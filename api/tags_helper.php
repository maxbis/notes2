<?php

function normalize_note_tag(string $tag): string {
    $tag = preg_replace('/\s+/u', ' ', trim($tag)) ?? '';
    if ($tag === '') return '';
    $tag = function_exists('mb_strtolower') ? mb_strtolower($tag, 'UTF-8') : strtolower($tag);
    $length = function_exists('mb_strlen') ? mb_strlen($tag, 'UTF-8') : strlen($tag);
    if ($length > 64) {
        $tag = function_exists('mb_substr') ? mb_substr($tag, 0, 64, 'UTF-8') : substr($tag, 0, 64);
        $tag = rtrim($tag);
    }
    return $tag;
}

function normalize_note_tags($tags): array {
    if (!is_array($tags)) return [];

    $normalized = [];
    foreach ($tags as $tag) {
        if (!is_scalar($tag)) continue;
        $value = normalize_note_tag((string)$tag);
        if ($value === '') continue;
        $normalized[$value] = true;
    }

    $result = array_keys($normalized);
    sort($result, SORT_NATURAL | SORT_FLAG_CASE);
    return $result;
}

function load_note_tags_for_note_id(mysqli $conn, int $noteId): array {
    $stmt = $conn->prepare("SELECT tag FROM note_tags WHERE note_id = ? ORDER BY tag ASC");
    if (!$stmt) __notes_db_fail($conn, 'prepare: select note tags');
    $stmt->bind_param("i", $noteId);
    if (!$stmt->execute()) __notes_db_fail($conn, 'execute: select note tags');

    $tags = [];
    if (method_exists($stmt, 'get_result')) {
        $result = $stmt->get_result();
        if ($result !== false) {
            while ($row = $result->fetch_assoc()) {
                $tags[] = (string)($row['tag'] ?? '');
            }
        }
    } else {
        $stmt->bind_result($tag);
        while ($stmt->fetch()) {
            $tags[] = (string)$tag;
        }
    }

    return array_values(array_filter($tags, static fn($tag) => $tag !== ''));
}

function load_note_tags_map(mysqli $conn, array $noteIds): array {
    $noteIds = array_values(array_filter(array_map('intval', $noteIds), static fn($id) => $id > 0));
    if (!$noteIds) return [];

    $placeholders = implode(',', array_fill(0, count($noteIds), '?'));
    $types = str_repeat('i', count($noteIds));
    $stmt = $conn->prepare("SELECT note_id, tag FROM note_tags WHERE note_id IN ($placeholders) ORDER BY tag ASC");
    if (!$stmt) __notes_db_fail($conn, 'prepare: select tags map');
    $bindValues = [$types];
    foreach ($noteIds as $index => $noteId) {
        $bindValues[] = &$noteIds[$index];
    }
    call_user_func_array([$stmt, 'bind_param'], $bindValues);
    if (!$stmt->execute()) __notes_db_fail($conn, 'execute: select tags map');

    $map = [];
    if (method_exists($stmt, 'get_result')) {
        $result = $stmt->get_result();
        if ($result !== false) {
            while ($row = $result->fetch_assoc()) {
                $noteId = (int)($row['note_id'] ?? 0);
                $tag = (string)($row['tag'] ?? '');
                if ($noteId > 0 && $tag !== '') {
                    $map[$noteId][] = $tag;
                }
            }
        }
    } else {
        $stmt->bind_result($noteId, $tag);
        while ($stmt->fetch()) {
            $noteId = (int)$noteId;
            $tag = (string)$tag;
            if ($noteId > 0 && $tag !== '') {
                $map[$noteId][] = $tag;
            }
        }
    }

    return $map;
}

function replace_note_tags(mysqli $conn, int $noteId, array $tags): void {
    $stmtDelete = $conn->prepare("DELETE FROM note_tags WHERE note_id = ?");
    if (!$stmtDelete) __notes_db_fail($conn, 'prepare: delete note tags');
    $stmtDelete->bind_param("i", $noteId);
    if (!$stmtDelete->execute()) __notes_db_fail($conn, 'execute: delete note tags');

    if (!$tags) return;

    $stmtInsert = $conn->prepare("INSERT INTO note_tags (note_id, tag) VALUES (?, ?)");
    if (!$stmtInsert) __notes_db_fail($conn, 'prepare: insert note tag');
    foreach ($tags as $tag) {
        $stmtInsert->bind_param("is", $noteId, $tag);
        if (!$stmtInsert->execute()) __notes_db_fail($conn, 'execute: insert note tag');
    }
}

function attach_tags_to_note(mysqli $conn, ?array $note): ?array {
    if (!$note) return $note;
    $noteId = isset($note['id']) ? (int)$note['id'] : 0;
    $note['tags'] = $noteId > 0 ? load_note_tags_for_note_id($conn, $noteId) : [];
    return $note;
}

function attach_tags_to_notes(mysqli $conn, array $notes): array {
    if (!$notes) return $notes;

    $noteIds = [];
    foreach ($notes as $note) {
        $noteId = isset($note['id']) ? (int)$note['id'] : 0;
        if ($noteId > 0) $noteIds[] = $noteId;
    }

    $tagMap = load_note_tags_map($conn, $noteIds);
    foreach ($notes as &$note) {
        $noteId = isset($note['id']) ? (int)$note['id'] : 0;
        $note['tags'] = $noteId > 0 ? ($tagMap[$noteId] ?? []) : [];
    }
    unset($note);

    return $notes;
}
