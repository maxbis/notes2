# Tags And Inspector

## Purpose

Document how tags are normalized and edited, how tag-based filtering works, and how the inspector derives structure and metadata from the current draft.

## Location

- Tag state and UI: `/Users/maxbisschop/dev/www/notes2/js/tags.js`
- Inspector rendering: `/Users/maxbisschop/dev/www/notes2/js/inspector.js`
- Save-state indicators: `/Users/maxbisschop/dev/www/notes2/js/indicators.js`

## Inputs/Outputs

- Inputs:
  - tag text entered in the main editor or inspector tag input
  - note tag arrays loaded from the API
  - current draft HTML and title from the editor
  - save-state flags from shared frontend state
- Outputs:
  - normalized tag arrays in current and saved state
  - sidebar tag filters and per-note tag displays
  - inspector outline, reading metrics, timeline metadata, and quick actions
  - unsaved and last-saved status indicators

## Flow/Behavior

1. Tags are normalized on every read and write.
   - tags are trimmed, collapsed for whitespace, lowercased, deduplicated, length-limited, and sorted
2. The app stores two tag baselines:
   - `currentTags` for the active draft
   - `savedTags` for change detection after successful saves
3. Tag chips are rendered in both the main editor and the inspector.
4. Sidebar filters are derived from all loaded notes.
   - each tag tracks usage count and latest usage time
   - active tags are ranked above inactive tags
   - filtering requires a note to match every active tag
5. The inspector parses the current editor HTML to compute:
   - word count
   - character count
   - estimated reading time
   - heading outline for `h1`, `h2`, and `h3`
6. Outline items scroll the editor to the corresponding heading by assigning temporary heading IDs into the live DOM.
7. Indicators reflect save state.
   - the unsaved indicator becomes clickable when there are pending changes
   - the last-saved label changes format for mobile and desktop layouts

## Edge Cases/Failure Modes

- When tags differ only by case or repeated whitespace:
  - normalization collapses them into one stored tag

- When no tags exist on the current note set:
  - sidebar filters and inspector tag areas fall back to empty-state output instead of rendering broken controls

- When the current draft is not a saved note yet:
  - the inspector still renders metrics from the draft content
  - timeline and note-specific metadata can remain empty or placeholder values

- When heading text is empty:
  - the inspector generates fallback section labels such as `Section 1`

- When the unsaved indicator is clicked:
  - focus restoration logic tries to preserve the editor caret after the save completes

## Related Files

- `/Users/maxbisschop/dev/www/notes2/js/tags.js`
- `/Users/maxbisschop/dev/www/notes2/js/inspector.js`
- `/Users/maxbisschop/dev/www/notes2/js/indicators.js`
- `/Users/maxbisschop/dev/www/notes2/js/state.js`
- `/Users/maxbisschop/dev/www/notes2/js/notes.js`
- `/Users/maxbisschop/dev/www/notes2/js/save.js`
