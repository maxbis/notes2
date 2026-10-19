# Project Overview

## Purpose

Document the overall structure of the Notes project so future feature docs have a stable starting point and new contributors can quickly locate the main runtime paths.

## Location

- Source root: `/Users/maxbisschop/dev/www/notes2`
- Web document root: `/Users/maxbisschop/dev/www/notes2/public`
- Main authenticated app shell: `/Users/maxbisschop/dev/www/notes2/app.php`
- Frontend entrypoint: `/Users/maxbisschop/dev/www/notes2/public/app.js`
- API entrypoint: `/Users/maxbisschop/dev/www/notes2/api.php`
- Public read-only page: `/Users/maxbisschop/dev/www/notes2/public.php`
- Existing save doc: `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`

## Inputs/Outputs

- Inputs:
  - authenticated browser requests to `app.php`
  - frontend fetch requests to `api.php`
  - public note links to `/public/?id=...`
  - database state in `notes`, `note_tags`, and `settings`
- Outputs:
  - interactive note editor UI
  - JSON API responses for note CRUD and metadata updates
  - read-only public note rendering
  - mirrored documentation files in `docs/`

## Flow/Behavior

1. `public/index.php` redirects the browser to `app.php`.
2. The PHP entrypoints in `public/` include their implementations from the source root, keeping configuration and helpers outside the document root.
3. `app.php` renders the authenticated application shell and loads `public/app.js` plus shared styles from `public/style.css`.
4. `public/app.js` wires together the frontend modules in `public/js/` for note loading, editing, saving, search, tags, sharing, import, export, and inspector behavior.
5. Frontend data operations call `public/api.php`, which includes the API implementation and dispatches to method-specific handlers in `api/handlers/`.
6. API handlers use shared helpers in `api/` for sanitization, tags, settings, pinning, database access, and error formatting.
7. `public/public/index.php` includes `public.php` to render a sanitized note in a read-only layout.
8. `schema.sql` currently documents additive schema changes for settings, note tags, and pinning support.

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
- `/Users/maxbisschop/dev/www/notes2/public/index.php`
- `/Users/maxbisschop/dev/www/notes2/public/app.php`
- `/Users/maxbisschop/dev/www/notes2/public/api.php`
- `/Users/maxbisschop/dev/www/notes2/public/public/index.php`
- `/Users/maxbisschop/dev/www/notes2/app.php`
- `/Users/maxbisschop/dev/www/notes2/public/app.js`
- `/Users/maxbisschop/dev/www/notes2/public/style.css`
- `/Users/maxbisschop/dev/www/notes2/public.php`
- `/Users/maxbisschop/dev/www/notes2/api.php`
- `/Users/maxbisschop/dev/www/notes2/api/`
- `/Users/maxbisschop/dev/www/notes2/public/js/`
- `/Users/maxbisschop/dev/www/notes2/schema.sql`
