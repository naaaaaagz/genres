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

const AREA_ACCENT = {
  rock: "#ff8a6b", metal: "#e0607f", punk: "#ff7ba8", pop: "#ffb454",
  folk: "#9ad06b", latin: "#ffd166", jazz: "#c9a6ff", soulful: "#f0956b",
  classical: "#bfc6d4", rasta: "#7fd48f", hiphop: "#ffc857", breakbeat: "#6fd6ff",
  house: "#7bb8ff", techno: "#8fa8ff", trance: "#a88fff", hardcore: "#ff6f6f",
  industrial: "#9fa6ad", experimental: "#7fe0d0",
};
const FALLBACK_ACCENT = "#8fb6ff";

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

const GAP_X = 9, ROW_GAP = 13;
const BAND_TOP = 26, BAND_BOTTOM = 16;
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
      for (const it of r) { it.y = ry + (rh - it.h) / 2; it.rowBottom = ry + rh; }
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
  for (const e of edges) e.jog = e.from.rowBottom + ROW_GAP / 2;

  const out = { area, level, width, items, edges, bands, height: y + 56, itemFor };
  layoutCache[key] = out;
  return out;
}

/* ------------------------------------------------------------------- draw */

const scroller = document.getElementById("scroller");
const pan = document.getElementById("pan");
const stage = document.getElementById("stage");
const svg = document.getElementById("edges");
const areaNameEl = document.getElementById("areaName");
const tipEl = document.getElementById("tip");
const scrimEl = document.getElementById("scrim");
const hintEl = document.getElementById("scrollHint");
const fadeTop = document.getElementById("fadeTop");
const fadeBottom = document.getElementById("fadeBottom");

const PAD_L = 10, PAD_R = 50;
const EDGE_STYLE = {
  p1: { w: 1.6, o: .50 }, p2: { w: 1.0, o: .28 }, p3: { w: .65, o: .17 },
  ex: { w: .9, o: .26, dash: "3 4" }, gh: { w: .7, o: .10 },
};

let curAreaIdx = 0;
let curLevel = 4;
let layout = null;
let focused = null;
let hintTimer = null;

function availWidth() {
  return Math.max(200, scroller.clientWidth - PAD_L - PAD_R);
}

function edgePath(from, to, jog) {
  const x1 = from.ax, y1 = from.y + from.h;    // child sits above its parent
  const x2 = to.bx, y2 = to.y;
  if (y2 < y1 + 10) {
    /* same band (or overlapping rows): gentle side curve instead */
    const sy = from.cy, ey = to.cy;
    const dx = Math.abs(x2 - x1), bow = Math.min(26, Math.max(12, dx * .3));
    const sx = x1 < x2 ? from.x + from.w : from.x;
    const ex = x1 < x2 ? to.x : to.x + to.w;
    return "M" + sx + " " + sy + "C" + (sx + (x1 < x2 ? bow : -bow)) + " " + sy
      + "," + (ex - (x1 < x2 ? bow : -bow)) + " " + ey + "," + ex + " " + ey;
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

function render(area, level) {
  const width = availWidth();
  layout = buildLayout(area, level, width);
  const accent = AREA_ACCENT[area] || FALLBACK_ACCENT;
  stage.style.setProperty("--accent", accent);
  stage.classList.remove("focus");
  stage.style.transform = "";
  focused = null;
  hideTip();

  /* bands */
  let html = "";
  for (const b of layout.bands) {
    const raw = DECADES[b.di] || "";
    const label = DECADE_LABEL[raw] || raw;
    html += '<div class="band" style="top:' + b.top + 'px;height:' + (b.bottom - b.top) + 'px">'
      + (b.first ? "" : '<div class="bline"></div>')
      + '<div class="blabel">' + label + "</div></div>";
  }

  /* bricks */
  for (let i = 0; i < layout.items.length; i++) {
    const it = layout.items[i];
    const style = "left:" + (it.x + PAD_L).toFixed(1) + "px;top:" + it.y.toFixed(1)
      + "px;width:" + it.w.toFixed(1) + "px;height:" + it.h + "px";
    if (it.kind === "ghost") {
      html += '<div class="brick ghost" style="' + style + '"></div>';
    } else if (it.kind === "ext") {
      html += '<div class="brick ext" data-i="' + i + '" style="' + style + '">'
        + '<span>' + esc(it.node.name)
        + '<span class="xarea">' + esc(areaDisplay[it.node.area] || it.node.area) + "</span></span></div>";
    } else {
      html += '<div class="brick" data-i="' + i + '" style="' + style + '">' + esc(it.node.name) + "</div>";
    }
  }
  stage.insertAdjacentHTML("beforeend", html);

  /* the brick x positions above include PAD_L; keep the geometry in sync */
  for (const it of layout.items) { it.px = it.x + PAD_L; it.pcx = it.cx + PAD_L; }

  /* edges */
  svg.setAttribute("width", width + PAD_L + PAD_R);
  svg.setAttribute("height", layout.height);
  let sv = "";
  for (let i = 0; i < layout.edges.length; i++) {
    const e = layout.edges[i];
    const st = EDGE_STYLE[e.rank];
    const from = { cx: e.from.pcx, ax: e.ax + PAD_L, x: e.from.px, w: e.from.w, y: e.from.y, h: e.from.h, cy: e.from.cy };
    const to = { cx: e.to.pcx, bx: e.bx + PAD_L, x: e.to.px, w: e.to.w, y: e.to.y, h: e.to.h, cy: e.to.cy };
    sv += '<path class="e ' + e.rank + '" data-e="' + i + '" d="' + edgePath(from, to, e.jog)
      + '" fill="none" stroke="#ffffff" stroke-width="' + st.w + '" opacity="' + st.o + '"'
      + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : "") + ' stroke-linecap="round"></path>';
  }
  svg.innerHTML = sv;

  stage.style.height = layout.height + "px";
  scroller.scrollTop = 0;
  updateFades();
  showHint();
}

function clearStage() {
  const kids = stage.querySelectorAll(".brick,.band");
  for (const k of kids) k.remove();
  svg.innerHTML = "";
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ------------------------------------------------------------- area swipe */

function setArea(idx, dir) {
  const n = order.length;
  curAreaIdx = ((idx % n) + n) % n;
  const area = order[curAreaIdx];
  areaNameEl.classList.add("swapping");
  if (dir) {
    pan.style.transition = "transform .16s ease-in, opacity .16s ease-in";
    pan.style.transform = "translateX(" + (dir > 0 ? -50 : 50) + "px)";
    pan.style.opacity = "0";
  }
  const paint = () => {
    clearStage();
    render(area, curLevel);
    areaNameEl.textContent = areaDisplay[area] || area;
    areaNameEl.classList.remove("swapping");
    if (dir) {
      pan.style.transition = "none";
      pan.style.transform = "translateX(" + (dir > 0 ? 50 : -50) + "px)";
      pan.style.opacity = "0";
      requestAnimationFrame(() => {
        pan.style.transition = "transform .24s cubic-bezier(.25,.8,.3,1), opacity .24s";
        pan.style.transform = "translateX(0)";
        pan.style.opacity = "1";
      });
    } else {
      pan.style.transform = "";
      pan.style.opacity = "1";
    }
  };
  if (dir) setTimeout(paint, 160); else paint();
}

let ptrId = null, sx = 0, sy = 0, dragAxis = null, dragDX = 0;
scroller.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  ptrId = e.pointerId; sx = e.clientX; sy = e.clientY; dragAxis = null; dragDX = 0;
}, { passive: true });

scroller.addEventListener("pointermove", e => {
  if (e.pointerId !== ptrId) return;
  const dx = e.clientX - sx, dy = e.clientY - sy;
  if (dragAxis === null) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) dragAxis = "x";
    else if (Math.abs(dy) > 10) dragAxis = "y";
  }
  if (dragAxis === "x") {
    e.preventDefault();
    dragDX = dx;
    pan.style.transition = "none";
    pan.style.transform = "translateX(" + (dx * .42) + "px)";
    pan.style.opacity = String(Math.max(.45, 1 - Math.abs(dx) / 420));
  }
}, { passive: false });

function endDrag() {
  if (ptrId === null) return;
  ptrId = null;
  if (dragAxis !== "x") return;
  const dx = dragDX; dragAxis = null;
  if (Math.abs(dx) > 55) { setArea(curAreaIdx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); return; }
  pan.style.transition = "transform .2s, opacity .2s";
  pan.style.transform = "translateX(0)";
  pan.style.opacity = "1";
}
scroller.addEventListener("pointerup", endDrag, { passive: true });
scroller.addEventListener("pointercancel", endDrag, { passive: true });

document.getElementById("prevArea").addEventListener("click", () => setArea(curAreaIdx - 1, -1));
document.getElementById("nextArea").addEventListener("click", () => setArea(curAreaIdx + 1, 1));

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
      + '<span class="dnum">' + lv + "</span>"
      + '<span class="dblip"></span>'
      + (prem ? LOCK_SVG : "")
      + '<span class="dhit"></span></button>';
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
  clearStage();
  render(order[curAreaIdx], lv);
}

/* ----------------------------------------------------------- focus + info */

function relatedOf(item) {
  const nodesSet = new Set([item]), edgeSet = new Set();
  layout.edges.forEach((e, i) => {
    if (e.from === item || e.to === item) {
      edgeSet.add(i);
      nodesSet.add(e.from); nodesSet.add(e.to);
    }
  });
  return { nodesSet, edgeSet };
}

function focusItem(item, el) {
  focused = item;
  const { nodesSet, edgeSet } = relatedOf(item);
  const bricks = stage.querySelectorAll(".brick");
  for (const b of bricks) {
    const i = b.dataset.i;
    const it = i === undefined ? null : layout.items[+i];
    b.classList.toggle("rel", !!it && nodesSet.has(it));
    b.classList.toggle("sel", b === el);
  }
  /* ghosts carry no data-i; relate them through their parent item */
  for (const b of stage.querySelectorAll(".brick.ghost")) b.classList.remove("rel");
  svg.querySelectorAll(".e").forEach(p => p.classList.toggle("rel", edgeSet.has(+p.dataset.e)));

  stage.classList.add("focus");
  stage.style.transformOrigin = item.pcx + "px " + item.cy + "px";
  stage.style.transform = "scale(.84)";
  showTipAtItem(item);
}

function unfocus() {
  focused = null;
  stage.classList.remove("focus");
  stage.style.transform = "";
  for (const b of stage.querySelectorAll(".brick")) b.classList.remove("rel", "sel");
  svg.querySelectorAll(".e").forEach(p => p.classList.remove("rel"));
  hideTip();
}

let tipTimer = null;
function hideTip() { tipEl.classList.remove("show"); tipEl.classList.remove("premium"); }

function showTipAt(el, text, premium, autohide) {
  const r = el.getBoundingClientRect();
  tipEl.textContent = text;
  tipEl.classList.toggle("premium", !!premium);
  tipEl.style.left = (r.left + r.width / 2) + "px";
  tipEl.style.top = (r.top - 8) + "px";
  tipEl.classList.add("show");
  tipEl.dataset.action = premium ? "" : "info";
  clearTimeout(tipTimer);
  if (autohide) tipTimer = setTimeout(hideTip, autohide);
}

function showTipAtItem(item) {
  const sr = scroller.getBoundingClientRect();
  const z = .84;
  const originY = item.cy;
  const topInStage = originY + (item.y - originY) * z;
  const x = sr.left + item.pcx;
  const y = sr.top - scroller.scrollTop + topInStage - 8;
  tipEl.textContent = "More info";
  tipEl.classList.remove("premium");
  tipEl.style.left = x + "px";
  tipEl.style.top = Math.max(sr.top + 16, y) + "px";
  tipEl.dataset.action = "info";
  tipEl.classList.add("show");
  clearTimeout(tipTimer);
}

stage.addEventListener("click", e => {
  if (dragAxis === "x") return;
  const b = e.target.closest(".brick[data-i]");
  if (!b) { if (focused) unfocus(); return; }
  const it = layout.items[+b.dataset.i];
  if (focused === it) { unfocus(); return; }
  focusItem(it, b);
});

tipEl.addEventListener("click", () => {
  if (tipEl.dataset.action !== "info" || !focused) return;
  openSheet(focused.node);
});

/* --------------------------------------------------------------- overlay */

const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip.",
  "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
  "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt.",
];
function loremFor(tech) {
  let h = 2166136261;
  for (let i = 0; i < tech.length; i++) { h ^= tech.charCodeAt(i); h = Math.imul(h, 16777619); }
  return LOREM[Math.abs(h) % LOREM.length];
}

function openSheet(n) {
  document.getElementById("sheetName").textContent = n.name;
  const raw = n.dec || "";
  const dec = DECADE_LABEL[raw] || raw;
  let meta = dec ? '<span class="chip">' + esc(dec) + "</span>" : "";
  const flags = flagAssets(n.country);
  if (flags.length) {
    meta += '<span class="chip">'
      + flags.map(f => '<img src="' + f[0] + '" alt="' + esc(f[1]) + '" title="' + esc(f[1]) + '">').join("")
      + "</span>";
  }
  meta += '<span class="chip">' + esc(areaDisplay[n.area] || n.area) + "</span>";
  document.getElementById("sheetMeta").innerHTML = meta;
  document.getElementById("sheetDesc").textContent = loremFor(n.tech);
  scrimEl.classList.add("show");
  hideTip();
}
function closeSheet() { scrimEl.classList.remove("show"); if (focused) showTipAtItem(focused); }
document.getElementById("sheetClose").addEventListener("click", closeSheet);
scrimEl.addEventListener("click", e => { if (e.target === scrimEl) closeSheet(); });

/* ------------------------------------------------------- fades + scroll hint */

function updateFades() {
  const st = scroller.scrollTop;
  const max = scroller.scrollHeight - scroller.clientHeight;
  fadeTop.style.opacity = st > 8 ? "1" : "0";
  fadeBottom.style.opacity = max - st > 8 ? "1" : "0";
}

function showHint() {
  clearTimeout(hintTimer);
  hintEl.classList.remove("show");
  const max = scroller.scrollHeight - scroller.clientHeight;
  if (max < 40) return;
  hintTimer = setTimeout(() => {
    hintEl.classList.add("show");
    hintTimer = setTimeout(() => hintEl.classList.remove("show"), 2600);
  }, 320);
}

scroller.addEventListener("scroll", () => {
  updateFades();
  if (scroller.scrollTop > 12 && hintEl.classList.contains("show")) {
    clearTimeout(hintTimer);
    hintEl.classList.remove("show");
  }
  if (focused) showTipAtItem(focused);
}, { passive: true });

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { clearStage(); render(order[curAreaIdx], curLevel); }, 180);
});

/* ------------------------------------------------------------------- boot */

setLevel(curLevel);
setArea(0, 0);
const loading = document.getElementById("loading");
requestAnimationFrame(() => requestAnimationFrame(() => {
  loading.classList.add("done");
  setTimeout(() => loading.remove(), 450);
}));

window.__genreMap = {
  get layout() { return layout; },
  get order() { return order; },
  setArea, setLevel, focusItem, openSheet,
  get level() { return curLevel; },
};
}));
