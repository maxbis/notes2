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

function notes_list_preview(string $html, int $maxLength = 160): string {
    $withBlockSpacing = preg_replace(
        '/<\s*\/?\s*(?:address|article|aside|blockquote|br|div|dl|dt|dd|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|td|th|ul)\b[^>]*>/iu',
        ' ',
        $html
    );
    $plainText = html_entity_decode(
        strip_tags($withBlockSpacing ?? $html),
        ENT_QUOTES | ENT_HTML5,
        'UTF-8'
    );
    $plainText = preg_replace('/\s+/u', ' ', trim($plainText)) ?? '';

    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        return mb_strlen($plainText, 'UTF-8') > $maxLength
            ? rtrim(mb_substr($plainText, 0, $maxLength, 'UTF-8')) . '…'
            : $plainText;
    }

    return strlen($plainText) > $maxLength
        ? rtrim(substr($plainText, 0, $maxLength)) . '…'
        : $plainText;
}

function notes_list_query_tags($rawTags): array {
    if (is_array($rawTags)) {
        return normalize_note_tags($rawTags);
    }

    if (!is_scalar($rawTags)) return [];
    return normalize_note_tags(explode(',', (string)$rawTags));
}

function notes_bind_and_execute(mysqli_stmt $stmt, string $types, array $values, string $context): void {
    if ($types !== '') {
        $bindValues = [$types];
        foreach ($values as $index => $value) {
            $values[$index] = $value;
            $bindValues[] = &$values[$index];
        }
        if (!call_user_func_array([$stmt, 'bind_param'], $bindValues)) {
            __notes_json_error(500, 'Database error', ['context' => "bind: $context"]);
        }
    }

    if (!$stmt->execute()) {
        __notes_json_error(500, 'Database error', ['context' => "execute: $context"]);
    }
}

function notes_fetch_all_from_stmt(mysqli_stmt $stmt): array {
    if (method_exists($stmt, 'get_result')) {
        $result = $stmt->get_result();
        if ($result === false) return [];

        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = $row;
        }
        return $rows;
    }

    $meta = $stmt->result_metadata();
    if ($meta === false) return [];

    $row = [];
    $bind = [];
    while ($field = $meta->fetch_field()) {
        $row[$field->name] = null;
        $bind[] = &$row[$field->name];
    }
    $meta->free();
    if (!$bind) return [];

    call_user_func_array([$stmt, 'bind_result'], $bind);
    $rows = [];
    while ($stmt->fetch()) {
        $rows[] = array_map(static fn($value) => $value, $row);
    }
    return $rows;
}

function handle_notes_list(mysqli $conn): void {
    $rawLimit = $_GET['limit'] ?? '50';
    if (!is_scalar($rawLimit) || !preg_match('/^\d+$/', (string)$rawLimit)) {
        __notes_json_error(400, 'Invalid limit');
    }
    $limit = (int)$rawLimit;
    if ($limit < 1 || $limit > 100) {
        __notes_json_error(400, 'Limit must be between 1 and 100');
    }

    $rawQuery = $_GET['q'] ?? '';
    if (!is_scalar($rawQuery)) {
        __notes_json_error(400, 'Invalid search query');
    }
    $query = preg_replace('/\s+/u', ' ', trim((string)$rawQuery)) ?? '';
    $queryLength = function_exists('mb_strlen')
        ? mb_strlen($query, 'UTF-8')
        : strlen($query);
    if ($queryLength > 200) {
        __notes_json_error(400, 'Search query must be 200 characters or fewer');
    }

    $tags = notes_list_query_tags($_GET['tags'] ?? []);
    $where = [];
    $types = '';
    $values = [];

    if ($query !== '') {
        $where[] = '(
            LOCATE(?, n.title) > 0
            OR LOCATE(?, n.content) > 0
            OR EXISTS (
                SELECT 1
                FROM note_tags search_tag
                WHERE search_tag.note_id = n.id
                  AND LOCATE(?, search_tag.tag) > 0
            )
        )';
        $types .= 'sss';
        array_push($values, $query, $query, $query);
    }

    if ($tags) {
        $tagPlaceholders = implode(',', array_fill(0, count($tags), '?'));
        $where[] = "(
            SELECT COUNT(DISTINCT filter_tag.tag)
            FROM note_tags filter_tag
            WHERE filter_tag.note_id = n.id
              AND filter_tag.tag IN ($tagPlaceholders)
        ) = ?";
        $types .= str_repeat('s', count($tags)) . 'i';
        foreach ($tags as $tag) {
            $values[] = $tag;
        }
        $values[] = count($tags);
    }

    $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $fetchLimit = $limit + 1;
    $types .= 'i';
    $values[] = $fetchLimit;

    $sql = "
        SELECT
            n.id,
            n.hash_id,
            n.title,
            n.public_token,
            n.is_published,
            LEFT(n.content, 4096) AS content_excerpt,
            n.is_pinned,
            n.created_at,
            n.updated_at,
            n.version
        FROM notes n
        $whereSql
        ORDER BY n.is_pinned DESC, n.updated_at DESC, n.id DESC
        LIMIT ?
    ";
    $stmt = $conn->prepare($sql);
    if (!$stmt) __notes_db_fail($conn, 'prepare: metadata notes list');
    notes_bind_and_execute($stmt, $types, $values, 'metadata notes list');

    $notes = notes_fetch_all_from_stmt($stmt);
    $hasMore = count($notes) > $limit;
    if ($hasMore) {
        $notes = array_slice($notes, 0, $limit);
    }
    $notes = attach_tags_to_notes($conn, $notes);
    foreach ($notes as &$note) {
        $note['preview'] = notes_list_preview((string)($note['content_excerpt'] ?? ''));
        unset($note['content_excerpt'], $note['id']);
    }
    unset($note);

    $publicDefaultHashId = get_setting($conn, 'public_default_hash_id');
    echo json_encode([
        'notes' => $notes,
        'public_default_hash_id' => $publicDefaultHashId !== null && $publicDefaultHashId !== ''
            ? $publicDefaultHashId
            : null,
        'has_more' => $hasMore,
        'query' => [
            'q' => $query,
            'tags' => $tags,
            'limit' => $limit,
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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

        $note = normalize_note_sharing(attach_tags_to_note($conn, fetch_assoc_from_stmt($stmt)));
        echo json_encode($note ? $note : ['error' => 'Note not found'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    } elseif (isset($_GET['view']) && $_GET['view'] === 'list') {
        handle_notes_list($conn);
    } else {
        // Get all notes and public "easy access" default
        $result = $conn->query("SELECT id, hash_id, public_token, is_published, title, content, is_pinned, created_at, updated_at, version FROM notes ORDER BY updated_at DESC");
        if ($result === false) __notes_db_fail($conn, 'query: select all notes');
        $notes = [];
        while ($row = $result->fetch_assoc()) {
            $notes[] = normalize_note_sharing($row);
        }
        $publicDefaultHashId = get_setting($conn, 'public_default_hash_id');
        $payload = [
            'notes' => attach_tags_to_notes($conn, $notes),
            'public_default_hash_id' => $publicDefaultHashId !== null && $publicDefaultHashId !== '' ? $publicDefaultHashId : null
        ];
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
