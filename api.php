<?php
declare(strict_types=1);

// Ensure API always returns JSON (even on fatals) so the frontend can show a useful error.
// Optional debug mode:
// - Set `define('NOTES_DEBUG_TOKEN', '...');` in config.php (recommended, config.php is gitignored)
// - Then call: api.php?debug=1&token=YOUR_TOKEN

ob_start();

// Load error handlers first
require_once __DIR__ . '/api/error_handler.php';
__notes_setup_error_handlers();

// Load config (absolute path). Any fatal here will be converted to JSON by the shutdown handler above.
require_once __DIR__ . '/config.php';
// Load database functions
require_once __DIR__ . '/api/database.php';

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
