# Music Genres Timeline

A dependency-free interactive visualization of 730 music genres, arranged by era and fixed genre-area sectors with nested secondary-area contours.

Open `index.html` directly, or serve the repository root with any static web server. The published page has no runtime dependencies.

For maintenance, `node build.js` regenerates `index.html` from:

- `src/shell.html` — page structure and styles
- `genres-data.json` — source-sheet snapshot
- `src/layout.js` — layout, routing, and interactions

Read `GPT_HANDOFF.md` before changing the project. It is the canonical implementation and project-history anchor, including the source spreadsheet schema and the fixed-sector layout invariant.
