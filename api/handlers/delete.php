<?php
// DELETE request handler
// Note: error_handler.php is already loaded by api.php,
// but we require it here for safety in case this file is called directly

if (!function_exists('__notes_json_error') || !function_exists('__notes_db_fail')) {
    require_once __DIR__ . '/../error_handler.php';
}

function handle_delete(mysqli $conn): void {
    // Delete note
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) && json_last_error() !== JSON_ERROR_NONE) {
        __notes_json_error(400, 'Invalid JSON');
    }
    $hash_id = $data['hash_id'];
    
    $stmt = $conn->prepare("DELETE FROM notes WHERE hash_id = ?");
    if (!$stmt) __notes_db_fail($conn, 'prepare: delete note');
    $stmt->bind_param("s", $hash_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        __notes_db_fail($conn, 'execute: delete note');
    }
}
