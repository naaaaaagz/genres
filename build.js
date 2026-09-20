/* Builds both pages from src/.

     index.html      mobile page  = src/mobile-shell.html + rows + src/common.js + src/mobile.js
     index_old.html  radial page  = src/shell.html        + rows + src/common.js + src/layout.js

   Neither output should ever be hand-edited; run `node build.js` instead. */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = p => fs.readFileSync(path.join(root, p), "utf8").trimEnd();

/* Rows come from the GENRES sheet (columns A Nr., B Name, C Nametech, D HIDE,
   E Area, F Secondary Area, G Importance, H Parent, I Parent secondary,
   J Parent tertiary, K No Parent, L External Parent, M Decade, N Country)
   via genres-data.json. Columns O (Custom for desc.), P (Desc. EN) and
   Q (Claude comment) are intentionally not carried into the site. */
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "genres-data.json"), "utf8"));
const rows = snapshot.values.slice(1)
  .filter(r => (r[1] || "").trim())            // must have a Name
  .filter(r => !(r[3] || "").trim())           // D HIDE: skip flagged rows
  .map(r => [
    r[1].trim(),                               // B Name
    (r[2] || "").trim(),                       // C Nametech (stable ID)
    Math.max(1, Math.min(5, parseInt(r[6], 10) || 1)), // G Importance
    (r[7] || "(none)").trim(),                 // H Parent (Nametech)
    (r[12] || "").trim(),                      // M Decade
    (r[13] || "").trim(),                      // N Country
    (r[4] || "other").trim(),                  // E Area
    (r[5] || "").trim(),                       // F Secondary Area
    (r[8] || "").trim(),                       // I Parent secondary (Nametech)
    (r[9] || "").trim(),                       // J Parent tertiary (Nametech)
    (r[10] || "").trim().toLowerCase() === "x", // K No Parent flag
    (r[11] || "").trim().toLowerCase() === "x", // L External Parent flag
  ]);

const common = read("src/common.js");
const data = "const rows=" + JSON.stringify(rows) + ";";

function assemble(shellPath, codePath, outPath) {
  const out = [
    read(shellPath),
    "<script>",
    data,
    common,
    read(codePath),
    "</" + "script>",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(root, outPath), out);
  console.log(outPath + " written:", out.length, "bytes");
}

assemble("src/mobile-shell.html", "src/mobile.js", "index.html");
assemble("src/shell.html", "src/layout.js", "index_old.html");
console.log("rows:", rows.length);
