<?php

function ensure_note_pinning_column(mysqli $conn): void {
    $result = $conn->query("SHOW COLUMNS FROM notes LIKE 'is_pinned'");
    if ($result === false) {
        __notes_db_fail($conn, 'query: show is_pinned column');
    }
    $hasColumn = $result->num_rows > 0;
    $result->free();

    if ($hasColumn) return;

    $alter = "ALTER TABLE notes ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0";
    if ($conn->query($alter) === false) {
        __notes_db_fail($conn, 'query: add is_pinned column');
    }
}

function normalize_note_pinned($value): int {
    if (is_bool($value)) return $value ? 1 : 0;
    if (is_numeric($value)) return ((int)$value) === 1 ? 1 : 0;
    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        return in_array($normalized, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
    }
    return 0;
}
