# Schema And Migrations

## Purpose

Capture the database objects that this project currently defines outside the base `notes` table and explain the behavioral role of each addition.

## Location

- Schema changes: `/Users/maxbisschop/dev/www/notes2/schema.sql`

## Inputs/Outputs

- Inputs:
  - existing application database with a pre-existing `notes` table
  - migration statements in `schema.sql`
- Outputs:
  - `settings` table for key-value app settings
  - `note_tags` table for normalized note tags
  - `is_pinned` column on `notes`

## Flow/Behavior

1. `settings` stores app-level key-value data.
   - current documented usage is `public_default_hash_id`
2. `note_tags` stores tags outside the main `notes` row.
   - each row links one note to one normalized tag
   - the composite primary key prevents duplicate tags on the same note
   - the foreign key cascades deletes when a note is removed
3. `notes.is_pinned` stores whether a note should sort above unpinned notes in the UI.

## Edge Cases/Failure Modes

- When the base `notes` table is absent:
  - `schema.sql` is not sufficient by itself to create the whole application database
  - it only documents additive structures layered on top of that table

- When tags are deleted or replaced:
  - helper code rewrites rows in `note_tags`
  - referential integrity depends on the note foreign key

- When migrations are applied to a database that already has `is_pinned`:
  - the `ADD COLUMN IF NOT EXISTS` clause avoids duplicate-column failure on supported MySQL versions

## Related Files

- `/Users/maxbisschop/dev/www/notes2/schema.sql`
- `/Users/maxbisschop/dev/www/notes2/api/tags_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/settings_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/pin_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/get.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
