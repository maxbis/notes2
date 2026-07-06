# Project Overview

## Purpose

Document the overall structure of the Notes project so future feature docs have a stable starting point and new contributors can quickly locate the main runtime paths.

## Location

- Source root: `/Users/maxbisschop/dev/www/notes2`
- Main authenticated app shell: `/Users/maxbisschop/dev/www/notes2/app.php`
- Frontend entrypoint: `/Users/maxbisschop/dev/www/notes2/app.js`
- API entrypoint: `/Users/maxbisschop/dev/www/notes2/api.php`
- Public read-only page: `/Users/maxbisschop/dev/www/notes2/public.php`
- Existing save doc: `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`

## Inputs/Outputs

- Inputs:
  - authenticated browser requests to `app.php`
  - frontend fetch requests to `api.php`
  - public note links to `public.php?id=...`
  - database state in `notes`, `note_tags`, and `settings`
- Outputs:
  - interactive note editor UI
  - JSON API responses for note CRUD and metadata updates
  - read-only public note rendering
  - mirrored documentation files in `docs/`

## Flow/Behavior

1. `index.php` redirects the browser to `app.php`.
2. `app.php` renders the authenticated application shell and loads `app.js` plus shared styles from `style.css`.
3. `app.js` wires together the frontend modules in `js/` for note loading, editing, saving, search, tags, sharing, import, export, and inspector behavior.
4. Frontend data operations call `api.php`, which sets up error handling, opens the database connection, and dispatches to method-specific handlers in `api/handlers/`.
5. API handlers use shared helpers in `api/` for sanitization, tags, settings, pinning, database access, and error formatting.
6. `public.php` renders a sanitized note in a read-only layout and can optionally redirect to a configured default public note.
7. `schema.sql` currently documents additive schema changes for settings, note tags, and pinning support.

## Edge Cases/Failure Modes

- When project docs are missing:
  - the source code remains the system of record
  - new docs should be added under `docs/` using mirrored source structure

- When frontend and backend sanitization rules drift:
  - paste behavior and server-side saved HTML can diverge
  - both `js/smart-paste.js` and `api/config.php` plus `api/sanitize.php` need to be checked together

- When concurrent editors update the same note:
  - the save flow depends on optimistic locking in `api/handlers/put.php`
  - the frontend save queue and stale-note handling need to stay aligned with the API contract

- When public access is enabled without a configured default note:
  - `public.php` falls back to an error page instead of redirecting

## Related Files

- `/Users/maxbisschop/dev/www/notes2/index.php`
- `/Users/maxbisschop/dev/www/notes2/app.php`
- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/style.css`
- `/Users/maxbisschop/dev/www/notes2/public.php`
- `/Users/maxbisschop/dev/www/notes2/api.php`
- `/Users/maxbisschop/dev/www/notes2/api/`
- `/Users/maxbisschop/dev/www/notes2/js/`
- `/Users/maxbisschop/dev/www/notes2/schema.sql`
