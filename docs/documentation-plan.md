# Documentation Plan

## Purpose

Define which source areas need documentation next, where those docs should live in `docs/`, and the order that adds the most value without creating low-signal file-by-file markdown.

## Location

- Plan doc: `/Users/maxbisschop/dev/www/notes2/docs/documentation-plan.md`
- Existing docs root: `/Users/maxbisschop/dev/www/notes2/docs/`
- Source root being mapped: `/Users/maxbisschop/dev/www/notes2`

## Inputs/Outputs

- Inputs:
  - current source files in `app.php`, `app.js`, `js/`, `api/`, `public.php`, and `schema.sql`
  - existing doc coverage in `docs/js/save-behavior.md`
- Outputs:
  - a prioritized list of remaining documentation targets
  - exact suggested doc paths under `docs/`
  - a phased execution plan for filling the remaining documentation gaps

## Flow/Behavior

1. Document cross-cutting runtime entry points first so the project has an architectural map.
2. Document the most behavior-heavy frontend flows next because most user-visible changes land there.
3. Document API contracts and backend safety rules after that so frontend and backend changes can be validated against a shared reference.
4. Document the schema and public rendering flow once the main editor and API docs are in place.
5. Keep docs feature-level where possible and avoid one markdown file per source file unless a file has standalone behavior worth documenting.

## Edge Cases/Failure Modes

- Current coverage:
  - project overview, app shell, core JS flows, API contract, sanitization, schema, and public view docs now exist
  - `docs/js/save-behavior.md` remains the focused save deep-dive

- Remaining documentation gaps:
  - first-pass coverage is now in place for the main runtime areas
  - future gaps are mostly incremental updates when behavior changes

- Potential stale documentation risk:
  - `docs/js/save-behavior.md` should stay aligned with `js/save.js`, `js/notes.js`, and `api/handlers/put.php`
  - sanitization behavior must be documented against both frontend paste rules and backend save-time sanitization

- Scope control:
  - when several files participate in one user flow, document the flow once instead of duplicating the same explanation across multiple docs

## Related Files

- `/Users/maxbisschop/dev/www/notes2/docs/project-overview.md`
- `/Users/maxbisschop/dev/www/notes2/docs/js/save-behavior.md`
- `/Users/maxbisschop/dev/www/notes2/app.php`
- `/Users/maxbisschop/dev/www/notes2/app.js`
- `/Users/maxbisschop/dev/www/notes2/js/`
- `/Users/maxbisschop/dev/www/notes2/api/`
- `/Users/maxbisschop/dev/www/notes2/public.php`
- `/Users/maxbisschop/dev/www/notes2/schema.sql`

## Documentation Coverage

1. `docs/project-overview.md`
   - Cross-project architecture map

2. `docs/app-shell.md`
   - Authenticated shell, startup wiring, and layout regions

3. `docs/js/`
   - note lifecycle
   - save deep-dive
   - editor and formatting
   - tags and inspector
   - sharing and links
   - import and export

4. `docs/api/`
   - note API contract
   - sanitization and safety
   - tags, pins, and settings helpers

5. `docs/database/schema-and-migrations.md`
   - additive schema objects and behaviors

6. `docs/public/read-only-note-view.md`
   - public renderer and redirect behavior

7. `docs/icons/assets-and-pwa.md`
   - manifest and icon asset behavior

## Recommended Execution Order

1. Keep `docs/js/save-behavior.md` as a focused deep-dive instead of merging it away.
2. Update the matching doc whenever note model, sanitization rules, import/export behavior, or public-link behavior changes.
3. Prefer extending the existing feature docs before creating new file-level docs.
