<?php
// GET request handler

require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../error_handler.php';

function handle_get(mysqli $conn): void {
    if (isset($_GET['id'])) {
        // Get single note by hash_id
        $hash_id = $_GET['id'];
        $stmt = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
        if (!$stmt) __notes_db_fail($conn, 'prepare: select by hash_id');
        $stmt->bind_param("s", $hash_id);
        if (!$stmt->execute()) __notes_db_fail($conn, 'execute: select by hash_id');

        $note = fetch_assoc_from_stmt($stmt);
        echo json_encode($note ? $note : ['error' => 'Note not found'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } else {
        // Get all notes
        $result = $conn->query("SELECT id, hash_id, title, content, created_at, updated_at, version FROM notes ORDER BY updated_at DESC");
        if ($result === false) __notes_db_fail($conn, 'query: select all notes');
        $notes = [];
        while ($row = $result->fetch_assoc()) {
            $notes[] = $row;
        }
        echo json_encode($notes, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
