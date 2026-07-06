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
  - `GET` requests for all notes, one note by `id`, or lightweight freshness fields
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

2. `GET` supports two main modes.
   - Without `id`, the API returns all notes plus `public_default_hash_id`
   - With `id`, the API returns one note by `hash_id`
   - With `fields=version,updated_at`, the API returns only freshness data for the selected note

3. `POST` creates notes.
   - request JSON can contain `title`, `content`, `tags`, and `is_pinned`
   - note HTML is sanitized before insert
   - the inserted note is reloaded and returned with tags attached

4. `PUT` handles three branches.
   - `set_public_default` stores or clears the public easy-access default note
   - `set_pinned` toggles a note’s pinned flag and bumps its version
   - standard note update writes title, content, tags, and pin state

5. Standard `PUT` note updates use optimistic locking.
   - the client sends `expected_version`
   - the server updates only when the database version matches
   - a mismatch returns `409 conflict` with current server data and version details

6. Forced overwrite is explicit.
   - when `force_overwrite` is true and the server has a newer version, the API first copies the overwritten server version into a new note
   - the original note is then updated unconditionally and its version is bumped

7. `DELETE` removes a note by `hash_id`.

## Edge Cases/Failure Modes

- When request JSON is invalid:
  - handlers return `400 Invalid JSON`

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
