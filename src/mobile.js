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

const MEAS = document.createElement("canvas").getContext("2d");
const FONT_STACK = '600 10.5px "Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
const BRICK_MAX_W = 150, BRICK_MIN_W = 58, PAD_TEXT = 13;
const LINE_H = [0, 24, 35, 46];

function splitLines(text, k) {
  const words = text.split(/\s+/);
  if (words.length < k) return null;
  let bestCut = null, bestScore = Infinity;
  const cuts = [];
  (function rec(start, depth, acc) {
    if (depth === k - 1) { cuts.push(acc.concat([words.length])); return; }
    for (let i = start + 1; i <= words.length - (k - depth - 1); i++) rec(i, depth + 1, acc.concat([i]));
  })(0, 0, []);
  for (const c of cuts) {
    const parts = []; let prev = 0;
    for (const p of c) { parts.push(words.slice(prev, p).join(" ")); prev = p; }
    const widths = parts.map(p => MEAS.measureText(p).width);
    const score = Math.max.apply(null, widths);
    if (score < bestScore) { bestScore = score; bestCut = parts; }
  }
  return { parts: bestCut, w: bestScore };
}

const measureCache = Object.create(null);
function measure(text) {
  if (measureCache[text]) return measureCache[text];
  MEAS.font = FONT_STACK;
  const one = MEAS.measureText(text).width;
  let out;
  if (one + PAD_TEXT <= BRICK_MAX_W) {
    out = { w: Math.max(BRICK_MIN_W, Math.ceil(one) + PAD_TEXT), h: LINE_H[1] };
  } else {
    const two = splitLines(text, 2);
    if (two && two.w + PAD_TEXT <= BRICK_MAX_W) {
      out = { w: Math.max(BRICK_MIN_W, Math.ceil(two.w) + PAD_TEXT), h: LINE_H[2] };
    } else {
      const three = splitLines(text, 3);
      const w = three ? Math.min(BRICK_MAX_W, Math.ceil(three.w) + PAD_TEXT) : BRICK_MAX_W;
      out = { w: Math.max(BRICK_MIN_W, w), h: LINE_H[3] };
    }
  }
  measureCache[text] = out;
  return out;
}

/* ---------------------------------------------------------------- layout */

const GAP_X = 9, ROW_GAP = 24, JITTER = 5;
const BAND_TOP = 30, BAND_BOTTOM = 20;
const GHOST_W = 30, GHOST_H = 11;
const EXT_H = 30;
const MAX_GHOSTS = 2;

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
    const add = cur.length ? GAP_X + it.w : it.w;
    if (cur.length && curW + add > width) { rowsOut.push(cur); cur = []; curW = 0; }
    curW += cur.length ? GAP_X + it.w : it.w;
    cur.push(it);
  }
  if (cur.length) rowsOut.push(cur);
  for (const r of rowsOut) placeRow(r, width);
  return rowsOut;
}

const layoutCache = Object.create(null);

function buildLayout(area, level, width) {
  const key = area + "|" + level + "|" + width;
  if (layoutCache[key]) return layoutCache[key];

  const all = nodesByArea[area] || [];
  const vis = all.filter(n => n.imp >= level);
  const visible = new Set(vis.map(n => n.tech));

  /* nearest visible ancestor inside this area, following primary parents */
  const resolveCache = Object.create(null);
  function resolve(tech) {
    if (!tech) return null;
    if (tech in resolveCache) return resolveCache[tech];
    let cur = tech, hops = 0, out = null;
    const seen = new Set();
    while (cur && hops++ < 40 && !seen.has(cur)) {
      seen.add(cur);
      const n = byTech[cur];
      if (!n || n.area !== area) { out = null; break; }
      if (visible.has(cur)) { out = cur; break; }
      cur = n.p1;
    }
    resolveCache[tech] = out;
    return out;
  }

  const items = [];
  const itemFor = Object.create(null);
  function addItem(it) { items.push(it); return it; }

  for (const n of vis) {
    const m = measure(n.name);
    itemFor[n.tech] = addItem({
      kind: "node", node: n, tech: n.tech, di: n.di,
      w: m.w, h: m.h, x: 0, y: 0, want: 0,
    });
  }

  /* External parents: shown as a translucent oval in their own decade. */
  const extItems = Object.create(null);
  for (const n of vis) {
    if (!n.extParent || !n.p1) continue;
    const p = byTech[n.p1];
    if (!p || p.area === area) continue;
    if (!extItems[p.tech]) {
      const m = measure(p.name);
      extItems[p.tech] = addItem({
        kind: "ext", node: p, tech: "ext:" + p.tech, di: p.di,
        w: Math.max(74, m.w + 18), h: EXT_H, x: 0, y: 0, want: 0,
      });
    }
  }

  /* Ghost bricks: a few of each visible brick's hidden direct children, so a
     shallow drilldown still hints at the detail underneath it. */
  const ghosts = [];
  if (level > 1) {
    for (const n of vis) {
      const kids = (kidsOf[n.tech] || [])
        .filter(k => k.area === area && k.imp < level)
        .sort((a, b) => b.imp - a.imp || a.name.localeCompare(b.name))
        .slice(0, MAX_GHOSTS);
      for (const k of kids) {
        ghosts.push(addItem({
          kind: "ghost", node: k, tech: "gh:" + k.tech, di: k.di,
          parentItem: itemFor[n.tech], w: GHOST_W, h: GHOST_H, x: 0, y: 0, want: 0,
        }));
      }
    }
  }

  /* ---- edges ---- */
  const edges = [];
  for (const n of vis) {
    const src = itemFor[n.tech];
    const drawn = new Set();
    /* primary */
    if (n.extParent && n.p1 && byTech[n.p1] && byTech[n.p1].area !== area) {
      const t = extItems[byTech[n.p1].tech];
      if (t) { edges.push({ from: src, to: t, rank: "ex" }); drawn.add(t.tech); }
    } else {
      const t = resolve(n.p1);
      if (t && t !== n.tech) { edges.push({ from: src, to: itemFor[t], rank: "p1" }); drawn.add(t); }
    }
    /* secondary / tertiary, only when they land inside this area */
    const t2 = resolve(n.p2);
    if (t2 && t2 !== n.tech && !drawn.has(t2)) { edges.push({ from: src, to: itemFor[t2], rank: "p2" }); drawn.add(t2); }
    const t3 = resolve(n.p3);
    if (t3 && t3 !== n.tech && !drawn.has(t3)) { edges.push({ from: src, to: itemFor[t3], rank: "p3" }); drawn.add(t3); }
  }
  for (const g of ghosts) if (g.parentItem) edges.push({ from: g, to: g.parentItem, rank: "gh" });

  /* parents / children adjacency for the placement sweeps */
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

  /* Within one decade there is no chronology to lean on, so rank by how deep a
     brick sits in the same-decade parent chain: deeper = drawn in a higher row,
     which keeps a same-decade child above the parent it came from. */
  for (const [di, layer] of layers) {
    const memo = new Map();
    const depth = it => {
      if (memo.has(it)) return memo.get(it);
      memo.set(it, 0);
      let d = 0;
      for (const o of it.up) if (o.di === di) d = Math.max(d, depth(o) + 1);
      memo.set(it, d);
      return d;
    };
    for (const it of layer) it.rank = 0;
    for (const it of layer) it.rank = depth(it);
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
        } else {
          it.want = it.x + it.w / 2;
        }
      }
      layer.sort((a, b) => b.rank - a.rank || a.want - b.want || a.w - b.w);
      packLayer(layer, width);
    }
  }
  sweep(true); sweep(false); sweep(true);

  /* ---- vertical: newest band on top ---- */
  const bands = [];
  let y = 0;
  const top = dis.slice().reverse();                              // newest first
  for (let bi = 0; bi < top.length; bi++) {
    const di = top[bi];
    const layer = layers.get(di);
    const rowsOut = packLayer(layer, width);
    const bandTop = y;
    let ry = y + BAND_TOP;
    for (const r of rowsOut) {
      let rh = 0; for (const it of r) if (it.h > rh) rh = it.h;
      for (const it of r) {
        /* nudge each brick off its row's baseline so parallel connectors
           don't all run at the same height */
        const j = (hash32(it.tech) % (2 * JITTER + 1)) - JITTER;
        it.y = ry + (rh - it.h) / 2 + j;
        it.rowTop = ry; it.rowBottom = ry + rh;   // nominal, jitter-free
      }
      ry += rh + ROW_GAP;
    }
    y = ry - ROW_GAP + BAND_BOTTOM;
    bands.push({ di, top: bandTop, bottom: y, first: bi === 0 });
  }

  for (const it of items) {
    it.cx = it.x + it.w / 2; it.cy = it.y + it.h / 2;
    it.eOut = []; it.eIn = [];
  }
  for (const e of edges) { e.from.eOut.push(e); e.to.eIn.push(e); }
  for (const it of items) {
    const inset = Math.min(7, it.w / 4);
    it.eOut.sort((a, b) => a.to.cx - b.to.cx);
    it.eOut.forEach((e, i) => {
      e.ax = it.x + inset + (it.w - 2 * inset) * ((i + 1) / (it.eOut.length + 1));
    });
    it.eIn.sort((a, b) => a.from.cx - b.from.cx);
    it.eIn.forEach((e, i) => {
      e.bx = it.x + inset + (it.w - 2 * inset) * ((i + 1) / (it.eIn.length + 1));
    });
  }
  /* Each connector drops straight down from the child and only turns sideways
     in the clear gap just above its parent, at its own height inside that gap,
     so long runs fan out across the children instead of stacking into one
     cable above the parent. */
  const jogBand = Math.max(3, ROW_GAP - 2 * JITTER - 2);
  for (const e of edges) {
    e.jog = e.to.rowTop - ROW_GAP + JITTER + 1
      + (hash32(e.from.tech + ">" + e.to.tech) % jogBand);
  }

  const out = { area, level, width, items, edges, bands, height: y + 56, itemFor };
  layoutCache[key] = out;
  return out;
}


/* ------------------------------------------------------------------- draw */

const viewport = document.getElementById("viewport");
const track = document.getElementById("track");
const areabar = document.getElementById("areabar");
const areaNameEl = document.getElementById("areaName");
const tipEl = document.getElementById("tip");
const scrimEl = document.getElementById("scrim");
const hintEl = document.getElementById("scrollHint");
const fadeTop = document.getElementById("fadeTop");
const fadeBottom = document.getElementById("fadeBottom");

const PAD_L = 10, PAD_R = 50;
const ZOOM = .84;
const EDGE_STYLE = {
  p1: { w: 2.0, o: .62 },
  p2: { w: 1.0, o: .30 },
  p3: { w: .55, o: .24, dash: "1.2 3.2" },
  ex: { w: .9, o: .28, dash: "3 4" },
  gh: { w: .7, o: .10 },
};

let curAreaIdx = 0;
let curLevel = 3;
let hintTimer = null;

/* Three side-by-side panes: previous area, current area, next area. The track
   slides horizontally so a swipe carries one out while the next comes in. */
const panes = Array.prototype.map.call(track.children, el => ({
  el,
  stage: el.querySelector(".stage"),
  svg: el.querySelector(".edges"),
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

function edgePath(from, to, jog) {
  const x1 = from.ax, y1 = from.y + from.h;    // child sits above its parent
  const x2 = to.bx, y2 = to.y;
  if (y2 < y1 + 10) {
    const sy = from.cy, ey = to.cy;
    const dx = Math.abs(to.cx - from.cx), bow = Math.min(26, Math.max(12, dx * .3));
    const dir = from.cx < to.cx ? 1 : -1;
    const sx = dir > 0 ? from.x + from.w : from.x;
    const ex = dir > 0 ? to.x : to.x + to.w;
    return "M" + sx + " " + sy + "C" + (sx + dir * bow) + " " + sy
      + "," + (ex - dir * bow) + " " + ey + "," + ex + " " + ey;
  }
  if (Math.abs(x2 - x1) < 1.5) return "M" + x1 + " " + y1 + "V" + y2;
  /* Travel sideways in the clear gap just below the child, then drop straight
     down. Keeps the long runs vertical instead of cutting across bricks. */
  let my = jog === undefined ? y1 + (y2 - y1) * 0.5 : jog;
  const half = y1 + (y2 - y1) * 0.5;
  if (my < y1 + 5) my = Math.min(half, y1 + 5);
  if (my > y2 - 5) my = Math.max(half, y2 - 5);
  const r = Math.min(8, Math.abs(x2 - x1) / 2, (my - y1), (y2 - my));
  const s = x2 > x1 ? 1 : -1;
  return "M" + x1 + " " + y1
    + "V" + (my - r)
    + "Q" + x1 + " " + my + " " + (x1 + s * r) + " " + my
    + "H" + (x2 - s * r)
    + "Q" + x2 + " " + my + " " + x2 + " " + (my + r)
    + "V" + y2;
}

function renderPane(pane, area, level) {
  pane.area = area;
  pane.focused = null; pane.selEl = null;
  applyScheme(pane.el, area);
  pane.el.classList.remove("focus");
  pane.stage.style.transform = "";

  const width = Math.max(200, pane.el.clientWidth - PAD_L - PAD_R);
  const L = buildLayout(area, level, width);
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
    const style = "left:" + (it.x + PAD_L).toFixed(1) + "px;top:" + it.y.toFixed(1)
      + "px;width:" + it.w.toFixed(1) + "px;height:" + it.h + "px";
    if (it.kind === "ghost") {
      html += '<div class="brick ghost" style="' + style + '"></div>';
    } else if (it.kind === "ext") {
      html += '<div class="brick ext" data-i="' + i + '" style="' + style + '"><span>'
        + esc(it.node.name) + '<span class="xarea">'
        + esc(areaDisplay[it.node.area] || it.node.area) + "</span></span></div>";
    } else {
      html += '<div class="brick" data-i="' + i + '" style="' + style + '">' + esc(it.node.name) + "</div>";
    }
  }

  for (const it of L.items) { it.px = it.x + PAD_L; it.pcx = it.cx + PAD_L; }
  let sv = "";
  for (let i = 0; i < L.edges.length; i++) {
    const e = L.edges[i], st = EDGE_STYLE[e.rank];
    const from = { cx: e.from.pcx, ax: e.ax + PAD_L, x: e.from.px, w: e.from.w, y: e.from.y, h: e.from.h, cy: e.from.cy };
    const to = { cx: e.to.pcx, bx: e.bx + PAD_L, x: e.to.px, w: e.to.w, y: e.to.y, h: e.to.h, cy: e.to.cy };
    sv += '<path class="e ' + e.rank + '" data-e="' + i + '" d="' + edgePath(from, to, e.jog)
      + '" fill="none" stroke-width="' + st.w + '" opacity="' + st.o + '"'
      + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + ' stroke-linecap="round"></path>';
  }

  pane.svg.setAttribute("width", width + PAD_L + PAD_R);
  pane.svg.setAttribute("height", L.height);
  pane.svg.innerHTML = sv;
  for (const k of pane.stage.querySelectorAll(".brick,.band")) k.remove();
  pane.stage.insertAdjacentHTML("beforeend", html);
  pane.stage.style.height = L.height + "px";
  pane.el.scrollTop = 0;
}

/* The header shows whichever area the carousel is closest to, so the title and
   the page colours change mid-swipe rather than snapping at the end. */
let headerIdx = -1;
function setHeader(idx) {
  if (idx === headerIdx) return;
  headerIdx = idx;
  const area = order[idx];
  areaNameEl.textContent = areaDisplay[area] || area;
  applyScheme(document.documentElement, area);
}

/* Repaint all three panes around the current index. */
function paintAll() {
  for (let s = 0; s < 3; s++) renderPane(panes[s], order[wrapIdx(curAreaIdx + s - 1)], curLevel);
  headerIdx = -1;
  setHeader(curAreaIdx);
  hideTip();
  updateFades();
  showHint();
}

/* --------------------------------------------------------------- carousel */

const CENTER = -100 / 3;                       // track is 300% wide
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
  setTimeout(() => {
    setTrack(0, false);
    paintAll();
    sliding = false;
  }, 300);
}

let ptrId = null, sx = 0, sy = 0, axis = null, dx = 0, lockX = false;

function onDown(e, forceX) {
  if (sliding || scrimEl.classList.contains("show")) return;
  if (e.pointerType === "mouse" && e.button !== 0) return;
  ptrId = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0;
  axis = forceX ? null : null; lockX = !!forceX;
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
function onUp(e) {
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

/* the title strip swipes too */
areabar.addEventListener("pointerdown", e => {
  if (e.target.closest(".chev")) return;
  onDown(e, true);
}, { passive: true });
areabar.addEventListener("pointermove", onMove, { passive: false });
areabar.addEventListener("pointerup", onUp, { passive: true });
areabar.addEventListener("pointercancel", onUp, { passive: true });

document.getElementById("prevArea").addEventListener("click", () => goTo(curAreaIdx - 1, -1));
document.getElementById("nextArea").addEventListener("click", () => goTo(curAreaIdx + 1, 1));

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
      + '<span class="dnum">' + lv + "</span><span class=\"dblip\"></span>"
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

/* Everything the genre descends from and everything descended from it: the
   primary-parent spine walked both ways, plus the node's own secondary and
   tertiary links. */
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
        const e = pair[0];
        if (!spine(e.rank)) continue;
        edgeSet.add(pair[1]);
        const nxt = pick(e);
        inSet.add(nxt);
        if (!seen.has(nxt)) { seen.add(nxt); stack.push(nxt); }
      }
    }
  };
  walk(item, up, e => e.to);       // ancestors
  walk(item, down, e => e.from);   // descendants
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

  /* Scale from the top edge and compensate the scroll position, so the tapped
     brick stays put and the whole diagram is still scrollable end to end. */
  const before = pane.el.scrollTop;
  pane.stage.style.transformOrigin = "50% 0";
  pane.stage.style.transform = "scale(" + ZOOM + ")";
  pane.stage.style.height = (L.height * ZOOM) + "px";
  pane.el.classList.add("focus");
  const want = item.cy * ZOOM - item.cy + before;
  pane.el.scrollTop = Math.max(0, want);
  trackTip(pane);
}

function unfocus(pane) {
  if (!pane.focused) return;
  const L = pane.layout, item = pane.focused;
  const before = pane.el.scrollTop;
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
  /* follow the brick while the zoom transition plays out */
  const t0 = performance.now();
  cancelAnimationFrame(tipRaf);
  const step = () => {
    positionTip(pane);
    if (performance.now() - t0 < 420) tipRaf = requestAnimationFrame(step);
  };
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
  const el = active().el;
  if (el.scrollHeight - el.clientHeight < 40) return;
  hintTimer = setTimeout(() => {
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
  get areaIdx() { return curAreaIdx; },
  setLevel,
  setArea(i) { curAreaIdx = wrapIdx(i); paintAll(); },
  goTo, focusItem, unfocus, openSheet, lineageOf, scheme,
};
}));
