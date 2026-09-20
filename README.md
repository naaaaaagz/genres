# Music Genres Timeline

Two dependency-free views of the same 770-genre dataset. Open either file
directly, or serve the repository root with any static web server.

- **`index.html`** — the main, mobile-first page. One Area at a time, scrolled
  vertically with newest music at the top and the oldest at the bottom, divided
  by faint decade bands. Swipe left/right (or use the header chevrons) to move
  between Areas; the drilldown selector filters bricks by Importance.
- **`index_old.html`** — the earlier radial page: all 770 genres on one
  pannable/zoomable canvas, concentric rings by decade and fixed angular
  sectors by Area.

## Build

Both pages are generated. **Never hand-edit `index.html` or `index_old.html`.**
Run `node build.js`, which assembles them from:

| source | used by |
|---|---|
| `genres-data.json` | both — snapshot of the GENRES sheet |
| `src/common.js` | both — country/region → flag lookups, Area display names |
| `src/mobile-shell.html` + `src/mobile.js` | `index.html` |
| `src/shell.html` + `src/layout.js` | `index_old.html` |

`assets/flags/*.svg` and `assets/symbols/*.svg` must ship alongside the pages;
relative paths are unchanged.

## Docs

`GPT_HANDOFF.md` is the implementation and project-history anchor for the radial
page, including the source-spreadsheet schema and its fixed-sector layout
invariant. Read it before changing `src/layout.js`.
