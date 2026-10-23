<?php
/**
 * IECZA · api/contacto.php
 * Handler de solicitudes de cotización (leads).
 * - Valida los datos del formulario del index.
 * - Filtra spam con honeypot ("website").
 * - Envía correo a ventas y respalda en /data/leads.log.
 * - Responde JSON (fetch) o redirige (POST sin JS).
 *
 * Producción: ajusta $CONFIG['to'] y $CONFIG['from'] y asegura mail()/SMTP.
 */

declare(strict_types=1);

$CONFIG = [
    'to'       => 'ventas@iec.com.mx',
    'from'     => 'no-reply@iec.com.mx',
    'subject'  => 'Nuevo lead desde la web IEC COMUNICACIONES',
    'log_file' => __DIR__ . '/../data/leads.log',
    'redirect' => '../index.html',
];

function wants_json(): bool {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $xrw    = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
    return strpos($accept, 'application/json') !== false || strtolower($xrw) === 'fetch';
}

function respond(bool $ok, string $message, array $cfg, int $code = 200): void {
    if (wants_json()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    } else {
        $status = $ok ? 'ok' : 'error';
        header('Location: ' . $cfg['redirect'] . '?contacto=' . $status . '#contacto', true, 303);
    }
    exit;
}

function clean(string $value): string {
    return trim(filter_var($value, FILTER_SANITIZE_FULL_SPECIAL_CHARS));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(false, 'Método no permitido.', $CONFIG, 405);
}

if (!empty($_POST['website'])) {
    respond(true, 'Gracias, te contactaremos pronto.', $CONFIG);
}

$name    = clean($_POST['name']  ?? '');
$phone   = clean($_POST['phone'] ?? '');
$email   = trim($_POST['email'] ?? '');
$service = clean($_POST['service'] ?? '');

$errors = [];
if ($name === '' || mb_strlen($name) < 2) { $errors[] = 'Ingresa tu nombre.'; }
$digits = preg_replace('/\D/', '', $phone);
if (strlen($digits) < 7) { $errors[] = 'Ingresa un teléfono válido.'; }
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'El correo no es válido.'; }

if (!empty($errors)) {
    respond(false, implode(' ', $errors), $CONFIG, 422);
}

$body = implode("\n", [
    "Nueva solicitud de cotización (IECZA web):",
    "",
    "Nombre/Empresa: {$name}",
    "Teléfono:       {$phone}",
    "Correo:         " . ($email !== '' ? $email : '(no proporcionado)'),
    "Servicio:       " . ($service !== '' ? $service : '(no especificado)'),
    "IP:             " . ($_SERVER['REMOTE_ADDR'] ?? 'desconocida'),
    "Fecha:          " . date('Y-m-d H:i:s'),
]);

$headers = [
    'From: IECZA Web <' . $CONFIG['from'] . '>',
    'Content-Type: text/plain; charset=utf-8',
];
if ($email !== '') { $headers[] = 'Reply-To: ' . $email; }

@mkdir(dirname($CONFIG['log_file']), 0775, true);
@file_put_contents($CONFIG['log_file'], $body . "\n" . str_repeat('-', 40) . "\n", FILE_APPEND | LOCK_EX);

@mail(
    $CONFIG['to'],
    '=?UTF-8?B?' . base64_encode($CONFIG['subject']) . '?=',
    $body,
    implode("\r\n", $headers)
);

respond(true, '¡Gracias, ' . $name . '! Un asesor te contactará muy pronto.', $CONFIG);
