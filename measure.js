// Measurement harness: loads a genres page in Chromium and reports layout quality metrics.
const { chromium } = require("playwright");
const path = require("path");

const file = process.argv[2];
const shot = process.argv[3];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  page.on("pageerror", e => errors.push("pageerror: " + e.message));

  const t0 = Date.now();
  await page.goto("file://" + path.resolve(file), { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("timeline")?.dataset.nodes, null, { timeout: 120000 });
  const loadMs = Date.now() - t0;

  const m = await page.evaluate(() => {
    const root = document.getElementById("timeline");
    const worldW = parseFloat(root.style.width), worldH = parseFloat(root.style.height);
    const cx = worldW / 2, cy = worldH / 2;

    const nodes = [...root.querySelectorAll(".node")].map(el => ({
      x: parseFloat(el.style.left), y: parseFloat(el.style.top),
      w: el.offsetWidth, h: el.offsetHeight,
    }));
    for (const n of nodes) { n.mx = n.x + n.w / 2; n.my = n.y + n.h / 2; n.r = Math.hypot(n.mx - cx, n.my - cy); }

    // --- ink density in radial shells ---
    const maxR = Math.max(...nodes.map(n => n.r + Math.hypot(n.w, n.h) / 2));
    const SH = 24, shell = new Array(SH).fill(0);
    for (const n of nodes) shell[Math.min(SH - 1, Math.floor(n.r / maxR * SH))] += n.w * n.h;
    const shells = shell.map((a, i) => {
      const r0 = maxR * i / SH, r1 = maxR * (i + 1) / SH;
      const ring = Math.PI * (r1 * r1 - r0 * r0);
      return { i, r0: Math.round(r0), r1: Math.round(r1), fill: +(a / ring * 100).toFixed(2) };
    });

    // --- innermost occupied radius (the void) ---
    const innerVoid = Math.min(...nodes.map(n => n.r - Math.hypot(n.w, n.h) / 2));

    // --- total card ink vs bounding disc ---
    const ink = nodes.reduce((s, n) => s + n.w * n.h, 0);
    const disc = Math.PI * maxR * maxR;

    // --- radial-ness of lineage edges ---
    // For each edge, compare the parent->child chord against the pure-radial direction at the parent.
    const idx = new Map();
    [...root.querySelectorAll(".node")].forEach(el => idx.set(el.dataset.i, el));
    const devs = [];
    for (const p of root.querySelectorAll(".edge")) {
      const a = idx.get(p.dataset.parent), b = idx.get(p.dataset.child);
      if (!a || !b) continue;
      const ax = parseFloat(a.style.left) + a.offsetWidth / 2, ay = parseFloat(a.style.top) + a.offsetHeight / 2;
      const bx = parseFloat(b.style.left) + b.offsetWidth / 2, by = parseFloat(b.style.top) + b.offsetHeight / 2;
      const pa = Math.atan2(ay - cy, ax - cx), ca = Math.atan2(by - cy, bx - cx);
      let d = Math.abs(ca - pa); if (d > Math.PI) d = 2 * Math.PI - d;
      devs.push(d * 180 / Math.PI);
    }
    devs.sort((u, v) => u - v);
    const q = f => +devs[Math.floor((devs.length - 1) * f)].toFixed(2);

    // How outward does each edge actually run? 0deg = straight out from the
    // centre, 90deg = purely sideways. This is what "radial" looks like.
    const lean = [];
    for (const p of root.querySelectorAll(".edge")) {
      const a = idx.get(p.dataset.parent), b = idx.get(p.dataset.child);
      if (!a || !b) continue;
      const ax = parseFloat(a.style.left) + a.offsetWidth / 2, ay = parseFloat(a.style.top) + a.offsetHeight / 2;
      const bx = parseFloat(b.style.left) + b.offsetWidth / 2, by = parseFloat(b.style.top) + b.offsetHeight / 2;
      const mx = (ax + bx) / 2 - cx, my = (ay + by) / 2 - cy;
      const rl = Math.hypot(mx, my) || 1;
      const ex = bx - ax, ey = by - ay;
      const el = Math.hypot(ex, ey) || 1;
      const cosA = Math.abs((mx / rl) * (ex / el) + (my / rl) * (ey / el));
      lean.push(Math.acos(Math.min(1, cosA)) * 180 / Math.PI);
    }
    lean.sort((u, v) => u - v);
    const lq = f => +lean[Math.floor((lean.length - 1) * f)].toFixed(2);

    // --- path length vs straight-line distance (routing detour cost) ---
    let detour = [];
    for (const p of root.querySelectorAll(".edge")) {
      try {
        const L = p.getTotalLength();
        const s = p.getPointAtLength(0), e = p.getPointAtLength(L);
        const straight = Math.hypot(e.x - s.x, e.y - s.y);
        if (straight > 1) detour.push(L / straight);
      } catch (_) {}
    }
    detour.sort((u, v) => u - v);

    return {
      worldW: Math.round(worldW), worldH: Math.round(worldH), maxR: Math.round(maxR),
      nodes: nodes.length,
      edges: root.querySelectorAll(".edge").length,
      routeFailures: root.dataset.routeFailures,
      innerVoidRadius: Math.round(innerVoid),
      voidShareOfRadius: +(innerVoid / maxR * 100).toFixed(1),
      inkDensityPct: +(ink / disc * 100).toFixed(2),
      angularDeviationDeg: { p50: q(.5), p75: q(.75), p90: q(.9), p99: q(.99), mean: +(devs.reduce((a, b) => a + b, 0) / devs.length).toFixed(2) },
      edgeLeanDeg: { p50: lq(.5), p75: lq(.75), p90: lq(.9), mean: +(lean.reduce((a, b) => a + b, 0) / lean.length).toFixed(2) },
      outwardPct: +(lean.filter(v => v < 45).length / lean.length * 100).toFixed(1),
      detourRatio: { p50: +detour[Math.floor(detour.length * .5)].toFixed(3), p90: +detour[Math.floor(detour.length * .9)].toFixed(3), max: +detour.at(-1).toFixed(3) },
      shells,
    };
  });

  // --- geometric correctness: card overlaps ---
  const overlaps = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".node")];
    const boxes = els.map(el => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight, n: el.querySelector(".name").textContent }));
    const cell = 200, grid = new Map();
    const key = (gx, gy) => gx + ":" + gy;
    boxes.forEach((b, i) => {
      for (let gx = Math.floor(b.x / cell); gx <= Math.floor((b.x + b.w) / cell); gx++)
        for (let gy = Math.floor(b.y / cell); gy <= Math.floor((b.y + b.h) / cell); gy++) {
          const k = key(gx, gy); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
        }
    });
    const seen = new Set(), hits = [];
    for (const list of grid.values())
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        const i = list[a], j = list[b], k = i + "," + j;
        if (seen.has(k)) continue; seen.add(k);
        const p = boxes[i], q = boxes[j];
        if (p.x < q.x + q.w && p.x + p.w > q.x && p.y < q.y + q.h && p.y + p.h > q.y) hits.push(p.n + " / " + q.n);
      }
    return hits;
  });

  if (shot) {
    await page.screenshot({ path: shot, fullPage: false });
  }
  console.log(JSON.stringify({ loadMs, ...m, cardOverlaps: overlaps.length, overlapSample: overlaps.slice(0, 5), consoleIssues: errors.slice(0, 8) }, null, 2));
  await browser.close();
})();
