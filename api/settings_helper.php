<?php
// Settings table helpers for key-value app settings (e.g. public "easy access" default note).

/**
 * Get a setting value by name. Returns null if not set or table missing.
 */
function get_setting(mysqli $conn, string $name): ?string {
    $stmt = $conn->prepare("SELECT value FROM settings WHERE name = ? LIMIT 1");
    if (!$stmt) return null;
    $stmt->bind_param("s", $name);
    if (!$stmt->execute()) {
        $stmt->close();
        return null;
    }
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();
    return $row && isset($row['value']) ? (string) $row['value'] : null;
}

/**
 * Set a setting. Use value = null or '' to clear.
 */
function set_setting(mysqli $conn, string $name, ?string $value): bool {
    $value = $value ?? '';
    $stmt = $conn->prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)");
    if (!$stmt) return false;
    $stmt->bind_param("ss", $name, $value);
    $ok = $stmt->execute();
    $stmt->close();
    return $ok;
}
