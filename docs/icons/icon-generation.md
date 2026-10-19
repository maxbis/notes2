# Icon Generation

## Purpose

Regenerate the browser and home-screen icons when a source image is available.

## Location

- Output directory: `public/icons/`
- Active app manifest: `public/manifest.webmanifest`
- Source image: provide an SVG or another suitable high-resolution image; no source SVG is currently checked in.

## Inputs/Outputs

- Input: a source image such as `source-icon.svg`.
- Outputs: `public/icons/apple-touch-icon.png` (180×180), `public/icons/icon-192.png` (192×192), and the sizes required by the manifest.

## Flow/Behavior

1. Export PNG files from an image editor or use ImageMagick from the project root:

   ```bash
   magick -background none source-icon.svg -resize 180x180 public/icons/apple-touch-icon.png
   magick -background none source-icon.svg -resize 192x192 public/icons/icon-192.png
   magick -background none source-icon.svg -resize 512x512 public/icons/android-chrome-512x512.png
   ```

2. Confirm that the paths and sizes in `public/manifest.webmanifest` match the generated files.

## Edge Cases/Failure Modes

- When a source image is unavailable, keep the existing checked-in PNG assets.
- When filenames in the manifest and `public/icons/` differ, installed-app icons can fail to load.

## Related Files

- `public/manifest.webmanifest`
- `public/icons/`
- `docs/icons/assets-and-pwa.md`
