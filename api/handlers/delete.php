<?php
// DELETE request handler
// Note: error_handler.php is already loaded by api.php,
// but we require it here for safety in case this file is called directly

if (!function_exists('__notes_json_error') || !function_exists('__notes_db_fail')) {
    require_once __DIR__ . '/../error_handler.php';
}
if (!function_exists('get_setting') || !function_exists('set_setting')) {
    require_once __DIR__ . '/../settings_helper.php';
}

function handle_delete(mysqli $conn): void {
    // Delete note
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) && json_last_error() !== JSON_ERROR_NONE) {
        __notes_json_error(400, 'Invalid JSON');
    }
    $hash_id = isset($data['hash_id']) ? trim((string)$data['hash_id']) : '';
    if ($hash_id === '') {
        __notes_json_error(400, 'hash_id is required');
    }

    $wasDefaultPublished = get_setting($conn, 'public_default_hash_id') === $hash_id;
    
    $stmt = $conn->prepare("DELETE FROM notes WHERE hash_id = ?");
    if (!$stmt) __notes_db_fail($conn, 'prepare: delete note');
    $stmt->bind_param("s", $hash_id);
    
    if ($stmt->execute()) {
        if ($wasDefaultPublished && !set_setting($conn, 'public_default_hash_id', '')) {
            __notes_db_fail($conn, 'clear public default after delete');
        }
        $publicDefaultHashId = $wasDefaultPublished
            ? null
            : get_setting($conn, 'public_default_hash_id');
        echo json_encode([
            'success' => true,
            'public_default_hash_id' => $publicDefaultHashId !== null && $publicDefaultHashId !== ''
                ? $publicDefaultHashId
                : null
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        __notes_db_fail($conn, 'execute: delete note');
    }
}
