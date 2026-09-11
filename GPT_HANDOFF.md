# GENRES project — handoff to GPT / Codex (2026-09-11)

This is the canonical state-of-truth for continuing the project. It replaces the now-removed `HANDOFF.md` and `CLAUDE_HANDOFF.md`.

Read this whole file before touching anything. The most important thing in it is the constraint in **"The one rule that must never be broken"** below — a previous attempt at improving this page violated it and had to be thrown out.

## What this project is

A dependency-free, static, single-file interactive music-genre timeline (`index.html`). The published page needs no framework, backend, or runtime build step: it uses inline CSS and vanilla JS and can be opened directly as a local file. For maintainability, `build.js` assembles `index.html` from `src/shell.html`, `genres-data.json`, and `src/layout.js`. It uses concentric chronology: oldest eras near the center, decades as concentric rings growing outward. Genre cards are absolutely-positioned HTML `<div>`s; rings, area contours, and lineage edges are SVG drawn under/around them.

## The one rule that must never be broken

Each of the 27 genre "Areas" (Rock, Heavy Metal, Folk Music, Hip Hop, etc.) owns a **fixed angular sector — a fixed compass direction from the circle's center — for the entire diagram, at every ring/decade**. An area's colored region always grows straight outward in the same direction; it never rotates, drifts, or occupies a different angle at a different radius.

This was violated once, by an earlier rewrite that re-allocated each ring's angles only among the areas present in that specific ring (to reduce empty space). That produced better density numbers but made the colored areas spiral instead of running in a straight line outward — visually "random chaos." It was scrapped entirely and reverted. **Do not attempt any layout approach that computes angular sectors per-ring or per-decade. Sectors are computed once, globally, from total per-area demand across the whole diagram, and never recomputed per ring.** If you want to reduce empty space or improve density, there are other levers (ring thickness, starting radius, sector gap size, per-category track counts within a ring) — all used successfully today without touching sector angles. See "What changed today" below for exactly which levers were pulled.

## Current file state

- `index.html` is the canonical deployable page and must match the output of `node build.js`.
- Maintainable source is split across `src/shell.html`, `genres-data.json`, and `src/layout.js`; edit those inputs, then rebuild. Do not hand-edit only the generated `index.html`.
- `GPT_HANDOFF.md` is the sole handoff anchor. The older handoff files and superseded visualization exports were removed from the repository during the 2026-09-11 publication cleanup; Git history retains them if needed.
- Treat the source spreadsheet as read-only unless the user explicitly asks for a write.
- `assets/flags/` gained three new files today: `eu.svg`, `africa.svg`, `asia.svg` (see below).

## Data source and fields

Source spreadsheet: https://docs.google.com/spreadsheets/d/1QJrYbr_UMWM3W19gT39ysiZjfxz3m4FvUVUNtKUidkY/edit?gid=0#gid=0 — use only the first tab, `GENRES`. Do not edit other tabs, and treat the sheet as read-only unless explicitly asked to write to it.

| Column | Header | Site use |
|---|---|---|
| A | Nr. | not rendered |
| B | Name | card label, unique lookup key |
| C | Nametech | not rendered |
| D | Area | angular sector, color, area contour |
| E | Area misc. | not rendered |
| F | Importance | card size multiplier, 1–5 |
| G | Parent | primary lineage edge; `(none)` = root |
| H | Decade | ring; `ancient`, `medieval`, `early modern`, then 1900s–2020s |
| I | Year | not rendered |
| J | Country | flag/region icon, or Worldwide/Online symbol |

As of today: 922 genres, 833 primary-parent edges, 27 Areas, 16 era/ring labels. `index.html` embeds a compact `rows` array in this exact order: `[Name, Importance, Parent, Decade, Country, Area]`. There's also a local snapshot `genres-data.json`, verified identical to both the live sheet and the embedded rows as of this session — no refresh needed unless the sheet has changed since 2026-09-11.

A column K "Custom" exists in the sheet with `x` on 54 genres (Ska, Dub, Reggae, Ambient, IDM, Trap, K-Pop, Hyperpop, …). It is **not used anywhere in the site** and its intended meaning was never confirmed with the user — ask before wiring it into anything.

## Architecture (unchanged from before today)

- Every card is created first and its real rendered width/height measured; those measurements drive sector demand, track packing, overlap avoidance, area contours, routing obstacles, and edge endpoints. Nothing is laid out from guessed/estimated sizes.
- Area sectors (`categoryOrder` / `sectors`, a `Map` of area → `{start, end, mid}` angle bounds) are computed **once**, globally, from each area's peak single-decade linear card-width demand. This is the invariant described above — never touch this to be "per ring."
- A single global `radius` cursor advances once per decade band. Within each decade, each area greedily packs its own cards into angular "tracks" via `boxAt`/`overlaps` real-rectangle collision checks (not angular-width estimates), with a 600-try angular search per candidate and an 80-track safety throw.
- Lineage/edge routing tries, in order: a direct clear line (`clearPath`, Liang–Barsky), then a grid-based A* (`routeGrid`, via a binary `Heap`), then routing around the world's outer perimeter (`routeOutside`), then a straight line as absolute last resort (increments a `routeFailures` counter).
- Hover shows the ancestor chain only (hovered card → all ancestors → root), never descendants; implemented as a single delegated, `requestAnimationFrame`-coalesced `pointermove` listener on `#viewport` (see "What changed today" — this used to be 1844 individual per-card listeners).
- Cursor-anchored wheel zoom and drag-pan via a CSS `transform` on `#timeline`, animated with `requestAnimationFrame`.
- `flagAssets()` maps a genre's `Country` field to local SVG flag/symbol images via an `iso` name→code map, plus special-cased broad region tokens (see below).

## What changed today (all done as small, named, auditable find/replace patches against the previous `index.html`, never a rewrite)

1. **Empty center fixed.** The hardcoded starting radius (`radius=1400`) was cut to `150`. This alone shrank the empty middle by most of the way (inner void radius 1325px → ~427px, 18.2% → 6.2% of total radius).
2. **Sector padding reclaimed.** The gap between adjacent area sectors (`sectorGap`) was reduced from `.018` to `.007` radians, reclaiming ~18.5° of total arc across the 27 sectors.
3. **Ring thickness made per-area, not per-decade-global.** Previously one decade's ring thickness was set by whichever single area needed the most tracks that decade, wasting radius on every other, less-crowded area in that same ring. Now each area's ring contribution is sized to its own need; the outer boundary of the ring is the max across areas. The actual card-collision placement algorithm itself was not touched, only how ring thickness is derived from its results. This further shrank the overall diagram with zero new card overlaps.
4. **Lineage routing biased to avoid doubling back toward the center.** The A* fallback router (used only when a direct line and simple clearance don't work) now prefers, among its candidate port-pair options, the ones whose path doesn't dip closer to the world center partway through. Implementation note for whoever touches this next: **do not** implement this as a per-step cost penalty inside the A* search itself — that was tried first and it broke the heuristic badly enough to make the search blow up toward its safety cap on hard edges, hanging and eventually crashing the page (caught before it reached the user, via a timed headless load test — never skip that test after touching pathfinding). The safe version instead just re-sorts the already-computed candidate port pairs so a "more outward" option is tried first; the search algorithm itself is completely unchanged.
5. **Hover flicker fixed.** Replaced 1844 individual per-card `pointerenter`/`pointerleave` listeners with one delegated, animation-frame-coalesced `pointermove` listener on the viewport.
6. **GPU compositing (`will-change: transform`) is now toggled on only during active pan/zoom**, not held permanently. This targets a "parts of the diagram go invisible while panning" report, on the theory that permanently compositing a ~14,000px-wide layer is close to common GPU texture-size limits on some drivers. This fix is a reasonable mitigation but **unverified** — a headless browser can't reproduce GPU-driver-specific rendering glitches. If the user still sees this, it needs investigating on their actual machine (check DevTools' rendering/layer panel, try disabling GPU acceleration, etc.).
7. **Loading spinner added.** A `#loading` overlay (spinner + "Loading genres…" text) now covers the page until layout has fully computed and one extra paint has settled, then fades out once, cleanly, with no flash of partially-built content. On a sandboxed test machine this took a very approximate ~14s for layout plus a few more seconds for paint to settle — real hardware should be meaningfully faster, but that hasn't been measured outside the sandbox.
8. **Region flag icons added and fixed.** `flagAssets()` now recognizes `Europe`, `Africa`/`West Africa`, and `South Asia` as tokens and maps them to three new local icons — `assets/flags/eu.svg` (12-star circle on blue), `africa.svg` (continent silhouette, red/gold gradient backdrop), `asia.svg` (Indian-subcontinent silhouette, orange/teal gradient backdrop). These are simple straight-edge polygon icons, deliberately not smooth/organic shapes — at the actual render size (20×15px) organic blob contours were unreadable ("looked like a potato"); straight-edged silhouettes read correctly at that size. **Latin America, Middle East, Caribbean, and Scandinavia tokens are still unhandled** (1, 2, 2, and 4 rows respectively) — intentionally out of scope, not forgotten.
9. **Reverted: an experimental "wobble" filter on area outlines.** Earlier today, an SVG `feTurbulence`/`feDisplacementMap` filter was added to area contour outlines to break up a dead-straight edge in the Heavy Metal/Rock sector boundary. The user didn't like the resulting jagged look and asked for smooth edges again, so this was fully removed — not hidden, the filter definition and its CSS application are both gone. **Do not re-add this specific technique.** If a straight-sector-boundary complaint comes up again, a better fix would be to actually vary the contour sample points that generate the area outline path, not a post-render displacement filter.

## Verified state as of today

- Final local Chrome re-verification during publication preparation: 922 cards, 833 edges, 27 area contours, 0 card overlaps, and `routeFailures: 0`.
- The rendered world is 13,565px square. The measured inner void radius was 301px, 4.5% of the occupied radius (font rendering can cause small environment-dependent geometry differences).
- Claude's interaction smoke test recorded 9 ancestor cards / 8 edges highlighted for Sigilkore, with correct hover leave, zoom, and pan behavior.
- Final local Chrome re-verification found 0 broken flag images and no browser console warnings or errors.
- `node build.js` regenerated an `index.html` byte-for-byte identical to the verified current page (SHA-256 `EE85E0055AA01C7D8598A3F05D39EA2FD24703E46C5B2E7B48E5014F20A9693C`).

## Verification tooling left in the project (not part of the shipped site)

- `measure.js` — headless-Chromium script reporting density, inner-void size, card overlaps, route failures, edge lean, per-ring fill %. Run it against a changed `index.html` before calling a change done.
- `smoke.js` — headless interaction smoke test: hover-chain correctness, hover leave, zoom/pan. Uses a bubbling `pointermove` dispatch + a two-`requestAnimationFrame` wait to match the current delegated hover listener (a plain `pointerenter`/`pointerleave` dispatch will NOT trigger anything with today's hover code).

Both scripts require Playwright to be available in the local Node environment; it is not a dependency of the published page.

If you write or run anything like this, treat it the same way today's changes were validated: **measure before/after, don't just eyeball a screenshot, and don't declare a fix done without loading the actual page.**

## Suggested continuation instruction

> Read `C:\gpt\genres\GPT_HANDOFF.md` in full before editing anything, especially "The one rule that must never be broken." Make only the changes requested. Verify any layout, routing, or interaction change in a real rendered browser (or headless equivalent) before calling it done — check card overlaps, route failures, hover behavior, and that every area's angular sector direction is unchanged from before your edit.
