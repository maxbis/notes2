<?php
/**
 * Notes - Config/DB health check
 *
 * Usage (CLI):
 *   php check-config.php
 *
 * Usage (Browser):
 *   /check-config.php
 *
 * Security:
 *   This reveals environment/config details. Delete/disable after use.
 */
declare(strict_types=1);

function is_cli(): bool {
    return PHP_SAPI === 'cli' || PHP_SAPI === 'phpdbg';
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function print_header(bool $cli, string $title): void {
    if ($cli) {
        echo $title . PHP_EOL;
        echo str_repeat('=', strlen($title)) . PHP_EOL . PHP_EOL;
        return;
    }

    header('Content-Type: text/html; charset=UTF-8');
    $safeTitle = h($title);
    echo "<!doctype html>\n<html lang=\"en\">\n<head>\n";
    echo "  <meta charset=\"utf-8\" />\n";
    echo "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n";
    echo "  <title>{$safeTitle}</title>\n";
    echo "  <style>
        :root { color-scheme: light dark; }
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; }
        .wrap { max-width: 920px; margin: 0 auto; }
        h1 { margin: 0 0 12px; font-size: 22px; }
        .meta { opacity: 0.8; margin: 0 0 18px; }
        .card { border: 1px solid rgba(127,127,127,.35); border-radius: 12px; padding: 16px; }
        ul { margin: 0; padding-left: 18px; }
        li { margin: 8px 0; }
        .ok { color: #0a7b34; }
        .warn { color: #a16b00; }
        .fail { color: #b00020; }
        code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; }
        .foot { margin-top: 14px; opacity: 0.85; font-size: 13px; }
        @media (prefers-color-scheme: dark) {
          .ok { color: #43d17a; }
          .warn { color: #f1c04a; }
          .fail { color: #ff6b6b; }
        }
      </style>\n";
    echo "</head>\n<body>\n<div class=\"wrap\">\n";
    echo "<h1>{$safeTitle}</h1>\n";
    echo "<p class=\"meta\">SAPI: <code>" . h(PHP_SAPI) . "</code> · PHP: <code>" . h(PHP_VERSION) . "</code></p>\n";
    echo "<div class=\"card\">\n<ul>\n";
}

function print_footer(bool $cli, int $exitCode): void {
    if ($cli) {
        echo PHP_EOL;
        echo "Exit code: {$exitCode}" . PHP_EOL;
        return;
    }
    echo "</ul>\n";
    echo "<p class=\"foot\">Exit code: <code>" . h((string)$exitCode) . "</code>. For security, delete <code>check-config.php</code> after you’re done.</p>\n";
    echo "</div>\n</div>\n</body>\n</html>\n";
}

function out(bool $cli, string $status, string $label, string $detail = ''): void {
    $status = strtolower($status);
    $tag = $status === 'ok' ? 'OK' : ($status === 'warn' ? 'WARN' : 'FAIL');

    if ($cli) {
        $line = "[{$tag}] {$label}";
        if ($detail !== '') $line .= " - {$detail}";
        echo $line . PHP_EOL;
        return;
    }

    $cls = $status === 'ok' ? 'ok' : ($status === 'warn' ? 'warn' : 'fail');
    $safeLabel = h($label);
    $safeDetail = $detail !== '' ? ' — ' . h($detail) : '';
    echo "<li><strong class=\"{$cls}\">{$tag}</strong> {$safeLabel}{$safeDetail}</li>\n";
}

$cli = is_cli();
$exit = 0;

print_header($cli, 'Notes config / database check');

// Step 1: Load config.php
$configPath = __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
if (!is_file($configPath)) {
    out($cli, 'fail', 'config.php not found', "Expected at: {$configPath}");
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}
if (!is_readable($configPath)) {
    out($cli, 'fail', 'config.php is not readable', "Path: {$configPath}");
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

try {
    require_once $configPath;
    out($cli, 'ok', 'Loaded config.php', $configPath);
} catch (Throwable $e) {
    out($cli, 'fail', 'Failed to load config.php', $e->getMessage());
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

// Step 2: Validate mysqli extension
if (!extension_loaded('mysqli') || !class_exists('mysqli')) {
    out($cli, 'fail', 'PHP mysqli extension missing', 'Enable/install mysqli to connect to MySQL/MariaDB');
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}
out($cli, 'ok', 'mysqli extension available');

// Step 3: Validate expected config constants
$required = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
foreach ($required as $name) {
    if (!defined($name)) {
        out($cli, 'fail', "Missing constant {$name}", 'Define it in config.php');
        $exit = 1;
    }
}
if ($exit !== 0) {
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

$dbHost = (string)constant('DB_HOST');
$dbUser = (string)constant('DB_USER');
$dbPass = (string)constant('DB_PASS');
$dbName = (string)constant('DB_NAME');

out($cli, $dbHost !== '' ? 'ok' : 'fail', 'DB_HOST', $dbHost !== '' ? $dbHost : 'Empty');
out($cli, $dbUser !== '' ? 'ok' : 'fail', 'DB_USER', $dbUser !== '' ? $dbUser : 'Empty');
out($cli, 'ok', 'DB_PASS', $dbPass === '' ? '(empty)' : '(set)');
out($cli, $dbName !== '' ? 'ok' : 'fail', 'DB_NAME', $dbName !== '' ? $dbName : 'Empty');

if ($dbHost === '' || $dbUser === '' || $dbName === '') {
    out($cli, 'fail', 'Configuration incomplete', 'Fix empty DB_* values in config.php');
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

// Step 4: Connect (use existing app helper if present)
// Load database functions
if (file_exists(__DIR__ . '/api/database.php')) {
    require_once __DIR__ . '/api/database.php';
}
if (!function_exists('getDBConnection')) {
    out($cli, 'fail', 'getDBConnection() not found', 'Expected it to be defined by api/database.php');
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

try {
    /** @var mysqli $conn */
    $conn = getDBConnection();
    out($cli, 'ok', 'Database connection established');
} catch (Throwable $e) {
    $msg = $e->getMessage();
    out($cli, 'fail', 'Database connection failed', $msg);
    out($cli, 'warn', 'Tip', 'Verify host/user/pass/db and that MySQL is running & reachable');
    $exit = 1;
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

// Step 5: Run query
$sql = "SELECT COUNT(*) AS cnt FROM notes";
$res = $conn->query($sql);
if ($res === false) {
    $errno = (int)$conn->errno;
    $err = (string)$conn->error;
    out($cli, 'fail', 'Query failed', "MySQL errno {$errno}: {$err}");
    if ($errno === 1146) {
        out($cli, 'warn', 'Tip', 'Table "notes" not found. Did you run the database schema / migrations?');
    } elseif ($errno === 1044 || $errno === 1045) {
        out($cli, 'warn', 'Tip', 'Access denied. Check DB_USER/DB_PASS and GRANT permissions for this database.');
    } else {
        out($cli, 'warn', 'SQL', $sql);
    }
    $exit = 1;
    $conn->close();
    print_footer($cli, $exit);
    if ($cli) exit($exit);
    return;
}

$row = $res->fetch_assoc();
$count = isset($row['cnt']) ? (int)$row['cnt'] : null;
$res->free();

if ($count === null) {
    out($cli, 'fail', 'Unexpected query result', 'Could not read COUNT(*) value');
    $exit = 1;
} else {
    out($cli, 'ok', 'notes table readable', "COUNT(*) = {$count}");
}

$conn->close();
print_footer($cli, $exit);
if ($cli) exit($exit);

