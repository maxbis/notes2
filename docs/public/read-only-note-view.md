# Read-Only Note View

## Purpose

Describe how public note links are resolved and rendered outside the authenticated editor shell.

## Location

- Public entrypoint and renderer: `/Users/maxbisschop/dev/www/notes2/public.php`
- Shared note styles: `/Users/maxbisschop/dev/www/notes2/style.css`
- Public-default setting helper: `/Users/maxbisschop/dev/www/notes2/api/settings_helper.php`

## Inputs/Outputs

- Inputs:
  - query parameter `?id=...` for a note hash
  - optional public default note stored in settings
  - note title, content, and timestamps from the database
- Outputs:
  - a read-only HTML note page
  - error pages for missing IDs, missing notes, and server failures
  - redirect behavior when public easy access is enabled and no explicit `id` is supplied

## Flow/Behavior

1. `public.php` loads configuration, database helpers, and settings helpers.
2. If no `id` is provided:
   - the script checks whether public easy access is enabled
   - it looks up `public_default_hash_id`
   - if a default note exists, the request redirects to `public.php?id=...`
3. If no note can be resolved, the page renders a standalone error view instead of the authenticated app shell.
4. For valid notes:
   - the page loads title, content, `created_at`, and `updated_at`
   - the note title is escaped before output
   - note content is rendered as stored HTML because content is sanitized on write
5. The page reuses the editor visual language in a reduced read-only layout.
6. Highlight.js is loaded for `pre code` blocks.
   - if a `pre` block does not already contain `code`, the script wraps its content before highlighting

## Edge Cases/Failure Modes

- When no `id` is supplied and no public default exists:
  - the page returns a `400 Missing note id` error view

- When the database connection fails:
  - the page returns a `500 Server error` view rather than an incomplete HTML page

- When the note does not exist:
  - the page returns a `404 Not found` error view

- When note content includes code blocks without explicit nested `code` tags:
  - the client-side highlight bootstrapping wraps those blocks before applying syntax highlighting

## Related Files

- `/Users/maxbisschop/dev/www/notes2/public.php`
- `/Users/maxbisschop/dev/www/notes2/style.css`
- `/Users/maxbisschop/dev/www/notes2/api/database.php`
- `/Users/maxbisschop/dev/www/notes2/api/settings_helper.php`
- `/Users/maxbisschop/dev/www/notes2/docs/api/notes-api.md`
