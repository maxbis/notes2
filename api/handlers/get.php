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

function notes_list_plain_text(string $html): string {
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

    return $plainText;
}

function notes_list_truncate_text(string $plainText, int $maxLength): string {
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        return mb_strlen($plainText, 'UTF-8') > $maxLength
            ? rtrim(mb_substr($plainText, 0, $maxLength, 'UTF-8')) . '…'
            : $plainText;
    }

    return strlen($plainText) > $maxLength
        ? rtrim(substr($plainText, 0, $maxLength)) . '…'
        : $plainText;
}

function notes_list_preview(string $html, int $maxLength = 160): string {
    $plainText = notes_list_plain_text($html);
    return notes_list_truncate_text($plainText, $maxLength);
}

function notes_list_match_preview(string $html, string $query, int $maxLength = 180): string {
    $plainText = notes_list_plain_text($html);
    if ($query === '' || $plainText === '') return notes_list_preview($html, $maxLength);

    if (function_exists('mb_stripos') && function_exists('mb_substr') && function_exists('mb_strlen')) {
        $position = mb_stripos($plainText, $query, 0, 'UTF-8');
        if ($position === false) return notes_list_preview($html, $maxLength);

        $start = max(0, $position - 60);
        $snippet = trim(mb_substr($plainText, $start, $maxLength, 'UTF-8'));
        if ($start > 0) $snippet = '…' . $snippet;
        if ($start + $maxLength < mb_strlen($plainText, 'UTF-8')) $snippet .= '…';
        return $snippet;
    }

    $position = stripos($plainText, $query);
    if ($position === false) return notes_list_preview($html, $maxLength);
    $start = max(0, $position - 60);
    $snippet = trim(substr($plainText, $start, $maxLength));
    if ($start > 0) $snippet = '…' . $snippet;
    if ($start + $maxLength < strlen($plainText)) $snippet .= '…';
    return $snippet;
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

function notes_text_contains(string $haystack, string $needle): bool {
    if ($needle === '') return true;
    if (function_exists('mb_stripos')) return mb_stripos($haystack, $needle, 0, 'UTF-8') !== false;
    return stripos($haystack, $needle) !== false;
}

function notes_open_todos_from_note(array $note, string $query = ''): array {
    $html = (string)($note['content'] ?? '');
    if ($html === '' || stripos($html, 'todo-item') === false) return [];

    $document = new DOMDocument('1.0', 'UTF-8');
    $previousErrorMode = libxml_use_internal_errors(true);
    try {
        $loaded = $document->loadHTML(
            '<?xml encoding="UTF-8"><div id="notes-todo-root">' . $html . '</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previousErrorMode);
    }
    if (!$loaded) return [];

    $xpath = new DOMXPath($document);
    $items = $xpath->query(
        '//*[@id="notes-todo-root"]//li[contains(concat(" ", normalize-space(@class), " "), " todo-item ")]'
    );
    if ($items === false) return [];

    $title = (string)($note['title'] ?? '');
    $tags = is_array($note['tags'] ?? null) ? $note['tags'] : [];
    $noteMatches = notes_text_contains($title, $query)
        || array_filter($tags, static fn($tag) => notes_text_contains((string)$tag, $query));
    $openItems = [];
    foreach ($items as $index => $item) {
        if (!$item instanceof DOMElement) continue;
        $completedAt = trim($item->getAttribute('data-todo-completed-at'));
        $isCompleted = preg_match(
            '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/',
            $completedAt
        ) === 1;
        if ($isCompleted) continue;

        $text = preg_replace('/\s+/u', ' ', trim((string)$item->textContent)) ?? '';
        if ($text === '') continue;

        $openItems[] = [
            'text' => $text,
            'todo_id' => $item->getAttribute('data-todo-id') ?: null,
            'todo_index' => $index,
        ];
    }

    $openTodoCount = count($openItems);
    $results = [];
    foreach ($openItems as $openItem) {
        if (!$noteMatches && !notes_text_contains($openItem['text'], $query)) continue;

        $results[] = [
            'hash_id' => (string)($note['hash_id'] ?? ''),
            'title' => $title,
            'preview' => notes_list_truncate_text($openItem['text'], 180),
            'tags' => $tags,
            'updated_at' => $note['updated_at'] ?? null,
            'todo_id' => $openItem['todo_id'],
            'todo_index' => $openItem['todo_index'],
            'note_open_todo_count' => $openTodoCount,
            'is_todo' => true,
        ];
    }

    return $results;
}

function handle_open_todos(mysqli $conn): void {
    $rawLimit = $_GET['limit'] ?? '20';
    if (!is_scalar($rawLimit) || !preg_match('/^\d+$/', (string)$rawLimit)) {
        __notes_json_error(400, 'Invalid limit');
    }
    $limit = (int)$rawLimit;
    if ($limit < 1 || $limit > 100) {
        __notes_json_error(400, 'Limit must be between 1 and 100');
    }

    $rawQuery = $_GET['q'] ?? '';
    if (!is_scalar($rawQuery)) {
        __notes_json_error(400, 'Invalid todo search query');
    }
    $query = preg_replace('/\s+/u', ' ', trim((string)$rawQuery)) ?? '';
    $queryLength = function_exists('mb_strlen') ? mb_strlen($query, 'UTF-8') : strlen($query);
    if ($queryLength > 200) {
        __notes_json_error(400, 'Todo search query must be 200 characters or fewer');
    }

    $result = $conn->query("
        SELECT id, hash_id, title, content, updated_at
        FROM notes
        WHERE content LIKE '%todo-item%'
        ORDER BY updated_at DESC, id DESC
    ");
    if ($result === false) __notes_db_fail($conn, 'query: open todos');

    $notes = [];
    while ($row = $result->fetch_assoc()) $notes[] = $row;
    $notes = attach_tags_to_notes($conn, $notes);

    $todos = [];
    $hasMore = false;
    foreach ($notes as $note) {
        foreach (notes_open_todos_from_note($note, $query) as $todo) {
            if (count($todos) >= $limit) {
                $hasMore = true;
                break 2;
            }
            $todos[] = $todo;
        }
    }

    echo json_encode([
        'notes' => $todos,
        'has_more' => $hasMore,
        'query' => [
            'q' => $query,
            'limit' => $limit,
            'mode' => 'open_todos',
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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

    $rawSnippetMode = $_GET['snippets'] ?? '';
    if (!is_scalar($rawSnippetMode)) {
        __notes_json_error(400, 'Invalid snippet mode');
    }
    $snippetMode = (string)$rawSnippetMode;
    if (!in_array($snippetMode, ['', 'match'], true)) {
        __notes_json_error(400, 'Invalid snippet mode');
    }
    $includeMatchSnippets = $snippetMode === 'match' && $query !== '';

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

    $contentSelection = $includeMatchSnippets
        ? 'n.content AS content_excerpt'
        : 'LEFT(n.content, 4096) AS content_excerpt';
    $sql = "
        SELECT
            n.id,
            n.hash_id,
            n.title,
            n.public_token,
            n.is_published,
            $contentSelection,
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
        $note['preview'] = $includeMatchSnippets
            ? notes_list_match_preview((string)($note['content_excerpt'] ?? ''), $query)
            : notes_list_preview((string)($note['content_excerpt'] ?? ''));
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
    } elseif (isset($_GET['view']) && $_GET['view'] === 'todos') {
        handle_open_todos($conn);
    } elseif (isset($_GET['view']) && $_GET['view'] === 'list') {
        handle_notes_list($conn);
    } else {
        // Get all notes and the Default Published note
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
