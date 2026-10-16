## Icons for iOS “Add to Home Screen” (PWA-ish)

iOS uses the HTML `<link rel="apple-touch-icon">` (PNG) for the home screen icon.

This project includes an SVG source at `icons/icon.svg`. Generate these PNGs next to it:

- `icons/apple-touch-icon.png` (**180×180**) — iOS home screen icon
- `icons/icon-192.png` (**192×192**) — manifest icon
- `icons/icon-512.png` (**512×512**) — manifest icon
- `icons/icon-512-maskable.png` (**512×512**) — manifest maskable icon

### Quick generation (recommended)

Use any tool you like; two common options:

- Image editor: export PNG at the sizes above.
- CLI (if you have ImageMagick installed):

```bash
magick -background none icons/icon.svg -resize 180x180 icons/apple-touch-icon.png
magick -background none icons/icon.svg -resize 192x192 icons/icon-192.png
magick -background none icons/icon.svg -resize 512x512 icons/icon-512.png
magick -background none icons/icon.svg -resize 512x512 icons/icon-512-maskable.png
```

