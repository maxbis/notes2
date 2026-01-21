<?php
// POST request handler - Create new note

require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../error_handler.php';
require_once __DIR__ . '/../sanitize.php';
require_once __DIR__ . '/../config.php'; // HTML sanitization config
require_once __DIR__ . '/../utils.php';

function handle_post(mysqli $conn): void {
    global $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS;
    
    // Create new note
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) && json_last_error() !== JSON_ERROR_NONE) {
        __notes_json_error(400, 'Invalid JSON');
    }
    $hash_id = generateHashId();
    $title = $data['title'] ?? 'Untitled';
    $content = $data['content'] ?? '';
    $content = sanitize_note_html($content, $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS);
    
    $stmt = $conn->prepare("INSERT INTO notes (hash_id, title, content) VALUES (?, ?, ?)");
    if (!$stmt) __notes_db_fail($conn, 'prepare: insert note');
    $stmt->bind_param("sss", $hash_id, $title, $content);
    
    if ($stmt->execute()) {
        $note_id = $conn->insert_id;
        $result = $conn->query("SELECT * FROM notes WHERE id = $note_id");
        if ($result === false) __notes_db_fail($conn, 'query: select inserted note');
        echo json_encode($result->fetch_assoc(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        __notes_db_fail($conn, 'execute: insert note');
    }
}
