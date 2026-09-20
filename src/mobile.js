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
const DECADE_LABEL = {};          // decades print in full
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
function hueOf(area) { return AREA_HUE[area] || [215, 18]; }
function schemeAt(h, s) {
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
function scheme(area) { const a = hueOf(area); return schemeAt(a[0], a[1]); }
/* Custom properties don't interpolate on their own, so the palette is blended
   numerically and written every frame — that is what keeps a swipe smooth
   instead of snapping from one area's colour to the next. */
function schemeMix(areaA, areaB, t) {
  if (t <= 0) return scheme(areaA);
  if (t >= 1) return scheme(areaB);
  const A = hueOf(areaA), B = hueOf(areaB);
  const dh = ((B[0] - A[0]) % 360 + 540) % 360 - 180;   // shortest way round
  return schemeAt(A[0] + dh * t, A[1] + (B[1] - A[1]) * t);
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
const fontFor = (imp, k) => '600 ' + (IMP_FONT[imp] * k) + 'px "Inter",-apple-system,'
  + 'BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';

/* A wide screen gets bigger bricks, and the diagram keeps a readable column
   width instead of stretching every decade into one flat line. */
const WIDE_AT = 660, MAX_CONTENT = 600;
function metricsFor(paneW) {
  const wide = paneW >= WIDE_AT;
  const scale = wide ? 1.22 : 1;
  const avail = Math.max(200, paneW - PAD_L - PAD_R);
  const contentW = wide ? Math.min(avail, MAX_CONTENT) : avail;
  return { scale, contentW, stageW: contentW + PAD_L + PAD_R };
}

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
function measure(text, imp, k) {
  const key = imp + "|" + k + "|" + text;
  if (measureCache[key]) return measureCache[key];
  const f = IMP_FONT[imp] * k;
  const maxW = (100 + imp * 10) * k, minW = (46 + imp * 7) * k;
  const padX = (9 + imp) * k, padY = 11 * k;
  const hFor = n => Math.round(n * f * 1.2 + padY);
  MEAS.font = fontFor(imp, k);
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

const GAP_X = 22, ROW_GAP = 38;
const BAND_TOP = 34, BAND_BOTTOM = 24;
const EXT_H = 34;
const CLEAR = 4;          // keep-out margin around a brick for routed lines
const LANE = 4;           // minimum distance between two parallel connectors
const HOP = 3.4;          // radius of the little jump drawn over a crossing
const STUB_LEN = 26;      // length of the "there is more here" stub
const MAX_DUDS = 3;

/* 1-D placement inside one row: keep the given order and the minimum gaps,
   but slide each brick as close to its wanted centre as the slack allows. */
function placeRow(items, width, inset) {
  const n = items.length;
  const lo = new Float64Array(n), hi = new Float64Array(n);
  let acc = inset || 0;
  for (let i = 0; i < n; i++) { lo[i] = acc; acc += items[i].w + GAP_X; }
  acc = width - (inset || 0);
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

function packLayer(items, width, inset) {
  const usable = width - 2 * (inset || 0);
  const rowsOut = [];
  let cur = [], curW = 0;
  for (const it of items) {
    if (cur.length && curW + GAP_X + it.w > usable) { rowsOut.push(cur); cur = []; curW = 0; }
    curW += cur.length ? GAP_X + it.w : it.w;
    cur.push(it);
  }
  if (cur.length) rowsOut.push(cur);
  for (const r of rowsOut) placeRow(r, width, inset);
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

function buildLayout(area, level, width, flip, blobs, uiK) {
  const key = area + "|" + level + "|" + width + "|" + (flip ? 1 : 0) + "|" + (blobs ? 1 : 0)
    + "|" + uiK;
  if (layoutCache[key]) return layoutCache[key];

  const all = nodesByArea[area] || [];
  const vis = all.filter(n => n.imp >= level);
  const visible = new Set(vis.map(n => n.tech));

  /* --- Secondary Areas: order them, then give each one a target band of the
     width so its genres gather into a column a blob can be drawn around. --- */
  const secIdx = new Map(), secTarget = new Map();
  let secInset = 0;
  if (blobs) {
    const counts = new Map();
    for (const n of vis) if (n.sec) counts.set(n.sec, (counts.get(n.sec) || 0) + 1);
    const keys = Array.from(counts.keys());
    const ki = new Map(); keys.forEach((k, i) => ki.set(k, i));
    const wt = keys.map(() => new Float64Array(keys.length));
    for (const n of vis) {
      if (!n.sec || !ki.has(n.sec)) continue;
      for (const t of [n.p1, n.p2, n.p3]) {
        const q = t && byTech[t];
        if (!q || q.area !== area || !q.sec || q.sec === n.sec || !ki.has(q.sec)) continue;
        wt[ki.get(n.sec)][ki.get(q.sec)] += 1;
        wt[ki.get(q.sec)][ki.get(n.sec)] += 1;
      }
    }
    const used = new Array(keys.length).fill(false);
    let start = 0, bw = -1;
    for (let i = 0; i < keys.length; i++) {
      const c = counts.get(keys[i]);
      if (c > bw) { bw = c; start = i; }
    }
    const chain = [];
    if (keys.length) { chain.push(start); used[start] = true; }
    while (chain.length < keys.length) {
      const tail = chain[chain.length - 1];
      let pick = -1, pw = -1;
      for (let j = 0; j < keys.length; j++) {
        if (used[j]) continue;
        const w = wt[tail][j] + 1e-6 * counts.get(keys[j]);
        if (w > pw) { pw = w; pick = j; }
      }
      chain.push(pick); used[pick] = true;
    }
    let total = 0; for (const k of keys) total += counts.get(k);
    let acc = 0;
    /* keep clear lanes down both edges so a bubble that has nothing in a row
       can still slip past without touching anybody else */
    /* wide enough for one tail per side with two sub-groups, two per side
       beyond that — anything narrower and a tail would graze a brick */
    secInset = keys.length <= 1 ? 0 : keys.length === 2 ? 28 : 40;
    const inner = width - 2 * secInset;
    chain.forEach((j, i) => {
      const k = keys[j], share = counts.get(k) / (total || 1);
      secIdx.set(k, i);
      secTarget.set(k, secInset + inner * (acc + share / 2));
      acc += share;
    });
  }

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
    const m = measure(n.name, imp, uiK);
    itemFor[n.tech] = { kind: "node", node: n, tech: n.tech, imp, di: n.di,
      sec: n.sec || "", si: secIdx.has(n.sec) ? secIdx.get(n.sec) : 9999,
      w: m.w, h: m.h, x: 0, y: 0, want: 0 };
    items.push(itemFor[n.tech]);
  }

  /* External parents: a translucent oval tinted with their own Area's colour */
  const extItems = Object.create(null);
  for (const n of vis) {
    if (!n.extParent || !n.p1) continue;
    const p = byTech[n.p1];
    if (!p || p.area === area || extItems[p.tech]) continue;
    const imp = Math.max(2, impOf(p.imp) - 1);
    const m = measure(p.name, imp, uiK);
    extItems[p.tech] = {
      kind: "ext", node: p, tech: "ext:" + p.tech, imp, di: p.di,
      sec: "", si: 9999, w: Math.max(84 * uiK, m.w + 20 * uiK), h: Math.round(EXT_H * uiK),
      x: 0, y: 0, want: 0,
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
  if (blobs) {
    for (const it of items) {
      if (it.kind !== "ext") continue;
      let best = 9999;
      for (const c of it.down) if (c.si < best) best = c.si;
      it.si = best;
    }
  }

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
      const rowsOut = packLayer(layers.get(di), width, secInset);
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
        let w;
        if (refs.length) {
          let s = 0; for (const o of refs) s += o.x + o.w / 2;
          w = s / refs.length;
        } else w = it.x + it.w / 2;
        if (blobs && secTarget.has(it.sec)) w = w * 0.22 + secTarget.get(it.sec) * 0.78;
        it.want = w;
      }
      layer.sort((a, b) => (blobs ? a.si - b.si : 0)
        || (flip ? a.rank - b.rank : b.rank - a.rank)
        || a.want - b.want || a.w - b.w);
      packLayer(layer, width, secInset);
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
    const rowsOut = packLayer(layer, width, secInset);
    const bandTop = y;
    let ry = y + BAND_TOP;
    for (const r of rowsOut) {
      let rh = 0; for (const it of r) if (it.h > rh) rh = it.h;
      const rowIdx = rows.length;
      let yTop = Infinity, yBot = -Infinity;
      for (const it of r) {
        it.y = ry + (rh - it.h) / 2;
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

  /* Vertical lanes: every row is sliced into discrete channels, LANE apart, in
     the gaps between its bricks. A connector crossing a row books one lane, so
     two connectors can never run closer than LANE to each other. */
  for (const r of rows) {
    const blocked = r.items.map(it => [it.x - CLEAR, it.x + it.w + CLEAR])
      .sort((a, b) => a[0] - b[0]);
    const gaps = [];
    let cursor = 1;
    for (const b of blocked) {
      if (b[0] > cursor) gaps.push([cursor, b[0]]);
      if (b[1] > cursor) cursor = b[1];
    }
    if (cursor < width - 1) gaps.push([cursor, width - 1]);
    r.blocked = blocked;
  }

  /* One global column grid, LANE apart, spanning the whole diagram. A long
     vertical run books a column over its whole length, so no two runs can end
     up in the same column — not even in neighbouring rows. */
  const cols = [];
  for (let x = 2; x <= width - 2; x += LANE) cols.push(x);
  const colOcc = cols.map(() => []);
  for (const r of rows) {
    r.gaps = [];
    let cur = 1;
    for (const bk of r.blocked) {
      if (bk[0] > cur) r.gaps.push([cur, bk[0]]);
      if (bk[1] > cur) cur = bk[1];
    }
    if (cur < width - 1) r.gaps.push([cur, width - 1]);
    r.colFree = new Uint8Array(cols.length);
    for (let i = 0; i < cols.length; i++) {
      let free = 1;
      for (const b of r.blocked) if (cols[i] > b[0] && cols[i] < b[1]) { free = 0; break; }
      r.colFree[i] = free;
    }
  }

  /* Horizontal lanes: the gap between two consecutive rows is sliced the same
     way. A sideways run books the first lane whose span is still free. */
  const corridors = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const lo = rows[i].yBot + 3, hi = rows[i + 1].yTop - 3;
    const ys = [];
    if (hi > lo) for (let y = lo; y <= hi; y += LANE) ys.push(y);
    if (!ys.length) ys.push((rows[i].yBot + rows[i + 1].yTop) / 2);
    corridors.push({ ys: ys, occ: ys.map(() => []) });
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

  /* ---- route every connector through the lanes ---- */
  const RANK_ORDER = { p1: 0, ex: 1, p2: 2, p3: 3 };
  const routeOrder = edges.slice().sort((a, b) =>
    RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
    || Math.abs(a.from.row - a.to.row) - Math.abs(b.from.row - b.to.row));
  for (const e of routeOrder) e.pts = routeEdge(e, rows, corridors, cols, colOcc);
  for (const s of stubs) s.seg = stubSegments(s.item, rows, flip);
  markCrossings(edges);

  /* --- one soft outline per Secondary Area ------------------------------
     Bubbles must never touch, so real extents are reserved first and the
     necks that bridge skipped rows are then threaded through what is left. */
  const blobList = [];
  if (blobs) {
    const BP = 7, SEP = 5;                     // outline padding, clear space
    const groups = new Map();
    for (const it of items) {
      if (it.kind !== "node" || !it.sec) continue;
      if (!groups.has(it.sec)) groups.set(it.sec, []);
      groups.get(it.sec).push(it);
    }
    const ext = new Map(), secs = [];
    for (const entry of groups) {
      const sec = entry[0], list = entry[1];
      if (list.length < 2) continue;
      const byRow = new Map();
      for (const it of list) {
        let r = byRow.get(it.row);
        if (!r) { r = { x1: Infinity, x2: -Infinity, yTop: Infinity, yBot: -Infinity }; byRow.set(it.row, r); }
        r.x1 = Math.min(r.x1, it.x); r.x2 = Math.max(r.x2, it.x + it.w);
        r.yTop = Math.min(r.yTop, it.y); r.yBot = Math.max(r.yBot, it.y + it.h);
      }
      ext.set(sec, byRow); secs.push(sec);
    }
    const reserved = new Map();
    const reserve = (r, a2, b2, sec) => {
      if (!reserved.has(r)) reserved.set(r, []);
      reserved.get(r).push([a2, b2, sec]);
    };
    for (const sec of secs) {
      for (const kv of ext.get(sec)) reserve(kv[0], kv[1].x1 - BP - SEP, kv[1].x2 + BP + SEP, sec);
    }
    /* longest-running sub-groups choose their necks first */
    secs.sort((a2, b2) => ext.get(b2).size - ext.get(a2).size);
    for (const sec of secs) {
      const byRow = ext.get(sec), list = groups.get(sec);
      const used = Array.from(byRow.keys()).sort((a2, b2) => a2 - b2);
      const spans = [];
      for (let r = used[0]; r <= used[used.length - 1]; r++) {
        const got = byRow.get(r);
        if (got) { spans.push(got); continue; }
        let prev = null, next = null;
        for (let q = r - 1; q >= used[0]; q--) if (byRow.get(q)) { prev = byRow.get(q); break; }
        for (let q = r + 1; q <= used[used.length - 1]; q++) if (byRow.get(q)) { next = byRow.get(q); break; }
        const pc = prev ? (prev.x1 + prev.x2) / 2 : null;
        const nc = next ? (next.x1 + next.x2) / 2 : null;
        const target = pc === null ? nc : nc === null ? pc : (pc + nc) / 2;

        /* the reserved side lanes, nearest to where the bubble wants to be */
        const NH = 3, NP = 3, NSEP = 3;         // neck half-width, padding, clearance
        const slots = [];
        if (secInset >= 36) slots.push(8, 20, width - 20, width - 8);
        else if (secInset >= 20) slots.push(8, width - 8);
        const taken = reserved.get(r) || [];
        const clashes = (a2, b2) => {
          for (const iv of taken) if (iv[2] !== sec && a2 < iv[1] && b2 > iv[0]) return true;
          return false;
        };

        /* gaps between bricks, minus every other bubble's reserved space */
        let cands = rows[r].gaps.map(g => [g[0], g[1]]);
        for (const iv of (reserved.get(r) || [])) {
          if (iv[2] === sec) continue;
          const out2 = [];
          for (const c of cands) {
            if (iv[1] <= c[0] || iv[0] >= c[1]) { out2.push(c); continue; }
            if (iv[0] > c[0]) out2.push([c[0], iv[0]]);
            if (iv[1] < c[1]) out2.push([iv[1], c[1]]);
          }
          cands = out2;
        }
        /* first choice: a gap between bricks wide enough and nobody else's */
        const need = 2 * (NH + NP + NSEP);
        let cx = null, pd = Infinity;
        for (const c of cands) {
          if (c[1] - c[0] < need) continue;
          const lo2 = c[0] + NH + NP + NSEP, hi2 = c[1] - NH - NP - NSEP;
          const cc = Math.min(Math.max(target, lo2), hi2);
          const d = Math.abs(cc - target);
          if (d < pd && !clashes(cc - NH - NP - NSEP, cc + NH + NP + NSEP)) { pd = d; cx = cc; }
        }
        /* otherwise slip down one of the reserved side lanes */
        if (cx === null) {
          let sd = Infinity;
          for (const sx of slots) {
            if (clashes(sx - NH - NP - NSEP, sx + NH + NP + NSEP)) continue;
            const d = Math.abs(sx - target);
            if (d < sd) { sd = d; cx = sx; }
          }
        }
        if (cx === null) {                       // give up gracefully at the edge
          cx = slots.length ? (target < width / 2 ? slots[0] : slots[slots.length - 1])
            : (target < width / 2 ? NH + NP + 2 : width - NH - NP - 2);
        }
        spans.push({ x1: cx - NH, x2: cx + NH, yTop: rows[r].yTop, yBot: rows[r].yBot, neck: true });
        reserve(r, cx - NH - NP - NSEP, cx + NH + NP + NSEP, sec);
      }
      blobList.push({ sec, label: secondaryLabel(sec), spans, n: list.length,
        si: secIdx.has(sec) ? secIdx.get(sec) : 0, secN: secs.length });
    }
    blobList.sort((a2, b2) => b2.n - a2.n);
  }

  const out = { area, level, flip, blobs: !!blobs, uiK, width, items, edges, stubs, rows, bands,
    blobList, height: y + 64, itemFor, crossings: bestScore };
  layoutCache[key] = out;
  return out;
}

/* ------------------------------------------------------- connector router */

/* Book a horizontal lane whose span [x1,x2] is still clear in this corridor. */
function takeCorrLane(c, x1, x2, want) {
  const a = Math.min(x1, x2) - LANE, b = Math.max(x1, x2) + LANE;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < c.ys.length; i++) {
    let clash = false;
    for (const iv of c.occ[i]) if (a < iv[1] && b > iv[0]) { clash = true; break; }
    if (clash) continue;
    const d = Math.abs(c.ys[i] - want);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best < 0) {
    let m = Infinity;
    for (let i = 0; i < c.ys.length; i++) {
      let n = 0;
      for (const iv of c.occ[i]) if (a < iv[1] && b > iv[0]) n++;
      const d = n * 10000 + Math.abs(c.ys[i] - want);
      if (d < m) { m = d; best = i; }
    }
  }
  c.occ[best].push([a, b]);
  return c.ys[best];
}

/* Middle of a corridor, used as the hint when booking a lane in it. */
function corrMid(c) { return (c.ys[0] + c.ys[c.ys.length - 1]) / 2; }

/* Child first, parent second. The run drops out of the child and then travels
   down a chain of booked columns: at each step it takes the column that stays
   brick-free for the most rows, sits nearest the current one, and is not
   already carrying another run over the same stretch of y. Every sideways jog
   books a lane in the corridor it happens in, for exactly the span it covers.
   So nothing passes under a brick and no two runs land in the same channel. */
function routeEdge(e, rows, corridors, cols, colOcc) {
  const from = e.from, to = e.to;
  const ci = from.row, pi = to.row;
  if (ci === pi) {
    const d = from.cx < to.cx ? 1 : -1;
    return { side: true, a: [d > 0 ? from.x + from.w : from.x, from.cy],
      b: [d > 0 ? to.x : to.x + to.w, to.cy], dir: d };
  }
  const dir = pi > ci ? 1 : -1;
  const yA = dir > 0 ? from.y + from.h : from.y;
  const yB = dir > 0 ? to.y : to.y + to.h;
  const corrOf = (a, b) => corridors[Math.min(a, b)];
  const n = cols.length;

  const pts = [[e.ax, yA]];
  let k = ci, x = e.ax, prevCol = -1, prevY = 0, guard = 0;

  const bookLeg = cy => {
    if (prevCol >= 0) {
      colOcc[prevCol].push([Math.min(prevY, cy) - LANE, Math.max(prevY, cy) + LANE]);
    }
  };

  while (k + dir !== pi && guard++ < 64) {
    /* how far each column stays clear from here, and whether it is already busy */
    let best = -1, bestScore = -Infinity, bestLast = k + dir;
    for (let i = 0; i < n; i++) {
      let last = k, run = 0;
      for (let r = k + dir; r !== pi; r += dir) {
        if (!rows[r].colFree[i]) break;
        last = r; run++;
      }
      if (!run) continue;
      /* a deliberately generous estimate of the stretch this leg would cover,
         so a column already in use is never mistaken for a free one */
      const lo = Math.min(rows[k].yTop, rows[last].yTop) - LANE;
      const hi = Math.max(rows[k].yBot, rows[last].yBot) + LANE;
      let busy = 0;
      for (const iv of colOcc[i]) if (lo < iv[1] && hi > iv[0]) busy++;
      const score = -busy * 100000 + Math.min(run, 6) * 40 - Math.abs(cols[i] - x);
      if (score > bestScore) { bestScore = score; best = i; bestLast = last; }
    }
    if (best < 0) break;

    const c = corrOf(k, k + dir);
    if (!c) break;
    const nx = cols[best];
    const cy = takeCorrLane(c, x, nx, corrMid(c));
    pts.push([x, cy]);
    if (Math.abs(nx - x) > 0.5) pts.push([nx, cy]);
    bookLeg(cy);
    prevCol = best; prevY = cy;
    x = nx; k = bestLast;
  }

  const cEnd = corrOf(k, k + dir);
  if (cEnd) {
    const cy = takeCorrLane(cEnd, x, e.bx, corrMid(cEnd));
    pts.push([x, cy]);
    bookLeg(cy);
    if (Math.abs(e.bx - x) > 0.5) pts.push([e.bx, cy]);
  }
  pts.push([e.bx, yB]);

  /* drop repeated and collinear points so the path has no zero-length pieces */
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (Math.abs(p[0] - q[0]) < 0.4 && Math.abs(p[1] - q[1]) < 0.4) continue;
    if (out.length >= 2) {
      const r = out[out.length - 2];
      const sameV = Math.abs(r[0] - q[0]) < 0.4 && Math.abs(q[0] - p[0]) < 0.4;
      const sameH = Math.abs(r[1] - q[1]) < 0.4 && Math.abs(q[1] - p[1]) < 0.4;
      if (sameV || sameH) { out[out.length - 1] = p; continue; }
    }
    out.push(p);
  }
  return { pts: out };
}

/* Where a sideways run passes over another connector's vertical run, mark the
   spot so the path can be drawn with a little jump instead of a plain cross. */
function markCrossings(edges) {
  const H = [], V = [];
  edges.forEach((e, ei) => {
    e.hops = null;
    if (e.pts.side) return;
    const p = e.pts.pts;
    for (let i = 0; i + 1 < p.length; i++) {
      const a = p[i], b = p[i + 1];
      if (Math.abs(a[1] - b[1]) < 0.01 && Math.abs(a[0] - b[0]) > 0.01) {
        H.push({ ei: ei, si: i, y: a[1], x1: Math.min(a[0], b[0]), x2: Math.max(a[0], b[0]) });
      } else if (Math.abs(a[0] - b[0]) < 0.01) {
        V.push({ ei: ei, x: a[0], y1: Math.min(a[1], b[1]), y2: Math.max(a[1], b[1]) });
      }
    }
  });
  const END = HOP + 6;
  for (const h of H) {
    const xs = [];
    for (const v of V) {
      if (v.ei === h.ei) continue;
      if (v.x < h.x1 + END || v.x > h.x2 - END) continue;
      if (h.y < v.y1 + 1 || h.y > v.y2 - 1) continue;
      xs.push(v.x);
    }
    if (!xs.length) continue;
    xs.sort((a, b) => a - b);
    const keep = [];
    for (const x of xs) if (!keep.length || x - keep[keep.length - 1] > 2 * HOP + 1.5) keep.push(x);
    const e = edges[h.ei];
    if (!e.hops) e.hops = {};
    e.hops[h.si] = keep;
  }
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
const swipeHintEl = document.getElementById("swipeHint");
const blobBtn = document.getElementById("blobBtn");
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
let curBlobs = false;
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

/* Rounded-corner polyline. Where `hops` marks a crossing, the run lifts over
   the other connector in a half circle so the two read as not joined. */
const F = v => v.toFixed(1);
function polyPath(pts, r, hops) {
  const n = pts.length;
  if (n < 2) return "";
  const len = i => Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  const rr = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) rr[i] = Math.min(r, len(i - 1) / 2, len(i) / 2);

  let d = "M" + F(pts[0][0]) + " " + F(pts[0][1]);
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1], L = len(i) || 1;
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    const hs = hops && hops[i];
    if (hs && Math.abs(uy) < 0.01) {
      const startX = a[0] + ux * rr[i], endX = b[0] - ux * rr[i + 1];
      const lo = Math.min(startX, endX) + HOP + 1, hi = Math.max(startX, endX) - HOP - 1;
      const seq = hs.filter(x => x >= lo && x <= hi).sort((p, q) => (ux > 0 ? p - q : q - p));
      for (const hx of seq) {
        d += "L" + F(hx - ux * HOP) + " " + F(a[1])
          + "A" + HOP + " " + HOP + " 0 0 " + (ux > 0 ? 1 : 0)
          + " " + F(hx + ux * HOP) + " " + F(a[1]);
      }
    }
    d += "L" + F(b[0] - ux * rr[i + 1]) + " " + F(b[1] - uy * rr[i + 1]);
    if (i + 1 < n - 1 && rr[i + 1] > 0.5) {
      const c = pts[i + 2], L2 = len(i + 1) || 1;
      d += "Q" + F(b[0]) + " " + F(b[1]) + " "
        + F(b[0] + (c[0] - b[0]) / L2 * rr[i + 1]) + " "
        + F(b[1] + (c[1] - b[1]) / L2 * rr[i + 1]);
    }
  }
  return d;
}
/* A closed, corner-rounded outline: down the left extents, back up the right. */
function blobPath(spans, padX, padNeck, padY, padTop, padBot, r) {
  const n = spans.length;
  const top = [], bot = [], px = [];
  for (let i = 0; i < n; i++) {
    px[i] = spans[i].neck ? padNeck : padX;
    top[i] = i === 0 ? spans[0].yTop - padTop : (spans[i - 1].yBot + spans[i].yTop) / 2;
    bot[i] = i === n - 1 ? spans[n - 1].yBot + padBot : (spans[i].yBot + spans[i + 1].yTop) / 2;
  }
  const pts = [];
  for (let i = 0; i < n; i++) { pts.push([spans[i].x1 - px[i], top[i]], [spans[i].x1 - px[i], bot[i]]); }
  for (let i = n - 1; i >= 0; i--) { pts.push([spans[i].x2 + px[i], bot[i]], [spans[i].x2 + px[i], top[i]]); }
  const p = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const q = p[p.length - 1];
    if (Math.abs(pts[i][0] - q[0]) > 0.4 || Math.abs(pts[i][1] - q[1]) > 0.4) p.push(pts[i]);
  }
  const m = p.length;
  if (m < 3) return "";
  let d = "";
  for (let i = 0; i < m; i++) {
    const a = p[(i - 1 + m) % m], c = p[i], b = p[(i + 1) % m];
    const d1 = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const d2 = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const inX = c[0] - (c[0] - a[0]) / d1 * rr, inY = c[1] - (c[1] - a[1]) / d1 * rr;
    const outX = c[0] + (b[0] - c[0]) / d2 * rr, outY = c[1] + (b[1] - c[1]) / d2 * rr;
    d += (i === 0 ? "M" + F(inX) + " " + F(inY) : "L" + F(inX) + " " + F(inY));
    d += "Q" + F(c[0]) + " " + F(c[1]) + " " + F(outX) + " " + F(outY);
  }
  return d + "Z";
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

function renderPane(pane, area, level, keepScroll) {
  cancelAnimationFrame(zoomRaf);
  pane.area = area;
  pane.focused = null; pane.selEl = null;
  pane.stage.style.transition = "";
  applyScheme(pane.el, area);
  pane.el.classList.remove("focus");
  pane.stage.style.transform = "";

  const mx = metricsFor(pane.el.clientWidth);
  const width = mx.contentW;
  pane.el.style.setProperty("--fs", String(mx.scale));
  pane.stage.style.width = mx.stageW + "px";
  const L = buildLayout(area, level, width, curFlip, curBlobs, mx.scale);
  pane.layout = L;

  let html = "";
  for (const b of L.bands) {
    const raw = DECADES[b.di] || "";
    html += '<div class="band" data-b="' + b.di + '" style="top:' + b.top
      + 'px;height:' + (b.bottom - b.top) + 'px">'
      + (b.first ? "" : '<div class="bline"></div>')
      + '<div class="blabel' + (raw.length > 7 ? " sm" : "") + '">'
      + esc(DECADE_LABEL[raw] || raw) + "</div></div>";
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
      html += '<div class="brick ext" data-i="' + i + '" data-k="' + esc(it.tech)
        + '" style="' + style + '"><span>'
        + esc(it.node.name) + '<span class="xarea">'
        + esc(areaDisplay[it.node.area] || it.node.area) + "</span></span></div>";
    } else {
      html += '<div class="brick i' + it.imp + '" data-i="' + i + '" data-k="' + esc(it.tech)
        + '" style="' + style + '">' + esc(it.node.name) + "</div>";
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
      let hops = null;
      if (e.hops) { hops = {}; for (const k in e.hops) hops[k] = e.hops[k].map(x => x + PAD_L); }
      d = polyPath(pts, 7, hops);
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

  /* Secondary-Area outlines sit behind everything, each tinted a step off the
     Area's own hue, with its name in italics on top of the bubble. */
  let blobHtml = "", blobLab = "";
  if (L.blobList && L.blobList.length) {
    const ah = AREA_HUE[area] || [215, 18];
    for (const g of L.blobList) {
      /* each sub-group sits a measured step off the Area's own hue, so two
         of them are never the same tint */
      const n = Math.max(1, g.secN);
      const spread = Math.min(34, 150 / n);
      const shift = (g.si - (n - 1) / 2) * spread;
      const h = (ah[0] + shift + 720) % 360;
      const sat = Math.max(24, ah[1]) + (g.si % 2 ? 7 : -3);
      const spans = g.spans.map(sp => ({ x1: sp.x1 + PAD_L, x2: sp.x2 + PAD_L,
        yTop: sp.yTop, yBot: sp.yBot, neck: sp.neck }));
      const d = blobPath(spans, 7, 3, 7, 20, 11, 14);
      if (!d) continue;
      blobHtml += '<path class="blob" d="' + d + '" fill="hsl(' + h + ' ' + sat + '% 62% / .055)"'
        + ' stroke="hsl(' + h + ' ' + sat + '% 72% / .26)" stroke-width="1" stroke-dasharray="5 4"></path>';
      const lx = (spans[0].x1 + spans[0].x2) / 2, ly = spans[0].yTop - 8;
      blobLab += '<text class="bloblab" x="' + F(lx) + '" y="' + F(ly) + '"'
        + ' fill="hsl(' + h + ' ' + sat + '% 80% / .62)">' + esc(g.label) + "</text>";
    }
  }

  pane.svg.setAttribute("width", width + PAD_L + PAD_R);
  pane.svg.setAttribute("height", L.height);
  pane.svg.innerHTML = blobHtml + sv + stubHtml + duds + blobLab;
  for (const k of pane.stage.querySelectorAll(".brick,.band")) k.remove();
  pane.stage.insertAdjacentHTML("beforeend", html);
  pane.stage.style.height = L.height + "px";
  if (!keepScroll) pane.el.scrollTop = 0;
}

/* ---------------------------------------------------- re-arrange animation
   Every brick is rebuilt in its new place, then pushed back to where it was
   with a transform and released — so it glides. The connectors can't tween
   between two different path shapes, so they cross-fade instead, and the
   decade you were looking at is kept under the top of the screen. */
const MORPH_OUT = 100, MORPH_MOVE = 320;
let morphTimer = null;
function morphPane(pane, rebuild) {
  const el = pane.el, old = pane.layout;
  if (!old) { rebuild(); return; }
  clearTimeout(morphTimer);
  const paneH = el.clientHeight, sTop = el.scrollTop;

  let anchor = null;
  for (const b of old.bands) {
    if (sTop + 1 >= b.top && sTop + 1 < b.bottom) {
      anchor = { di: b.di, frac: (sTop - b.top) / Math.max(1, b.bottom - b.top) };
      break;
    }
  }
  if (!anchor && old.bands.length) anchor = { di: old.bands[0].di, frac: 0 };

  const prev = new Map();
  for (const it of old.items) prev.set(it.tech, { x: it.x, y: it.y });
  const prevBand = new Map();
  for (const b of old.bands) prevBand.set(String(b.di), b.top);

  pane.svg.style.transition = "opacity " + MORPH_OUT + "ms linear";
  pane.svg.style.opacity = "0";

  morphTimer = setTimeout(() => {
    rebuild();
    const L = pane.layout;

    let ns = sTop;
    if (anchor) {
      for (const b of L.bands) {
        if (b.di === anchor.di) { ns = b.top + anchor.frac * (b.bottom - b.top); break; }
      }
    }
    ns = Math.min(Math.max(0, ns), Math.max(0, el.scrollHeight - el.clientHeight));
    el.scrollTop = ns;
    const dS = ns - sTop;

    const byTech = new Map();
    for (const it of L.items) byTech.set(it.tech, it);
    const moved = [];
    const near = (a, b) => (a > -1.3 * paneH && a < 2.3 * paneH) || (b > -1.3 * paneH && b < 2.3 * paneH);

    for (const node of pane.stage.querySelectorAll(".brick[data-k]")) {
      const it = byTech.get(node.dataset.k), p = prev.get(node.dataset.k);
      if (!it) continue;
      if (!p) { node.style.opacity = "0"; moved.push(node); continue; }
      const dy = (p.y - it.y) + dS, dx = p.x - it.x;
      if (!near(p.y - sTop, it.y - ns) || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) continue;
      node.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
      moved.push(node);
    }
    for (const node of pane.stage.querySelectorAll(".band[data-b]")) {
      const b = L.bands.find(z => String(z.di) === node.dataset.b);
      const pt = prevBand.get(node.dataset.b);
      if (!b || pt === undefined) continue;
      const dy = (pt - b.top) + dS;
      if (!near(pt - sTop, b.top - ns) || Math.abs(dy) < 0.5) continue;
      node.style.transform = "translateY(" + dy.toFixed(1) + "px)";
      moved.push(node);
    }

    void pane.stage.offsetHeight;                 // commit the start positions
    for (const node of moved) {
      node.classList.add("morphing");
      node.style.transform = "";
      node.style.opacity = "";
    }
    morphTimer = setTimeout(() => {
      pane.svg.style.transition = "opacity 190ms ease-out";
      pane.svg.style.opacity = "";
    }, MORPH_MOVE - 70);
    setTimeout(() => {
      for (const node of moved) { node.classList.remove("morphing"); node.style.transform = ""; }
      pane.svg.style.transition = "";
    }, MORPH_MOVE + 60);
  }, MORPH_OUT);
}

let headerIdx = -1, tweenRaf = 0;
function applyVars(el, vars) { for (const k in vars) el.style.setProperty(k, vars[k]); }
function areaLabel(a) { return areaDisplay[a] || a; }

/* One blended frame of the transition between two areas. */
function paintChrome(fromArea, toArea, t) {
  applyVars(document.documentElement, schemeMix(fromArea, toArea, t));
  const name = t < 0.5 ? fromArea : toArea;
  if (areaNameEl.dataset.a !== name) {
    areaNameEl.dataset.a = name;
    areaNameEl.textContent = areaLabel(name);
  }
  areaNameEl.style.opacity = String(Math.max(0.06, Math.abs(2 * t - 1)));
}
function tweenChrome(fromArea, toArea, t0, t1, ms, done) {
  cancelAnimationFrame(tweenRaf);
  const t = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t) / ms);
    const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    paintChrome(fromArea, toArea, t0 + (t1 - t0) * e);
    if (k < 1) tweenRaf = requestAnimationFrame(step);
    else if (done) done();
  };
  tweenRaf = requestAnimationFrame(step);
}
function setHeader(idx) {
  cancelAnimationFrame(tweenRaf);
  headerIdx = idx;
  const area = order[idx];
  areaNameEl.dataset.a = area;
  areaNameEl.textContent = areaLabel(area);
  areaNameEl.style.opacity = "1";
  applyScheme(document.documentElement, area);
}
function paintAll() {
  clearTimeout(morphTimer);
  for (const pn of panes) { pn.svg.style.transition = ""; pn.svg.style.opacity = ""; }
  for (let s = 0; s < 3; s++) renderPane(panes[s], order[wrapIdx(curAreaIdx + s - 1)], curLevel);
  /* keep the two corner buttons beside the diagram, not the window edge */
  const mx = metricsFor(active().el.clientWidth);
  document.documentElement.style.setProperty("--stage-left",
    Math.max(0, (active().el.clientWidth - mx.stageW) / 2) + "px");
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
function goTo(idx, dir, fromT) {
  if (sliding) return;
  const step = dir || (idx > curAreaIdx ? 1 : -1);
  sliding = true;
  hideTip();
  const fromArea = order[curAreaIdx], toArea = order[wrapIdx(idx)];
  curAreaIdx = wrapIdx(idx);
  headerIdx = curAreaIdx;
  tweenChrome(fromArea, toArea, fromT || 0, 1, 300);
  setTrack(-step * viewport.clientWidth, true);
  setTimeout(() => { setTrack(0, false); paintAll(); sliding = false; }, 300);
}

let ptrId = null, sx = 0, sy = 0, axis = null, dx = 0, lockX = false;
let dragT = 0, dragTo = null;
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
  /* the palette follows the finger, so there is nothing to flicker */
  cancelAnimationFrame(tweenRaf);
  dragT = Math.min(1, Math.abs(dx) / Math.max(1, viewport.clientWidth));
  dragTo = order[wrapIdx(curAreaIdx + (dx < 0 ? 1 : -1))];
  paintChrome(order[curAreaIdx], dragTo, dragT);
}
function onUp() {
  if (ptrId === null) return;
  ptrId = null;
  if (axis !== "x") { axis = null; return; }
  axis = null;
  const threshold = Math.min(70, viewport.clientWidth * .2);
  if (dx <= -threshold) goTo(curAreaIdx + 1, 1, dragT);
  else if (dx >= threshold) goTo(curAreaIdx - 1, -1, dragT);
  else {
    const from = order[curAreaIdx], to = dragTo || from;
    tweenChrome(from, to, dragT, 0, 200, () => setHeader(curAreaIdx));
    setTrack(0, true);
  }
  dx = 0; dragT = 0;
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

function rearrange() {
  const pane = active();
  unfocus(pane);
  hideTip();
  for (let i = 0; i < 3; i++) {
    if (i === 1) continue;
    renderPane(panes[i], order[wrapIdx(curAreaIdx + i - 1)], curLevel);
  }
  morphPane(pane, () => renderPane(pane, pane.area, curLevel, true));
  setTimeout(() => { updateFades(); showHint(); }, MORPH_OUT + MORPH_MOVE + 80);
}

function setFlip(on) {
  curFlip = !!on;
  flipBtn.classList.toggle("down", curFlip);
  flipBtn.setAttribute("aria-label", curFlip ? "Show newest first" : "Show oldest first");
  hintText.textContent = curFlip ? "scroll down for the future" : "scroll down for the past";
  rearrange();
}
flipBtn.addEventListener("click", () => setFlip(!curFlip));

function setBlobs(on) {
  curBlobs = !!on;
  blobBtn.classList.toggle("on", curBlobs);
  blobBtn.setAttribute("aria-label", curBlobs ? "Hide secondary areas" : "Show secondary areas");
  rearrange();
}
blobBtn.addEventListener("click", () => setBlobs(!curBlobs));

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
  /* An out-of-area parent is only a marker, not part of this area's tree:
     show what comes straight off it and stop there. */
  if (item.kind === "ext") {
    for (const pair of (down.get(item) || [])) { edgeSet.add(pair[1]); inSet.add(pair[0].from); }
    return { inSet: inSet, edgeSet: edgeSet };
  }
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

/* Scale and scroll are driven together on one eased curve, so the diagram
   eases out rather than snapping. */
let zoomRaf = 0;
function tweenZoom(pane, fromZ, toZ, fromScroll, toScroll, holdH, ms) {
  cancelAnimationFrame(zoomRaf);
  const H = pane.layout.height;
  pane.stage.style.transition = "none";
  pane.stage.style.height = holdH + "px";
  const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms);
    const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;  // easeInOutCubic
    const z = fromZ + (toZ - fromZ) * e;
    pane.stage.style.transform = z >= 0.999 ? "" : "scale(" + z.toFixed(4) + ")";
    pane.el.scrollTop = fromScroll + (toScroll - fromScroll) * e;
    if (k < 1) zoomRaf = requestAnimationFrame(step);
    else pane.stage.style.height = (H * toZ) + "px";
  };
  zoomRaf = requestAnimationFrame(step);
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
  pane.el.classList.add("focus");
  /* hold the full height while shrinking so the browser never clamps the
     scroll position mid-animation */
  tweenZoom(pane, 1, ZOOM, before, Math.max(0, item.cy * ZOOM - item.cy + before),
    L.height, 500);
  trackTip(pane);
}
function unfocus(pane) {
  if (!pane.focused) return;
  const L = pane.layout, item = pane.focused, before = pane.el.scrollTop;
  pane.focused = null; pane.selEl = null;
  pane.el.classList.remove("focus");
  tweenZoom(pane, ZOOM, 1, before, Math.max(0, before + item.cy - item.cy * ZOOM),
    L.height, 440);
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
  /* while zoomed out the stage no longer fills the pane, so a tap on the
     bare margin has to drop focus too */
  pane.el.addEventListener("click", e => {
    if (e.target === pane.el && pane.focused && !sliding) unfocus(pane);
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
  const it = pane.focused;
  const jump = it && it.kind === "ext";
  tipEl.textContent = jump ? "Switch to " + areaLabel(it.node.area) : "More info";
  tipEl.classList.remove("premium");
  tipEl.dataset.action = jump ? "jump" : "info";
  tipEl.dataset.area = jump ? it.node.area : "";
  positionTip(pane);
  tipEl.classList.add("show");
  clearTimeout(tipTimer);
  const t0 = performance.now();
  cancelAnimationFrame(tipRaf);
  const step = () => { positionTip(pane); if (performance.now() - t0 < 620) tipRaf = requestAnimationFrame(step); };
  tipRaf = requestAnimationFrame(step);
}
tipEl.addEventListener("click", () => {
  const pane = active();
  if (!pane.focused) return;
  if (tipEl.dataset.action === "jump") {
    const target = order.indexOf(tipEl.dataset.area);
    if (target < 0) return;
    let step = target - curAreaIdx;
    const n = order.length;
    if (step > n / 2) step -= n; else if (step < -n / 2) step += n;
    goTo(target, step >= 0 ? 1 : -1);
    return;
  }
  if (tipEl.dataset.action !== "info") return;
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
  /* blink the side chevrons a few times so the swipe is discoverable */
  setTimeout(() => {
    swipeHintEl.classList.add("play");
    setTimeout(() => swipeHintEl.remove(), 2700);
  }, 500);
}));

window.__genreMap = {
  get pane() { return active(); },
  get layout() { return active().layout; },
  get order() { return order; },
  get level() { return curLevel; },
  get flip() { return curFlip; },
  get areaIdx() { return curAreaIdx; },
  get blobs() { return curBlobs; },
  setLevel, setFlip, setBlobs, goTo, focusItem, unfocus, openSheet, lineageOf, scheme, PAD_L,
  setArea(i) { curAreaIdx = wrapIdx(i); paintAll(); },
};
}));
