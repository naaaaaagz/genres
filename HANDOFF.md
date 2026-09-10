# GENRES handover

## Current saved state

- Static local project: `index.html`, local assets, and an untracked `genres-data.json` source snapshot.
- Git `HEAD`: `941fffc313761f53a841c249c8a9db54aa98139c` (`Add interactive music genres timeline`), also the last confirmed push to origin `naaaaaagz/genres`.
- At handover, tracked files have no local diff. Untracked files are `genres-data.json`, `qa-genres-layout.png`, and `qa-genres-runtime.png`. The QA screenshots may be stale.
- The three pending changes below are not present in the saved `index.html`: it still uses linear importance sizing `1 + (importance - 1) * .15`, routing ports 4 px outside cards, and has no ancestor-chain hover behavior.
- Previously verified state (not rerun for this handover): 922 cards, 833 primary edges, 16 chronological rings, 27 area blobs, zero card overlaps, and zero edge/card hits. Some line-line crossings are allowed.

The intended design is oldest-at-center concentric chronology with stable angular Area groups and lineages growing outward. Families born later begin at their correct ring. There is one broad amorphous filled path per Area, not individual card halos. Routes are smooth and reduce unnecessary waypoints. The full-fit overview necessarily has small labels; cards become readable when zoomed. Existing features include local flags, local Worldwide/Online symbols, dark mode, importance-based geometry, cursor-anchored zoom, and drag pan.

## Source and assets

- Source reference (do not edit other tabs): https://docs.google.com/spreadsheets/d/1QJrYbr_UMWM3W19gT39ysiZjfxz3m4FvUVUNtKUidkY/edit?gid=0#gid=0
- Use only the first tab, `GENRES`: B Name, D Area, F Importance, G Parent, H Era, J Country.
- Last verified live snapshot: 922 genres, 833 primary edges, 27 Areas, and 16 era labels (`ancient` 29, `medieval` 19, `early modern` 59, then 1900s through 2020s). The old 33-era layout is obsolete. Other tabs were untouched.
- Local data and HTML were synchronized by the last successful generation job.
- Assets currently include 79 SVG flags and 2 symbol files, plus local license/attribution material.

## Pending changes

1. Make visible lineage lines touch their card borders, especially around Rock. Diagnosis: clearance-routing ports sit 4 px outside cards, and direct rectangle intersection can miss rounded corners. Keep clearance routing ports, but render endpoints at safe side anchors on the actual card border. Inspect Rock spacing only if needed; do not redesign the layout.
2. Apply stronger nonlinear importance sizing once, with absolute multipliers: importance 1 `.65`, 2 `1.035`, 3 `1.365`, 4 `1.624`, 5 `2.16`. All real card dimensions must feed packing and routing.
3. On hover, highlight only the hovered card, every ancestor card to the root, and the connecting primary edges along that chain. Do not highlight descendants. Clear on leave, avoid child-flag flicker, do not relayout, and preserve pan/zoom.

Do not publish, commit, push, sync, or make spreadsheet writes without a new explicit request.

## Verification and delivery

After the future patch, perform one real saved-page browser check rather than syntax-only QA. Check visible endpoint contact (especially Rock), overlaps and edge clearance after resizing, deep-node/root/leave hover behavior, and pan/zoom preservation. A localhost browser route previously worked; `file://` navigation was denied. An old server at `127.0.0.1:8765` may or may not still exist (previous session ID 19505); verify rather than assume, and do not leave task-started processes running. Avoid a broad repeated suite unless a failure justifies it.

## Workflow and tool pitfalls

- Delegate only independent work, with minimum context/files and the cheapest capable worker. Escalate only after a failure. Return concise findings/diffs, not noisy logs; avoid duplicate solving unless verification warrants it. Prefer an MVP plus targeted checks and label uncertainty.
- Runtime approval may appear in the ChatGPT app rather than the Codex window. User task authorization does not suppress runtime prompts; never claim an approval is pending without evidence.
- A previous global constant named `top` collided with `window.top` and caused a blank page; the fix was `topOffset`.
- Keep all edits local and preserve unrelated work. Remove only task-created, unneeded temporary files.

Suggested continuation instruction:

> Read `C:\gpt\genres\HANDOFF.md`. Verify saved state, then finish only the Pending changes. Keep edits local and inspect the final page in a browser.
