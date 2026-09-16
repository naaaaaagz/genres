# GENRES site — handoff to ChatGPT Codex (2026-09-12)

## Status, plainly

The site works and passes every automated check (0 card overlaps, 0 broken flag images, no console errors), but **the user is not happy with the visual quality of the genre-area blob shapes** and asked to move this project back to you rather than continue iterating with Claude. Do not treat the clean metrics below as proof the layout is good — they measure collisions and crashes, not whether a shape looks pinched, stretched, or "mangled" (the user's word). That judgment call is still open. Read the "Unresolved: blob shape quality" section before touching the layout algorithm; it explains exactly what was tried, why it wasn't good enough, and what to try instead of repeating the same patches.

## What to upload to GitHub for the public page

Minimum for the page to work, unchanged relative paths:

```
index.html          ← the deployable page (generated, self-contained, no build step needed to serve it)
assets/flags/*.svg   ← ~90 country + region flag icons
assets/symbols/*.svg ← "worldwide"/"online" icons
```

That's genuinely all a static host (GitHub Pages, Netlify, anything) needs. `index.html` is a single self-contained file — no external JS/CSS dependencies, everything is inlined except the `assets/` image references.

Also upload, so the project stays maintainable by anyone (including you, next time) instead of requiring hand-edits to the generated `index.html`:

```
src/shell.html       ← page shell: <style>, #loading markup + script, #viewport/#timeline containers
src/layout.js        ← all layout, routing, and interaction logic (the real "source code")
genres-data.json     ← raw snapshot of the Google Sheet (columns B/C/E/F/G/H/J/L), 730 rows
build.js             ← `node build.js` concatenates shell.html + genres-data.json (as embedded JSON) + layout.js → index.html
README.md            ← short pointer doc, update it if you restructure anything
```

**Never hand-edit `index.html` directly.** It's generated. Edit `src/shell.html` / `src/layout.js` / `genres-data.json` and run `node build.js`. If you ever find `index.html` has drifted from what `build.js` would produce, that's a bug to fix, not a state to preserve.

Optional / your call, not needed for the page to run:

```
measure.js           ← headless Playwright metrics harness (overlaps, route failures, void radius, angular deviation, etc.) — genuinely useful, keep it if you can run Playwright in your environment
smoke.js             ← hover-chain interaction smoke test — per CLAUDE_HANDOFF.md this was already known to be unreliable before this session touched it; don't trust its output without rewriting it to use real Playwright events and a two-frame wait
GPT_HANDOFF.md, CLAUDE_HANDOFF.md ← prior session handoff docs, useful history, safe to keep or delete
index2.html, baseline.png, baseline_measure.json ← stale artifacts from an earlier patch round (see project doc `claude/index2-postmortem.md` if you have access to it) — index2.html was a scratch copy that was later made identical to index.html and then diverged again as index.html kept changing; don't upload it, it'll just confuse whoever opens the repo next
```

## How the page works (architecture)

Single HTML file, no framework, no build tooling needed at runtime. It renders 730 music genres as cards on a giant pannable/zoomable canvas: genres are arranged in **concentric rings by decade** (radius = era) and in **fixed angular wedges by top-level genre Area** (angle = genre family — Rock, Jazz, Techno, etc., 21 of them). Colored blob outlines ("lobes") are drawn behind each Area's cards, and behind each Area's "Secondary Area" sub-groups (Ambient, Drum & Bass, IDM, etc.) nested inside it. Parent→child genre relationships are drawn as routed connector lines (direct line if clear, else grid-based A*, else perimeter routing, else a straight fallback).

**The one rule that must never be broken:** each of the 21 top-level Areas owns one fixed angular sector for the *entire* diagram, at every ring/decade. Sector angles are computed once, globally, before any card is placed — never recomputed per-ring or per-decade. An earlier rewrite that let sectors shift per-ring produced visually random spiraling chaos and had to be fully reverted. If you touch `src/layout.js`, grep for `categoryOrder` / `sectors` / `subSectors` and make sure nothing inside the per-decade placement loop (`for(const decade of decades){...}`) ever recomputes a category's own angular bounds — it may only place cards inside bounds decided once, up front.

Key functions in `src/layout.js`, in the order they run:
- `iso` / `regionIcons` / `flagAssets` — country name → flag SVG path.
- `chainOrder` / `cycleScore` / `twoOptImprove` — generic nearest-neighbor + 2-opt ordering, used both to order the 21 Areas around the circle (by inter-Area link weight, with a bonus for keeping electronic genres adjacent) and to order each Area's internal Secondary Areas.
- `areaDemand` / `sectors` — each Area's angular width is proportional to `(peak per-decade linear card width)^0.58`, not equal shares.
- `subSectors` — same idea one level down: each Secondary Area gets a fixed slice *inside* its parent Area's sector, sized by its own peak demand.
- The big per-decade loop (~line 37) — places every card. For each Area, each decade, each Secondary Area sub-group: track-based greedy angular packing (`boxAt`/`overlaps`) inside that sub-group's angular bounds, adding more radial tracks (deeper stack) rather than exceeding its bounds.
- `contourPath` / `closedContour` — turns each Area's (or Secondary Area's) set of cards into a smooth SVG blob outline by sampling one inner/outer/left/right envelope per decade and connecting them with corner-cutting Bézier smoothing.
- `routeGrid` / `routeOutside` / `localDetour` — the edge-routing fallback chain.
- `addAreaLabel` / `placeLabel` — on-blob text labels, placed via a collision-avoiding spiral search against both node cards and other labels.
- The `#loading` overlay markup/script lives in `src/shell.html`, not `layout.js` — it has to paint before the (slow, ~10-20s in a sandboxed headless browser; unverified but presumably much faster on real hardware) layout computation even starts, which is why `layout.js`'s entire body is wrapped in a double `requestAnimationFrame`.

## Data contract

Source is the `GENRES` tab of a Google Sheet (the user has not authorized editing it or re-pulling it this session — don't touch it without asking). `genres-data.json` is a point-in-time snapshot of `values` (raw rows). `build.js` maps columns:

| Column | Meaning |
|---|---|
| B | display name |
| C | `Nametech`, stable genre ID — **parent resolution must use this, never the display name** |
| E | main Area |
| F | Secondary Area (short internal codes: `dnb`, `idm`, `ukgrime`, etc. — `layout.js` maps these to display names via `secondaryDisplay` and normalizes a couple of casing inconsistencies, e.g. `idm` vs `IDM`, via `secondaryLabel`) |
| G | Importance 1–5 |
| H | Parent, referencing column C |
| J | era/decade |
| L | country/region (comma/slash separated; region tokens like "Europe", "Caribbean" map to flag icons via `regionIcons`, plain country names via `iso`) |

## Unresolved: blob shape quality (read this before changing layout.js)

Across this project's history (see `GPT_HANDOFF.md` / `CLAUDE_HANDOFF.md` for the blow-by-blow), the layout has gone through several rounds fighting the same underlying tension: **a fixed angular sector is a constant, but genre content per decade is wildly uneven**, so any algorithm has to decide what happens when one Area or Secondary Area needs more angular room in some decades than others. Every approach tried so far has been some version of "let it borrow room / expand into the parent's wider sector when it doesn't fit" — and every version of that has produced a visible defect once real (uneven) data is plugged in:

1. Letting a Secondary Area borrow angular space from *other, unrelated* top-level Areas when its own Area's sector is full → the borrowed range could be far away angularly, and since the blob's outline connects consecutive decades' angular envelopes, one displaced decade dragged the whole shape into a long twisted arc across unrelated Areas. (This was the "Latin and Jazz are unacceptable, criss-crossing" complaint.) Fixed by never borrowing outside the Area's own sector.
2. Even confined to one Area, switching a Secondary Area between its own narrow sub-sector and the parent's full sector *per decade*, as a hard yes/no threshold, produced a sharp elbow/pinch wherever two adjacent decades landed on opposite sides of the threshold. (This was the "Ambient and Dubstep are mangled" complaint.) Softened by blending the two bounds continuously instead of switching abruptly — this reduced the sharpness of the bend but did **not** eliminate the fact that some Secondary Areas are still long, thin, snake-like shapes, because their content really is spread across many decades inside a narrow slice.
3. The alternative tried and rejected: always confine every Secondary Area to its own fixed sub-sector, never expanding, and let it stack arbitrarily deep (more radial tracks) instead. This is geometrically always possible (a fixed angle covers more linear distance at a larger radius) and produces perfectly consistent, non-pinched angular bounds — but it roughly **doubled** the overall diagram radius (`maxR` went from ~6000px to ~12900px) because a few sparse-early-era Secondary Areas needed extremely deep stacks. Rejected as a worse trade.

None of these three is clearly "the right answer" — they're different trade-offs between shape smoothness, world size, and how strictly the fixed-sector invariant is honored one level down (note: the invariant is about *top-level Areas*, not Secondary Areas — there is room to reconsider whether Secondary Areas need a fixed angular sector at all, versus e.g. an entirely different visual treatment for sub-genre groupings that doesn't fight this constraint). Some directions worth considering that were **not** tried this round:

- Don't give Secondary Areas a fixed angular sector at all. Let them free-flow within their parent Area's sector per-decade (packed by demand each decade, no persistent angular identity), and instead of a colored blob outline, label sub-genre clusters some other way (e.g. a lighter background tint per contiguous run of same-secondary cards within a decade, or just the on-card color, or a leader-line label) that doesn't depend on the sub-genre having a stable, connectable shape across decades.
- Reconsider whether the smooth Bézier contour is fighting the data. A blob that's forced to be smooth across radically different per-decade widths is a shape that *wants* to look like a sharp funnel or a pinch; that's arguably not a rendering bug so much as smoothing being the wrong tool for this particular data shape. A contour style that's allowed sharper, more angular transitions between decades (still cleaned up, just not forced through a uniform-radius Bézier corner-cut) might read as "intentional" rather than "distorted" even when the underlying width genuinely changes a lot decade to decade.
- Ask the user directly, with pictures, which specific Secondary Areas they consider acceptable vs. not (Trance was called out as the *positive* reference example) and try to characterize numerically what's different about Trance's per-decade content distribution vs. Ambient's/Dubstep's/Latin's, rather than guessing at another global algorithm tweak.

Whatever you change, **verify with `node measure.js index.html`** (needs Playwright; `npm install playwright` and a Chromium binary — the version used this session ran headless Chromium at `/opt/pw-browsers/chromium` in a sandboxed container, adjust the executablePath in `measure.js` for your environment) before calling it done, and — more importantly this time — actually look at zoomed screenshots of Latin, Jazz, Ambient, Dubstep, and Trance side by side before deciding it's fixed. A metrics-only pass ("0 overlaps, 0 route failures") is necessary but was repeatedly not sufficient for this specific complaint.

## Last verified state (this session, before handoff)

`node build.js && node measure.js index.html`:

```
nodes: 730, edges: 653
maxR: 6062, worldW/H: 12348
cardOverlaps: 0
routeFailures: 2 (of 653 — both pre-existing minor fallback-edge cases, not new)
areaContours: 21, secondaryContours: 11, insetMasks: 21
consoleIssues: []
```

Flag audit (all 730 cards): 0 broken images, 0 failed network requests. Label audit (32 Area + Secondary Area titles): 0 label-label overlaps, 0 label-node overlaps. Loading screen paints on first frame (before the ~10-20s sandboxed layout computation), cycles 7 fixed messages every 0.5-0.6s with a masked scroll-fade transition, and fades out over 0.5s once ready.

None of the above contradicts the "Unresolved" section above — they're different, both-true facts: the page is structurally sound and the specific blob shapes are still not what the user wants.
