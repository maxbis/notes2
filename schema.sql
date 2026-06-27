CREATE TABLE IF NOT EXISTS settings (
    name VARCHAR(64) PRIMARY KEY,
    value TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS note_tags (
    note_id INT NOT NULL,
    tag VARCHAR(64) NOT NULL,
    PRIMARY KEY (note_id, tag),
    KEY idx_note_tags_tag (tag),
    CONSTRAINT fk_note_tags_note_id
        FOREIGN KEY (note_id) REFERENCES notes(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE notes
    ADD COLUMN IF NOT EXISTS is_pinned TINYINT(1) NOT NULL DEFAULT 0;
