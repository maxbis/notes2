<?php
/**
 * HTML access gate for authenticated Notes pages (e.g. app.php).
 *
 * On failure: 403 Warm Paper denial page.
 * On success: refresh the validation cookie (~3 months).
 */

require_once __DIR__ . '/auth.php';

if (!validateUser()) {
    $debugReason = notes_validation_debug_reason();
    $warmPaperVersion = (string) @filemtime(__DIR__ . '/../warm-paper/warm-paper.css');
    $loginCssVersion = (string) @filemtime(__DIR__ . '/login.css');

    http_response_code(403);
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied — Notes</title>
    <link rel="stylesheet" href="warm-paper/warm-paper.css?v=<?php echo htmlspecialchars($warmPaperVersion, ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="stylesheet" href="login/login.css?v=<?php echo htmlspecialchars($loginCssVersion, ENT_QUOTES, 'UTF-8'); ?>">
</head>
<body class="wp-theme notes-auth">
    <main class="notes-auth__shell">
        <section class="wp-panel notes-auth__panel" aria-labelledby="notes-auth-denied-title">
            <div class="notes-auth__brand">
                <span class="wp-header__brand-mark" aria-hidden="true">N</span>
                <span class="notes-auth__brand-name">Notes</span>
            </div>
            <h1 id="notes-auth-denied-title" class="wp-page-title">Access denied</h1>
            <p class="wp-page-description">
                Network and/or workstation not authorized to access this page.
            </p>
            <?php if ($debugReason !== null) : ?>
                <div class="wp-alert wp-alert--warning" role="status">
                    Debug: <?php echo htmlspecialchars($debugReason, ENT_QUOTES, 'UTF-8'); ?>
                </div>
            <?php endif; ?>
            <div class="notes-auth__actions">
                <a class="wp-button wp-button--primary" href="login/">Sign in</a>
            </div>
        </section>
    </main>
</body>
</html>
    <?php
    exit;
}

refreshValidationCookie();
