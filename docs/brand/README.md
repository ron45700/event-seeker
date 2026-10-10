# event seeker icon

A stage light finding the mic: live shows (music and stand-up) and the search for them.
Amber light (`#f4b740`, the site's `--accent`) on the page's dark ink (`#10131c`, `--bg`).

| File | Use |
|---|---|
| `icon.svg` | The mark on a full-bleed square with its own background. Dashboards, docs |
| `icon-512.png` | The same at 512 px, opaque (no transparent pixels) |

For a dashboard (Homarr), point the tile at the copies the site serves:
`http://<host>:8765/icon.svg` or `http://<host>:8765/icon-512.png`.

## In the site (`frontend/public/`, served at `/`)

| File | Drawn from | Use |
|---|---|---|
| `favicon.svg` | its own drawing | Browser tab. Simplified for 16-32 px: solid beam, bolder mic |
| `favicon-32.png` | `favicon.svg` | Tab icon for browsers without SVG favicons |
| `apple-touch-icon.png` | `icon.svg`, 180 px | iPhone / iPad home screen (iOS rounds the corners) |
| `icon-192.png`, `icon-512.png` | `icon.svg` | `site.webmanifest` (Android home screen) |
| `icon.svg` | | Same as `docs/brand/icon.svg` |

The navbar draws the mark inline (`frontend/src/components/BrandMark.tsx`, the `icon.svg`
drawing on a rounded tile), so it needs no request and stays sharp at any size.

Keep `icon.svg` here, `frontend/public/icon.svg` and `BrandMark.tsx` in step.

## Regenerating the PNGs

From the project root, with any change to the SVGs:

```
npx @resvg/resvg-js-cli --fit-width 32  frontend/public/favicon.svg frontend/public/favicon-32.png
npx @resvg/resvg-js-cli --fit-width 180 frontend/public/icon.svg frontend/public/apple-touch-icon.png
npx @resvg/resvg-js-cli --fit-width 192 frontend/public/icon.svg frontend/public/icon-192.png
npx @resvg/resvg-js-cli --fit-width 512 frontend/public/icon.svg frontend/public/icon-512.png
cp frontend/public/icon.svg frontend/public/icon-512.png docs/brand/
```

Check a change at 16 px against both a light and a dark tab bar before keeping it.
