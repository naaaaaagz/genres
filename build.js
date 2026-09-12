/* Assembles index.html from src/shell.html + the GENRES rows + src/layout.js.
   Keeping the data injection here means the layout source stays readable. */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const shell = fs.readFileSync(path.join(root, "src/shell.html"), "utf8").trimEnd();
const code = fs.readFileSync(path.join(root, "src/layout.js"), "utf8").trimEnd();

/* Rows come from the GENRES sheet (columns B,C,G,H,J,L,E,F) via genres-data.json.
   Verified identical to the live sheet before this build. */
const snapshot = JSON.parse(fs.readFileSync(path.join(root, "genres-data.json"), "utf8"));
const rows = snapshot.values.slice(1)
  .filter(r => (r[1] || "").trim())
  .map(r => [
    r[1].trim(),                              // B Name
    (r[2] || "").trim(),                      // C Nametech (stable ID)
    Math.max(1, Math.min(5, parseInt(r[6], 10) || 1)), // G Importance
    (r[7] || "(none)").trim(),                // H Parent (Nametech)
    (r[9] || "").trim(),                      // J Decade
    (r[11] || "").trim(),                     // L Country
    (r[4] || "other").trim(),                 // E Area
    (r[5] || "").trim(),                      // F Secondary Area
  ]);

const out = [
  shell,
  "<script>",
  "const rows=" + JSON.stringify(rows) + ";",
  code,
  "</" + "script>",
  "",
].join("\n");

fs.writeFileSync(path.join(root, "index.html"), out);
console.log("index.html written:", out.length, "bytes,", rows.length, "rows");
