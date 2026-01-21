<?php
declare(strict_types=1);

// Ensure API always returns JSON (even on fatals) so the frontend can show a useful error.
// Optional debug mode:
// - Set `define('NOTES_DEBUG_TOKEN', '...');` in config.php (recommended, config.php is gitignored)
// - Then call: api.php?debug=1&token=YOUR_TOKEN

ob_start();

$__notes_request_id = bin2hex(random_bytes(6)); // 12 hex chars

$__notes_debug = false;
if (isset($_GET['debug']) && (string)$_GET['debug'] === '1') {
    if (defined('NOTES_DEBUG') && NOTES_DEBUG) {
        $__notes_debug = true;
    } elseif (defined('NOTES_DEBUG_TOKEN')) {
        $provided = isset($_GET['token']) ? (string)$_GET['token'] : '';
        $expected = (string)NOTES_DEBUG_TOKEN;
        if ($provided !== '' && $expected !== '' && hash_equals($expected, $provided)) {
            $__notes_debug = true;
        }
    }
}

function __notes_json_error(int $statusCode, string $message, array $extra = []): void {
    global $__notes_request_id;
    if (function_exists('http_response_code')) http_response_code($statusCode);
    if (!headers_sent()) header('Content-Type: application/json; charset=UTF-8');

    $payload = array_merge([
        'error' => $message,
        'request_id' => $__notes_request_id,
    ], $extra);

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) $json = '{"error":"Internal Server Error","request_id":"' . $__notes_request_id . '"}';

    // If anything already printed, discard it so the response remains valid JSON.
    if (ob_get_level() > 0) @ob_clean();
    echo $json;
    exit;
}

function __notes_db_fail(mysqli $conn, string $context, int $statusCode = 500): void {
    global $__notes_debug;
    $extra = ['context' => $context];
    if ($__notes_debug) {
        $extra['mysql_errno'] = (int)$conn->errno;
        $extra['mysql_error'] = (string)$conn->error;
    }
    __notes_json_error($statusCode, 'Database error', $extra);
}

set_exception_handler(function (Throwable $e) {
    global $__notes_debug;
    $extra = [];
    if ($__notes_debug) {
        $extra['type'] = get_class($e);
        $extra['details'] = $e->getMessage();
        $extra['file'] = $e->getFile();
        $extra['line'] = $e->getLine();
        $extra['trace'] = $e->getTraceAsString();
    }
    __notes_json_error(500, 'Internal Server Error', $extra);
});

register_shutdown_function(function () {
    global $__notes_debug;
    $err = error_get_last();
    if (!$err) return;

    // Only handle fatal errors
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'] ?? 0, $fatalTypes, true)) return;

    $extra = [];
    if ($__notes_debug) {
        $extra['type'] = $err['type'] ?? null;
        $extra['details'] = $err['message'] ?? null;
        $extra['file'] = $err['file'] ?? null;
        $extra['line'] = $err['line'] ?? null;
    }
    __notes_json_error(500, 'Internal Server Error', $extra);
});

// Load config (absolute path). Any fatal here will be converted to JSON by the shutdown handler above.
require_once __DIR__ . '/config.php';

if (!headers_sent()) header('Content-Type: application/json; charset=UTF-8');

$ALLOWED_TAGS = [
    'h1', 'h2', 'h3', 'h4',
    'p', 'b', 'i',
    'li', 'ol', 'ul',
    'pre', 'code',
    'table', 'th', 'tr', 'td',
    'div',
    'a'
];

// Per-tag attribute allowlist. Anything else is stripped (including any on* handlers).
// Adjust this map as needed.
$ALLOWED_ATTRS_BY_TAG = [
    // Tables
    'td' => ['colspan', 'rowspan'],
    'th' => ['colspan', 'rowspan'],
    'tr' => [],
    'table' => [],

    // Text/blocks (default: no attrs)
    'div' => [],
    'p' => [],
    'h1' => [],
    'h2' => [],
    'h3' => [],
    'h4' => [],
    'b' => [],
    'i' => [],
    'ol' => [],
    'ul' => [],
    'li' => [],
    'pre' => [],
    'code' => [],
    'a' => ['href'],
];

$FORBIDDEN_TAGS = [
    // Dangerous / irrelevant for notes
    'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
    'form', 'input', 'button', 'textarea', 'select', 'option',
    'svg', 'math',
];

function sanitize_note_html($html, $allowedTags, $allowedAttrsByTag, $forbiddenTags) {
    if (!is_string($html) || $html === '') return '';

    // DOMDocument is picky; keep errors internal.
    $prev = libxml_use_internal_errors(true);
    libxml_clear_errors();

    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = false;
    $dom->preserveWhiteSpace = true;

    // Wrap in a root container so we can extract the sanitized innerHTML easily.
    $wrapped = '<div id="__notes_root__">' . $html . '</div>';
    $flags = 0;
    if (defined('LIBXML_HTML_NOIMPLIED')) $flags |= LIBXML_HTML_NOIMPLIED;
    if (defined('LIBXML_HTML_NODEFDTD')) $flags |= LIBXML_HTML_NODEFDTD;

    // Hint encoding to avoid mojibake.
    $dom->loadHTML('<?xml encoding="utf-8" ?>' . $wrapped, $flags);

    $root = $dom->getElementById('__notes_root__');
    if (!$root) {
        libxml_clear_errors();
        libxml_use_internal_errors($prev);
        // Fallback: if parsing failed, treat as plain text.
        return htmlspecialchars($html, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    $allowedSet = array_fill_keys(array_map('strtolower', $allowedTags), true);
    $forbiddenSet = array_fill_keys(array_map('strtolower', $forbiddenTags), true);

    $sanitizeNode = function ($node) use (&$sanitizeNode, $allowedSet, $allowedAttrsByTag, $forbiddenSet) {
        if (!$node) return;

        // Remove comments
        if ($node->nodeType === XML_COMMENT_NODE) {
            if ($node->parentNode) $node->parentNode->removeChild($node);
            return;
        }

        if ($node->nodeType !== XML_ELEMENT_NODE) {
            // Text nodes etc are kept as-is.
            return;
        }

        $tag = strtolower($node->nodeName);

        // Remove dangerous tags entirely (including their children).
        if (isset($forbiddenSet[$tag])) {
            if ($node->parentNode) $node->parentNode->removeChild($node);
            return;
        }

        // If tag not allowed: unwrap (keep children/text).
        if (!isset($allowedSet[$tag])) {
            $parent = $node->parentNode;
            if ($parent) {
                while ($node->firstChild) {
                    $parent->insertBefore($node->firstChild, $node);
                }
                $parent->removeChild($node);
            }
            return;
        }

        // Allowed tag: strip attributes unless allowlisted.
        $allowedAttrs = [];
        if (isset($allowedAttrsByTag[$tag]) && is_array($allowedAttrsByTag[$tag])) {
            foreach ($allowedAttrsByTag[$tag] as $a) {
                $allowedAttrs[strtolower($a)] = true;
            }
        }

        if ($node->hasAttributes()) {
            // Snapshot attributes first (live list).
            $toRemove = [];
            foreach ($node->attributes as $attr) {
                $name = strtolower($attr->nodeName);

                // Never allow event handlers or inline styles.
                if (strncmp($name, 'on', 2) === 0 || $name === 'style') {
                    $toRemove[] = $attr->nodeName;
                    continue;
                }

                if (!isset($allowedAttrs[$name])) {
                    $toRemove[] = $attr->nodeName;
                    continue;
                }

                // Normalize numeric attributes
                if ($name === 'colspan' || $name === 'rowspan') {
                    $val = preg_replace('/[^0-9]/', '', (string)$attr->nodeValue);
                    if ($val === '') {
                        $toRemove[] = $attr->nodeName;
                    } else {
                        $node->setAttribute($attr->nodeName, $val);
                    }
                }
            }
            foreach ($toRemove as $attrName) {
                $node->removeAttribute($attrName);
            }
        }

        // Recurse into children (snapshot first, because we may modify DOM).
        $children = [];
        foreach ($node->childNodes as $child) $children[] = $child;
        foreach ($children as $child) $sanitizeNode($child);
    };

    // Sanitize children of root wrapper.
    $rootChildren = [];
    foreach ($root->childNodes as $child) $rootChildren[] = $child;
    foreach ($rootChildren as $child) $sanitizeNode($child);

    // Extract sanitized inner HTML of root.
    $out = '';
    foreach ($root->childNodes as $child) {
        $out .= $dom->saveHTML($child);
    }

    libxml_clear_errors();
    libxml_use_internal_errors($prev);
    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    global $__notes_debug;
    $extra = [];
    if ($__notes_debug) $extra['details'] = $e->getMessage();
    __notes_json_error(500, 'Database connection failed', $extra);
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Get single note by hash_id
            $hash_id = $_GET['id'];
            $stmt = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
            if (!$stmt) __notes_db_fail($conn, 'prepare: select by hash_id');
            $stmt->bind_param("s", $hash_id);
            if (!$stmt->execute()) __notes_db_fail($conn, 'execute: select by hash_id');

            // get_result() requires mysqlnd; fall back to bind_result if unavailable
            if (method_exists($stmt, 'get_result')) {
                $result = $stmt->get_result();
                if ($result === false) __notes_db_fail($conn, 'get_result: select by hash_id');
                $note = $result->fetch_assoc();
            } else {
                $meta = $stmt->result_metadata();
                if ($meta === false) __notes_db_fail($conn, 'result_metadata: select by hash_id');
                $row = [];
                $bind = [];
                while ($field = $meta->fetch_field()) {
                    $row[$field->name] = null;
                    $bind[] = &$row[$field->name];
                }
                $meta->free();
                if ($bind) {
                    call_user_func_array([$stmt, 'bind_result'], $bind);
                    $note = $stmt->fetch() ? array_map(static fn($v) => $v, $row) : null;
                } else {
                    $note = null;
                }
            }

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
        break;
        
    case 'POST':
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
        break;
        
    case 'PUT':
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
            break;
        }

        // Fetch current server version (needed for conflict responses and overwrite-copy logic)
        $stmtCurrent = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
        if (!$stmtCurrent) __notes_db_fail($conn, 'prepare: select current note');
        $stmtCurrent->bind_param("s", $hash_id);
        if (!$stmtCurrent->execute()) __notes_db_fail($conn, 'execute: select current note');

        if (method_exists($stmtCurrent, 'get_result')) {
            $serverResult = $stmtCurrent->get_result();
            if ($serverResult === false) __notes_db_fail($conn, 'get_result: select current note');
            $serverNote = $serverResult->fetch_assoc();
        } else {
            $meta = $stmtCurrent->result_metadata();
            if ($meta === false) __notes_db_fail($conn, 'result_metadata: select current note');
            $row = [];
            $bind = [];
            while ($field = $meta->fetch_field()) {
                $row[$field->name] = null;
                $bind[] = &$row[$field->name];
            }
            $meta->free();
            if ($bind) {
                call_user_func_array([$stmtCurrent, 'bind_result'], $bind);
                $serverNote = $stmtCurrent->fetch() ? array_map(static fn($v) => $v, $row) : null;
            } else {
                $serverNote = null;
            }
        }
        if (!$serverNote) {
            http_response_code(404);
            echo json_encode(['error' => 'Note not found']);
            break;
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
                break;
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

        if (method_exists($stmtReload, 'get_result')) {
            $result = $stmtReload->get_result();
            if ($result === false) __notes_db_fail($conn, 'get_result: reload updated note');
            $note = $result->fetch_assoc();
        } else {
            $meta = $stmtReload->result_metadata();
            if ($meta === false) __notes_db_fail($conn, 'result_metadata: reload updated note');
            $row = [];
            $bind = [];
            while ($field = $meta->fetch_field()) {
                $row[$field->name] = null;
                $bind[] = &$row[$field->name];
            }
            $meta->free();
            if ($bind) {
                call_user_func_array([$stmtReload, 'bind_result'], $bind);
                $note = $stmtReload->fetch() ? array_map(static fn($v) => $v, $row) : null;
            } else {
                $note = null;
            }
        }

        echo json_encode($note, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        break;
        
    case 'DELETE':
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
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>
