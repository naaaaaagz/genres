const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const b = await chromium.launch();
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

    const hover = el => el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    const leave = el => el.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body }));

    const deep = find("Sigilkore");
    hover(deep);
    out.deepChainCards = stage.querySelectorAll(".node.chain-highlight").length;
    out.deepChainEdges = stage.querySelectorAll(".edge.chain-highlight").length;
    out.dimApplied = stage.classList.contains("chain-hover");
    leave(deep);
    out.afterLeave = stage.querySelectorAll(".chain-highlight").length;

    const root = find("Folk Music");
    hover(root);
    out.rootChainCards = stage.querySelectorAll(".node.chain-highlight").length;
    out.rootChainEdges = stage.querySelectorAll(".edge.chain-highlight").length;
    leave(root);

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
