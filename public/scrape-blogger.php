<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

$url = $input['url'] ?? $_POST['url'] ?? $_GET['url'] ?? '';

if (empty($url)) {
    http_response_code(400);
    echo json_encode(['error' => 'URL is required'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!preg_match('/^https?:\/\//i', $url)) {
    $url = 'https://' . $url;
}

/**
 * Universal text cleaner for Bengali (Bangla) & English text:
 * - Decodes URL percent encoding (%E0%A6...)
 * - Decodes Unicode escape sequences (\u09ac...)
 * - Decodes decimal, hex, and double-encoded HTML entities (&#2477;, &amp;#2477;)
 * - Detects and repairs UTF-8 to ISO-8859-1 / Windows-1252 Mojibake (à¦¬à¦¾à¦‚à¦²à¦¾ -> বাংলা)
 */
function cleanBloggerText($str) {
    if (empty($str)) return '';
    $curr = (string)$str;

    // 1. URL percent decoding if present
    if (preg_match('/%[0-9a-fA-F]{2}/', $curr)) {
        $curr = urldecode($curr);
    }

    // 2. Unicode escape sequences (e.g. \u09ac\u09be...)
    $curr = preg_replace_callback('/\\\\u([0-9a-fA-F]{4})/i', function($m) {
        return mb_chr(hexdec($m[1]), 'UTF-8');
    }, $curr);

    // 3. Multi-pass HTML entities decoding (handles double-encoded entities like &amp;#2477;)
    for ($i = 0; $i < 3; $i++) {
        $prev = $curr;
        $curr = html_entity_decode($curr, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Handle numeric entities if html_entity_decode missed any
        $curr = preg_replace_callback('/&#(\d+);/', function($m) {
            $code = intval($m[1]);
            return ($code > 0 && $code < 1114111) ? mb_chr($code, 'UTF-8') : $m[0];
        }, $curr);
        $curr = preg_replace_callback('/&#x([0-9a-fA-F]+);/i', function($m) {
            $code = hexdec($m[1]);
            return ($code > 0 && $code < 1114111) ? mb_chr($code, 'UTF-8') : $m[0];
        }, $curr);
        if ($curr === $prev) break;
    }

    // 4. Fix Mojibake: typical UTF-8 misinterpreted as ISO-8859-1 or Windows-1252 (e.g. strings containing à¦ or à§)
    if (strpos($curr, 'à¦') !== false || strpos($curr, 'à§') !== false || strpos($curr, 'Ã') !== false || strpos($curr, 'à') !== false) {
        $converted = @mb_convert_encoding($curr, 'ISO-8859-1', 'UTF-8');
        if ($converted !== false && mb_check_encoding($converted, 'UTF-8') && !empty($converted)) {
            $curr = $converted;
        } else {
            $converted2 = @iconv('UTF-8', 'Windows-1252//IGNORE', $curr);
            if ($converted2 !== false && mb_check_encoding($converted2, 'UTF-8') && !empty($converted2)) {
                $curr = $converted2;
            }
        }
    }

    // 5. Clean zero-width chars and normalize newlines
    $curr = preg_replace('/[\x{200B}-\x{200D}\x{FEFF}]/u', '', $curr);
    $curr = preg_replace("/\r\n|\r/", "\n", $curr);
    $curr = preg_replace("/[ \t]+/", " ", $curr);
    $curr = preg_replace("/\n{3,}/", "\n\n", $curr);
    return trim($curr);
}

function fetchPage($targetUrl) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $targetUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_ENCODING, ''); // Decompress gzip/deflate automatically
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    curl_setopt($ch, CURLOPT_COOKIE, 'adult_content_acknowledged=yes; blogspot_consent=yes; cf_clearance=yes');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9,bn;q=0.8',
        'Cache-Control: no-cache'
    ]);
    $html = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($html === false || $httpCode >= 400) {
        return '';
    }

    // Convert charset to UTF-8 if needed
    if (!empty($html) && !mb_check_encoding($html, 'UTF-8')) {
        $html = mb_convert_encoding($html, 'UTF-8', 'ISO-8859-1, Windows-1252, UTF-8');
    }

    return $html;
}

$html = fetchPage($url);

if (empty($html)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to fetch content from URL'], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. Extract Title
$title = '';
if (preg_match('/<meta\s+property=["\']og:title["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
    $title = cleanBloggerText($m[1]);
}
if (empty($title) && preg_match('/<meta\s+name=["\']twitter:title["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
    $title = cleanBloggerText($m[1]);
}
if (empty($title) && preg_match('/<(?:h1|h2|h3)[^>]*class=["\'][^"\']*(?:post-title|entry-title)[^"\']*["\'][^>]*>(.*?)<\/(?:h1|h2|h3)>/isu', $html, $m)) {
    $title = cleanBloggerText(strip_tags($m[1]));
}
if (empty($title) && preg_match('/<title[^>]*>(.*?)<\/title>/isu', $html, $m)) {
    $title = cleanBloggerText(strip_tags($m[1]));
}

// Clean Blogger suffixes and prefixes
$title = preg_replace('/\s*-\s*Blogger\s*$/iu', '', $title);
$title = preg_replace('/\s*\|\s*Blogger\s*$/iu', '', $title);
$title = preg_replace('/^(Blogger:\s*)/iu', '', $title);
$title = cleanBloggerText($title);

// Fallback to URL slug
$isInvalidTitle = empty($title) || 
    stripos($title, 'sensitive content') !== false || 
    strtolower($title) === 'blogger' || 
    strtolower($title) === 'untitled' || 
    mb_strlen($title) < 3;

if ($isInvalidTitle) {
    $parsedPath = parse_url($url, PHP_URL_PATH);
    if ($parsedPath) {
        $segments = array_filter(explode('/', $parsedPath));
        $last = end($segments);
        if ($last) {
            $rawSlug = preg_replace('/\.html?$/i', '', $last);
            $rawSlug = preg_replace('/[-_+]+/u', ' ', $rawSlug);
            $decoded = urldecode(trim($rawSlug));
            if (mb_strlen($decoded) > 2) {
                $title = ucwords($decoded);
            }
        }
    }
}
if (empty($title)) {
    $title = '';
}

// 2. Extract Description & Captions
$description = '';
if (preg_match('/<meta\s+property=["\']og:description["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
    $description = cleanBloggerText($m[1]);
}
if (empty($description) && preg_match('/<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
    $description = cleanBloggerText($m[1]);
}

// Helper to convert Blogger images to original full-resolution /s1600/
function toHighResBloggerImg($imgUrl) {
    if (empty($imgUrl)) return '';
    $trimmed = trim($imgUrl);
    if (strpos($trimmed, '//') === 0) $trimmed = 'https:' . $trimmed;
    if (strpos($trimmed, 'googleusercontent.com') !== false || strpos($trimmed, 'bp.blogspot.com') !== false) {
        $trimmed = preg_replace('/\/w[0-9]+-h[0-9]+-[^\/]+\//', '/s1600/', $trimmed);
        $trimmed = preg_replace('/\/s[0-9]+-c\//', '/s1600/', $trimmed);
        $trimmed = preg_replace('/\/s[0-9]+\//', '/s1600/', $trimmed);
    }
    return $trimmed;
}

// 2b. Check dedicated Blogger captions (.tr-caption, td.tr-caption, figcaption, .caption)
$captions = [];
if (preg_match_all('/<(?:td|div|p|span|figcaption)[^>]+class=["\'][^"\']*(?:tr-caption|caption)[^"\']*["\'][^>]*>(.*?)<\/(?:td|div|p|span|figcaption)>/isu', $html, $capMatches)) {
    foreach ($capMatches[1] as $c) {
        $cleanC = cleanBloggerText(strip_tags($c));
        if (mb_strlen($cleanC) > 2 && !in_array($cleanC, $captions)) {
            $captions[] = $cleanC;
        }
    }
}
if (!empty($captions)) {
    $joinedCaptions = implode("\n\n", $captions);
    $description = $joinedCaptions . (!empty($description) && strpos($description, $joinedCaptions) === false ? "\n\n" . $description : '');
}

$description = cleanBloggerText($description);

// 3. Extract Images (including anchor links wrapping original thumbnails)
$images = [];

// Anchor links wrapping high-res Blogger photos
if (preg_match_all('/<a[^>]+href=["\'](https?:\/\/[^"\']+\.(?:jpe?g|png|webp|gif)(?:\?[^"\']*)?)["\']/i', $html, $anchorMatches)) {
    foreach ($anchorMatches[1] as $aUrl) {
        $images[] = toHighResBloggerImg($aUrl);
    }
}

if (preg_match('/<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
    $images[] = toHighResBloggerImg(trim($m[1]));
}
if (preg_match('/<meta\s+name=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
    $images[] = toHighResBloggerImg(trim($m[1]));
}

if (preg_match_all('/<img[^>]+(?:data-src|data-original-url|src)=["\'](https?:\/\/[^"\']+)["\']/i', $html, $imgMatches)) {
    foreach ($imgMatches[1] as $imgUrl) {
        if (strpos($imgUrl, 'data:image') === false) {
            $images[] = toHighResBloggerImg($imgUrl);
        }
    }
}

// Filter out 1x1 gifs and icons
$cleanImages = [];
foreach ($images as $img) {
    $lower = strtolower($img);
    if (strpos($lower, 'blank.gif') === false && 
        strpos($lower, 'pixel.gif') === false && 
        strpos($lower, 'px.gif') === false && 
        strpos($lower, 'spinner') === false && 
        strlen($img) > 15) {
        $cleanImages[] = $img;
    }
}
$images = array_values(array_unique($cleanImages));

// 4. Extract Videos strictly from main post body
if (preg_match('/<div[^>]+class=["\'][^"\']*(?:post-body|entry-content)[^"\']*["\'][^>]*>(.*?)<\/div>\s*<div[^>]+class=["\']post-footer/isu', $html, $bodyMatch)) {
    $searchHtml = $bodyMatch[1];
} elseif (preg_match('/<div[^>]+class=["\'][^"\']*(?:post-body|entry-content)[^"\']*["\'][^>]*>(.*?)<\/div>/isu', $html, $bodyMatch)) {
    $searchHtml = $bodyMatch[1];
} else {
    $cleanHtml = preg_replace('/<(?:header|footer|nav|aside|script|style)[^>]*>.*?<\/(?:header|footer|nav|aside|script|style)>/isu', '', $html);
    $searchHtml = $cleanHtml;
}

$rawVideos = [];

// Look for iframe / embed sources
if (preg_match_all('/<(?:iframe|video|source|embed)[^>]+(?:src|data-src)=["\']([^"\']+)["\']/i', $searchHtml, $embedMatches)) {
    foreach ($embedMatches[1] as $src) {
        if (strpos($src, '//') === 0) $src = 'https:' . $src;
        $rawVideos[] = $src;
    }
}

// Direct links
if (preg_match_all('/<a[^>]+href=["\'](https?:\/\/[^"\']+)["\']/i', $searchHtml, $aMatches)) {
    foreach ($aMatches[1] as $href) {
        $rawVideos[] = $href;
    }
}

$videoPatterns = [
    '/https?:\/\/(?:www\.|draft\.)?blogger\.com\/video\.g\?[^\s"\'<>&]+/i',
    '/https?:\/\/(?:www\.)?(?:mega\.nz|mega\.co\.nz)\/[^\s"\'<>&]+/i',
    '/https?:\/\/(?:www\.)?(?:terabox\.com|teraboxapp\.com|1024tera\.com|1024terabox\.com|terasharelink\.com)\/[^\s"\'<>&]+/i',
    '/https?:\/\/drive\.google\.com\/file\/d\/[^\s"\'<>&]+/i',
    '/https?:\/\/[^\s"\'<>]+\.mp4(?:\?[^\s"\'<>]*)?/i'
];

foreach ($videoPatterns as $pat) {
    if (preg_match_all($pat, $searchHtml, $matches)) {
        foreach ($matches[0] as $v) {
            $rawVideos[] = $v;
        }
    }
}

$seenKeys = [];
$uniqueVideos = [];

foreach ($rawVideos as $raw) {
    $u = trim($raw, " \t\n\r\0\x0B'\"<>)");
    if (empty($u)) continue;
    $lower = strtolower($u);

    // Ignore ad networks & social
    if (strpos($lower, 'doubleclick') !== false ||
        strpos($lower, 'googleads') !== false ||
        strpos($lower, 'adsterra') !== false ||
        strpos($lower, 'exoclick') !== false ||
        strpos($lower, 'propeller') !== false ||
        strpos($lower, 'popads') !== false ||
        strpos($lower, 'trafficjunkie') !== false ||
        strpos($lower, 't.me/') !== false ||
        strpos($lower, 'facebook.com/') !== false ||
        strpos($lower, 'youtube.com/channel') !== false) {
        continue;
    }

    $key = null;
    $finalUrl = $u;

    if (strpos($lower, 'blogger.com/video') !== false) {
        if (preg_match('/token=([a-zA-Z0-9_\-]+)/', $u, $m)) {
            $key = 'blogger_' . $m[1];
            $finalUrl = 'https://www.blogger.com/video.g?token=' . $m[1];
        } else {
            $key = 'blogger_' . $u;
        }
    } elseif (strpos($lower, 'mega.nz') !== false || strpos($lower, 'mega.co.nz') !== false) {
        if (preg_match('/mega\.(?:nz|co\.nz)\/(?:file\/|embed\/|\#\!|\#)([a-zA-Z0-9_\-]+)/', $u, $m)) {
            $key = 'mega_' . $m[1];
        } else {
            $key = 'mega_' . $u;
        }
    } elseif (strpos($lower, 'terabox') !== false || strpos($lower, '1024tera') !== false) {
        if (preg_match('/(?:s\/|surl=)([a-zA-Z0-9_\-]+)/', $u, $m)) {
            $key = 'terabox_' . $m[1];
        } else {
            $key = 'terabox_' . $u;
        }
    } elseif (strpos($lower, 'drive.google.com') !== false) {
        if (preg_match('/\/d\/([a-zA-Z0-9_\-]+)/', $u, $m)) {
            $key = 'gdrive_' . $m[1];
            $finalUrl = 'https://drive.google.com/file/d/' . $m[1] . '/preview';
        } else {
            $key = 'gdrive_' . $u;
        }
    } elseif (strpos($lower, '.mp4') !== false) {
        if (strpos($lower, 'intro') !== false || strpos($lower, 'loader') !== false || strpos($lower, 'blank') !== false) {
            continue;
        }
        $key = 'mp4_' . explode('?', $u)[0];
    }

    if ($key && !isset($seenKeys[$key])) {
        $seenKeys[$key] = true;
        $uniqueVideos[] = $finalUrl;
    }
}

echo json_encode([
    'title' => $title,
    'description' => $description,
    'caption' => $description,
    'images' => $images,
    'videos' => $uniqueVideos
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
