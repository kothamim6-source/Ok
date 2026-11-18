<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$rawInput = file_get_contents('php://input');
$input = json_decode($rawInput, true);

if (!$input) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON payload']);
    exit;
}

$botToken = $input['providedBotToken'] ?? $input['botToken'] ?? '';
$chatId = $input['providedChatId'] ?? $input['chatId'] ?? $input['chat_id'] ?? '';

if (empty($botToken) || empty($chatId)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Bot token and Chat ID are required']);
    exit;
}

$title = $input['title'] ?? '';
$description = $input['description'] ?? '';
$telegramDescription = $input['telegramDescription'] ?? '';
$thumbnailUrl = $input['thumbnailUrl'] ?? $input['photo'] ?? '';
$videoLink = $input['videoLink'] ?? '';

$caption = $input['caption'] ?? '';
$text = $input['text'] ?? '';

// Build message caption if not explicitly provided
if (empty($caption) && empty($text)) {
    $rawTitle = !empty(trim($title)) ? trim($title) : 'New Viral Video';
    $safeTitle = htmlspecialchars($rawTitle, ENT_QUOTES, 'UTF-8');
    $msg = "<b>{$safeTitle}</b>\n\n";
    if (!empty($videoLink)) {
        $msg .= "🎬 <b>Watch Now / Share Link:</b>\n{$videoLink}\n\n";
    }
    $finalDesc = '';
    $descTrim = trim($description);
    $tgDescTrim = trim($telegramDescription);
    // If telegram-specific description is provided, use only it for Telegram post
    if (!empty($tgDescTrim)) {
        $finalDesc = $tgDescTrim;
    } elseif (!empty($descTrim)) {
        $finalDesc = $descTrim;
    }
    if (!empty($finalDesc)) {
        $msg .= htmlspecialchars($finalDesc, ENT_QUOTES, 'UTF-8');
    }
    $caption = mb_strlen($msg) > 1020 ? mb_substr($msg, 0, 1016) . '...' : $msg;
    $text = mb_strlen($msg) > 4000 ? mb_substr($msg, 0, 3996) . '...' : $msg;
}

$customApiUrl = $input['customApiUrl'] ?? $input['apiUrl'] ?? '';

function sendTelegramRequest($botToken, $method, $payload, $customApiUrl = '') {
    $baseApi = !empty($customApiUrl) ? rtrim($customApiUrl, '/') : 'https://api.telegram.org';
    $url = "{$baseApi}/bot{$botToken}/{$method}";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['code' => $httpCode, 'response' => json_decode($result, true), 'raw' => $result];
}

$success = false;
$error = '';

// If photo/thumbnail provided, try sendPhoto
if (!empty($thumbnailUrl)) {
    $photoPayload = [
        'chat_id' => $chatId,
        'photo' => $thumbnailUrl,
        'caption' => !empty($caption) ? $caption : $text,
        'parse_mode' => 'HTML'
    ];
    $res = sendTelegramRequest($botToken, 'sendPhoto', $photoPayload, $customApiUrl);
    if ($res['code'] === 200 && !empty($res['response']['ok'])) {
        $success = true;
    } else {
        $error = $res['response']['description'] ?? 'Photo send failed';
    }
}

// If photo failed or not provided, fallback to sendMessage
if (!$success) {
    $msgPayload = [
        'chat_id' => $chatId,
        'text' => !empty($text) ? $text : $caption,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => false
    ];
    $res = sendTelegramRequest($botToken, 'sendMessage', $msgPayload, $customApiUrl);
    if ($res['code'] === 200 && !empty($res['response']['ok'])) {
        $success = true;
    } else {
        $error = $res['response']['description'] ?? 'Message send failed';
    }
}

if ($success) {
    echo json_encode(['success' => true]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $error]);
}
