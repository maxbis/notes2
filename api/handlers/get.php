<?php
// GET request handler
// Note: database.php and error_handler.php are already loaded by api.php,
// but we require them here for safety in case this file is called directly

if (!function_exists('__notes_json_error') || !function_exists('__notes_db_fail')) {
    require_once __DIR__ . '/../error_handler.php';
}
if (!function_exists('getDBConnection') || !function_exists('fetch_assoc_from_stmt')) {
    require_once __DIR__ . '/../database.php';
}
if (!function_exists('get_setting')) {
    require_once __DIR__ . '/../settings_helper.php';
}
if (!function_exists('attach_tags_to_note')) {
    require_once __DIR__ . '/../tags_helper.php';
}
if (!function_exists('normalize_note_pinned')) {
    require_once __DIR__ . '/../pin_helper.php';
}

function handle_get(mysqli $conn): void {
    if (isset($_GET['id'])) {
        // Get single note by hash_id
        $hash_id = $_GET['id'];
        $fields = isset($_GET['fields']) ? $_GET['fields'] : '';
        if ($fields === 'version,updated_at') {
            $stmt = $conn->prepare("SELECT version, updated_at FROM notes WHERE hash_id = ?");
        } else {
            $stmt = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
        }
        if (!$stmt) __notes_db_fail($conn, 'prepare: select by hash_id');
        $stmt->bind_param("s", $hash_id);
        if (!$stmt->execute()) __notes_db_fail($conn, 'execute: select by hash_id');

        $note = attach_tags_to_note($conn, fetch_assoc_from_stmt($stmt));
        echo json_encode($note ? $note : ['error' => 'Note not found'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        // Get all notes and public "easy access" default
        $result = $conn->query("SELECT id, hash_id, title, content, is_pinned, created_at, updated_at, version FROM notes ORDER BY updated_at DESC");
        if ($result === false) __notes_db_fail($conn, 'query: select all notes');
        $notes = [];
        while ($row = $result->fetch_assoc()) {
            $notes[] = $row;
        }
        $publicDefaultHashId = get_setting($conn, 'public_default_hash_id');
        $payload = [
            'notes' => attach_tags_to_notes($conn, $notes),
            'public_default_hash_id' => $publicDefaultHashId !== null && $publicDefaultHashId !== '' ? $publicDefaultHashId : null
        ];
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
