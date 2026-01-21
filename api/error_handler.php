<?php
// Error handling functions for API

function __notes_json_error(int $statusCode, string $message, array $extra = []): void {
    global $__notes_request_id;
    // Initialize request_id if not set (fallback for errors before setup)
    if (!isset($__notes_request_id)) {
        $__notes_request_id = bin2hex(random_bytes(6));
    }
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
    if (isset($__notes_debug) && $__notes_debug) {
        $extra['mysql_errno'] = (int)$conn->errno;
        $extra['mysql_error'] = (string)$conn->error;
    }
    __notes_json_error($statusCode, 'Database error', $extra);
}

function __notes_setup_error_handlers(): void {
    global $__notes_request_id, $__notes_debug;
    
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
    
    set_exception_handler(function (Throwable $e) use (&$__notes_debug) {
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

    register_shutdown_function(function () use (&$__notes_debug) {
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
}
