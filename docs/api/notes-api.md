# Notes API

## Purpose

Describe the HTTP entrypoint, request routing, and the note-oriented API contract used by the frontend application.

## Location

- API entrypoint: `/Users/maxbisschop/dev/www/notes2/api.php`
- GET handler: `/Users/maxbisschop/dev/www/notes2/api/handlers/get.php`
- POST handler: `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- PUT handler: `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
- DELETE handler: `/Users/maxbisschop/dev/www/notes2/api/handlers/delete.php`

## Inputs/Outputs

- Inputs:
  - `GET` requests for all notes, metadata-only note lists, one note by `id`, or lightweight freshness fields
  - `POST` requests for note creation
  - `PUT` requests for note updates, pinning, and public-default setting changes
  - `DELETE` requests for note removal
- Outputs:
  - JSON responses for notes, note lists, metadata updates, and errors
  - `409 conflict` responses for optimistic-lock failures
  - `404` responses when note targets do not exist

## Flow/Behavior

1. `api.php` always aims to return JSON.
   - shutdown and exception handling convert fatals into JSON payloads
   - config, database helpers, sanitization config, and utility functions are loaded before dispatch

2. `GET` supports legacy full-list and single-note modes.
   - Without `id`, the API returns all notes plus `public_default_hash_id`
   - With `id`, the API returns one note by `hash_id`
   - With `fields=version,updated_at`, the API returns only freshness data for the selected note

3. `GET view=list` returns a bounded metadata-only list.
   - `content` and the internal numeric note ID are omitted
   - each item includes `hash_id`, `title`, `preview`, `is_pinned`, timestamps, `version`, and `tags`
   - `limit` defaults to 50 and accepts values from 1 through 100
   - `q` performs a case-insensitive substring search across title, complete HTML content, and tags
   - `tags` accepts a comma-separated value or a query-string array and requires every selected tag to match
   - results sort pinned notes first, then by most recently updated
   - `has_more` reports whether the bounded result has additional matches
   - the legacy no-parameter response remains unchanged for frontend compatibility

4. Metadata list previews are generated server-side.
   - the API reads only an initial bounded content excerpt for preview generation
   - block-level HTML is converted to spacing, tags are stripped, entities are decoded, and whitespace is normalized
   - previews are limited to 160 characters

5. `POST` creates notes.
   - request JSON can contain `title`, `content`, `tags`, and `is_pinned`
   - note HTML is sanitized before insert
   - the inserted note is reloaded and returned with tags attached

6. `PUT` handles sharing, settings, pinning, and note updates.
   - `set_public_default` stores or clears the Default Published note
   - `set_sharing` publishes, disables, or regenerates a note’s public link
   - `set_pinned` toggles a note’s pinned flag and bumps its version
   - standard note update writes title, content, tags, and pin state

7. Standard `PUT` note updates use optimistic locking.
   - the client sends `expected_version`
   - the server updates only when the database version matches
   - a mismatch returns `409 conflict` with current server data and version details

8. Forced overwrite is explicit.
   - when `force_overwrite` is true and the server has a newer version, the API first copies the overwritten server version into a new note
   - the original note is then updated unconditionally and its version is bumped

9. `DELETE` removes a note by `hash_id`.
   - deleting the Default Published note also clears the default setting
   - the response includes the remaining `public_default_hash_id`, or `null`

## Edge Cases/Failure Modes

- When request JSON is invalid:
  - handlers return `400 Invalid JSON`

- When metadata-list `limit` is malformed or outside 1 through 100:
  - the API returns `400`

- When metadata-list `q` is longer than 200 characters:
  - the API returns `400`

- When database preparation or execution fails:
  - shared database error helpers emit JSON error responses

- When a note is missing:
  - single-note GETs return `{"error":"Note not found"}`
  - pin updates and standard updates can return `404`

- When the client omits `expected_version` on a normal update:
  - the API rejects the request with `400`

- When overwrite-copy logic runs during a force overwrite:
  - the copied note title gains ` (version overwritten)` so the prior server version remains inspectable

## Related Files

- `/Users/maxbisschop/dev/www/notes2/api.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/get.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/post.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/put.php`
- `/Users/maxbisschop/dev/www/notes2/api/handlers/delete.php`
- `/Users/maxbisschop/dev/www/notes2/api/error_handler.php`
- `/Users/maxbisschop/dev/www/notes2/api/tags_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/pin_helper.php`
- `/Users/maxbisschop/dev/www/notes2/api/settings_helper.php`
