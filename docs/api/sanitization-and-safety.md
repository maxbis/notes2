# Sanitization And Safety

## Purpose

Document the backend safety rules that keep stored note HTML constrained, normalize error responses, and reduce frontend/backend drift around allowed markup.

## Location

- Allowed tags and attributes: `/Users/maxbisschop/dev/www/notes2/api/config.php`
- Server-side sanitizer: `/Users/maxbisschop/dev/www/notes2/api/sanitize.php`
- JSON error handling: `/Users/maxbisschop/dev/www/notes2/api/error_handler.php`
- API entrypoint: `/Users/maxbisschop/dev/www/notes2/api.php`

## Inputs/Outputs

- Inputs:
  - note HTML submitted through create and update requests
  - fatal errors, uncaught exceptions, and database failures in API execution
  - attribute values such as classes, links, `colspan`, and `rowspan`
- Outputs:
  - sanitized HTML persisted to the database
  - JSON error payloads with stable `error` and `request_id` fields
  - debug-enriched error payloads when debug mode is explicitly enabled

## Flow/Behavior

1. The API loads an allowlist configuration before note handlers run.
2. `sanitize_note_html()` parses submitted HTML with `DOMDocument`.
3. Sanitization rules are applied recursively.
   - forbidden tags are removed entirely
   - unsupported tags are unwrapped so their child text can survive
   - event handlers and inline styles are always stripped
   - only per-tag allowlisted attributes are preserved
4. Links are filtered.
   - safe values can start with `#` or `/`
   - otherwise only `http:`, `https:`, `mailto:`, and `tel:` are allowed
5. Class handling is narrow.
   - code blocks keep only `language-*` classes
   - block elements can keep only `indent-1` through `indent-4`
   - application-owned todo markup keeps only `todo-list`, `todo-item`, and `todo-checkbox`
   - todo IDs, ISO timestamps, completion labels, and checkbox accessibility attributes are validated individually
   - the todo additions live in `api/sanitize.php` because `api/config.php` is installation-local and ignored by Git
6. Numeric table attributes are normalized.
   - `colspan` and `rowspan` keep only digits
7. Newlines inside `pre` and `code` are preserved through placeholder substitution so parser normalization does not collapse them.
8. Error handling is centralized.
   - JSON helpers ensure API errors stay machine-readable
   - debug details are included only when explicitly enabled

## Edge Cases/Failure Modes

- When HTML parsing fails badly enough that the root wrapper cannot be recovered:
  - the sanitizer falls back to escaped plain text instead of returning raw unsafe HTML

- When a class attribute contains mixed allowed and disallowed values:
  - only the allowed subset survives
  - the attribute is removed entirely if nothing valid remains

- When an unsafe link is submitted:
  - the `href` is removed rather than rewritten

- When a fatal occurs before normal handler output:
  - shutdown handlers still attempt to emit JSON instead of broken partial output

- When client and server allowlists diverge:
  - paste-time behavior can differ from save-time behavior
  - `js/smart-paste.js` must be validated together with `api/config.php` and `api/sanitize.php`

## Related Files

- `/Users/maxbisschop/dev/www/notes2/api/config.php`
- `/Users/maxbisschop/dev/www/notes2/api/sanitize.php`
- `/Users/maxbisschop/dev/www/notes2/api/error_handler.php`
- `/Users/maxbisschop/dev/www/notes2/api.php`
- `/Users/maxbisschop/dev/www/notes2/js/smart-paste.js`
- `/Users/maxbisschop/dev/www/notes2/js/editor.js`
