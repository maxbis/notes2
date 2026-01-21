<?php
require_once 'config.php';

header('Content-Type: application/json');

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

$method = $_SERVER['REQUEST_METHOD'];
try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database connection failed',
        'details' => $e->getMessage()
    ]);
    exit;
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Get single note by hash_id
            $hash_id = $_GET['id'];
            $stmt = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
            $stmt->bind_param("s", $hash_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $note = $result->fetch_assoc();
            echo json_encode($note ? $note : ['error' => 'Note not found']);
        } else {
            // Get all notes

            $result = $conn->query("SELECT id, hash_id, title, content, created_at, updated_at, version FROM notes ORDER BY updated_at DESC");
            $notes = [];
            while ($row = $result->fetch_assoc()) {
                $notes[] = $row;
            }
            echo json_encode($notes);
        }
        break;
        
    case 'POST':
        // Create new note
        $data = json_decode(file_get_contents('php://input'), true);
        $hash_id = generateHashId();
        $title = $data['title'] ?? 'Untitled';
        $content = $data['content'] ?? '';
        $content = sanitize_note_html($content, $ALLOWED_TAGS, $ALLOWED_ATTRS_BY_TAG, $FORBIDDEN_TAGS);
        
        $stmt = $conn->prepare("INSERT INTO notes (hash_id, title, content) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $hash_id, $title, $content);
        
        if ($stmt->execute()) {
            $note_id = $conn->insert_id;
            $result = $conn->query("SELECT * FROM notes WHERE id = $note_id");
            echo json_encode($result->fetch_assoc());
        } else {
            echo json_encode(['error' => 'Failed to create note']);
        }
        break;
        
    case 'PUT':
        // Update existing note
        $data = json_decode(file_get_contents('php://input'), true);
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
        $stmtCurrent->bind_param("s", $hash_id);
        $stmtCurrent->execute();
        $serverResult = $stmtCurrent->get_result();
        $serverNote = $serverResult->fetch_assoc();
        if (!$serverNote) {
            http_response_code(404);
            echo json_encode(['error' => 'Note not found']);
            break;
        }
        $serverVersion = isset($serverNote['version']) ? (int)$serverNote['version'] : null;

        if (!$forceOverwrite) {
            // Optimistic lock update: only update if the version matches expected_version
            $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ?, version = version + 1 WHERE hash_id = ? AND version = ?");
            $stmt->bind_param("sssi", $title, $content, $hash_id, $expected_version);

            if (!$stmt->execute()) {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to update note']);
                break;
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
                ]);
                break;
            }
        } else {
            // Force overwrite path: only make a copy if we are behind (server_version > expected_version)
            if ($expected_version !== null && $serverVersion !== null && $serverVersion > $expected_version) {
                $copy_hash_id = generateHashId();
                $copy_title = ($serverNote['title'] ?? '') . ' (version overwritten)';
                $copy_content = $serverNote['content'] ?? '';

                $stmtCopy = $conn->prepare("INSERT INTO notes (hash_id, title, content, version) VALUES (?, ?, ?, 1)");
                $stmtCopy->bind_param("sss", $copy_hash_id, $copy_title, $copy_content);
                $stmtCopy->execute();
            }

            // Overwrite the original note unconditionally (but still bump version)
            $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ?, version = version + 1 WHERE hash_id = ?");
            $stmt->bind_param("sss", $title, $content, $hash_id);

            if (!$stmt->execute()) {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to update note']);
                break;
            }
        }

        // Return updated note
        $stmtReload = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
        $stmtReload->bind_param("s", $hash_id);
        $stmtReload->execute();
        $result = $stmtReload->get_result();
        echo json_encode($result->fetch_assoc());
        break;
        
    case 'DELETE':
        // Delete note
        $data = json_decode(file_get_contents('php://input'), true);
        $hash_id = $data['hash_id'];
        
        $stmt = $conn->prepare("DELETE FROM notes WHERE hash_id = ?");
        $stmt->bind_param("s", $hash_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Failed to delete note']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>
