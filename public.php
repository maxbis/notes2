<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/api/database.php';

$hash_id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';

function render_error_page($title, $message, $statusCode = 400) {
    http_response_code($statusCode);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeMsg = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    ?>
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <title><?php echo $safeTitle; ?> - Notes</title>
        <link rel="stylesheet" href="style.css" />
        <style>
            /* Minimal layout without the authenticated editor shell */
            header { display: none; }
            .main-content { height: auto; }
            .sidebar { display: none; }
            .editor { border: 1px solid #e5e5e7; border-radius: 14px; overflow: hidden; }
            .editor-header { padding: 1.25rem 1.5rem; }
            .toolbar { display: none; }
            .editor-footer { opacity: 1; }
        </style>
    </head>
    <body>
        <div class="container" style="height:auto; min-height:100vh;">
            <div class="main-content" style="height:auto; padding: 1.25rem;">
                <main class="editor" aria-label="Public note">
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

if ($hash_id === '') {
    render_error_page('Missing note id', 'No note id was provided.', 400);
}

try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    render_error_page('Server error', 'Database connection failed.', 500);
}

$stmt = $conn->prepare("SELECT title, content, created_at, updated_at FROM notes WHERE hash_id = ? LIMIT 1");
if (!$stmt) {
    $conn->close();
    render_error_page('Server error', 'Failed to prepare database query.', 500);
}

$stmt->bind_param("s", $hash_id);
$stmt->execute();
$result = $stmt->get_result();
$note = $result ? $result->fetch_assoc() : null;
$stmt->close();
$conn->close();

if (!$note) {
    render_error_page('Not found', 'This note does not exist (or the link is incorrect).', 404);
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
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
    <title><?php echo $safeTitle; ?> - Notes</title>
    <link rel="icon" href="icons/favicon.ico">
    <link rel="stylesheet" href="style.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" />
    <style>
        /* Minimal layout without the authenticated editor shell */
        header { display: none; }
        .main-content { height: auto; }
        .sidebar { display: none; }
        .editor { border: 1px solid #e5e5e7; border-radius: 14px; overflow: hidden; }
        .editor-header { padding: 1.25rem 1.5rem; }
        .toolbar { display: none; }
        .editor-footer { opacity: 1; }
    </style>
</head>
<body>
    <div class="container" style="height:auto; min-height:100vh;">
        <div class="main-content" style="height:auto; padding: 1.25rem;">
            <main class="editor" aria-label="Public note (read-only)">
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

