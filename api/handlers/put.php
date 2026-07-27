<?php
// PUT request handler - Update existing note
// Note: database.php, error_handler.php, sanitize.php, config.php (HTML), and utils.php 
// are already loaded by api.php, but we require them here for safety in case this file is called directly

if (!function_exists('__notes_json_error') || !function_exists('__notes_db_fail')) {
    require_once __DIR__ . '/../error_handler.php';
}
if (!function_exists('getDBConnection')) {
    require_once __DIR__ . '/../database.php';
}
if (!function_exists('sanitize_note_html')) {
    require_once __DIR__ . '/../sanitize.php';
}
if (!isset($ALLOWED_TAGS)) {
    require_once __DIR__ . '/../config.php'; // HTML sanitization config
}
if (!function_exists('generateHashId')) {
    require_once __DIR__ . '/../utils.php';
}
if (!function_exists('set_setting')) {
    require_once __DIR__ . '/../settings_helper.php';
}
if (!function_exists('replace_note_tags')) {
    require_once __DIR__ . '/../tags_helper.php';
}
if (!function_exists('normalize_note_pinned')) {
    require_once __DIR__ . '/../pin_helper.php';
}

function handle_put(mysqli $conn): void {
    global $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS;
    
    // Update existing note or settings (e.g. public_default_hash_id)
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data) && json_last_error() !== JSON_ERROR_NONE) {
        __notes_json_error(400, 'Invalid JSON');
    }
    if (array_key_exists('set_public_default', $data)) {
        $value = $data['set_public_default'];
        $hashId = (is_string($value) && $value !== '') ? $value : null;
        if ($hashId !== null) {
            $stmtDefaultCandidate = $conn->prepare(
                "SELECT hash_id FROM notes
                 WHERE hash_id = ? AND is_published = 1 AND public_token IS NOT NULL
                 LIMIT 1"
            );
            if (!$stmtDefaultCandidate) __notes_db_fail($conn, 'prepare: validate public default');
            $stmtDefaultCandidate->bind_param("s", $hashId);
            if (!$stmtDefaultCandidate->execute()) __notes_db_fail($conn, 'execute: validate public default');
            if (!fetch_assoc_from_stmt($stmtDefaultCandidate)) {
                __notes_json_error(409, 'Only a published note can be used as the default public note');
            }

            if (!set_setting($conn, 'public_default_hash_id', $hashId)) {
                __notes_db_fail($conn, 'save public default');
            }
        } else {
            if (!set_setting($conn, 'public_default_hash_id', '')) {
                __notes_db_fail($conn, 'clear public default');
            }
        }

        $storedHashId = get_setting($conn, 'public_default_hash_id');
        $expectedHashId = $hashId ?? '';
        if ($storedHashId !== $expectedHashId) {
            __notes_json_error(500, 'Default public note setting was not saved');
        }

        echo json_encode([
            'ok' => true,
            'public_default_hash_id' => $storedHashId !== '' ? $storedHashId : null
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return;
    }
    if (array_key_exists('set_sharing', $data) && is_array($data['set_sharing'] ?? null)) {
        $payload = $data['set_sharing'];
        $hashId = isset($payload['hash_id']) ? trim((string)$payload['hash_id']) : '';
        $action = isset($payload['action']) ? (string)$payload['action'] : '';
        if ($hashId === '') {
            __notes_json_error(400, 'hash_id is required');
        }
        if (!in_array($action, ['publish', 'disable', 'regenerate'], true)) {
            __notes_json_error(400, 'Invalid sharing action');
        }

        if ($action === 'disable') {
            $stmtShare = $conn->prepare("UPDATE notes SET is_published = 0, public_token = NULL WHERE hash_id = ?");
            if (!$stmtShare) __notes_db_fail($conn, 'prepare: disable sharing');
            $stmtShare->bind_param("s", $hashId);
        } else {
            $token = generate_public_token();
            if ($action === 'publish') {
                $stmtShare = $conn->prepare(
                    "UPDATE notes SET is_published = 1, public_token = COALESCE(public_token, ?) WHERE hash_id = ?"
                );
            } else {
                $stmtShare = $conn->prepare(
                    "UPDATE notes SET is_published = 1, public_token = ? WHERE hash_id = ?"
                );
            }
            if (!$stmtShare) __notes_db_fail($conn, 'prepare: update sharing');
            $stmtShare->bind_param("ss", $token, $hashId);
        }

        if (!$stmtShare->execute()) __notes_db_fail($conn, 'execute: update sharing');
        if ($stmtShare->affected_rows === 0) {
            $exists = $conn->prepare("SELECT id FROM notes WHERE hash_id = ?");
            if (!$exists) __notes_db_fail($conn, 'prepare: check sharing note');
            $exists->bind_param("s", $hashId);
            if (!$exists->execute()) __notes_db_fail($conn, 'execute: check sharing note');
            if (!fetch_assoc_from_stmt($exists)) {
                __notes_json_error(404, 'Note not found');
            }
        }

        if ($action === 'disable') {
            $defaultHashId = get_setting($conn, 'public_default_hash_id');
            if ($defaultHashId === $hashId) {
                set_setting($conn, 'public_default_hash_id', '');
            }
        }

        $stmtSharedNote = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
        if (!$stmtSharedNote) __notes_db_fail($conn, 'prepare: reload shared note');
        $stmtSharedNote->bind_param("s", $hashId);
        if (!$stmtSharedNote->execute()) __notes_db_fail($conn, 'execute: reload shared note');
        $note = normalize_note_sharing(attach_tags_to_note($conn, fetch_assoc_from_stmt($stmtSharedNote)));
        echo json_encode($note, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return;
    }
    if (array_key_exists('set_pinned', $data) && is_array($data['set_pinned'] ?? null)) {
        $payload = $data['set_pinned'];
        $hashId = isset($payload['hash_id']) ? (string)$payload['hash_id'] : '';
        if ($hashId === '') {
            __notes_json_error(400, 'hash_id is required');
        }
        $isPinned = normalize_note_pinned($payload['is_pinned'] ?? 0);

        $stmtPin = $conn->prepare("UPDATE notes SET is_pinned = ?, version = version + 1 WHERE hash_id = ?");
        if (!$stmtPin) __notes_db_fail($conn, 'prepare: update is_pinned');
        $stmtPin->bind_param("is", $isPinned, $hashId);
        if (!$stmtPin->execute()) __notes_db_fail($conn, 'execute: update is_pinned');
        if ($stmtPin->affected_rows === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Note not found']);
            return;
        }

        $stmtPinnedNote = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
        if (!$stmtPinnedNote) __notes_db_fail($conn, 'prepare: reload pinned note');
        $stmtPinnedNote->bind_param("s", $hashId);
        if (!$stmtPinnedNote->execute()) __notes_db_fail($conn, 'execute: reload pinned note');

        $note = attach_tags_to_note($conn, fetch_assoc_from_stmt($stmtPinnedNote));
        echo json_encode($note, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return;
    }
    $hash_id = $data['hash_id'];
    $title = $data['title'] ?? '';
    $content = $data['content'] ?? '';
    $tags = normalize_note_tags($data['tags'] ?? []);
    $content = sanitize_note_html($content, $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS);

    $expected_version = isset($data['expected_version']) ? (int)$data['expected_version'] : null;
    $forceOverwrite = isset($data['force_overwrite']) && $data['force_overwrite'];
    
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
    $isPinned = normalize_note_pinned($data['is_pinned'] ?? ($serverNote['is_pinned'] ?? 0));
    $serverVersion = isset($serverNote['version']) ? (int)$serverNote['version'] : null;

    if (!$forceOverwrite) {
        // Optimistic lock update: only update if the version matches expected_version
        $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ?, is_pinned = ?, version = version + 1 WHERE hash_id = ? AND version = ?");
        if (!$stmt) __notes_db_fail($conn, 'prepare: optimistic update');
        $stmt->bind_param("ssisi", $title, $content, $isPinned, $hash_id, $expected_version);

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
            $serverNoteId = isset($serverNote['id']) ? (int)$serverNote['id'] : 0;
            $serverTags = $serverNoteId > 0 ? load_note_tags_for_note_id($conn, $serverNoteId) : [];
            $copy_hash_id = generateHashId();
            $copy_title = ($serverNote['title'] ?? '') . ' (version overwritten)';
            $copy_content = $serverNote['content'] ?? '';

            $stmtCopy = $conn->prepare("INSERT INTO notes (hash_id, title, content, version) VALUES (?, ?, ?, 1)");
            if (!$stmtCopy) __notes_db_fail($conn, 'prepare: insert overwrite copy');
            $stmtCopy->bind_param("sss", $copy_hash_id, $copy_title, $copy_content);
            if (!$stmtCopy->execute()) __notes_db_fail($conn, 'execute: insert overwrite copy');
            replace_note_tags($conn, (int)$conn->insert_id, $serverTags);
        }

        // Overwrite the original note unconditionally (but still bump version)
        $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ?, is_pinned = ?, version = version + 1 WHERE hash_id = ?");
        if (!$stmt) __notes_db_fail($conn, 'prepare: force overwrite update');
        $stmt->bind_param("ssis", $title, $content, $isPinned, $hash_id);

        if (!$stmt->execute()) {
            __notes_db_fail($conn, 'execute: force overwrite update');
        }
    }

    $noteId = isset($serverNote['id']) ? (int)$serverNote['id'] : 0;
    if ($noteId > 0) {
        replace_note_tags($conn, $noteId, $tags);
    }

    // Return updated note
    $stmtReload = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
    if (!$stmtReload) __notes_db_fail($conn, 'prepare: reload updated note');
    $stmtReload->bind_param("s", $hash_id);
    if (!$stmtReload->execute()) __notes_db_fail($conn, 'execute: reload updated note');

    $note = normalize_note_sharing(attach_tags_to_note($conn, fetch_assoc_from_stmt($stmtReload)));
    echo json_encode($note, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}
