<?php
// Set headers
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

// Disable default HTML error display so JSON output remains clean
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Set execution time limit safely
@set_time_limit(30);

// Global exception and error handler returning clean JSON
set_error_handler(function ($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) return false;
    echo json_encode([
        'status' => 'error',
        'type' => 'php_error',
        'message' => $errstr,
        'line' => $errline
    ], JSON_PRETTY_PRINT);
    exit;
});

set_exception_handler(function (Throwable $e) {
    echo json_encode([
        'status' => 'error',
        'type' => 'exception',
        'message' => $e->getMessage(),
        'line' => $e->getLine()
    ], JSON_PRETTY_PRINT);
    exit;
});

// Quick ping / health-check test
if (isset($_GET['test']) || isset($_GET['ping'])) {
    echo json_encode([
        'status' => 'ok',
        'message' => 'Cron script is alive and functional!',
        'php_version' => PHP_VERSION,
        'time' => date('Y-m-d H:i:s'),
        'curl_available' => function_exists('curl_init')
    ], JSON_PRETTY_PRINT);
    exit;
}

// Configuration (set via environment variables or hosting config)
$supabaseUrl = getenv('VITE_SUPABASE_URL') ?: (getenv('SUPABASE_URL') ?: '');
$supabaseAnonKey = getenv('VITE_SUPABASE_ANON_KEY') ?: (getenv('SUPABASE_ANON_KEY') ?: '');

if (empty($supabaseUrl) || empty($supabaseAnonKey)) {
    echo json_encode(['status' => 'error', 'message' => 'Supabase credentials not configured']);
    exit;
}

function supabaseRequest($endpoint, $method = 'GET', $body = null) {
    global $supabaseUrl, $supabaseAnonKey;
    $url = rtrim($supabaseUrl, '/') . '/rest/v1/' . ltrim($endpoint, '/');
    $ch = curl_init($url);
    if (!$ch) {
        return ['code' => 0, 'data' => null, 'error' => 'curl_init failed'];
    }
    
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) StreamHubCron/2.0');
    
    $headers = [
        'apikey: ' . $supabaseAnonKey,
        'Authorization: Bearer ' . $supabaseAnonKey,
        'Content-Type: application/json',
        'Prefer: return=representation'
    ];
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);
    
    if ($response === false) {
        return ['code' => $httpCode, 'data' => null, 'error' => $curlErr];
    }
    
    return [
        'code' => $httpCode,
        'data' => json_decode($response, true)
    ];
}

function safeSubstr($str, $start, $len) {
    if (function_exists('mb_substr')) {
        return mb_substr($str, $start, $len, 'UTF-8');
    }
    return substr($str, $start, $len);
}

function sendTg($botToken, $chatId, $photo, $caption, $customApiUrl = '') {
    if (empty($botToken) || empty($chatId)) return false;
    
    $baseApi = !empty($customApiUrl) ? rtrim($customApiUrl, '/') : 'https://api.telegram.org';
    $url = !empty($photo) 
        ? "{$baseApi}/bot{$botToken}/sendPhoto"
        : "{$baseApi}/bot{$botToken}/sendMessage";
        
    $payload = !empty($photo) 
        ? [
            'chat_id' => $chatId,
            'photo' => $photo,
            'caption' => safeSubstr($caption, 0, 1020),
            'parse_mode' => 'HTML'
        ]
        : [
            'chat_id' => $chatId,
            'text' => safeSubstr($caption, 0, 4000),
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => false
        ];
        
    $ch = curl_init($url);
    if (!$ch) return false;
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    $res = curl_exec($ch);
    curl_close($ch);
    
    $json = json_decode($res, true);
    return !empty($json['ok']);
}

$now = round(microtime(true) * 1000);

function tryAcquireTelegramLockPhp($lockKey, $ttlMs = 86400000) {
    global $now;
    $logRes = supabaseRequest('settings?id=eq.telegram_posted_log&select=*');
    $logRow = (!empty($logRes['data']) && is_array($logRes['data']) && isset($logRes['data'][0])) ? $logRes['data'][0] : null;
    $locks = [];
    if (!empty($logRow['data'])) {
        $logData = $logRow['data'];
        if (is_string($logData)) {
            $logData = json_decode($logData, true) ?: [];
        }
        if (is_array($logData)) {
            $locks = $logData['locks'] ?? $logData['postedIds'] ?? [];
            if (!is_array($locks)) $locks = [];
        }
    }

    $remoteTime = $locks[$lockKey] ?? null;
    if (!empty($remoteTime) && ($now - $remoteTime < $ttlMs)) {
        return false; // Already locked or posted!
    }

    $locks[$lockKey] = $now;
    $cutoff = $now - (7 * 86400000);
    $cleaned = [];
    foreach ($locks as $k => $ts) {
        if (is_numeric($ts) && $ts > $cutoff) {
            $cleaned[$k] = (float)$ts;
        }
    }

    if (!empty($logRow)) {
        supabaseRequest('settings?id=eq.telegram_posted_log', 'PATCH', [
            'data' => [
                'locks' => $cleaned,
                'updatedAt' => $now
            ]
        ]);
    } else {
        supabaseRequest('settings', 'POST', [
            'id' => 'telegram_posted_log',
            'data' => [
                'locks' => $cleaned,
                'updatedAt' => $now
            ]
        ]);
    }

    return true;
}

$results = [
    'time' => date('Y-m-d H:i:s'),
    'published_videos' => [],
    'scheduled_text_posts' => []
];

// 1. Fetch Telegram Secrets
$secretsRes = supabaseRequest('settings?id=eq.telegram_secrets&select=*');
$secretsRow = (!empty($secretsRes['data']) && is_array($secretsRes['data']) && isset($secretsRes['data'][0])) 
    ? $secretsRes['data'][0] 
    : [];

$secretsData = $secretsRow['data'] ?? [];
if (is_string($secretsData)) {
    $secretsData = json_decode($secretsData, true) ?: [];
}
if (!is_array($secretsData)) {
    $secretsData = [];
}

$botToken = $secretsData['botToken'] ?? '';
$chatId = $secretsData['channelId'] ?? '';
$defaultDesc = $secretsData['defaultDescription'] ?? '';
$customApiUrl = $secretsData['customApiUrl'] ?? '';

$categoryChannels = (!empty($secretsData['categoryChannels']) && is_array($secretsData['categoryChannels'])) 
    ? $secretsData['categoryChannels'] 
    : [];

function normalizeTgChatIdPhp($raw) {
    $raw = trim((string)$raw);
    if ($raw === '') return '';
    if (preg_match('/^-?\d+$/', $raw)) return $raw;
    if (preg_match('/(t\.me\/(\+|joinchat\/)|telegram\.me\/(\+|joinchat\/))/i', $raw)) return '';
    $clean = preg_replace('/^https?:\/\/(www\.)?(t\.me|telegram\.me|telegram\.dog)\//i', '', $raw);
    $clean = preg_replace('/^(t\.me|telegram\.me|telegram\.dog)\//i', '', $clean);
    $parts = preg_split('/[?#\/]/', $clean);
    $handle = trim($parts[0] ?? '');
    if ($handle === '') return '';
    return ($handle[0] === '@') ? $handle : ('@' . $handle);
}

function resolveVideoChannelsPhp($catRaw, $categoryChannels, $fallbackChatId) {
    $resolved = [];
    $fallbackNorm = normalizeTgChatIdPhp($fallbackChatId);
    $cats = array_filter(array_map('trim', explode(',', (string)$catRaw)));

    if (!empty($cats)) {
        foreach ($cats as $cat) {
            $matched = '';
            $catLower = strtolower($cat);
            foreach ($categoryChannels as $k => $v) {
                if (strtolower(trim((string)$k)) === $catLower && !empty($v)) {
                    $matched = normalizeTgChatIdPhp($v);
                    break;
                }
            }
            $ch = $matched !== '' ? $matched : $fallbackNorm;
            if ($ch !== '' && !in_array($ch, $resolved, true)) {
                $resolved[] = $ch;
            }
        }
    }

    if (empty($resolved) && $fallbackNorm !== '') {
        $resolved[] = $fallbackNorm;
    }
    return $resolved;
}

// Determine site URL from host
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$siteUrl = isset($_SERVER['HTTP_HOST']) ? $protocol . $_SERVER['HTTP_HOST'] : (getenv('APP_URL') ?: '');

// 2. Check and Publish Scheduled Videos
$videoRes = supabaseRequest("videos?status=eq.scheduled&created_at=lte.{$now}&select=*");
if (!empty($videoRes['data']) && is_array($videoRes['data'])) {
    foreach ($videoRes['data'] as $video) {
        if (!is_array($video) || empty($video['id'])) {
            continue;
        }
        $vId = $video['id'];
        $acquired = tryAcquireTelegramLockPhp("video_{$vId}");
        if (!$acquired) {
            continue; // Already processed
        }
        
        // Update video status to published atomically
        $upd = supabaseRequest("videos?id=eq.{$vId}&status=eq.scheduled", 'PATCH', ['status' => 'published']);
        if (empty($upd['data'])) {
            continue; // Already claimed by node-cron or browser task
        }

        $results['published_videos'][] = $video['title'] ?? $vId;
        
        // Send to Telegram (category-wise channels)
        $videoCat = $video['category_id'] ?? $video['categoryId'] ?? $video['category'] ?? '';
        $targetChannels = resolveVideoChannelsPhp($videoCat, $categoryChannels, $chatId);
        if (!empty($botToken) && !empty($targetChannels)) {
            $vTitle = htmlspecialchars($video['title'] ?? '', ENT_QUOTES, 'UTF-8');
            $vLink = "{$siteUrl}/video/{$vId}";
            $caption = "<b>{$vTitle}</b>\n\n🎬 <b>Watch Now / Share Link:</b>\n{$vLink}\n\n";
            $desc = !empty($defaultDesc) ? $defaultDesc : ($video['description'] ?? '');
            if (!empty($desc)) {
                $caption .= htmlspecialchars($desc, ENT_QUOTES, 'UTF-8');
            }
            $thumb = $video['thumbnail_url'] ?? $video['thumbnailUrl'] ?? '';
            foreach ($targetChannels as $targetCh) {
                sendTg($botToken, $targetCh, $thumb, $caption, $customApiUrl);
            }
        }
    }
}

// 3. Process Scheduled Text Posts
$textPostsRes = supabaseRequest('settings?id=eq.scheduled_text_posts&select=*');
if (!empty($textPostsRes['data']) && is_array($textPostsRes['data']) && !empty($botToken) && !empty($chatId)) {
    $row = $textPostsRes['data'][0] ?? null;
    if (is_array($row)) {
        $rowData = $row['data'] ?? [];
        if (is_string($rowData)) {
            $rowData = json_decode($rowData, true) ?: [];
        }
        $posts = (is_array($rowData) && isset($rowData['posts']) && is_array($rowData['posts'])) 
            ? $rowData['posts'] 
            : [];
            
        $updated = false;
        $bdToday = gmdate('Y-m-d', (int)($now / 1000) + (6 * 3600));
        
        foreach ($posts as $idx => &$post) {
            if (!is_array($post)) continue;
            
            if (($post['status'] ?? '') === 'pending' && ($post['scheduledFor'] ?? 0) <= $now) {
                $postId = $post['id'] ?? $idx;
                $isDaily = !empty($post['isDaily']);

                if (!empty($post['lastPostedAt'])) {
                    $lastBD = gmdate('Y-m-d', (int)($post['lastPostedAt'] / 1000) + (6 * 3600));
                    if ($lastBD === $bdToday) {
                        continue; // Already posted today
                    }
                }

                $lockKey = $isDaily ? "text_post_daily_{$postId}_{$bdToday}" : "text_post_{$postId}";
                $acquired = tryAcquireTelegramLockPhp($lockKey);
                if (!$acquired) {
                    continue;
                }

                $ok = sendTg($botToken, $chatId, '', $post['textContent'] ?? '', $customApiUrl);
                if ($ok) {
                    $post['lastPostedAt'] = $now;
                    if ($isDaily) {
                        $post['scheduledFor'] += 24 * 60 * 60 * 1000;
                        $post['status'] = 'pending';
                    } else {
                        $post['status'] = 'posted';
                    }
                } else {
                    $post['status'] = 'failed';
                }
                $updated = true;
                $results['scheduled_text_posts'][] = "Post #{$idx} (" . ($post['status']) . ")";
            }
        }
        unset($post); // Break reference
        
        if ($updated) {
            supabaseRequest('settings?id=eq.scheduled_text_posts', 'PATCH', [
                'data' => [
                    'posts' => $posts,
                    'updatedAt' => $now
                ]
            ]);
        }
    }
}

// 4. Daily Auto-Gift Process removed - gifting is now exclusively triggered manually by admin on button click

echo json_encode([
    'status' => 'ok',
    'result' => $results
], JSON_PRETTY_PRINT);
