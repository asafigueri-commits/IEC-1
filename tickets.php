<?php
/**
 * IECZA · api/tickets.php
 * Recepción de tickets de soporte desde el Portal de Clientes.
 * - Valida asunto y descripción.
 * - Filtra spam con honeypot ("website").
 * - Notifica al NOC y respalda en /data/tickets.log.
 * - Responde JSON con un folio de ticket generado.
 */

declare(strict_types=1);

$CONFIG = [
    'to'       => 'soporte@iec.com.mx',
    'from'     => 'no-reply@iec.com.mx',
    'log_file' => __DIR__ . '/../data/tickets.log',
];

function json_out(bool $ok, string $message, int $code = 200, array $extra = []): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(array_merge(['ok' => $ok, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

function clean(string $value): string {
    return trim(filter_var($value, FILTER_SANITIZE_FULL_SPECIAL_CHARS));
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(false, 'Método no permitido.', 405);
}

if (!empty($_POST['website'])) {
    json_out(true, 'Ticket recibido.', 200, ['ticket' => 'TK-0000']);
}

$subject  = clean($_POST['subject'] ?? '');
$category = clean($_POST['category'] ?? 'otro');
$priority = clean($_POST['priority'] ?? 'media');
$bodyTxt  = trim($_POST['body'] ?? '');

$errors = [];
if ($subject === '' || mb_strlen($subject) < 3) { $errors[] = 'Asunto inválido.'; }
if ($bodyTxt === '' || mb_strlen($bodyTxt) < 5) { $errors[] = 'Describe el problema.'; }
if (!empty($errors)) {
    json_out(false, implode(' ', $errors), 422);
}

$ticketId = 'TK-' . str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);

$record = implode("\n", [
    "Ticket {$ticketId}",
    "Asunto:      {$subject}",
    "Categoría:   {$category}",
    "Prioridad:   {$priority}",
    "Descripción: " . strip_tags($bodyTxt),
    "IP:          " . ($_SERVER['REMOTE_ADDR'] ?? 'desconocida'),
    "Fecha:       " . date('Y-m-d H:i:s'),
]);

$headers = [
    'From: IECZA Portal <' . $CONFIG['from'] . '>',
    'Content-Type: text/plain; charset=utf-8',
];

@mkdir(dirname($CONFIG['log_file']), 0775, true);
@file_put_contents($CONFIG['log_file'], $record . "\n" . str_repeat('-', 40) . "\n", FILE_APPEND | LOCK_EX);

@mail(
    $CONFIG['to'],
    '=?UTF-8?B?' . base64_encode("Nuevo ticket {$ticketId}: {$subject}") . '?=',
    $record,
    implode("\r\n", $headers)
);

json_out(true, "Ticket {$ticketId} registrado. Nuestro NOC le dará seguimiento.", 200, ['ticket' => $ticketId]);
