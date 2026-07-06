# Tags, Pins, And Settings Helpers

## Purpose

Document the backend helper modules that normalize note metadata, attach tags to API responses, manage pin state values, and persist lightweight app settings.

## Location

- Tag helpers: `/Users/maxbisschop/dev/www/notes2/api/tags_helper.php`
- Pin helpers: `/Users/maxbisschop/dev/www/notes2/api/pin_helper.php`
- Settings helpers: `/Users/maxbisschop/dev/www/notes2/api/settings_helper.php`
- Utility helpers: `/Users/maxbisschop/dev/www/notes2/api/utils.php`

## Inputs/Outputs

- Inputs:
  - raw tag arrays from client requests
  - raw pin values from client requests or database rows
  - note IDs used to load or replace tag rows
  - setting names and values such as `public_default_hash_id`
- Outputs:
  - normalized tags
  - normalized `is_pinned` values
  - note payloads enriched with `tags`
  - stored and loaded key-value settings
  - generated note `hash_id` values

## Flow/Behavior

1. Tag helpers normalize all tags before storage.
   - tags are trimmed, lowercased, whitespace-collapsed, deduplicated, limited to 64 characters, and sorted
2. Tag helper loading supports both single-note and bulk-note attachment.
   - single-note responses call `attach_tags_to_note()`
   - note-list responses call `attach_tags_to_notes()`
3. Tag replacement rewrites the complete tag set for a note.
   - existing rows are deleted first
   - new rows are inserted one by one
4. Pin helpers coerce mixed input forms into `0` or `1`.
   - booleans, numbers, and string values such as `true`, `yes`, and `on` are supported
5. Settings helpers provide simple key-value storage in the `settings` table.
   - `get_setting()` returns `null` when no value exists
   - `set_setting()` inserts or updates values in place
6. Utility helpers currently provide `generateHashId()` for note creation and overwrite-copy flows.

## Edge Cases/Failure Modes

- When tag input is not an array:
  - normalization returns an empty tag list

- When duplicate tags arrive with different casing:
  - normalization collapses them to one stored value

- When no tag rows exist for a note:
  - tag attachment returns an empty `tags` array rather than omitting the field

- When the settings table is missing or a settings query fails:
  - callers can receive `null` or `false` depending on helper path
  - public easy-access behavior may silently fall back to no redirect

- When pin input uses unexpected scalar forms:
  - helper coercion defaults to `0` unless the value clearly maps to a truthy pinned state

## Related Files

- `/Users/maxbisschop/dev/www/notes2/api/tags_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/pin_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/settings_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/utils.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/get.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
