<?php
// Simple diagnostic test for API
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

$errors = [];
$success = [];

// Test 1: Check if files exist
$files_to_check = [
    'config.php',
    'api/error_handler.php',
    'api/database.php',
    'api/config.php',
    'api/utils.php',
    'api/handlers/get.php',
    'api/handlers/post.php',
    'api/handlers/put.php',
    'api/handlers/delete.php',
];

foreach ($files_to_check as $file) {
    $path = __DIR__ . '/' . $file;
    if (file_exists($path)) {
        $success[] = "File exists: $file";
    } else {
        $errors[] = "File missing: $file (checked: $path)";
    }
}

// Test 2: Try to load config
try {
    require_once __DIR__ . '/config.php';
    $success[] = "config.php loaded";
    
    if (defined('DB_HOST')) {
        $success[] = "DB_HOST defined: " . DB_HOST;
    } else {
        $errors[] = "DB_HOST not defined";
    }
} catch (Throwable $e) {
    $errors[] = "Error loading config.php: " . $e->getMessage();
}

// Test 3: Try to load error handler
try {
    require_once __DIR__ . '/api/error_handler.php';
    $success[] = "error_handler.php loaded";
    
    if (function_exists('__notes_json_error')) {
        $success[] = "__notes_json_error function exists";
    } else {
        $errors[] = "__notes_json_error function not found";
    }
} catch (Throwable $e) {
    $errors[] = "Error loading error_handler.php: " . $e->getMessage();
}

// Test 4: Try to load database
try {
    require_once __DIR__ . '/api/database.php';
    $success[] = "database.php loaded";
    
    if (function_exists('getDBConnection')) {
        $success[] = "getDBConnection function exists";
    } else {
        $errors[] = "getDBConnection function not found";
    }
} catch (Throwable $e) {
    $errors[] = "Error loading database.php: " . $e->getMessage();
}

// Test 5: PHP version
$success[] = "PHP version: " . PHP_VERSION;

// Test 6: Check __DIR__
$success[] = "__DIR__ resolves to: " . __DIR__;

echo json_encode([
    'success' => $success,
    'errors' => $errors,
    'php_version' => PHP_VERSION,
    'current_dir' => __DIR__,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
