<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api/database.php';
require_once __DIR__ . '/api/settings_helper.php';
require_once __DIR__ . '/api/sharing_helper.php';

$public_token = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

function public_asset_url($path) {
    $version = @filemtime(__DIR__ . '/' . $path);
    $suffix = $version === false ? '' : '?v=' . rawurlencode((string) $version);
    return htmlspecialchars($path . $suffix, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function public_document_base_href() {
    $baseHref = defined('PUBLIC_DOCUMENT_BASE_HREF') ? PUBLIC_DOCUMENT_BASE_HREF : './';
    return htmlspecialchars($baseHref, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function render_error_page($title, $message, $statusCode = 400) {
    http_response_code($statusCode);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMsg = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover" />
        <base href="<?php echo public_document_base_href(); ?>">
        <title><?php echo $safeTitle; ?> - Notes</title>
        <meta name="theme-color" content="#315f8d">
        <link rel="stylesheet" href="<?php echo public_asset_url('warm-paper/warm-paper.css'); ?>" />
        <link rel="stylesheet" href="<?php echo public_asset_url('style.css'); ?>" />
    </head>
    <body class="wp-theme public-view">
        <div class="container wp-app public-container">
            <div class="main-content public-main">
                <main class="editor wp-card public-note public-note--error" aria-label="Public note">
                    <div class="editor-header">
                        <div class="title-container">
                            <h2><?php echo $safeTitle; ?></h2>
                        </div>
                    </div>
                    <div class="editor-content"><?php echo nl2br($safeMsg); ?></div>
                    <div class="editor-footer">
                        <span id="noteMeta"></span>
                        <span class="last-saved"></span>
                    </div>
                </main>
            </div>
        </div>
    </body>
    </html>
    <?php
    exit;
}

if ($public_token === '') {
    $easyAccessEnabled = defined('PUBLIC_EASY_ACCESS_ENABLED') ? PUBLIC_EASY_ACCESS_ENABLED : true;
    if ($easyAccessEnabled) {
        try {
            $conn = getDBConnection();
            ensure_note_sharing_schema($conn);
            $defaultHashId = get_setting($conn, 'public_default_hash_id');
            if ($defaultHashId !== null && $defaultHashId !== '') {
                $stmtDefault = $conn->prepare(
                    "SELECT public_token FROM notes WHERE hash_id = ? AND is_published = 1 AND public_token IS NOT NULL LIMIT 1"
                );
                if ($stmtDefault) {
                    $stmtDefault->bind_param("s", $defaultHashId);
                    $stmtDefault->execute();
                    $defaultNote = fetch_assoc_from_stmt($stmtDefault);
                    if (!empty($defaultNote['public_token'])) {
                        $public_token = (string)$defaultNote['public_token'];
                    }
                }
            }
            if (isset($conn) && $conn instanceof mysqli) {
                $conn->close();
            }
        } catch (Throwable $e) {
            render_error_page('Server error', 'The Default Published note could not be loaded.', 500);
        }
    }
    if ($public_token === '') {
        render_error_page(
            'No Default Published note',
            'No Published note is currently selected as Default Published.',
            404
        );
    }
}

try {
    $conn = getDBConnection();
    ensure_note_sharing_schema($conn);
} catch (Throwable $e) {
    render_error_page('Server error', 'Database connection failed.', 500);
}

$stmt = $conn->prepare("SELECT title, content, created_at, updated_at FROM notes WHERE public_token = ? AND is_published = 1 LIMIT 1");
if (!$stmt) {
    $conn->close();
    render_error_page('Server error', 'Failed to prepare database query.', 500);
}

$stmt->bind_param("s", $public_token);
$stmt->execute();
$result = $stmt->get_result();
$note = $result ? $result->fetch_assoc() : null;
$stmt->close();
$conn->close();

if (!$note) {
    render_error_page('Link unavailable', 'This sharing link is disabled, expired, or incorrect.', 404);
}

$title = $note['title'] ?? 'Untitled';
$content = $note['content'] ?? '';
$created_at = $note['created_at'] ?? null;
$updated_at = $note['updated_at'] ?? null;

$safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover" />
    <base href="<?php echo public_document_base_href(); ?>">
    <title><?php echo $safeTitle; ?> - Notes</title>
    <link rel="icon" href="icons/favicon.ico">
    <meta name="theme-color" content="#315f8d">
    <link rel="stylesheet" href="<?php echo public_asset_url('warm-paper/warm-paper.css'); ?>" />
    <link rel="stylesheet" href="<?php echo public_asset_url('style.css'); ?>" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
</head>
<body class="wp-theme public-view">
    <div class="container wp-app public-container">
        <div class="main-content public-main">
            <main class="editor wp-card public-note" aria-label="Public note (read-only)">
                <div class="editor-header">
                    <div class="title-container">
                        <h2><?php echo $safeTitle; ?></h2>
                    </div>
                </div>

                <div class="editor-content" aria-label="Content">
                    <?php
                        // Note content is stored sanitized on write (see api.php). Render as HTML.
                        echo $content;
                    ?>
                </div>

                <div class="editor-footer">
                    <span id="noteMeta">
                        <?php
                            if ($updated_at) {
                                $safeUpdated = htmlspecialchars((string)$updated_at, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                echo "Last updated: " . $safeUpdated;
                            } elseif ($created_at) {
                                $safeCreated = htmlspecialchars((string)$created_at, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
                                echo "Created: " . $safeCreated;
                            }
                        ?>
                    </span>
                    <span class="last-saved"></span>
                </div>
            </main>
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        (function () {
            if (typeof hljs === 'undefined') return;
            var container = document.querySelector('.editor-content');
            if (!container) return;
            container.querySelectorAll('pre').forEach(function (pre) {
                var first = pre.firstElementChild;
                if (!first || first.tagName !== 'CODE') {
                    var code = document.createElement('code');
                    while (pre.firstChild) code.appendChild(pre.firstChild);
                    pre.appendChild(code);
                }
            });
            container.querySelectorAll('pre code').forEach(function (el) { hljs.highlightElement(el); });
        })();
    </script>
</body>
</html>
