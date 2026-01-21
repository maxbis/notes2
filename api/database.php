<?php
// Database helper functions

/**
 * Create database connection using credentials from config.php
 */
function getDBConnection() {
    try {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            throw new Exception("Connection failed: " . $conn->connect_error);
        }
        $conn->set_charset("utf8mb4");
        return $conn;
    } catch (Exception $e) {
        // Let the caller decide how to render the error (JSON API, HTML, etc.)
        throw new Exception("Database connection error: " . $e->getMessage(), 0, $e);
    }
}

/**
 * Fetch a single row from a prepared statement
 * Handles both mysqlnd (get_result) and fallback (bind_result) methods
 */
function fetch_assoc_from_stmt(mysqli_stmt $stmt): ?array {
    if (method_exists($stmt, 'get_result')) {
        $result = $stmt->get_result();
        if ($result === false) return null;
        return $result->fetch_assoc();
    } else {
        $meta = $stmt->result_metadata();
        if ($meta === false) return null;
        $row = [];
        $bind = [];
        while ($field = $meta->fetch_field()) {
            $row[$field->name] = null;
            $bind[] = &$row[$field->name];
        }
        $meta->free();
        if ($bind) {
            call_user_func_array([$stmt, 'bind_result'], $bind);
            if ($stmt->fetch()) {
                // Copy values to break references (PHP < 7.4 compatibility)
                return array_map(function($v) { return $v; }, $row);
            }
            return null;
        } else {
            return null;
        }
    }
}
