const fs = require('fs');

const inputXml = fs.readFileSync('current-drive-v3.drawio', 'utf8');
const csvText = fs.readFileSync('genres-current-v3.csv', 'utf8');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

const raw = parseCsv(csvText);
const headers = raw[0];
const ix = Object.fromEntries(headers.map((h, i) => [h.trim().toLowerCase(), i]));
const pick = (r, name) => r[ix[name]] ?? '';

const genres = raw.slice(1).filter(r => pick(r, 'name').trim()).map((r, i) => ({
  row: i + 2,
  name: pick(r, 'name').trim(),
  tech: pick(r, 'nametech').trim(),
  area: (pick(r, 'area').trim() || 'misc').toLowerCase(),
  importance: Math.max(1, Math.min(5, Number(pick(r, 'importance')) || 1)),
  parent: pick(r, 'parent').trim(),
  decade: pick(r, 'decade').trim().toLowerCase(),
  year: pick(r, 'year').trim(),
}));

const nameMap = new Map(genres.map(g => [g.name.toLowerCase(), g]));
const duplicateNames = genres.filter((g, i) => genres.findIndex(x => x.name.toLowerCase() === g.name.toLowerCase()) !== i);
if (duplicateNames.length) throw new Error(`Duplicate names: ${duplicateNames.map(x => x.name).join(', ')}`);
const missingParents = genres.filter(g => g.parent && !/^\(?none\)?$/i.test(g.parent) && !nameMap.has(g.parent.toLowerCase()));
if (missingParents.length) throw new Error(`Missing parents: ${missingParents.map(x => `${x.name} <- ${x.parent}`).join(', ')}`);

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function decadeKey(s) {
  if (!s || /traditional|undated|unknown|ancient/i.test(s)) return -100000;
  const m = s.match(/(\d{3,4})s/);
  return m ? Number(m[1]) : -100000;
}
function decadeLabel(s) {
  return decadeKey(s) === -100000 ? 'Ancient' : s;
}
function phase(g) {
  const y = g.year.toLowerCase();
  if (/early|beginning|c\.\s*\d{3,4}[0-3]\b/.test(y)) return 'early';
  if (/late|end of/.test(y)) return 'late';
  if (/mid/.test(y)) return 'mid';
  const years = [...y.matchAll(/\b(\d{4})\b/g)].map(m => Number(m[1]));
  if (years.length && decadeKey(g.decade) >= 1000) {
    const avg = years.reduce((a, b) => a + b, 0) / years.length;
    const digit = avg % 10;
    if (digit <= 3) return 'early';
    if (digit >= 7) return 'late';
    return 'mid';
  }
  return 'mid';
}

const sizeByImportance = {
  1: { w: 210, h: 72, fs: 20, sw: 1.8, opacity: 80 },
  2: { w: 255, h: 86, fs: 23, sw: 2.3, opacity: 86 },
  3: { w: 310, h: 102, fs: 27, sw: 3.0, opacity: 92 },
  4: { w: 370, h: 124, fs: 31, sw: 3.8, opacity: 97 },
  5: { w: 450, h: 152, fs: 36, sw: 5.0, opacity: 100 },
};
for (const g of genres) {
  const base = sizeByImportance[g.importance];
  const textWidth = Math.min(620, Math.max(base.w, 76 + g.name.length * (base.fs * 0.60)));
  g.w = Math.round(textWidth);
  g.h = base.h + (g.name.length > 28 ? 24 : 0);
  g.fs = base.fs; g.sw = base.sw; g.opacity = base.opacity;
  g.phase = phase(g);
}

const preferredAreas = ['classical','folk','jazz','soulful','jamaican','latin','african','rock','metal','pop','hiphop','breakbeat','dnb','dubstep','hardcore','house','techno','trance','psy','edm','downtempo','ambient','experimental','noise','industrial','chiptune'];
const areaSet = new Set(genres.map(g => g.area));
const areas = preferredAreas.filter(a => areaSet.has(a)).concat([...areaSet].filter(a => !preferredAreas.includes(a)).sort());
const palette = ['#465A8B','#7A5C3E','#315C78','#7C4B70','#734D91','#A04B4B','#5D6B37','#5A6078','#6A4343','#88527A','#4D6689','#7C5837','#36647A','#5B4E86','#7A3E55','#3E6B67','#4F5E87','#694F86','#6D4773','#3A6679','#5F6840','#4C6372','#675171','#75504A','#65465F','#4B6680'];
const areaColor = new Map(areas.map((a, i) => [a, palette[i % palette.length]]));

const decades = [...new Set(genres.map(g => decadeKey(g.decade) === -100000 ? 'ancient' : g.decade))]
  .sort((a, b) => decadeKey(a) - decadeKey(b));
const phases = ['early','mid','late'];
const MAX_NODES_PER_ROW = 2;
const NODE_GAP = 34;
const group = new Map();
for (const g of genres) {
  const d = decadeKey(g.decade) === -100000 ? 'ancient' : g.decade;
  const k = `${d}|${g.phase}|${g.area}`;
  if (!group.has(k)) group.set(k, []);
  group.get(k).push(g);
}
for (const arr of group.values()) arr.sort((a,b) => b.importance - a.importance || a.name.localeCompare(b.name));

const phaseWidths = new Map();
for (const d of decades) {
  for (const p of phases) {
    let widest = 0, has = false;
    for (const a of areas) {
      const arr = group.get(`${d}|${p}|${a}`) || [];
      if (!arr.length) continue;
      has = true;
      for (let start = 0; start < arr.length; start += MAX_NODES_PER_ROW) {
        const row = arr.slice(start, start + MAX_NODES_PER_ROW);
        const width = row.reduce((sum, g) => sum + g.w, 0) + Math.max(0, row.length - 1) * NODE_GAP;
        widest = Math.max(widest, width);
      }
    }
    phaseWidths.set(`${d}|${p}`, has ? Math.max(190, widest + 90) : 18);
  }
}

const LEFT = 260, TOP = 190, DECADE_GAP = 46;
const decadeGeom = new Map();
let xCursor = LEFT;
for (const d of decades) {
  const px = {};
  const start = xCursor;
  for (const p of phases) { px[p] = xCursor; xCursor += phaseWidths.get(`${d}|${p}`); }
  const end = xCursor;
  decadeGeom.set(d, { start, end, width: end - start, px });
  xCursor += DECADE_GAP;
}
const WIDTH = Math.ceil(xCursor + 160);

const areaGeom = new Map();
let yCursor = TOP;
for (const a of areas) {
  const maxH = Math.max(...genres.filter(g => g.area === a).map(g => g.h));
  let maxRows = 1;
  for (const d of decades) for (const p of phases) {
    maxRows = Math.max(maxRows, Math.ceil((group.get(`${d}|${p}|${a}`) || []).length / MAX_NODES_PER_ROW));
  }
  const rowPitch = maxH + 78;
  const height = 105 + (maxRows - 1) * rowPitch + maxH + 48;
  areaGeom.set(a, { top: yCursor, rail: yCursor + 72, nodeY: yCursor + 100, height, maxH, maxRows, rowPitch });
  yCursor += height + 26;
}
const HEIGHT = Math.ceil(yCursor + 100);

for (const d of decades) {
  const dg = decadeGeom.get(d);
  for (const p of phases) {
    const pw = phaseWidths.get(`${d}|${p}`);
    for (const a of areas) {
      const arr = group.get(`${d}|${p}|${a}`) || [];
      if (!arr.length) continue;
      const ag = areaGeom.get(a);
      for (let start = 0, rowIndex = 0; start < arr.length; start += MAX_NODES_PER_ROW, rowIndex++) {
        const row = arr.slice(start, start + MAX_NODES_PER_ROW);
        const total = row.reduce((sum, g) => sum + g.w, 0) + (row.length - 1) * NODE_GAP;
        let x = dg.px[p] + (pw - total) / 2;
        for (const g of row) {
          g.nodeRow = rowIndex;
          g.rail = ag.top + 72 + rowIndex * ag.rowPitch;
          g.x = Math.round(x); g.y = Math.round(ag.nodeY + rowIndex * ag.rowPitch + (ag.maxH - g.h) / 2);
          g.cx = g.x + g.w / 2; g.cy = g.y + g.h / 2;
          g.decadeNorm = d;
          x += g.w + NODE_GAP;
        }
      }
    }
  }
}

const cells = [];
cells.push('<mxCell id="0"/>', '<mxCell id="1" parent="0"/>');
cells.push(`<mxCell id="bg" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#11141B;strokeColor=none;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${WIDTH}" height="${HEIGHT}" as="geometry"/></mxCell>`);
cells.push(`<mxCell id="title" value="MUSIC GENRES — LINEAGE TIMELINE V2" style="text;html=1;align=left;verticalAlign=middle;fontColor=#F3F6FA;fontSize=40;fontStyle=1;spacingLeft=12;" vertex="1" parent="1"><mxGeometry x="24" y="18" width="1100" height="62" as="geometry"/></mxCell>`);
cells.push(`<mxCell id="subtitle" value="Parent → child • horizontal position shows early / mid / late • stacked rows reduce horizontal stretch while dedicated rails keep arrows clear" style="text;html=1;align=left;verticalAlign=middle;fontColor=#BFC8D8;fontSize=22;spacingLeft=12;" vertex="1" parent="1"><mxGeometry x="24" y="82" width="1900" height="38" as="geometry"/></mxCell>`);

let legendX = 28;
for (let imp = 1; imp <= 5; imp++) {
  const s = sizeByImportance[imp];
  const w = 54 + imp * 15, h = 26 + imp * 4;
  cells.push(`<mxCell id="legend_${imp}" value="${imp}" style="rounded=1;arcSize=28;whiteSpace=wrap;html=1;fillColor=#5A6D94;strokeColor=#D9E3F3;strokeWidth=${s.sw};fontColor=#FFFFFF;fontSize=${11+imp*2};fontStyle=${imp>=4?1:0};" vertex="1" parent="1"><mxGeometry x="${legendX}" y="124" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  legendX += w + 14;
}

decades.forEach((d, i) => {
  const dg = decadeGeom.get(d);
  const fill = i % 2 ? '#151A23' : '#1A202B';
  cells.push(`<mxCell id="decade_bg_${i}" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=#394052;strokeWidth=1;opacity=82;" vertex="1" parent="1"><mxGeometry x="${dg.start}" y="${TOP-60}" width="${dg.width}" height="${HEIGHT-TOP+70}" as="geometry"/></mxCell>`);
  cells.push(`<mxCell id="decade_${i}" value="${esc(decadeLabel(d))}" style="rounded=1;arcSize=24;whiteSpace=wrap;html=1;fillColor=#252C3A;strokeColor=#71809A;strokeWidth=2;fontColor=#FFFFFF;fontSize=22;fontStyle=1;" vertex="1" parent="1"><mxGeometry x="${dg.start+8}" y="${TOP-54}" width="${Math.max(120,dg.width-16)}" height="42" as="geometry"/></mxCell>`);
  for (const p of phases) {
    const pw = phaseWidths.get(`${d}|${p}`);
    if (pw < 50 || d === 'ancient') continue;
    const label = p === 'general' ? 'era-wide' : p;
    cells.push(`<mxCell id="phase_${i}_${p}" value="${label}" style="text;html=1;align=center;verticalAlign=middle;fontColor=#AEB8C9;fontSize=16;fontStyle=2;" vertex="1" parent="1"><mxGeometry x="${dg.px[p]}" y="${TOP-10}" width="${pw}" height="26" as="geometry"/></mxCell>`);
  }
});

areas.forEach((a, ai) => {
  const ag = areaGeom.get(a);
  const members = genres.filter(g => g.area === a);
  const first = members.reduce((m,g)=>Math.min(m,decades.indexOf(g.decadeNorm)),Infinity);
  const last = members.reduce((m,g)=>Math.max(m,decades.indexOf(g.decadeNorm)),-Infinity);
  const x1 = decadeGeom.get(decades[first]).start + 5;
  const x2 = decadeGeom.get(decades[last]).end - 5;
  const color = areaColor.get(a);
  cells.push(`<mxCell id="area_bg_${ai}" value="" style="rounded=1;arcSize=24;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=${color};strokeWidth=3;opacity=24;" vertex="1" parent="1"><mxGeometry x="${x1}" y="${ag.top}" width="${x2-x1}" height="${ag.height}" as="geometry"/></mxCell>`);
  cells.push(`<mxCell id="area_title_${ai}" value="${esc(a.toUpperCase())}" style="rounded=1;arcSize=30;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=#E7ECF5;strokeWidth=2;fontColor=#FFFFFF;fontSize=22;fontStyle=1;spacingLeft=12;align=left;" vertex="1" parent="1"><mxGeometry x="${x1+10}" y="${ag.top+10}" width="${Math.max(170,42+a.length*14)}" height="46" as="geometry"/></mxCell>`);
  for (let ri = 0; ri < ag.maxRows; ri++) {
    const railY = ag.top + 72 + ri * ag.rowPitch;
    cells.push(`<mxCell id="area_rail_${ai}_${ri}" value="" style="shape=line;strokeColor=${color};strokeWidth=1;dashed=1;opacity=45;" vertex="1" parent="1"><mxGeometry x="${x1+12}" y="${railY}" width="${Math.max(20,x2-x1-24)}" height="1" as="geometry"/></mxCell>`);
  }
});

genres.forEach((g, i) => { g.id = `genre_${i+1}`; });

let edgeId = 1;
const edgeRoutes = [];
for (const child of genres) {
  if (!child.parent || /^\(?none\)?$/i.test(child.parent)) continue;
  const parent = nameMap.get(child.parent.toLowerCase());
  if (!parent) continue;
  const sourceRail = parent.rail;
  const targetRail = child.rail;
  const sDec = decadeGeom.get(parent.decadeNorm);
  const tDec = decadeGeom.get(child.decadeNorm);
  let pts = [{x:parent.cx,y:sourceRail}];
  if (parent.area !== child.area || parent.nodeRow !== child.nodeRow) {
    let corridor;
    if (decades.indexOf(child.decadeNorm) > decades.indexOf(parent.decadeNorm)) corridor = tDec.start - DECADE_GAP/2;
    else if (decades.indexOf(child.decadeNorm) < decades.indexOf(parent.decadeNorm)) corridor = sDec.start - DECADE_GAP/2;
    else corridor = tDec.end + DECADE_GAP/2;
    pts.push({x:corridor,y:sourceRail},{x:corridor,y:targetRail});
  }
  pts.push({x:child.cx,y:targetRail});
  edgeRoutes.push({ source: parent, target: child, points: [{x:parent.cx,y:parent.y}, ...pts, {x:child.cx,y:child.y}] });
  const pointXml = pts.map(p=>`<mxPoint x="${Math.round(p.x)}" y="${Math.round(p.y)}"/>`).join('');
  const stroke = areaColor.get(child.area);
  const sw = (1.0 + child.importance * 0.28).toFixed(2);
  cells.push(`<mxCell id="edge_${edgeId++}" value="" style="edgeStyle=segmentEdgeStyle;rounded=1;html=1;strokeColor=${stroke};strokeWidth=${sw};opacity=50;endArrow=block;endFill=1;endSize=8;exitX=0.5;exitY=0;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" edge="1" parent="1" source="${parent.id}" target="${child.id}"><mxGeometry relative="1" as="geometry"><Array as="points">${pointXml}</Array></mxGeometry></mxCell>`);
}

for (const g of genres) {
  const color = areaColor.get(g.area);
  const fontStyle = g.importance >= 4 ? 1 : 0;
  const shadow = g.importance === 5 ? 1 : 0;
  const label = `${esc(g.name)}${g.importance===5?' ★':''}`;
  cells.push(`<mxCell id="${g.id}" value="${label}" style="rounded=1;arcSize=24;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=#F1F4F9;strokeWidth=${g.sw};opacity=${g.opacity};fontColor=#FFFFFF;fontSize=${g.fs};fontStyle=${fontStyle};shadow=${shadow};spacing=12;align=center;verticalAlign=middle;fontFamily=Arial;" vertex="1" parent="1"><mxGeometry x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" as="geometry"/></mxCell>`);
}

const model = `<mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" pageScale="1" pageWidth="1169" pageHeight="827" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel>`;
const newPage = `<diagram id="LhVVGY1v8OEgOIba_3En" name="Genres timeline v2">${model}</diagram>`;

const pageRe = /<diagram\b[^>]*name="Genres timeline v2"[^>]*>[\s\S]*?<\/diagram>/;
if (!pageRe.test(inputXml)) throw new Error('Genres timeline v2 page not found');
const outputXml = inputXml.replace(pageRe, newPage);
fs.writeFileSync('genres-timeline-v3.drawio', outputXml, 'utf8');

function segmentHitsRect(a, b, r) {
  const eps = 2;
  if (a.x === b.x) {
    const lo = Math.min(a.y,b.y), hi = Math.max(a.y,b.y);
    return a.x > r.x+eps && a.x < r.x+r.w-eps && hi > r.y+eps && lo < r.y+r.h-eps;
  }
  if (a.y === b.y) {
    const lo = Math.min(a.x,b.x), hi = Math.max(a.x,b.x);
    return a.y > r.y+eps && a.y < r.y+r.h-eps && hi > r.x+eps && lo < r.x+r.w-eps;
  }
  return true;
}
let edgeNodeCrossings = 0;
for (const route of edgeRoutes) {
  for (let i=0;i<route.points.length-1;i++) {
    for (const g of genres) {
      if (g === route.source || g === route.target) continue;
      if (segmentHitsRect(route.points[i], route.points[i+1], g)) edgeNodeCrossings++;
    }
  }
}

const stats = {
  genres: genres.length,
  relations: edgeId - 1,
  areas: areas.length,
  decades: decades.length,
  width: WIDTH,
  height: HEIGHT,
  maxNodesPerRow: MAX_NODES_PER_ROW,
  minimumGenreFont: Math.min(...genres.map(g=>g.fs)),
  maximumGenreFont: Math.max(...genres.map(g=>g.fs)),
  edgeNodeCrossings,
  page1Preserved: /<diagram\b[^>]*name="Genres timeline"[^>]*>[\s\S]*?<\/diagram>/.exec(inputXml)?.[0] === /<diagram\b[^>]*name="Genres timeline"[^>]*>[\s\S]*?<\/diagram>/.exec(outputXml)?.[0],
  traditionalRemaining: genres.filter(g => /traditional|undated|unknown/i.test(g.decade)).map(g => g.name),
  deepTranceParent: nameMap.get('deep trance')?.parent,
  deathNRollParent: nameMap.get("death 'n' roll")?.parent,
  droneParent: nameMap.get('drone')?.parent,
  symphonicMetalParent: nameMap.get('symphonic metal')?.parent,
};
fs.writeFileSync('timeline-v2-stats.json', JSON.stringify(stats, null, 2), 'utf8');
console.log(JSON.stringify(stats, null, 2));
