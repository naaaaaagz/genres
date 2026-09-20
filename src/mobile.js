/* Mobile genre map.
   One Area at a time, scrolled vertically: newest music at the top, oldest at
   the bottom, split into faint decade bands. Swipe (or the header chevrons) to
   move between Areas. The drilldown selector filters by Importance.

   Row shape, as emitted by build.js:
     0 name  1 nametech  2 importance  3 parent  4 decade  5 country
     6 area  7 secondary area  8 parent secondary  9 parent tertiary
     10 "No Parent" flag  11 "External Parent" flag

   `rows`, plus the shared lookups from src/common.js (iso, regions,
   regionIcons, flagAssets, areaDisplay), are injected above this file.
*/
requestAnimationFrame(() => requestAnimationFrame(function () {
"use strict";

/* ------------------------------------------------------------------ data */

const DECADES = ["ancient", "medieval", "early modern", "1900s", "1910s", "1920s",
  "1930s", "1940s", "1950s", "1960s", "1970s", "1980s", "1990s", "2000s",
  "2010s", "2020s"];
const DECADE_LABEL = {
  "ancient": "ancient", "medieval": "medieval", "early modern": "early mod.",
};
const decIndex = {};
DECADES.forEach((d, i) => { decIndex[d] = i; });

/* Each Area gets its own hue + saturation, from which the whole page palette
   is derived, so swiping visibly changes the mood rather than just the title. */
const AREA_HUE = {
  rasta: [138, 44], latin: [26, 58], jazz: [272, 38], experimental: [172, 36],
  industrial: [206, 14], hardcore: [2, 50], trance: [258, 44], techno: [222, 40],
  house: [198, 48], breakbeat: [188, 50], hiphop: [44, 54], soulful: [16, 48],
  pop: [322, 44], folk: [96, 38], rock: [14, 50], metal: [348, 42],
  classical: [40, 18],
};
function scheme(area) {
  const hs = AREA_HUE[area] || [215, 18];
  const h = hs[0], s = hs[1];
  const S = k => Math.round(s * k);
  return {
    "--bg": "hsl(" + h + " " + S(.30) + "% 18.5%)",
    "--bg-0": "hsl(" + h + " " + S(.30) + "% 18.5% / 0)",
    "--brick-fill": "hsl(" + h + " " + S(.38) + "% 14.5%)",
    "--brick-line": "hsl(" + h + " " + S(.95) + "% 79% / .62)",
    "--ink": "hsl(" + h + " " + S(.16) + "% 93%)",
    "--ink-dim": "hsl(" + h + " " + S(.14) + "% 63%)",
    "--ink-faint": "hsl(" + h + " " + S(.14) + "% 45%)",
    "--accent": "hsl(" + h + " " + Math.min(82, S(1.35)) + "% 69%)",
    "--band": "hsl(" + h + " " + S(.62) + "% 82% / .18)",
    "--edge": "hsl(" + h + " " + S(.52) + "% 87%)",
  };
}
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const nodes = [];
const byTech = Object.create(null);
for (const r of rows) {
  const n = {
    name: r[0], tech: r[1], imp: r[2], p1: r[3] === "(none)" ? "" : r[3],
    dec: r[4], country: r[5], area: r[6], sec: r[7],
    p2: r[8], p3: r[9], noParent: r[10], extParent: r[11],
    di: decIndex[r[4]] === undefined ? 0 : decIndex[r[4]],
  };
  nodes.push(n);
  byTech[n.tech] = n;
}

const nodesByArea = Object.create(null);
for (const n of nodes) (nodesByArea[n.area] || (nodesByArea[n.area] = [])).push(n);

/* Primary-parent children index, used for ghost bricks. */
const kidsOf = Object.create(null);
for (const n of nodes) {
  if (!n.p1) continue;
  (kidsOf[n.p1] || (kidsOf[n.p1] = [])).push(n);
}

/* ------------------------------------------------- area order (swipe order)
   Areas that share parent links sit next to each other, so swiping moves
   between musically adjacent families rather than jumping at random. */

const areaKeys = Object.keys(nodesByArea);
const aIdx = Object.create(null);
areaKeys.forEach((a, i) => { aIdx[a] = i; });
const W = areaKeys.map(() => new Float64Array(areaKeys.length));
for (const n of nodes) {
  for (const t of [n.p1, n.p2, n.p3]) {
    const p = t && byTech[t];
    if (!p || p.area === n.area) continue;
    const a = aIdx[n.area], b = aIdx[p.area];
    if (a === undefined || b === undefined) continue;
    W[a][b] += 1; W[b][a] += 1;
  }
}
const order = (function () {
  const n = areaKeys.length, used = new Array(n).fill(false);
  let start = 0, best = -1;
  for (let i = 0; i < n; i++) {
    let s = 0; for (let j = 0; j < n; j++) s += W[i][j];
    if (s > best) { best = s; start = i; }
  }
  const chain = [start]; used[start] = true;
  while (chain.length < n) {
    const tail = chain[chain.length - 1];
    let pick = -1, pw = -1;
    for (let j = 0; j < n; j++) {
      if (used[j]) continue;
      const w = W[tail][j] + 1e-6 * nodesByArea[areaKeys[j]].length;
      if (w > pw) { pw = w; pick = j; }
    }
    chain.push(pick); used[pick] = true;
  }
  const score = c => { let s = 0; for (let i = 0; i + 1 < c.length; i++) s += W[c[i]][c[i + 1]]; return s; };
  let cur = chain, curS = score(cur), improved = true, guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    for (let i = 0; i < n - 1 && !improved; i++) {
      for (let j = i + 1; j < n; j++) {
        const cand = cur.slice(0, i).concat(cur.slice(i, j + 1).reverse(), cur.slice(j + 1));
        const s = score(cand);
        if (s > curS + 1e-9) { cur = cand; curS = s; improved = true; break; }
      }
    }
  }
  return cur.map(i => areaKeys[i]);
})();

/* ------------------------------------------------------------ measurement */

/* A genre's Importance drives how big its brick is: 5 reads as a landmark,
   1 is small but still comfortably readable. */
const IMP_FONT = { 5: 14.5, 4: 12.8, 3: 11.6, 2: 10.4, 1: 9.6 };
const impOf = n => Math.max(1, Math.min(5, n | 0));
const fontFor = imp => '600 ' + IMP_FONT[imp] + 'px "Inter",-apple-system,BlinkMacSystemFont,'
  + '"Segoe UI",Roboto,Arial,sans-serif';

const MEAS = document.createElement("canvas").getContext("2d");

function splitLines(text, k) {
  const words = text.split(/\s+/);
  if (words.length < k) return null;
  let best = null, bestScore = Infinity;
  const cuts = [];
  (function rec(start, depth, acc) {
    if (depth === k - 1) { cuts.push(acc.concat([words.length])); return; }
    for (let i = start + 1; i <= words.length - (k - depth - 1); i++) rec(i, depth + 1, acc.concat([i]));
  })(0, 0, []);
  for (const c of cuts) {
    const parts = []; let prev = 0;
    for (const p of c) { parts.push(words.slice(prev, p).join(" ")); prev = p; }
    const score = Math.max.apply(null, parts.map(p => MEAS.measureText(p).width));
    if (score < bestScore) { bestScore = score; best = parts; }
  }
  return { parts: best, w: bestScore };
}

/* CSS wraps greedily, so count the lines the chosen width actually produces
   rather than trusting the balanced split used to pick that width. */
function greedyLines(text, avail) {
  const words = text.split(/\s+/);
  const sp = MEAS.measureText(" ").width;
  let lines = 1, cur = 0;
  for (const wd of words) {
    const ww = MEAS.measureText(wd).width;
    const cand = cur ? cur + sp + ww : ww;
    if (cand > avail && cur) { lines++; cur = ww; } else cur = cand;
  }
  return lines;
}

const measureCache = Object.create(null);
function measure(text, imp) {
  const key = imp + "|" + text;
  if (measureCache[key]) return measureCache[key];
  const f = IMP_FONT[imp];
  const maxW = 100 + imp * 10, minW = 46 + imp * 7, padX = 9 + imp, padY = 11;
  const hFor = k => Math.round(k * f * 1.2) + padY;
  MEAS.font = fontFor(imp);
  const one = MEAS.measureText(text).width;
  let out;
  if (one + padX * 2 <= maxW) {
    out = { w: Math.max(minW, Math.ceil(one) + padX * 2), h: hFor(1) };
  } else {
    const two = splitLines(text, 2);
    if (two && two.w + padX * 2 <= maxW) {
      const w = Math.max(minW, Math.ceil(two.w) + padX * 2);
      out = { w: w, h: hFor(Math.min(2, greedyLines(text, w - padX * 2))) };
    } else {
      const three = splitLines(text, 3);
      const w = Math.max(minW, three ? Math.min(maxW, Math.ceil(three.w) + padX * 2) : maxW);
      out = { w: w, h: hFor(Math.min(3, greedyLines(text, w - padX * 2))) };
    }
  }
  measureCache[key] = out;
  return out;
}

/* ---------------------------------------------------------------- layout */

const GAP_X = 18, ROW_GAP = 26, JITTER = 4;
const BAND_TOP = 32, BAND_BOTTOM = 22;
const EXT_H = 34;
const CLEAR = 4;          // keep-out margin around a brick for routed lines
const CHANNEL = 4;        // narrowest gap a connector is allowed to thread
const STUB_LEN = 24;      // length of the "there is more here" stub
const MAX_DUDS = 3;

/* 1-D placement inside one row: keep the given order and the minimum gaps,
   but slide each brick as close to its wanted centre as the slack allows. */
function placeRow(items, width) {
  const n = items.length;
  const lo = new Float64Array(n), hi = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) { lo[i] = acc; acc += items[i].w + GAP_X; }
  acc = width;
  for (let i = n - 1; i >= 0; i--) { acc -= items[i].w; hi[i] = acc; acc -= GAP_X; }
  for (let i = 0; i < n; i++) {
    let x = items[i].want - items[i].w / 2;
    if (x < lo[i]) x = lo[i];
    if (x > hi[i]) x = hi[i];
    if (i > 0) { const min = items[i - 1].x + items[i - 1].w + GAP_X; if (x < min) x = min; }
    items[i].x = x;
  }
  for (let i = n - 2; i >= 0; i--) {
    const max = items[i + 1].x - GAP_X - items[i].w;
    if (items[i].x > max) items[i].x = Math.max(lo[i], max);
  }
}

function packLayer(items, width) {
  const rowsOut = [];
  let cur = [], curW = 0;
  for (const it of items) {
    if (cur.length && curW + GAP_X + it.w > width) { rowsOut.push(cur); cur = []; curW = 0; }
    curW += cur.length ? GAP_X + it.w : it.w;
    cur.push(it);
  }
  if (cur.length) rowsOut.push(cur);
  for (const r of rowsOut) placeRow(r, width);
  return rowsOut;
}

/* How many connectors would visibly cross, judged from the x positions of the
   two ends; used to pick the best of several ordering sweeps. */
function countCrossings(edges) {
  let c = 0;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const a0 = Math.min(a.from.yc, a.to.yc), a1 = Math.max(a.from.yc, a.to.yc);
    for (let j = i + 1; j < edges.length; j++) {
      const b = edges[j];
      const b0 = Math.min(b.from.yc, b.to.yc), b1 = Math.max(b.from.yc, b.to.yc);
      if (a1 <= b0 || b1 <= a0) continue;
      const d1 = (a.from.x + a.from.w / 2) - (b.from.x + b.from.w / 2);
      const d2 = (a.to.x + a.to.w / 2) - (b.to.x + b.to.w / 2);
      if (d1 * d2 < 0) c++;
    }
  }
  return c;
}

const layoutCache = Object.create(null);

function buildLayout(area, level, width, flip) {
  const key = area + "|" + level + "|" + width + "|" + (flip ? 1 : 0);
  if (layoutCache[key]) return layoutCache[key];

  const all = nodesByArea[area] || [];
  const vis = all.filter(n => n.imp >= level);
  const visible = new Set(vis.map(n => n.tech));

  /* nearest visible ancestor inside this area, following primary parents;
     `hidden` counts the omitted genres passed on the way */
  const resolveCache = Object.create(null);
  function resolve(tech) {
    if (!tech) return null;
    if (tech in resolveCache) return resolveCache[tech];
    let cur = tech, hops = 0, out = null, skipped = 0;
    const seen = new Set();
    while (cur && hops++ < 40 && !seen.has(cur)) {
      seen.add(cur);
      const n = byTech[cur];
      if (!n || n.area !== area) { out = null; break; }
      if (visible.has(cur)) { out = { tech: cur, hidden: skipped }; break; }
      skipped++;
      cur = n.p1;
    }
    resolveCache[tech] = out;
    return out;
  }

  const items = [], itemFor = Object.create(null);

  for (const n of vis) {
    const imp = impOf(n.imp);
    const m = measure(n.name, imp);
    itemFor[n.tech] = { kind: "node", node: n, tech: n.tech, imp, di: n.di, w: m.w, h: m.h, x: 0, y: 0, want: 0 };
    items.push(itemFor[n.tech]);
  }

  /* External parents: a translucent oval tinted with their own Area's colour */
  const extItems = Object.create(null);
  for (const n of vis) {
    if (!n.extParent || !n.p1) continue;
    const p = byTech[n.p1];
    if (!p || p.area === area || extItems[p.tech]) continue;
    const imp = Math.max(2, impOf(p.imp) - 1);
    const m = measure(p.name, imp);
    extItems[p.tech] = {
      kind: "ext", node: p, tech: "ext:" + p.tech, imp, di: p.di,
      w: Math.max(84, m.w + 20), h: EXT_H, x: 0, y: 0, want: 0,
    };
    items.push(extItems[p.tech]);
  }

  /* ---- edges ---- */
  const edges = [];
  for (const n of vis) {
    const src = itemFor[n.tech];
    const drawn = new Set();
    if (n.extParent && n.p1 && byTech[n.p1] && byTech[n.p1].area !== area) {
      const t = extItems[byTech[n.p1].tech];
      if (t) { edges.push({ from: src, to: t, rank: "ex", hidden: 0 }); drawn.add(t.tech); }
    } else {
      const r = resolve(n.p1);
      if (r && r.tech !== n.tech) {
        edges.push({ from: src, to: itemFor[r.tech], rank: "p1", hidden: r.hidden });
        drawn.add(r.tech);
      }
    }
    const r2 = resolve(n.p2);
    if (r2 && r2.tech !== n.tech && !drawn.has(r2.tech)) {
      edges.push({ from: src, to: itemFor[r2.tech], rank: "p2", hidden: r2.hidden }); drawn.add(r2.tech);
    }
    const r3 = resolve(n.p3);
    if (r3 && r3.tech !== n.tech && !drawn.has(r3.tech)) {
      edges.push({ from: src, to: itemFor[r3.tech], rank: "p3", hidden: r3.hidden });
    }
  }

  /* stubs: a visible genre whose own children were filtered out keeps a short
     fading line in the children's direction, so the branch is not lost */
  const stubs = [];
  if (level > 1) {
    for (const n of vis) {
      const hiddenKids = (kidsOf[n.tech] || []).filter(k => k.area === area && k.imp < level).length;
      if (hiddenKids) stubs.push({ item: itemFor[n.tech], n: hiddenKids });
    }
  }

  for (const it of items) { it.up = []; it.down = []; }
  for (const e of edges) { e.from.up.push(e.to); e.to.down.push(e.from); }

  /* ---- layers ---- */
  const layers = new Map();
  for (const it of items) {
    if (!layers.has(it.di)) layers.set(it.di, []);
    layers.get(it.di).push(it);
  }
  const dis = Array.from(layers.keys()).sort((a, b) => a - b);   // oldest first
  for (const it of items) it.x = (width - it.w) / 2;

  /* Within one decade there is no chronology to lean on, so rank by depth in
     the same-decade parent chain and draw deeper genres nearer the "new" end. */
  for (const [di, layer] of layers) {
    const memo = new Map();
    const depth = it => {
      if (memo.has(it)) return memo.get(it);
      memo.set(it, 0);
      let d = 0;
      for (const o of it.up) if (o.di === di) d = Math.max(d, depth(o) + 1);
      memo.set(it, d); return d;
    };
    for (const it of layer) it.rank = 0;
    for (const it of layer) it.rank = depth(it);
  }

  /* provisional y, only so crossings can be scored between sweeps */
  function provisionalY() {
    const seq = flip ? dis : dis.slice().reverse();
    let y = 0;
    for (const di of seq) {
      const rowsOut = packLayer(layers.get(di), width);
      for (const r of rowsOut) {
        let rh = 0; for (const it of r) if (it.h > rh) rh = it.h;
        for (const it of r) it.yc = y + rh / 2;
        y += rh + ROW_GAP;
      }
      y += BAND_TOP + BAND_BOTTOM;
    }
  }

  function sweep(up) {
    const seq = up ? dis : dis.slice().reverse();
    for (const di of seq) {
      const layer = layers.get(di);
      for (const it of layer) {
        const refs = (up ? it.up : it.down).filter(o => o.di !== di);
        if (refs.length) {
          let s = 0; for (const o of refs) s += o.x + o.w / 2;
          it.want = s / refs.length;
        } else it.want = it.x + it.w / 2;
      }
      layer.sort((a, b) => (flip ? a.rank - b.rank : b.rank - a.rank)
        || a.want - b.want || a.w - b.w);
      packLayer(layer, width);
    }
  }

  /* Alternate barycentre sweeps and keep whichever pass crosses least. */
  let best = null, bestScore = Infinity;
  for (let pass = 0; pass < 6; pass++) {
    sweep(true); sweep(false);
    provisionalY();
    const sc = countCrossings(edges);
    if (sc < bestScore) {
      bestScore = sc;
      best = { x: items.map(it => it.x), ord: dis.map(di => layers.get(di).slice()) };
    }
    if (sc === 0) break;
  }
  if (best) {
    items.forEach((it, i) => { it.x = best.x[i]; });
    dis.forEach((di, i) => layers.set(di, best.ord[i]));
  }

  /* ---- vertical placement, band by band ---- */
  const bands = [], rows = [];
  let y = 0;
  const seq = flip ? dis : dis.slice().reverse();
  for (let bi = 0; bi < seq.length; bi++) {
    const di = seq[bi];
    const layer = layers.get(di);
    const rowsOut = packLayer(layer, width);
    const bandTop = y;
    let ry = y + BAND_TOP;
    for (const r of rowsOut) {
      let rh = 0; for (const it of r) if (it.h > rh) rh = it.h;
      const rowIdx = rows.length;
      let yTop = Infinity, yBot = -Infinity;
      for (const it of r) {
        const j = (hash32(it.tech) % (2 * JITTER + 1)) - JITTER;
        it.y = ry + (rh - it.h) / 2 + j;
        it.row = rowIdx;
        if (it.y < yTop) yTop = it.y;
        if (it.y + it.h > yBot) yBot = it.y + it.h;
      }
      rows.push({ yTop, yBot, items: r.slice() });
      ry += rh + ROW_GAP;
    }
    y = ry - ROW_GAP + BAND_BOTTOM;
    bands.push({ di, top: bandTop, bottom: y, first: bi === 0 });
  }
  for (const it of items) { it.cx = it.x + it.w / 2; it.cy = it.y + it.h / 2; }

  /* free horizontal channels per row, for the connector router */
  for (const r of rows) {
    const blocked = r.items.map(it => [it.x - CLEAR, it.x + it.w + CLEAR])
      .sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cursor = 2;
    for (const b of blocked) {
      if (b[0] > cursor) gaps.push([cursor, b[0]]);
      if (b[1] > cursor) cursor = b[1];
    }
    if (cursor < width - 2) gaps.push([cursor, width - 2]);
    r.free = gaps.filter(f => f[1] - f[0] >= CHANNEL);
    /* a row packed edge to edge still needs one channel: take its widest gap */
    if (!r.free.length && gaps.length) {
      r.free = [gaps.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))];
    }
  }

  /* ---- connector anchors ---- */
  for (const it of items) { it.eOut = []; it.eIn = []; }
  for (const e of edges) { e.from.eOut.push(e); e.to.eIn.push(e); }
  for (const it of items) {
    const inset = Math.min(9, it.w / 4);
    it.eOut.sort((a, b) => a.to.cx - b.to.cx);
    it.eOut.forEach((e, i) => { e.ax = it.x + inset + (it.w - 2 * inset) * ((i + 1) / (it.eOut.length + 1)); });
    it.eIn.sort((a, b) => a.from.cx - b.from.cx);
    it.eIn.forEach((e, i) => { e.bx = it.x + inset + (it.w - 2 * inset) * ((i + 1) / (it.eIn.length + 1)); });
  }

  /* ---- route every connector through the free channels ---- */
  for (const e of edges) e.pts = routeEdge(e, rows, width, flip);
  for (const s of stubs) s.seg = stubSegments(s.item, rows, flip);

  const out = { area, level, flip, width, items, edges, stubs, rows, bands,
    height: y + 64, itemFor, crossings: bestScore };
  layoutCache[key] = out;
  return out;
}

/* ------------------------------------------------------- connector router */

function inFree(row, x) {
  for (const f of row.free) if (x >= f[0] + 1.5 && x <= f[1] - 1.5) return true;
  return false;
}
function nearestFree(row, x, bias) {
  if (!row.free.length) return x;
  let bestX = x, bestD = Infinity;
  for (const f of row.free) {
    const mid = (f[0] + f[1]) / 2;
    const lo = Math.min(f[0] + 1.5, mid), hi = Math.max(f[1] - 1.5, mid);
    const p = x < lo ? lo : x > hi ? hi : x;
    const d = Math.abs(p - x) * 1000 + Math.abs(p - bias);
    if (d < bestD) { bestD = d; bestX = p; }
  }
  return bestX;
}
function corridorY(rows, a, b, seed) {
  const lo = rows[Math.min(a, b)].yBot + 3;
  const hi = rows[Math.max(a, b)].yTop - 3;
  if (hi <= lo) return (rows[Math.min(a, b)].yBot + rows[Math.max(a, b)].yTop) / 2;
  return lo + (seed % Math.max(1, Math.round(hi - lo)));
}

/* Child first, parent second: the line leaves the child, travels only through
   the gaps between rows, and never passes under a brick or an oval. */
function routeEdge(e, rows, width, flip) {
  const from = e.from, to = e.to;
  const ci = from.row, pi = to.row;
  const seed = hash32(from.tech + ">" + to.tech);
  if (ci === pi) {
    /* same row: hop around the side */
    const dir = from.cx < to.cx ? 1 : -1;
    return { side: true, a: [dir > 0 ? from.x + from.w : from.x, from.cy],
      b: [dir > 0 ? to.x : to.x + to.w, to.cy], dir: dir };
  }
  const dir = pi > ci ? 1 : -1;
  let x = e.ax;
  const pts = [[x, dir > 0 ? from.y + from.h : from.y]];
  for (let k = ci; k !== pi; k += dir) {
    const next = k + dir;
    const cy = corridorY(rows, k, next, seed + k * 37);
    if (next === pi) {
      pts.push([x, cy]);
      if (Math.abs(e.bx - x) > 0.5) pts.push([e.bx, cy]);
      x = e.bx;
    } else if (!inFree(rows[next], x)) {
      const nx = nearestFree(rows[next], x, e.bx);
      pts.push([x, cy]);
      if (Math.abs(nx - x) > 0.5) pts.push([nx, cy]);
      x = nx;
    }
  }
  pts.push([x, dir > 0 ? to.y : to.y + to.h]);
  return { pts };
}

/* Four shortening segments read as a line fading out into nothing. */
function stubSegments(it, rows, flip) {
  const dir = flip ? 1 : -1;                     // toward the children
  const x = it.x + it.w * 0.82;
  const edge = dir > 0 ? it.y + it.h : it.y;
  let room = STUB_LEN;
  const nb = rows[it.row + dir];
  if (nb) room = Math.min(STUB_LEN, dir > 0 ? nb.yTop - edge - 3 : edge - nb.yBot - 3);
  if (room < 8) return null;
  const segs = [], n = 4, step = room / n;
  for (let i = 0; i < n; i++) {
    segs.push([x, edge + dir * i * step, x, edge + dir * (i + 1) * step]);
  }
  return segs;
}

/* ------------------------------------------------------------------- draw */

const viewport = document.getElementById("viewport");
const track = document.getElementById("track");
const areabar = document.getElementById("areabar");
const areaNameEl = document.getElementById("areaName");
const tipEl = document.getElementById("tip");
const scrimEl = document.getElementById("scrim");
const hintEl = document.getElementById("scrollHint");
const hintText = document.getElementById("hintText");
const flipBtn = document.getElementById("flipBtn");
const fadeTop = document.getElementById("fadeTop");
const fadeBottom = document.getElementById("fadeBottom");

const PAD_L = 12, PAD_R = 52;
const ZOOM = .84;
const EDGE_STYLE = {
  p1: { w: 2.1, o: .62 },
  p2: { w: 1.0, o: .30 },
  p3: { w: .55, o: .24, dash: "1.2 3.2" },
  ex: { w: .9, o: .28, dash: "3 4" },
};

let curAreaIdx = 0;
let curLevel = 3;
let curFlip = false;
let hintTimer = null;

const panes = Array.prototype.map.call(track.children, el => ({
  el, stage: el.querySelector(".stage"), svg: el.querySelector(".edges"),
  area: null, layout: null, focused: null, selEl: null,
}));
const active = () => panes[1];

function wrapIdx(i) { const n = order.length; return ((i % n) + n) % n; }
function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function applyScheme(el, area) {
  const sc = scheme(area);
  for (const k in sc) el.style.setProperty(k, sc[k]);
}

/* rounded-corner polyline */
function polyPath(pts, r) {
  if (pts.length < 2) return "";
  let d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const d1 = Math.hypot(p[0] - a[0], p[1] - a[1]);
    const d2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    if (rr < 1) { d += "L" + p[0].toFixed(1) + " " + p[1].toFixed(1); continue; }
    const u1 = [(p[0] - a[0]) / d1, (p[1] - a[1]) / d1];
    const u2 = [(b[0] - p[0]) / d2, (b[1] - p[1]) / d2];
    d += "L" + (p[0] - u1[0] * rr).toFixed(1) + " " + (p[1] - u1[1] * rr).toFixed(1)
      + "Q" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "
      + (p[0] + u2[0] * rr).toFixed(1) + " " + (p[1] + u2[1] * rr).toFixed(1);
  }
  const L = pts[pts.length - 1];
  return d + "L" + L[0].toFixed(1) + " " + L[1].toFixed(1);
}
function sidePath(rt) {
  const bow = Math.min(30, Math.max(14, Math.abs(rt.b[0] - rt.a[0]) * .35));
  return "M" + rt.a[0] + " " + rt.a[1] + "C" + (rt.a[0] + rt.dir * bow) + " " + rt.a[1]
    + "," + (rt.b[0] - rt.dir * bow) + " " + rt.b[1] + "," + rt.b[0] + " " + rt.b[1];
}
/* evenly spaced points along a polyline, for the "omitted genre" blocks */
function alongPoly(pts, n) {
  const segs = [], out = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(L); total += L;
  }
  if (!total) return out;
  for (let k = 1; k <= n; k++) {
    let t = total * k / (n + 1), i = 0;
    while (i < segs.length && t > segs[i]) { t -= segs[i]; i++; }
    if (i >= segs.length) i = segs.length - 1;
    const a = pts[i], b = pts[i + 1], f = segs[i] ? t / segs[i] : 0;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

function renderPane(pane, area, level) {
  pane.area = area;
  pane.focused = null; pane.selEl = null;
  applyScheme(pane.el, area);
  pane.el.classList.remove("focus");
  pane.stage.style.transform = "";

  const width = Math.max(200, pane.el.clientWidth - PAD_L - PAD_R);
  const L = buildLayout(area, level, width, curFlip);
  pane.layout = L;

  let html = "";
  for (const b of L.bands) {
    const raw = DECADES[b.di] || "";
    html += '<div class="band" style="top:' + b.top + 'px;height:' + (b.bottom - b.top) + 'px">'
      + (b.first ? "" : '<div class="bline"></div>')
      + '<div class="blabel">' + (DECADE_LABEL[raw] || raw) + "</div></div>";
  }
  for (let i = 0; i < L.items.length; i++) {
    const it = L.items[i];
    let style = "left:" + (it.x + PAD_L).toFixed(1) + "px;top:" + it.y.toFixed(1)
      + "px;width:" + it.w.toFixed(1) + "px;height:" + it.h + "px";
    if (it.kind === "ext") {
      const hs = AREA_HUE[it.node.area] || [215, 18];
      const h = hs[0], s = hs[1];
      style += ";--x-line:hsl(" + h + " " + Math.round(s * .95) + "% 74% / .48)"
        + ";--x-fill:hsl(" + h + " " + Math.round(s * .7) + "% 30% / .30)"
        + ";--x-ink:hsl(" + h + " " + Math.round(s * .35) + "% 86% / .78)";
      html += '<div class="brick ext" data-i="' + i + '" style="' + style + '"><span>'
        + esc(it.node.name) + '<span class="xarea">'
        + esc(areaDisplay[it.node.area] || it.node.area) + "</span></span></div>";
    } else {
      html += '<div class="brick i' + it.imp + '" data-i="' + i + '" style="' + style + '">'
        + esc(it.node.name) + "</div>";
    }
  }

  /* svg geometry shares the same PAD_L offset as the bricks */
  let sv = "", duds = "";
  for (let i = 0; i < L.edges.length; i++) {
    const e = L.edges[i], st = EDGE_STYLE[e.rank];
    let d, pts = null;
    if (e.pts.side) {
      const rt = e.pts;
      d = sidePath({ a: [rt.a[0] + PAD_L, rt.a[1]], b: [rt.b[0] + PAD_L, rt.b[1]], dir: rt.dir });
    } else {
      pts = e.pts.pts.map(p => [p[0] + PAD_L, p[1]]);
      d = polyPath(pts, 8);
    }
    sv += '<path class="e ' + e.rank + '" data-e="' + i + '" d="' + d
      + '" fill="none" stroke-width="' + st.w + '" opacity="' + st.o + '"'
      + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + ' stroke-linecap="round"></path>';
    if (pts && e.hidden > 0 && e.rank !== "ex") {
      for (const p of alongPoly(pts, Math.min(MAX_DUDS, e.hidden))) {
        duds += '<rect class="dud" x="' + (p[0] - 6.5).toFixed(1) + '" y="' + (p[1] - 3.5).toFixed(1)
          + '" width="13" height="7" rx="1.5"></rect>';
      }
    }
  }
  let stubHtml = "";
  for (const s of L.stubs) {
    if (!s.seg) continue;
    const fade = [.5, .32, .18, .07];
    s.seg.forEach((g, k) => {
      stubHtml += '<line class="stub" x1="' + (g[0] + PAD_L).toFixed(1) + '" y1="' + g[1].toFixed(1)
        + '" x2="' + (g[2] + PAD_L).toFixed(1) + '" y2="' + g[3].toFixed(1)
        + '" stroke-width="1.6" opacity="' + fade[k] + '" stroke-linecap="round"></line>';
    });
  }

  pane.svg.setAttribute("width", width + PAD_L + PAD_R);
  pane.svg.setAttribute("height", L.height);
  pane.svg.innerHTML = sv + stubHtml + duds;
  for (const k of pane.stage.querySelectorAll(".brick,.band")) k.remove();
  pane.stage.insertAdjacentHTML("beforeend", html);
  pane.stage.style.height = L.height + "px";
  pane.el.scrollTop = 0;
}

let headerIdx = -1;
function setHeader(idx) {
  if (idx === headerIdx) return;
  headerIdx = idx;
  const area = order[idx];
  areaNameEl.textContent = areaDisplay[area] || area;
  applyScheme(document.documentElement, area);
}
function paintAll() {
  for (let s = 0; s < 3; s++) renderPane(panes[s], order[wrapIdx(curAreaIdx + s - 1)], curLevel);
  headerIdx = -1;
  setHeader(curAreaIdx);
  hideTip();
  updateFades();
  showHint();
}

/* --------------------------------------------------------------- carousel */

const CENTER = -100 / 3;
function setTrack(px, animate) {
  track.classList.toggle("anim", !!animate);
  track.style.transform = "translate3d(calc(" + CENTER + "% + " + px + "px),0,0)";
}

let sliding = false;
function goTo(idx, dir) {
  if (sliding) return;
  const step = dir || (idx > curAreaIdx ? 1 : -1);
  sliding = true;
  hideTip();
  curAreaIdx = wrapIdx(idx);
  setHeader(curAreaIdx);
  setTrack(-step * viewport.clientWidth, true);
  setTimeout(() => { setTrack(0, false); paintAll(); sliding = false; }, 300);
}

let ptrId = null, sx = 0, sy = 0, axis = null, dx = 0, lockX = false;
function onDown(e, forceX) {
  if (sliding || scrimEl.classList.contains("show")) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  ptrId = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0; axis = null; lockX = !!forceX;
}
function onMove(e) {
  if (e.pointerId !== ptrId || sliding) return;
  const ddx = e.clientX - sx, ddy = e.clientY - sy;
  if (axis === null) {
    if (lockX) { if (Math.abs(ddx) > 6) axis = "x"; }
    else if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy) * 1.25) axis = "x";
    else if (Math.abs(ddy) > 10) axis = "y";
  }
  if (axis !== "x") return;
  e.preventDefault();
  if (hintEl.classList.contains("show")) { clearTimeout(hintTimer); hintEl.classList.remove("show"); }
  hideTip();
  dx = ddx;
  setTrack(dx, false);
  const half = viewport.clientWidth * .45;
  setHeader(wrapIdx(curAreaIdx + (dx <= -half ? 1 : dx >= half ? -1 : 0)));
}
function onUp() {
  if (ptrId === null) return;
  ptrId = null;
  if (axis !== "x") { axis = null; return; }
  axis = null;
  const threshold = Math.min(70, viewport.clientWidth * .2);
  if (dx <= -threshold) goTo(curAreaIdx + 1, 1);
  else if (dx >= threshold) goTo(curAreaIdx - 1, -1);
  else { setHeader(curAreaIdx); setTrack(0, true); }
  dx = 0;
}
track.addEventListener("pointerdown", e => onDown(e, false), { passive: true });
track.addEventListener("pointermove", onMove, { passive: false });
track.addEventListener("pointerup", onUp, { passive: true });
track.addEventListener("pointercancel", onUp, { passive: true });
areabar.addEventListener("pointerdown", e => { if (!e.target.closest(".chev")) onDown(e, true); }, { passive: true });
areabar.addEventListener("pointermove", onMove, { passive: false });
areabar.addEventListener("pointerup", onUp, { passive: true });
areabar.addEventListener("pointercancel", onUp, { passive: true });

document.getElementById("prevArea").addEventListener("click", () => goTo(curAreaIdx - 1, -1));
document.getElementById("nextArea").addEventListener("click", () => goTo(curAreaIdx + 1, 1));

window.addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Escape" && scrimEl.classList.contains("show")) { closeSheet(); return; }
  if (scrimEl.classList.contains("show")) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); goTo(curAreaIdx - 1, -1); }
  else if (e.key === "ArrowRight") { e.preventDefault(); goTo(curAreaIdx + 1, 1); }
});

/* ------------------------------------------------------------- time flip */

function setFlip(on) {
  curFlip = !!on;
  flipBtn.classList.toggle("down", curFlip);
  flipBtn.setAttribute("aria-label", curFlip ? "Show newest first" : "Show oldest first");
  hintText.textContent = curFlip ? "scroll down for the future" : "scroll down for the past";
  paintAll();
}
flipBtn.addEventListener("click", () => setFlip(!curFlip));

/* -------------------------------------------------------------- drilldown */

const LOCK_SVG = '<svg class="dlock" viewBox="0 0 8 9" fill="none">'
  + '<rect x="0.6" y="3.8" width="6.8" height="4.6" rx="1.1" fill="#f2c94c"/>'
  + '<path d="M2.3 3.8V2.6a1.7 1.7 0 013.4 0v1.2" stroke="#f2c94c" stroke-width="1.05" fill="none"/></svg>';

const dlevels = document.getElementById("dlevels");
(function buildDrill() {
  let html = '<div class="drail"></div>';
  for (const lv of [5, 4, 3, 2, 1]) {
    const prem = lv <= 2;
    html += '<button class="dstep' + (prem ? " premium" : "") + '" data-lv="' + lv + '">'
      + '<span class="dnum">' + lv + '</span><span class="dblip"></span>'
      + (prem ? LOCK_SVG : "") + '<span class="dhit"></span></button>';
  }
  dlevels.innerHTML = html;
  dlevels.addEventListener("click", e => {
    const b = e.target.closest(".dstep");
    if (!b) return;
    const lv = +b.dataset.lv;
    setLevel(lv);
    if (lv <= 2) showTipAt(b, "Premium Feature", true, 1900);
  });
})();
function setLevel(lv) {
  curLevel = lv;
  for (const b of dlevels.querySelectorAll(".dstep")) b.classList.toggle("on", +b.dataset.lv === lv);
  paintAll();
}

/* ------------------------------------------------------- focus on lineage */

function lineageOf(L, item) {
  const inSet = new Set([item]), edgeSet = new Set();
  const up = new Map(), down = new Map();
  L.edges.forEach((e, i) => {
    if (!up.has(e.from)) up.set(e.from, []);
    if (!down.has(e.to)) down.set(e.to, []);
    up.get(e.from).push([e, i]);
    down.get(e.to).push([e, i]);
  });
  const spine = r => r === "p1" || r === "ex";
  const walk = (start, map, pick) => {
    const stack = [start], seen = new Set([start]);
    while (stack.length) {
      const cur = stack.pop();
      for (const pair of (map.get(cur) || [])) {
        if (!spine(pair[0].rank)) continue;
        edgeSet.add(pair[1]);
        const nxt = pick(pair[0]);
        inSet.add(nxt);
        if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
      }
    }
  };
  walk(item, up, e => e.to);
  walk(item, down, e => e.from);
  for (const pair of (up.get(item) || [])) { edgeSet.add(pair[1]); inSet.add(pair[0].to); }
  for (const pair of (down.get(item) || [])) { edgeSet.add(pair[1]); inSet.add(pair[0].from); }
  return { inSet, edgeSet };
}

function focusItem(pane, item, el) {
  const L = pane.layout;
  const lin = lineageOf(L, item);
  pane.focused = item; pane.selEl = el;
  for (const b of pane.stage.querySelectorAll(".brick")) {
    const i = b.dataset.i;
    const it = i === undefined ? null : L.items[+i];
    b.classList.toggle("rel", !!it && lin.inSet.has(it));
    b.classList.toggle("sel", b === el);
  }
  for (const p of pane.svg.querySelectorAll(".e")) p.classList.toggle("rel", lin.edgeSet.has(+p.dataset.e));
  const before = pane.el.scrollTop;
  pane.stage.style.transformOrigin = "50% 0";
  pane.stage.style.transform = "scale(" + ZOOM + ")";
  pane.stage.style.height = (L.height * ZOOM) + "px";
  pane.el.classList.add("focus");
  pane.el.scrollTop = Math.max(0, item.cy * ZOOM - item.cy + before);
  trackTip(pane);
}
function unfocus(pane) {
  if (!pane.focused) return;
  const L = pane.layout, item = pane.focused, before = pane.el.scrollTop;
  pane.focused = null; pane.selEl = null;
  pane.el.classList.remove("focus");
  pane.stage.style.transform = "";
  pane.stage.style.height = L.height + "px";
  pane.el.scrollTop = Math.max(0, before + item.cy - item.cy * ZOOM);
  for (const b of pane.stage.querySelectorAll(".brick")) b.classList.remove("rel", "sel");
  for (const p of pane.svg.querySelectorAll(".e")) p.classList.remove("rel");
  hideTip();
}

for (const pane of panes) {
  pane.stage.addEventListener("click", e => {
    if (axis === "x" || sliding || pane !== active()) return;
    const b = e.target.closest(".brick[data-i]");
    if (!b) { unfocus(pane); return; }
    const it = pane.layout.items[+b.dataset.i];
    if (pane.focused === it) { unfocus(pane); return; }
    focusItem(pane, it, b);
  });
  pane.el.addEventListener("scroll", () => {
    if (pane !== active()) return;
    updateFades();
    if (pane.el.scrollTop > 12 && hintEl.classList.contains("show")) {
      clearTimeout(hintTimer); hintEl.classList.remove("show");
    }
    if (pane.focused) positionTip(pane);
  }, { passive: true });
}

/* ---------------------------------------------------------------- tooltip */

let tipTimer = null, tipRaf = 0;
function hideTip() {
  tipEl.classList.remove("show", "premium");
  cancelAnimationFrame(tipRaf); tipRaf = 0;
}
function showTipAt(el, text, premium, autohide) {
  const r = el.getBoundingClientRect();
  tipEl.textContent = text;
  tipEl.classList.toggle("premium", !!premium);
  tipEl.style.left = (r.left + r.width / 2) + "px";
  tipEl.style.top = (r.top - 8) + "px";
  tipEl.dataset.action = premium ? "" : "info";
  tipEl.classList.add("show");
  clearTimeout(tipTimer);
  if (autohide) tipTimer = setTimeout(hideTip, autohide);
}
function positionTip(pane) {
  if (!pane.selEl) return;
  const r = pane.selEl.getBoundingClientRect();
  const vp = viewport.getBoundingClientRect();
  tipEl.style.left = (r.left + r.width / 2) + "px";
  tipEl.style.top = Math.max(vp.top + 18, r.top - 8) + "px";
}
function trackTip(pane) {
  tipEl.textContent = "More info";
  tipEl.classList.remove("premium");
  tipEl.dataset.action = "info";
  positionTip(pane);
  tipEl.classList.add("show");
  clearTimeout(tipTimer);
  const t0 = performance.now();
  cancelAnimationFrame(tipRaf);
  const step = () => { positionTip(pane); if (performance.now() - t0 < 420) tipRaf = requestAnimationFrame(step); };
  tipRaf = requestAnimationFrame(step);
}
tipEl.addEventListener("click", () => {
  const pane = active();
  if (tipEl.dataset.action !== "info" || !pane.focused) return;
  openSheet(pane.focused.node);
});

/* --------------------------------------------------------------- overlay */

const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
  "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.",
];
function openSheet(n) {
  document.getElementById("sheetName").textContent = n.name;
  const raw = n.dec || "";
  let meta = raw ? '<span class="chip">' + esc(DECADE_LABEL[raw] || raw) + "</span>" : "";
  const flags = flagAssets(n.country);
  if (flags.length) {
    meta += '<span class="chip">' + flags.map(f =>
      '<img src="' + f[0] + '" alt="' + esc(f[1]) + '" title="' + esc(f[1]) + '">').join("") + "</span>";
  }
  meta += '<span class="chip">' + esc(areaDisplay[n.area] || n.area) + "</span>";
  document.getElementById("sheetMeta").innerHTML = meta;
  document.getElementById("sheetDesc").textContent = LOREM[hash32(n.tech) % LOREM.length];
  scrimEl.classList.add("show");
  hideTip();
}
function closeSheet() {
  scrimEl.classList.remove("show");
  const pane = active();
  if (pane.focused) trackTip(pane);
}
document.getElementById("sheetClose").addEventListener("click", closeSheet);
scrimEl.addEventListener("click", e => { if (e.target === scrimEl) closeSheet(); });

/* ----------------------------------------------------- fades + scroll hint */

function updateFades() {
  const el = active().el;
  const max = el.scrollHeight - el.clientHeight;
  fadeTop.style.opacity = el.scrollTop > 8 ? "1" : "0";
  fadeBottom.style.opacity = max - el.scrollTop > 8 ? "1" : "0";
}
function showHint() {
  clearTimeout(hintTimer);
  hintEl.classList.remove("show");
  hintTimer = setTimeout(() => {
    const el = active().el;
    if (el.scrollHeight - el.clientHeight < 60) return;
    hintEl.classList.add("show");
    hintTimer = setTimeout(() => hintEl.classList.remove("show"), 2600);
  }, 320);
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(paintAll, 180);
});

/* ------------------------------------------------------------------- boot */

for (const b of dlevels.querySelectorAll(".dstep")) b.classList.toggle("on", +b.dataset.lv === curLevel);
hintText.textContent = "scroll down for the past";
setTrack(0, false);
paintAll();
const loading = document.getElementById("loading");
requestAnimationFrame(() => requestAnimationFrame(() => {
  loading.classList.add("done");
  setTimeout(() => loading.remove(), 450);
}));

window.__genreMap = {
  get pane() { return active(); },
  get layout() { return active().layout; },
  get order() { return order; },
  get level() { return curLevel; },
  get flip() { return curFlip; },
  get areaIdx() { return curAreaIdx; },
  setLevel, setFlip, goTo, focusItem, unfocus, openSheet, lineageOf, scheme, PAD_L,
  setArea(i) { curAreaIdx = wrapIdx(i); paintAll(); },
};
}));
