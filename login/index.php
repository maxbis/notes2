<?php
/**
 * Validation login page.
 * Sets a cookie with the SHA-256 hashed validation key (30 days).
 */

declare(strict_types=1);

date_default_timezone_set('Europe/Amsterdam');

require_once __DIR__ . '/auth.php';

$validation_hash = null;
$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['validation_key'])) {
    $input = trim((string) $_POST['validation_key']);

    if ($input !== '') {
        $validation_hash = setValidationCookieFromKey($input);
        $message = 'Validation key has been set successfully!';
    } else {
        $error = 'Please enter a validation key.';
    }
}

if (
    isset($_COOKIE['validation'])
    && $validation_hash === null
    && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'
) {
    $validation_hash = (string) $_COOKIE['validation'];
}

$warmPaperVersion = (string) @filemtime(__DIR__ . '/../warm-paper/warm-paper.css');
$loginCssVersion = (string) @filemtime(__DIR__ . '/login.css');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#315f8d">
    <title>Sign in — Notes</title>
    <link rel="stylesheet" href="../warm-paper/warm-paper.css?v=<?php echo htmlspecialchars($warmPaperVersion, ENT_QUOTES, 'UTF-8'); ?>">
    <link rel="stylesheet" href="login.css?v=<?php echo htmlspecialchars($loginCssVersion, ENT_QUOTES, 'UTF-8'); ?>">
</head>
<body class="wp-theme notes-auth">
    <main class="notes-auth__shell">
        <section class="wp-panel notes-auth__panel" aria-labelledby="notes-auth-title">
            <div class="notes-auth__brand">
                <span class="wp-header__brand-mark" aria-hidden="true">N</span>
                <span class="notes-auth__brand-name">Notes</span>
            </div>

            <h1 id="notes-auth-title" class="wp-page-title">Sign in</h1>
            <p class="wp-page-description">Enter your validation key to continue.</p>

            <form class="notes-auth__form" method="POST" action="">
                <div class="wp-field">
                    <label class="wp-label" for="validation_key">Validation key</label>
                    <input
                        class="wp-input"
                        type="text"
                        id="validation_key"
                        name="validation_key"
                        placeholder="Enter validation key"
                        autocomplete="off"
                        autofocus
                    >
                </div>

                <button type="submit" class="wp-button wp-button--primary">Set validation</button>
            </form>

            <?php if ($message !== '') : ?>
                <div class="wp-alert wp-alert--success" role="status">
                    <?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?>
                </div>
            <?php endif; ?>

            <?php if ($error !== '') : ?>
                <div class="wp-alert wp-alert--error" role="alert">
                    <?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?>
                </div>
            <?php endif; ?>

            <?php if ($validation_hash !== null) : ?>
                <div class="notes-auth__hash">
                    <span class="notes-auth__hash-label">Validation hash (shown once)</span>
                    <a class="notes-auth__hash-value" href="../app.php">
                        <?php echo htmlspecialchars($validation_hash, ENT_QUOTES, 'UTF-8'); ?>
                    </a>
                    <div class="notes-auth__actions">
                        <a class="wp-button wp-button--primary" href="../app.php">Continue</a>
                    </div>
                </div>
            <?php endif; ?>
        </section>
    </main>
</body>
</html>
