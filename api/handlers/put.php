<?php
// PUT request handler - Update existing note

require_once __DIR__ . '/../database.php';
require_once __DIR__ . '/../error_handler.php';
require_once __DIR__ . '/../sanitize.php';
require_once __DIR__ . '/../config.php'; // HTML sanitization config
require_once __DIR__ . '/../utils.php';

function handle_put(mysqli $conn): void {
    global $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS;
    
    // Update existing note
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) && json_last_error() !== JSON_ERROR_NONE) {
        __notes_json_error(400, 'Invalid JSON');
    }
    $hash_id = $data['hash_id'];
    $title = $data['title'] ?? '';
    $content = $data['content'] ?? '';
    $content = sanitize_note_html($content, $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS);

    $expected_version = isset($data['expected_version']) ? (int)$data['expected_version'] : null;
    $forceOverwrite = false;
    if (isset($_GET['force']) && $_GET['force'] === '1') $forceOverwrite = true;
    if (isset($data['force_overwrite']) && $data['force_overwrite']) $forceOverwrite = true;
    
    if (!$forceOverwrite && $expected_version === null) {
        http_response_code(400);
        echo json_encode(['error' => 'expected_version is required']);
        return;
    }

    // Fetch current server version (needed for conflict responses and overwrite-copy logic)
    $stmtCurrent = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
    if (!$stmtCurrent) __notes_db_fail($conn, 'prepare: select current note');
    $stmtCurrent->bind_param("s", $hash_id);
    if (!$stmtCurrent->execute()) __notes_db_fail($conn, 'execute: select current note');

    $serverNote = fetch_assoc_from_stmt($stmtCurrent);
    if (!$serverNote) {
        http_response_code(404);
        echo json_encode(['error' => 'Note not found']);
        return;
    }
    $serverVersion = isset($serverNote['version']) ? (int)$serverNote['version'] : null;

    if (!$forceOverwrite) {
        // Optimistic lock update: only update if the version matches expected_version
        $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ?, version = version + 1 WHERE hash_id = ? AND version = ?");
        if (!$stmt) __notes_db_fail($conn, 'prepare: optimistic update');
        $stmt->bind_param("sssi", $title, $content, $hash_id, $expected_version);

        if (!$stmt->execute()) {
            __notes_db_fail($conn, 'execute: optimistic update');
        }

        if ($stmt->affected_rows === 0) {
            http_response_code(409);
            $behind_by = 0;
            if ($serverVersion !== null && $expected_version !== null) {
                $behind_by = max(0, $serverVersion - $expected_version);
            }
            echo json_encode([
                'error' => 'conflict',
                'server_version' => $serverVersion,
                'expected_version' => $expected_version,
                'behind_by' => $behind_by,
                'updated_at' => $serverNote['updated_at'] ?? null,
                'title' => $serverNote['title'] ?? null,
                'content' => $serverNote['content'] ?? null,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            return;
        }
    } else {
        // Force overwrite path: only make a copy if we are behind (server_version > expected_version)
        if ($expected_version !== null && $serverVersion !== null && $serverVersion > $expected_version) {
            $copy_hash_id = generateHashId();
            $copy_title = ($serverNote['title'] ?? '') . ' (version overwritten)';
            $copy_content = $serverNote['content'] ?? '';

            $stmtCopy = $conn->prepare("INSERT INTO notes (hash_id, title, content, version) VALUES (?, ?, ?, 1)");
            if (!$stmtCopy) __notes_db_fail($conn, 'prepare: insert overwrite copy');
            $stmtCopy->bind_param("sss", $copy_hash_id, $copy_title, $copy_content);
            if (!$stmtCopy->execute()) __notes_db_fail($conn, 'execute: insert overwrite copy');
        }

        // Overwrite the original note unconditionally (but still bump version)
        $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ?, version = version + 1 WHERE hash_id = ?");
        if (!$stmt) __notes_db_fail($conn, 'prepare: force overwrite update');
        $stmt->bind_param("sss", $title, $content, $hash_id);

        if (!$stmt->execute()) {
            __notes_db_fail($conn, 'execute: force overwrite update');
        }
    }

    // Return updated note
    $stmtReload = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
    if (!$stmtReload) __notes_db_fail($conn, 'prepare: reload updated note');
    $stmtReload->bind_param("s", $hash_id);
    if (!$stmtReload->execute()) __notes_db_fail($conn, 'execute: reload updated note');

    $note = fetch_assoc_from_stmt($stmtReload);
    echo json_encode($note, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}
