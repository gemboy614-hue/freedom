<?php
/* ФРИДОМ — обработчик формы обратной связи для обычного PHP-хостинга (sweb).
   Принимает POST JSON {name, phone, topic, message}, отправляет письмо
   через Resend (https://resend.com) и отвечает {"ok": true|false}. */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'not_configured']);
    exit;
}
$config = require $configPath;

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?: [];

function fd_str($v, $maxLen) {
    $v = trim((string) $v);
    return function_exists('mb_substr') ? mb_substr($v, 0, $maxLen) : substr($v, 0, $maxLen);
}

$name = fd_str($data['name'] ?? '', 120);
$phone = fd_str($data['phone'] ?? '', 40);
$topic = fd_str($data['topic'] ?? '', 120);
$message = fd_str($data['message'] ?? '', 2000);

$phoneDigits = preg_replace('/\D/', '', $phone);
if ($name === '' || strlen($phoneDigits) < 7) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_input']);
    exit;
}

$html = '<h2>Новая заявка с сайта ФРИДОМ</h2>'
    . '<p><b>Имя:</b> ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</p>'
    . '<p><b>Телефон:</b> ' . htmlspecialchars($phone, ENT_QUOTES, 'UTF-8') . '</p>'
    . '<p><b>Интересует:</b> ' . htmlspecialchars($topic !== '' ? $topic : '—', ENT_QUOTES, 'UTF-8') . '</p>'
    . '<p><b>Сообщение:</b><br>' . nl2br(htmlspecialchars($message !== '' ? $message : '—', ENT_QUOTES, 'UTF-8')) . '</p>';

$payload = json_encode([
    'from' => $config['MAIL_FROM'],
    'to' => [$config['MAIL_TO']],
    'subject' => 'Заявка с сайта ФРИДОМ: ' . $name,
    'html' => $html,
]);

$authHeader = 'Authorization: Bearer ' . $config['RESEND_API_KEY'] . "\r\nContent-Type: application/json";

if (function_exists('curl_init')) {
    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $config['RESEND_API_KEY'],
            'Content-Type: application/json',
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $requestError = curl_error($ch);
    curl_close($ch);
} else {
    // Fallback for hosting without the curl extension enabled.
    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => $authHeader,
            'content' => $payload,
            'timeout' => 15,
            'ignore_errors' => true,
        ],
    ]);
    $response = @file_get_contents('https://api.resend.com/emails', false, $context);
    $status = 0;
    $requestError = $response === false ? (error_get_last()['message'] ?? 'unknown error') : '';
    if (isset($http_response_header)) {
        foreach ($http_response_header as $header) {
            if (preg_match('#^HTTP/\S+\s+(\d+)#', $header, $m)) { $status = (int) $m[1]; break; }
        }
    }
}

if ($response === false || $status < 200 || $status >= 300) {
    $detail = $requestError ?: $response;
    error_log('[api/callback] Resend error ' . $status . ': ' . $detail);
    http_response_code(502);
    // TODO: временно возвращаем подробности в ответе для отладки 502 на sweb.
    // Убрать поле "debug" из ответа, как только форма заработает нормально.
    echo json_encode(['ok' => false, 'error' => 'send_failed', 'debug' => ['status' => $status, 'detail' => $detail]]);
    exit;
}

echo json_encode(['ok' => true]);
