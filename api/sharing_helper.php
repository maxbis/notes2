<?php
// Schema and value helpers for revocable public note links.

function ensure_note_sharing_schema(mysqli $conn): void {
    $tokenColumn = $conn->query("SHOW COLUMNS FROM notes LIKE 'public_token'");
    $needsBackfill = $tokenColumn && $tokenColumn->num_rows === 0;

    if ($needsBackfill) {
        if (!$conn->query("ALTER TABLE notes ADD COLUMN public_token VARCHAR(64) NULL AFTER hash_id")) {
            throw new Exception('Failed to add public_token: ' . $conn->error);
        }
    }

    $publishedColumn = $conn->query("SHOW COLUMNS FROM notes LIKE 'is_published'");
    if ($publishedColumn && $publishedColumn->num_rows === 0) {
        if (!$conn->query("ALTER TABLE notes ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 0 AFTER public_token")) {
            throw new Exception('Failed to add is_published: ' . $conn->error);
        }
    }

    // Preserve links created before explicit sharing controls were introduced.
    if ($needsBackfill) {
        if (!$conn->query("UPDATE notes SET public_token = hash_id, is_published = 1")) {
            throw new Exception('Failed to migrate existing public links: ' . $conn->error);
        }
    }

    $tokenIndex = $conn->query("SHOW INDEX FROM notes WHERE Key_name = 'uq_notes_public_token'");
    if ($tokenIndex && $tokenIndex->num_rows === 0) {
        if (!$conn->query("ALTER TABLE notes ADD UNIQUE KEY uq_notes_public_token (public_token)")) {
            throw new Exception('Failed to index public_token: ' . $conn->error);
        }
    }
}

function generate_public_token(): string {
    return bin2hex(random_bytes(16));
}

function normalize_note_sharing(?array $note): ?array {
    if (!$note) return null;
    $note['is_published'] = (int)($note['is_published'] ?? 0);
    $note['public_token'] = $note['public_token'] ?? null;
    return $note;
}
