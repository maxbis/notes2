<?php
declare(strict_types=1);

// Ensure API always returns JSON (even on fatals) so the frontend can show a useful error.
// Optional debug mode:
// - Set `define('NOTES_DEBUG_TOKEN', '...');` in config.php (recommended, config.php is gitignored)
// - Then call: api.php?debug=1&token=YOUR_TOKEN

ob_start();

// Set basic error handler first (before loading anything)
register_shutdown_function(function () {
    $err = error_get_last();
    if (!$err) return;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'] ?? 0, $fatalTypes, true)) return;
    
    if (ob_get_level() > 0) @ob_clean();
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'request_id' => bin2hex(random_bytes(6)),
        'details' => $err['message'] ?? 'Unknown error',
        'file' => $err['file'] ?? null,
        'line' => $err['line'] ?? null,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
});

// Load error handlers
try {
    require_once __DIR__ . '/api/error_handler.php';
    if (function_exists('__notes_setup_error_handlers')) {
        __notes_setup_error_handlers();
    }
} catch (Throwable $e) {
    if (ob_get_level() > 0) @ob_clean();
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to load error handlers',
        'request_id' => bin2hex(random_bytes(6)),
        'details' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

// Shared-key cookie gate (same validation cookie as app.php)
require_once __DIR__ . '/login/auth.php';
if (!validateUser()) {
    if (ob_get_level() > 0) {
        @ob_clean();
    }
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    http_response_code(403);
    $payload = ['error' => 'Unauthorized'];
    $debugReason = notes_validation_debug_reason();
    if ($debugReason !== null) {
        $payload['debug'] = $debugReason;
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
refreshValidationCookie();

// Load config (absolute path). Any fatal here will be converted to JSON by the shutdown handler above.
require_once __DIR__ . '/config.php';
// Load database functions
require_once __DIR__ . '/api/database.php';
// Load HTML sanitization config (needed by handlers)
require_once __DIR__ . '/api/config.php';
// Load utility functions (needed by handlers)
require_once __DIR__ . '/api/utils.php';

if (!headers_sent()) header('Content-Type: application/json; charset=UTF-8');

// Get database connection
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    global $__notes_debug;
    $extra = [];
    if ($__notes_debug) $extra['details'] = $e->getMessage();
    __notes_json_error(500, 'Database connection failed', $extra);
}

// Route to appropriate handler
switch ($method) {
    case 'GET':
        require_once __DIR__ . '/api/handlers/get.php';
        handle_get($conn);
        break;
        
    case 'POST':
        require_once __DIR__ . '/api/handlers/post.php';
        handle_post($conn);
        break;
        
    case 'PUT':
        require_once __DIR__ . '/api/handlers/put.php';
        handle_put($conn);
        break;
        
    case 'DELETE':
        require_once __DIR__ . '/api/handlers/delete.php';
        handle_delete($conn);
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>
