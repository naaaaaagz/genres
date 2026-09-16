const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND/.test(m.text())) errs.push(m.text()); });
  await p.goto("file://" + path.resolve(process.argv[2]));
  await p.waitForFunction(() => document.getElementById("timeline")?.dataset.nodes);

  const r = await p.evaluate(async () => {
    const stage = document.getElementById("timeline");
    const out = { routing: stage.dataset.routing };

    const find = name => [...stage.querySelectorAll(".node")]
      .find(e => e.querySelector(".name").textContent === name);

    const nodes = [...stage.querySelectorAll(".node")], byId = new Map(nodes.map(el => [el.dataset.i, el]));
    const parent = new Map([...stage.querySelectorAll(".edge")].map(edge => [edge.dataset.child, edge.dataset.parent]));
    const depth = id => { let d = 0, p = id; while (parent.has(p) && d < 80) { p = parent.get(p); d++; } return d; };
    const hover = el => el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
    const leave = () => document.getElementById("viewport").dispatchEvent(new PointerEvent("pointerleave"));

    const deep = nodes.sort((a, b) => depth(b.dataset.i) - depth(a.dataset.i))[0];
    hover(deep);
    out.deepChainCards = stage.querySelectorAll(".node.chain-highlight").length;
    out.deepChainEdges = stage.querySelectorAll(".edge.chain-highlight").length;
    out.dimApplied = stage.classList.contains("chain-hover");
    leave();
    out.afterLeave = stage.querySelectorAll(".chain-highlight").length;

    const root = nodes.find(el => !parent.has(el.dataset.i));
    hover(root);
    out.rootChainCards = stage.querySelectorAll(".node.chain-highlight").length;
    out.rootChainEdges = stage.querySelectorAll(".edge.chain-highlight").length;
    leave();

    // zoom + pan
    const before = stage.style.transform;
    document.getElementById("viewport").dispatchEvent(
      new WheelEvent("wheel", { deltaY: -600, clientX: 700, clientY: 450, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 450));
    out.zoomChanged = stage.style.transform !== before;
    out.transform = stage.style.transform.slice(0, 60);
    return out;
  });

  console.log(JSON.stringify({ ...r, pageErrors: errs }, null, 1));
  await b.close();
})();
