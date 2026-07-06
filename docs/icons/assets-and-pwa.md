# Assets And PWA

## Purpose

Describe the icon assets, manifest files, and installability-related metadata used by the Notes app.

## Location

- Main manifest: `/Users/maxbisschop/dev/www/notes2/manifest.webmanifest`
- Icon directory: `/Users/maxbisschop/dev/www/notes2/icons/`
- Icon notes: `/Users/maxbisschop/dev/www/notes2/icons/README.md`
- Secondary manifest-like file: `/Users/maxbisschop/dev/www/notes2/icons/site.webmanifest`

## Inputs/Outputs

- Inputs:
  - browser requests for manifest and icon files
  - home-screen and install surfaces on supported devices
- Outputs:
  - app metadata such as name, description, scope, and colors
  - install icons for launcher and home-screen use
  - apple-touch icon support through explicit HTML links

## Flow/Behavior

1. `app.php` links the main `manifest.webmanifest`.
2. The main manifest defines:
   - app name and short name as `Notes`
   - `start_url` as `app.php`
   - scope as `./`
   - display mode as `standalone`
   - background and theme colors
   - icon entries for 192px and 512px PNG assets
3. `app.php` also links favicon assets and `apple-touch-icon.png` directly for iOS home-screen behavior.
4. `icons/README.md` documents expected generated assets from the SVG icon source, including iOS and manifest sizes.
5. `icons/site.webmanifest` exists as an additional manifest-style asset file and appears to reflect favicon-generator output rather than the main app manifest.

## Edge Cases/Failure Modes

- When icon files and README instructions drift:
  - the documented generated asset list can differ from the files actually referenced by the active manifest

- When `icons/site.webmanifest` diverges from `manifest.webmanifest`:
  - browser behavior can depend on which manifest is actually linked
  - the app currently links `manifest.webmanifest`, so that file is the system of record

- When iOS install behavior is evaluated:
  - the explicit `apple-touch-icon` link matters more than manifest icon declarations

## Related Files

- `/Users/maxbisschop/dev/www/notes2/manifest.webmanifest`
- `/Users/maxbisschop/dev/www/notes2/app.php`
- `/Users/maxbisschop/dev/www/notes2/icons/README.md`
- `/Users/maxbisschop/dev/www/notes2/icons/site.webmanifest`
- `/Users/maxbisschop/dev/www/notes2/icons/apple-touch-icon.png`
- `/Users/maxbisschop/dev/www/notes2/icons/icon-192.png`
- `/Users/maxbisschop/dev/www/notes2/icons/android-chrome-512x512.png`
