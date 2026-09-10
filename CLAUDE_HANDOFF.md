# GENRES project handoff

## Goal and current design

This is a dependency-free, static, interactive music-genre timeline. It uses concentric chronology: the oldest eras are nearest the center and newer eras grow outward. Areas keep stable angular sectors; lineage edges connect each genre to its primary parent. Each Area has one broad filled contour, not individual card halos. The full-fit overview is intentionally dense; labels become readable through zoom.

Preserve the current dark visual design, chronology, Area grouping, local flag/symbol assets, cursor-anchored wheel zoom, drag pan, and ancestor-chain hover. Do not redesign the layout unless explicitly asked.

## Current repository state

- Workspace: `C:\gpt\genres`
- Main page: `index.html`
- Git `HEAD`: `941fffc313761f53a841c249c8a9db54aa98139c` (`Add interactive music genres timeline`)
- `origin/main` is at the same commit. The current `index.html` changes are local and uncommitted.
- Current untracked files include `HANDOFF.md`, `CLAUDE_HANDOFF.md`, `genres-data.json`, `qa-genres-layout.png`, and `qa-genres-runtime.png`. The two QA screenshots predate the latest changes and may be stale.
- Do not commit, push, sync, publish, or write to the spreadsheet unless the user explicitly requests it.

## Source spreadsheet and fields

Source: https://docs.google.com/spreadsheets/d/1QJrYbr_UMWM3W19gT39ysiZjfxz3m4FvUVUNtKUidkY/edit?gid=0#gid=0

Use only the first tab, `GENRES`. Do not edit other tabs. The local snapshot is `genres-data.json`, sourced from `GENRES!A1:J998`.

| Column | Header | Current site use |
|---|---|---|
| A | Nr. | Not rendered |
| B | Name | Card label and unique lookup key |
| C | Nametech | Not rendered |
| D | Area | Angular group, color, and Area contour |
| E | Area misc. | Not rendered |
| F | Importance | Card geometry multiplier, clamped to 1–5 |
| G | Parent | Primary lineage edge; `(none)` means a root |
| H | Decade | Chronological ring; includes `ancient`, `medieval`, `early modern`, then 1900s–2020s |
| I | Year | Not rendered |
| J | Country | Local flag(s), Worldwide symbol, or Online symbol |

The last verified data represented 922 genres, 833 primary-parent edges, 27 Areas, and 16 era/ring labels. `index.html` contains an embedded compact `rows` array in this order: Name, Importance, Parent, Decade, Country, Area. Keep the snapshot and embedded rows synchronized when refreshing data.

## Technology and implementation

- One static `index.html` with inline CSS and vanilla JavaScript; no framework, package manager, build dependency, backend, or external runtime asset.
- Genre cards are positioned HTML elements. Rings, Area contours, and lineage lines are SVG.
- The page creates every card first and measures its real rendered width and height. Those measured dimensions drive sector demand, track packing, overlap avoidance, Area contours, routing obstacles, and edge endpoints.
- Layout uses 16 radial bands, demand-weighted Area sectors, family-aware angular ordering, and additional radial tracks where necessary.
- Line routing tries a clear direct route, grid/A* routing, an outside fallback, and targeted local detours. Smooth routes use quadratic corners. Rendered endpoints use safe anchors on the actual card border while clearance ports remain outside cards.
- Importance uses absolute multipliers: 1 `.65`, 2 `1.035`, 3 `1.365`, 4 `1.624`, 5 `2.16`.
- Hover adds emphasis only to the hovered card, its ancestors to the root, and the primary edges connecting that chain. Descendants are not highlighted. State clears on pointer leave; child flags have pointer events disabled to prevent flicker.
- `assets/flags/` contains 79 local SVG flags. `assets/symbols/` contains local Worldwide and Online SVG symbols plus license/attribution files in `assets/`.
- `build_timeline_v2.js` and the CSV/Draw.io files are older Draw.io tooling, not the authoritative generator for the current HTML page. Do not run them expecting them to reproduce `index.html`.

## Request history already implemented

1. Build the circular chronology with oldest eras at the center, stable Area sectors, outward-growing lineages, one broad Area contour per Area, smooth routing, flags/symbols, dark mode, zoom, and pan.
2. Replace the obsolete 33-era arrangement with the current 16 labels and keep late-born families starting at their correct ring.
3. Strengthen importance sizing with the five exact nonlinear multipliers above and ensure measured card dimensions feed packing and routing.
4. Make lineage lines visibly touch card borders, especially around Rock, without redesigning the layout.
5. Add hover that highlights ancestors only, never descendants, while preserving pan/zoom and avoiding flag flicker.

There are no pending requested changes at this handoff.

## Latest verification

The saved `index.html` was inspected in a real browser through a temporary localhost server. `file://` was previously denied, so use localhost for future checks and stop the server afterward.

- 922 cards, 833 edges, 16 rings, 27 Area contours
- 0 card overlaps
- 0 edge/card crossings in a dense rendered-path audit
- 0 endpoint misses; Rock's incoming line visibly touches its border
- Five computed font sizes match the requested importance multipliers: 8.125, 12.9375, 17.0625, 20.3, and 27 px
- Deep hover check: Sigilkore highlighted 9 ancestor-chain cards and 8 connecting edges
- Root hover check: Folk Music highlighted only itself and no edge
- Leave cleared all highlight classes
- Zoom and pan both changed the view as expected without relayout; pointer state cleared after panning
- No browser console warnings or errors
- `data-route-failures` is `1`; that edge uses the existing fallback, but the rendered audit still found no card crossing or endpoint miss
- Inline JavaScript passed a syntax compilation check; `git diff --check` passed

## Continuation rules

- Read this file and inspect the current diff before editing.
- Make only changes requested by the user; preserve unrelated files and existing behavior.
- Treat the spreadsheet as read-only unless a new request explicitly authorizes a write. If a data refresh is requested, use only `GENRES`, reread it live, normalize the six site fields, update the embedded rows, and rerun browser verification.
- For visual or interaction changes, verify the saved page in a real localhost browser. Check overview layout, Rock or the affected lineage, overlaps, edge clearance, hover leave behavior, and pan/zoom in proportion to the change.
- Some line-line crossings are expected and allowed. Card overlaps and visible edge/card crossings are not.
- Do not leave task-started preview processes running.
