// Builds searchv2-exam.pptx. Run:  NODE_PATH=<dir with pptxgenjs>/node_modules node build-deck.js
// (npm install pptxgenjs somewhere first; PPTX_SKILL_DIR points at the pptx skill that provides apply_theme.js)
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');

const SKILL = process.env.PPTX_SKILL_DIR;
const { applyTheme } = require(path.join(SKILL, 'scripts/apply_theme.js'));

const SHOT = path.join(__dirname, 'screenshots') + '/';
const TERM = path.join(__dirname, 'terminal') + '/';
const UML = path.join(__dirname, '..', 'uml') + '/';
const OUT = path.join(__dirname, 'searchv2-exam.pptx');

// ---------- theme ----------
const THEME = {
  name: 'SearchV2 Exam',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '13222D', lt1: 'FFFFFF', dk2: '1E3B4C', lt2: 'EDF1F3',
    accent1: '178FA3', accent2: 'F2A93B', accent3: '4D7EA8',
    accent4: '3E9E78', accent5: 'D4574E', accent6: '8A6BBE',
    hlink: '178FA3', folHlink: '8A6BBE',
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'SearchV2: architecture principles in practice';
pres.author = 'Mikkel Vinther';
pres.subject = 'Exam presentation, Arkitekturprincipper i praksis';
const C = pres.SchemeColor;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: 'TITLE',
  background: { color: HEX.dk1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 1.7, w: 11.7, h: 1.9, fontSize: 48, bold: true, color: C.background1, margin: 0, align: 'left', valign: 'bottom' }, text: '' } },
    { placeholder: { options: { name: 'subtitle', type: 'body', x: 0.8, y: 3.85, w: 11.0, h: 1.1, fontSize: 22, color: C.background2, margin: 0, align: 'left', valign: 'top' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'SECTION',
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.5, w: 11.7, h: 1.4, fontSize: 44, bold: true, color: C.background1, margin: 0, align: 'left', valign: 'bottom' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 4.1, w: 10.5, h: 1.2, fontSize: 20, color: C.background2, margin: 0, align: 'left', valign: 'top' }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'CONTENT',
  background: { color: HEX.lt1 },
  slideNumber: { x: 12.15, y: 7.02, w: 0.6, h: 0.3, fontSize: 10, color: C.text2, align: 'right' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.3, w: 12.1, h: 0.85, fontSize: 30, bold: true, color: C.text1, margin: 0, align: 'left', valign: 'middle' }, text: '' } },
    { text: { text: 'SearchV2 · architecture principles in practice', options: { x: 0.6, y: 7.02, w: 7, h: 0.3, fontSize: 10, color: C.text2, margin: 0 } } },
  ],
});

// ---------- helpers ----------
function pngSize(file) {
  const d = fs.readFileSync(file);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
}

let section = null;
function newSection(title) { section = title; pres.addSection({ title }); }

function content(title, notes) {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  if (notes) s.addNotes(notes);
  return s;
}

function divider(title, body, notes) {
  const s = pres.addSlide({ masterName: 'SECTION', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  s.addText(body, { placeholder: 'body' });
  if (notes) s.addNotes(notes);
  return s;
}

function text(s, str, o) {
  s.addText(str, Object.assign({ isTextBox: true, margin: 0, color: C.text1, fontSize: 16, valign: 'top' }, o));
}

// Bulleted list; items are strings or [boldLead, rest].
function bullets(s, items, o) {
  const runs = [];
  items.forEach((it, i) => {
    const last = i === items.length - 1;
    if (Array.isArray(it)) {
      runs.push({ text: it[0] + ' ', options: { bold: true, bullet: { indent: 18 }, breakLine: false } });
      runs.push({ text: it[1], options: { breakLine: !last } });
    } else {
      runs.push({ text: it, options: { bullet: { indent: 18 }, breakLine: !last } });
    }
  });
  text(s, runs, Object.assign({ fontSize: 16, paraSpaceAfter: 8 }, o));
}

// Picture fitted into a box, centred, on a white frame with a soft shadow.
function pic(s, file, x, y, w, h, o) {
  const { w: iw, h: ih } = pngSize(file);
  const ar = iw / ih;
  let pw = w, ph = w / ar;
  if (ph > h) { ph = h; pw = h * ar; }
  const px = x + (w - pw) / 2, py = y + (h - ph) / 2;
  s.addShape(pres.ShapeType.rect, {
    x: px - 0.05, y: py - 0.05, w: pw + 0.1, h: ph + 0.1,
    fill: { color: C.background1 }, line: { color: 'C9D3D9', width: 0.75 },
    shadow: { type: 'outer', color: '000000', opacity: 0.18, blur: 6, offset: 2, angle: 90 },
    objectName: 'Frame: ' + path.basename(file),
  });
  s.addImage(Object.assign({ path: file, x: px, y: py, w: pw, h: ph, altText: (o && o.alt) || path.basename(file) }, {}));
  return { x: px, y: py, w: pw, h: ph };
}

function caption(s, str, x, y, w) {
  text(s, str, { x, y, w, h: 0.4, fontSize: 12, color: C.text2, italic: true });
}

function card(s, x, y, w, h, title, body, o) {
  o = o || {};
  const accent = o.accent || C.accent1;
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1, fill: { color: o.fill || C.background2 }, line: { color: o.fill || C.background2, width: 0.5 },
    objectName: 'Card: ' + title,
  });
  s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: y + 0.2, w: 0.22, h: 0.22, fill: { color: accent }, line: { color: accent, width: 0.5 }, objectName: 'Dot: ' + title });
  text(s, title, { x: x + 0.55, y: y + 0.14, w: w - 0.75, h: 0.36, fontSize: 16, bold: true, valign: 'middle' });
  text(s, body, { x: x + 0.25, y: y + 0.62, w: w - 0.5, h: h - 0.75, fontSize: o.size || 14, color: C.text1 });
}

function stat(s, x, y, w, value, label, accent, size) {
  text(s, value, { x, y, w, h: 0.9, fontSize: size || 44, bold: true, color: accent || C.accent1, fontFace: THEME.headFontFace, valign: 'bottom' });
  text(s, label, { x, y: y + 0.95, w, h: 0.6, fontSize: 14, color: C.text2 });
}

function chip(s, x, y, w, str, color) {
  s.addText(str, {
    shape: pres.ShapeType.roundRect, rectRadius: 0.16, x, y, w, h: 0.38, isTextBox: true, margin: 0,
    fill: { color }, color: C.background1, fontSize: 13, bold: true, align: 'center', valign: 'middle', objectName: 'Chip: ' + str,
  });
}

function node(s, x, y, w, h, str, o) {
  o = o || {};
  s.addText(str, {
    shape: pres.ShapeType.roundRect, rectRadius: 0.08, x, y, w, h, isTextBox: true, margin: 0.06,
    fill: { color: o.fill || C.background1 }, line: { color: o.line || C.text2, width: o.dashed ? 1 : 1.25, dashType: o.dashed ? 'dash' : 'solid' },
    color: o.color || C.text1, fontSize: o.size || 13, bold: !!o.bold, align: 'center', valign: 'middle',
    objectName: 'Node: ' + String(str).split('\n')[0],
  });
}

function zone(s, x, y, w, h, label, fill) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || C.background2 }, line: { color: 'D3DCE1', width: 0.75 }, objectName: 'Zone: ' + label });
  text(s, label, { x: x + 0.18, y: y + 0.08, w: w - 0.36, h: 0.3, fontSize: 12, bold: true, color: C.text2 });
}

// Arrow from (x1,y1) to (x2,y2); only horizontal or vertical, pointing right or down unless flipped.
function arrow(s, x1, y1, x2, y2, label, o) {
  o = o || {};
  const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
  s.addShape(pres.ShapeType.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w, h, flipH: x2 < x1, flipV: y2 < y1,
    line: { color: o.color || C.text2, width: 1.75, endArrowType: 'triangle', dashType: o.dashed ? 'dash' : 'solid' },
    objectName: 'Arrow' + (label ? ': ' + label : ''),
  });
  if (label) {
    const horizontal = h < w;
    text(s, label, { x: horizontal ? Math.min(x1, x2) - 0.2 : x1 + 0.08, y: horizontal ? y1 - 0.34 : Math.min(y1, y2) + h / 2 - 0.12, w: horizontal ? w + 0.4 : 1.4, h: 0.26, fontSize: 11, color: C.text2, align: horizontal ? 'center' : 'left' });
  }
}

function table(s, header, rows, o) {
  const hdr = header.map(h => ({ text: h, options: { bold: true, color: C.background1, fill: { color: C.text2 }, fontSize: o.fontSize || 13 } }));
  const body = rows.map((r, i) => r.map((c, j) => ({
    text: c,
    options: { fill: { color: i % 2 ? C.background1 : C.background2 }, color: C.text1, fontSize: o.fontSize || 13, bold: j === 0 && !o.noBoldFirst },
  })));
  s.addTable([hdr].concat(body), {
    x: o.x, y: o.y, w: o.w, colW: o.colW, rowH: o.rowH, valign: 'middle', margin: [0.04, 0.1, 0.04, 0.1],
    border: { type: 'solid', color: 'D5DDE2', pt: 0.75 }, autoPage: false,
  });
}

function terminal(s, str, x, y, w, h, size) {
  s.addText(str, {
    shape: pres.ShapeType.roundRect, rectRadius: 0.08, x, y, w, h, isTextBox: true, margin: 0.15, valign: 'top',
    fill: { color: C.text1 }, color: C.background2, fontFace: 'Courier New', fontSize: size || 12, objectName: 'Terminal',
  });
}
const termFile = f => fs.readFileSync(TERM + f, 'utf8').trimEnd();

const chartBase = {
  catAxisLabelColor: '4B5B66', valAxisLabelColor: '4B5B66', catAxisLabelFontSize: 12, valAxisLabelFontSize: 12,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', valGridLine: { color: 'D8E0E5', size: 0.5 }, catGridLine: { style: 'none' },
  dataLabelFontSize: 12, dataLabelFontFace: '+mn-lt', dataLabelColor: '13222D', legendFontSize: 12, legendFontFace: '+mn-lt', legendColor: '4B5B66',
  showTitle: true, titleFontSize: 14, titleColor: '13222D', titleFontFace: '+mn-lt',
};

// ======================================================================
// PART 1: the presentation (5-10 minutes)
// ======================================================================
newSection('Presentation');

// 1 Title
{
  const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: section });
  s.addText('Architecture principles in practice', { placeholder: 'title' });
  s.addText('SearchV2: an internal search engine that scales out, runs on Kubernetes and watches itself', { placeholder: 'subtitle' });
  const chips = [['Scale out', HEX.accent1], ['Stateless', HEX.accent3], ['Asynchronous', HEX.accent6], ['Monitored', HEX.accent4], ['Disabled', HEX.accent2]];
  chips.forEach((c, i) => chip(s, 0.8 + i * 2.2, 5.3, 2.0, c[0], c[1]));
  text(s, 'Exam presentation · Arkitekturprincipper i praksis · autumn 2026 · Mikkel Vinther', { x: 0.8, y: 6.55, w: 11, h: 0.4, fontSize: 14, color: C.background2 });
  s.addNotes('Opening (20 s). The exam asks me to present a self-chosen set of architecture principles and show in a working system how they are implemented. I chose the five principles from module 1, and I will show each one in the running system, with numbers, and say what it gains and what it costs.');
}

// 2 Plan
{
  const s = content('The plan for the ten minutes',
    'The exam is 30 minutes: a 5-10 minute talk, 15-20 minutes of questions, 5 minutes for the grade. This talk is the first block. Every claim has a screenshot or a number behind it, and the backup section has the detail for the questions.');
  const steps = [
    ['1', 'The system in one picture', '1 min'],
    ['2', 'Five principles and where they live', '1 min'],
    ['3', 'Scale out and stateless: the load test', '2 min'],
    ['4', 'Design to be disabled: the cache flag', '1.5 min'],
    ['5', 'Asynchronous design: the indexing pipeline', '2 min'],
    ['6', 'Monitored: dashboard and alerts', '1 min'],
    ['7', 'Gain versus cost, then a live demo', '1.5 min'],
  ];
  steps.forEach((st, i) => {
    const y = 1.5 + i * 0.72;
    s.addShape(pres.ShapeType.ellipse, { x: 0.6, y, w: 0.5, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0.5 }, objectName: 'Step ' + st[0] });
    text(s, st[0], { x: 0.6, y, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    text(s, st[1], { x: 1.3, y, w: 5.2, h: 0.5, fontSize: 17, valign: 'middle' });
    text(s, st[2], { x: 6.4, y, w: 1.0, h: 0.5, fontSize: 15, color: C.text2, valign: 'middle', align: 'right' });
  });
  card(s, 8.0, 1.5, 4.7, 5.0, 'What the exam asks for',
    [
      { text: 'Present a self-chosen set of principles and show how they are implemented in a working system.', options: { bullet: { indent: 16 }, breakLine: true } },
      { text: 'Judge the business gain and the cost of each principle in context.', options: { bullet: { indent: 16 }, breakLine: true } },
      { text: 'Format: 5-10 min talk, 15-20 min questions, 5 min grade; individual, 7-point scale.', options: { bullet: { indent: 16 }, breakLine: true } },
      { text: 'Course requirements: .NET, x-scale on a container platform, monitoring, performance tests, a z-axis plan for the database, a position on caching, UML diagrams.', options: { bullet: { indent: 16 } } },
    ], { size: 14 });
}

// 3 System overview (drawn)
{
  const s = content('SearchV2 in one picture',
    'Left to right on top: a browser calls the Blazor GUI, which calls the stateless search API (two pods), which uses Redis as a cache and PostgreSQL as the index. Bottom: the indexing pipeline, a Job that publishes one message per document to RabbitMQ, tokenizer workers, writer workers, which write to the same PostgreSQL. On the right: observability for everything. Each box is a pod or a group of pods in its own Kubernetes namespace.');
  zone(s, 0.6, 1.4, 9.3, 1.75, 'Search path (synchronous)');
  node(s, 0.85, 1.85, 1.35, 0.9, 'Browser');
  node(s, 2.65, 1.85, 1.75, 0.9, 'Blazor GUI\n(1 pod)', { fill: C.background1 });
  node(s, 4.85, 1.85, 2.0, 0.9, 'search-api\n(2 pods, stateless)', { line: C.accent1, bold: true });
  node(s, 7.55, 1.85, 2.1, 0.9, 'Redis cache\n(cache-aside)\n64 MB, LRU', { line: C.accent2, size: 12 });
  arrow(s, 2.2, 2.3, 2.65, 2.3);
  arrow(s, 4.4, 2.3, 4.85, 2.3);
  arrow(s, 6.85, 2.3, 7.55, 2.3);
  node(s, 2.2, 3.55, 6.6, 0.85, 'PostgreSQL: document, word, occ (the inverted index)\nHelm release, 2 GiB volume, metrics exporter', { line: C.accent3, bold: true, fill: C.background2 });
  arrow(s, 5.85, 2.75, 5.85, 3.55, 'SQL');
  zone(s, 0.6, 4.75, 9.3, 2.05, 'Indexing pipeline (asynchronous)');
  node(s, 0.85, 5.25, 1.6, 1.0, 'indexer Job\n(crawler)', { line: C.accent6, bold: true });
  node(s, 2.85, 5.45, 1.35, 0.6, 'RabbitMQ\ndiscovered', { fill: C.background2, size: 12 });
  node(s, 4.6, 5.25, 1.55, 1.0, 'tokenizers\n(×2)', { line: C.accent6, bold: true });
  node(s, 6.55, 5.45, 1.35, 0.6, 'RabbitMQ\ntokenized', { fill: C.background2, size: 12 });
  node(s, 8.25, 5.25, 1.45, 1.0, 'writers\n(×2)', { line: C.accent6, bold: true });
  arrow(s, 2.45, 5.75, 2.85, 5.75);
  arrow(s, 4.2, 5.75, 4.6, 5.75);
  arrow(s, 6.15, 5.75, 6.55, 5.75);
  arrow(s, 7.9, 5.75, 8.25, 5.75);
  arrow(s, 8.95, 5.25, 8.95, 4.4, 'write');
  zone(s, 10.2, 1.4, 2.55, 5.4, 'Observability');
  node(s, 10.4, 1.95, 2.15, 0.75, 'OpenTelemetry\nCollector', { line: C.accent4 });
  node(s, 10.4, 3.1, 2.15, 0.75, 'Prometheus\n+ 9 alert rules', { line: C.accent4 });
  node(s, 10.4, 4.25, 2.15, 0.75, 'Loki (logs)', { line: C.accent4 });
  node(s, 10.4, 5.4, 2.15, 0.75, 'Grafana\ndashboard', { line: C.accent4, bold: true });
  arrow(s, 11.475, 2.7, 11.475, 3.1);
  arrow(s, 11.475, 3.85, 11.475, 4.25);
  arrow(s, 11.475, 5.0, 11.475, 5.4);
  text(s, 'Apps send metrics and logs here', { x: 10.2, y: 6.2, w: 2.55, h: 0.5, fontSize: 11, color: C.text2, align: 'center' });
}

// 4 Principles table
{
  const s = content('Five principles, and the proof I will show',
    'These are the five principles named in module 1. For each I say where it lives in the system and what proof I have. The next slides take them in turn: scale out and stateless together, then disabled, asynchronous and monitored.');
  table(s, ['Principle', 'Where it lives', 'Proof in the running system'], [
    ['Scale out, not up', '2 search-api replicas behind a Service; indexing workers ×N', 'Load test: 556 req/s at 16 workers, 0 errors; reindex 24.6 s with 1+1 workers, 8.4 s with 8+8'],
    ['Stateless systems', 'The API keeps no state: Redis and PostgreSQL hold it, any pod can answer', 'X-Served-By shows both pods answering; killed pods lose nothing'],
    ['Asynchronous design', 'Indexing: three stages over RabbitMQ. Search stays synchronous.', 'Worker killed mid-run gives an identical index; a bad message is dead-lettered'],
    ['Design to be monitored', 'OpenTelemetry to Prometheus, Loki, Grafana; 9 alert rules', 'Dashboard under load; SearchCacheFailing fired when Redis was taken down'],
    ['Design to be disabled', 'SearchCache feature flag in a ConfigMap', 'Flag flipped with no restart: cache hits dropped to zero'],
  ], { x: 0.6, y: 1.45, w: 12.13, colW: [2.5, 4.5, 5.13], rowH: [0.45, 0.95, 0.95, 0.95, 0.95, 0.95], fontSize: 14 });
}

// 5 Scale out
{
  const s = content('Principle 1: scale out, not up',
    'The search API is cloned: two identical pods behind a Kubernetes Service. I ran a load test of 2, 8 and 16 concurrent workers for two minutes and a half, sent to both pods. Throughput grew from 192 to 556 requests per second with 0 errors, and the 95th percentile stayed under 45 ms. The request count in Prometheus matched what the client sent, so the metric can be trusted. Requests were split evenly between the pods. Cost: the shared database becomes the limit; I found that out later (slide on what the numbers taught me).');
  stat(s, 0.6, 1.4, 3.8, '2 → N', 'identical search-api pods behind one Service (Kubernetes is the load balancer)');
  stat(s, 4.7, 1.4, 3.8, '556 req/s', 'at 16 workers, cache on, both pods used');
  stat(s, 8.8, 1.4, 3.9, '0 errors', 'in 68,325 requests; Prometheus counted 68,303');
  s.addChart(pres.charts.BAR, [{ name: 'Requests per second', labels: ['2 workers', '8 workers', '16 workers'], values: [191.9, 486.0, 556.0] }],
    Object.assign({}, chartBase, { x: 0.6, y: 3.2, w: 5.9, h: 3.5, barDir: 'col', chartColors: [HEX.accent1], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', title: 'Throughput (requests per second)', valAxisMinVal: 0 }));
  s.addChart(pres.charts.BAR, [{ name: '95th percentile (ms)', labels: ['2 workers', '8 workers', '16 workers'], values: [14.9, 24.1, 41.9] }],
    Object.assign({}, chartBase, { x: 6.8, y: 3.2, w: 5.9, h: 3.5, barDir: 'col', chartColors: [HEX.accent3], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', title: '95th percentile latency (ms)', valAxisMinVal: 0 }));
}

// 6 Stateless
{
  const s = content('Principle 2: stateless, so any pod can answer',
    'The search API keeps nothing between requests: results come from PostgreSQL, cached results from Redis, and the feature flag from a mounted file. So any pod can answer any request, and a pod can die or be replaced without losing anything. The GUI shows which pod answered. Here the two curl calls hit different pods. The honest exception is the Blazor GUI: Blazor Server keeps a circuit per user in memory, so it runs as one replica.');
  pic(s, SHOT + 'gui-results-zoom.png', 0.6, 1.45, 7.3, 3.0);
  pic(s, SHOT + 'gui-route-zoom.png', 0.6, 4.75, 7.3, 1.3);
  caption(s, 'Zoom: the GUI shows how many records matched, the Fetch time, and the pod that answered (Route).', 0.6, 6.2, 7.3);
  terminal(s, termFile('x-served-by.txt'), 8.2, 1.45, 4.5, 2.45, 11);
  bullets(s, [
    ['State lives elsewhere:', 'Redis (cache) and PostgreSQL (index).'],
    ['Exception:', 'the Blazor GUI keeps a circuit per user, so it runs as one replica.'],
  ], { x: 8.2, y: 4.15, w: 4.5, h: 2.4, fontSize: 14 });
}

// 7 Disabled
{
  const s = content('Principle 5: design to be disabled',
    'A feature flag in a ConfigMap switches the cache off without a rollback, a new image or a restart. The flag reaches the pods in one to two minutes. I proved it with the load test: with the flag on there were 55,233 cache hits and 13,951 misses, an 80 percent hit ratio; with the flag off, zero of both. The honest finding is that, once the database was fixed, the cache gave only about 7 percent more throughput at this scale. So the flag is cheap insurance, and the cache earns its place by protecting the database, not by being fast.');
  terminal(s, termFile('feature-flag-off.txt'), 0.6, 1.45, 6.3, 2.5, 12);
  text(s, [
    { text: 'No release, no restart. ', options: { bold: true } },
    { text: 'The flag is a file in a mounted ConfigMap; the API watches it. In the load test the cache served 55,233 hits and 13,951 misses (80 %) with the flag on, and 0 of both with it off.', options: {} },
  ], { x: 0.6, y: 4.2, w: 6.3, h: 1.6, fontSize: 15 });
  card(s, 0.6, 5.65, 6.3, 1.15, 'Cost', 'More code paths to test, flags that linger, and a 1-2 minute delay before it reaches the pods.', { accent: HEX.accent5, size: 13 });
  s.addChart(pres.charts.BAR, [
    { name: 'Before: database limited to 150m CPU (26 Nov)', labels: ['Cache on', 'Cache off'], values: [135, 40] },
    { name: 'After: no database CPU limit (27 Nov)', labels: ['Cache on', 'Cache off'], values: [556, 521] },
  ], Object.assign({}, chartBase, { x: 7.2, y: 1.4, w: 5.5, h: 4.3, barDir: 'col', barGrouping: 'clustered', chartColors: [HEX.accent2, HEX.accent1], showLegend: true, legendPos: 'b', showValue: true, dataLabelPosition: 'outEnd', title: 'Requests per second at 16 workers', valAxisMinVal: 0 }));
  text(s, 'The cache looked 3.4× faster until the database limit was fixed. Now it is about 7 % faster and takes 80 % of the queries off PostgreSQL.', { x: 7.2, y: 5.85, w: 5.5, h: 0.95, fontSize: 14, color: C.text2 });
}

// 8 Asynchronous
{
  const s = content('Principle 3: asynchronous design for indexing',
    'Indexing used to be one process that could not be scaled, because it handed out ids from in-memory counters. Now it is three stages joined by RabbitMQ queues: a Job that finds the files and publishes one message per file, tokenizer workers that read and tokenize, and writer workers that save to PostgreSQL. Each stage scales on its own. A message is acknowledged only after the database commit, so a crashed worker means redelivery, which is why writes are idempotent. A message that fails twice goes to a dead-letter queue instead of stopping the run. Search stays synchronous on purpose: the user is waiting.');
  zone(s, 0.6, 1.4, 12.13, 2.6, 'One image, four roles: batch (the old indexer), pipeline, tokenizer, writer');
  node(s, 0.85, 1.95, 1.9, 1.5, 'indexer Job\nlists the files,\npublishes one\nmessage each', { line: C.accent6, bold: true, size: 13 });
  node(s, 3.2, 2.3, 1.7, 0.8, 'queue\ndiscovered', { fill: C.background2 });
  node(s, 5.35, 1.95, 1.9, 1.5, 'tokenizers (×N)\nread the file,\nextract the words', { line: C.accent6, bold: true, size: 13 });
  node(s, 7.7, 2.3, 1.7, 0.8, 'queue\ntokenized', { fill: C.background2 });
  node(s, 9.85, 1.95, 2.6, 1.5, 'writers (×N)\none transaction\nper document', { line: C.accent6, bold: true, size: 13 });
  arrow(s, 2.75, 2.7, 3.2, 2.7); arrow(s, 4.9, 2.7, 5.35, 2.7); arrow(s, 7.25, 2.7, 7.7, 2.7); arrow(s, 9.4, 2.7, 9.85, 2.7);
  node(s, 3.2, 3.35, 6.2, 0.5, 'dead-letter queue: documents that failed twice', { dashed: true, line: C.accent5, size: 12 });
  card(s, 0.6, 4.2, 3.9, 2.6, 'Why it works', 'The database assigns ids, so writers run in parallel. Writes are idempotent, so a repeated message is harmless. Words are inserted in a fixed order, so writers do not deadlock.', { accent: HEX.accent6, size: 14 });
  card(s, 4.7, 4.2, 3.9, 2.6, 'Gain', 'Each stage scales alone. A crashed worker loses nothing. One broken document does not stop the run. Measured: 24.6 s down to 8.4 s.', { accent: HEX.accent4, size: 14 });
  card(s, 8.8, 4.2, 3.93, 2.6, 'Cost', 'A broker to run and monitor. At-least-once delivery forces idempotent writes. While reindexing, search results are incomplete, so the API is stopped first.', { accent: HEX.accent5, size: 14 });
}

// 9 Async proof
{
  const s = content('Asynchronous design: where the time goes',
    'Left: a full reindex of 3,034 documents with different worker counts, tokenizers:writers. Two of each is twice as fast as one; eight of each about three times. The interesting rows are the last two: one tokenizer with four writers is almost as fast as four and four, while four tokenizers with one writer is no faster than one and one. So the writers are the bottleneck stage. Right: RabbitMQ during a run: 2,656 messages waiting for the writers, while the queue in front of the tokenizers is empty. The dashboard confirms it: a tokenizer takes about 1.3 ms per document, a writer 9.6 ms.');
  s.addChart(pres.charts.BAR, [{ name: 'Seconds for a full reindex', labels: ['1:1', '2:2', '4:4', '8:8', '1:4', '4:1'], values: [24.6, 12.7, 10.4, 8.4, 9.5, 23.5] }],
    Object.assign({}, chartBase, { x: 0.6, y: 1.4, w: 6.3, h: 3.2, barDir: 'col', chartColors: [HEX.accent6], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', title: 'Full reindex, 3,034 documents (seconds), tokenizers:writers', valAxisMinVal: 0 }));
  bullets(s, [
    ['Writers are the slow stage:', '9.6 ms per document against 1.3 ms for a tokenizer.'],
    ['So add writers, not tokenizers:', '1 tokenizer + 4 writers (9.5 s) is nearly as fast as 4 + 4, while 4 tokenizers + 1 writer (23.5 s) is no faster than 1 + 1.'],
    ['Failure test:', 'a writer pod and a tokenizer pod were force-deleted mid-run; the index came out identical to a clean run (3,034 documents, 25,258 words, 462,828 occurrences).'],
  ], { x: 7.2, y: 1.45, w: 5.5, h: 3.9, fontSize: 15 });
  pic(s, SHOT + 'rabbitmq-queues-crop.png', 0.6, 4.7, 7.0, 2.15);
  caption(s, 'RabbitMQ mid-run: 2,656 messages wait for the writers (486/s arrive, 118/s are handled).', 7.9, 5.4, 4.8);
}

// 10 Monitored
{
  const s = content('Principle 4: design to be monitored',
    'Both applications send metrics and logs with OpenTelemetry to one collector; Prometheus stores the metrics, Loki the logs, Grafana shows them. The dashboard on the left was recorded during the load test: requests per second, 95th percentile, errors, CPU and memory per pod. Nine alert rules watch the critical things, and the Prometheus alert page on the right was captured while Redis was down: SearchCacheFailing is firing and SearchLatencyHigh is pending. Cost: instrumentation work and storage, and there is no Alertmanager, so nothing is sent to a person; someone has to look.');
  pic(s, SHOT + 'grafana-load-cache-on.png', 0.6, 1.4, 7.4, 5.0);
  caption(s, 'Grafana during the load test: throughput, p95, errors, CPU and memory per pod.', 0.6, 6.5, 7.4);
  pic(s, SHOT + 'prometheus-alerts-crop.png', 8.2, 1.4, 4.55, 2.25);
  caption(s, 'Prometheus during a Redis outage.', 8.2, 3.75, 4.55);
  bullets(s, [
    ['Collected:', 'requests, latency, errors, cache, database time, PostgreSQL health, queue depth, logs.'],
    ['Alerts:', '9 rules, for example API down, 5xx rate, p95 over 500 ms, cache failing, dead letters.'],
    ['Limit:', 'no Alertmanager, so nobody is notified.'],
  ], { x: 8.2, y: 4.15, w: 4.55, h: 2.7, fontSize: 14 });
}

// 11 Gain vs cost
{
  const s = content('Business gain against cost',
    'The learning goals ask me to judge the gain and cost of a principle in a context. This is the summary. The pattern is the same for all five: you get flexibility and resilience, and you pay in moving parts, in discipline, and in things you now have to look after.');
  table(s, ['Principle', 'Gain', 'Cost and risk'], [
    ['Scale out', 'Capacity is added in minutes with small, cheap pods; no big-machine purchase', 'More moving parts; needs a stateless design; the shared database becomes the limit (it did)'],
    ['Stateless', 'Any pod can serve, die or be replaced; rolling updates and rollback are safe', 'State must live somewhere (Redis, PostgreSQL); the Blazor GUI is the exception'],
    ['Asynchronous', 'Stages scale and fail independently; one bad document does not stop the run', 'A broker to run; at-least-once delivery forces idempotent writes; partial results while reindexing'],
    ['Monitored', 'Problems are seen in minutes, and every performance claim has numbers behind it', 'Instrumentation work and storage; alerts nobody reads are noise'],
    ['Disabled', 'A risky feature is off in about two minutes without a release', 'Extra code paths to test; flags can linger; a delay before the change arrives'],
  ], { x: 0.6, y: 1.45, w: 12.13, colW: [2.0, 5.1, 5.03], rowH: [0.45, 0.95, 0.95, 0.95, 0.95, 0.95], fontSize: 14 });
}

// 12 Demo plan
{
  const s = content('Live demo: what I will show',
    'Pick three or four of these depending on the time. Everything runs from ./k8s/start.sh (about three minutes from a cold start). The reindex step replaces the index, so the API is stopped first; do it last. Port-forwards: GUI on 5080, Grafana on 3000, RabbitMQ on 15672.');
  const items = [
    ['1  Search', 'Open the GUI on localhost:5080, search "kitchen music". Point at Route (which pod) and Fetch (ms).'],
    ['2  Scale out', 'kubectl scale deploy/search-api --replicas=3, watch a third pod appear in Grafana.'],
    ['3  Disable', 'Patch the SearchCache flag to false. No restart; the hit ratio panel drops.'],
    ['4  Break it', 'Scale Redis to 0: searches still answer, slower, and the cache alert fires.'],
    ['5  Reindex', 'Stop the API, run ./k8s/pipeline-scaling.sh 1:1 4:4, watch the queues and the bar panels.'],
    ['6  Roll back', 'Run k8s/rollback-demo.sh: a bad image never becomes Ready and the old pods keep serving.'],
  ];
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    card(s, 0.6 + col * 4.1, 1.5 + row * 2.5, 3.93, 2.3, it[0], it[1], { accent: [HEX.accent1, HEX.accent3, HEX.accent2, HEX.accent5, HEX.accent6, HEX.accent4][i], size: 14 });
  });
  text(s, 'Start everything with ./k8s/start.sh (about 3 minutes). Do the reindex last: it replaces the index.', { x: 0.6, y: 6.55, w: 12, h: 0.35, fontSize: 13, color: C.text2 });
}

// 13 Conclusion
{
  const s = pres.addSlide({ masterName: 'TITLE', sectionTitle: section });
  s.addText('What I would take away', { placeholder: 'title' });
  s.addText([
    { text: 'Measure before you believe: the cache looked 3.4× faster until a database limit was fixed.', options: { bullet: { indent: 18 }, breakLine: true } },
    { text: 'Every principle has a price: a broker, idempotent writes, flags, instrumentation.', options: { bullet: { indent: 18 }, breakLine: true } },
    { text: 'Monitoring paid for itself: it exposed the throttled database and the slow writers.', options: { bullet: { indent: 18 } } },
  ], { placeholder: 'subtitle', fontSize: 20, paraSpaceAfter: 10, h: 2.4 });
  text(s, 'Questions?', { x: 0.8, y: 6.55, w: 6, h: 0.6, fontSize: 28, bold: true, color: C.accent2, fontFace: THEME.headFontFace });
  s.addNotes('Close with three sentences. The strongest point for the examiner is that the numbers changed my own conclusion: that is what measuring is for. Then take questions; the backup section has the evidence for each area.');
}

// ======================================================================
// PART 2: demo storyboard
// ======================================================================
newSection('Demo storyboard');
divider('Demo storyboard', 'Screens and commands for the live demo, in the order I would show them.', 'Backup section: what the audience sees at each step of the demo.');

{
  const s = content('1. The search GUI',
    'The GUI is a Blazor Server app (Aperture). Search for two words; the result list shows how many of the words each document contains, which words are missing, and when it was indexed. The header shows how many records matched, how long the search took, and which API pod answered.');
  pic(s, SHOT + 'gui-home.png', 0.6, 1.4, 5.9, 4.1);
  pic(s, SHOT + 'gui-results-zoom.png', 6.8, 1.4, 5.9, 4.1);
  caption(s, 'Home page.', 0.6, 5.6, 5.9);
  caption(s, 'Result for "kitchen music": 96 records in 5.43 ms from search-api-c7f4d65c7-nks5c.', 6.8, 5.6, 5.9);
  text(s, 'Search is a POST to /api/Search with the words and a case-sensitivity flag; the answer includes hits per document and the words that were not found.', { x: 0.6, y: 6.1, w: 12, h: 0.7, fontSize: 14 });
}

{
  const s = content('2. The cluster that is running',
    'Five namespaces: searchv2 (GUI, API, indexing), caching (Redis), messaging (RabbitMQ), database (PostgreSQL) and devops (observability). Everything is Running; the indexer Job has completed.');
  terminal(s, termFile('pods.txt'), 0.6, 1.4, 7.2, 4.1, 12);
  terminal(s, termFile('deploy-helm-flag.txt'), 8.0, 1.4, 4.73, 4.1, 11);
  text(s, 'Five namespaces, all pods Running; the indexer Job has completed. PostgreSQL is a Helm release; the feature flag is a ConfigMap.', { x: 0.6, y: 5.75, w: 12.1, h: 0.8, fontSize: 15, color: C.text2 });
}

{
  const s = content('3. Break Redis: searches still answer',
    'I took Redis down during a four-worker load test. All 217 searches still answered, with no errors, but every one took about four seconds, because the API tries Redis twice before falling back to PostgreSQL. The cache panel shows the errors, and after the two-minute window SearchCacheFailing fires. This is the failure mode I documented: the cache cannot take search down, but it can make it slower. A circuit breaker would fix the delay; it is not built.');
  pic(s, SHOT + 'grafana-outage-cache.png', 0.6, 1.4, 12.1, 1.9);
  pic(s, SHOT + 'grafana-outage-alerts.png', 0.6, 3.45, 6.0, 1.0);
  caption(s, 'Grafana "Firing alerts" panel while Redis was down.', 0.6, 4.5, 6.0);
  terminal(s, termFile('redis-outage-load.txt'), 6.9, 3.45, 5.83, 1.55, 11);
  bullets(s, [
    ['Result:', '217 requests, 0 % errors, p50 3.5 s, p95 4.0 s: slow, not broken.'],
    ['Why 4 s:', 'each request tries Redis twice (1 s timeouts) before it falls back to PostgreSQL.'],
    ['Not built:', 'a circuit breaker that would skip Redis after repeated failures.'],
  ], { x: 0.6, y: 5.2, w: 12.1, h: 1.6, fontSize: 14 });
}

{
  const s = content('4. Alerts: Prometheus noticed',
    'Prometheus evaluates nine rules. During the outage SearchCacheFailing went pending, then firing after its two-minute window, and SearchLatencyHigh went pending. The other seven stayed inactive. Earlier I also saw SearchApiDown and SearchApiReplicaMissing fire when the API was scaled to zero for a reindex, and IndexingMessagesFailed fire when a bad message landed in the dead-letter queue.');
  pic(s, SHOT + 'prometheus-alerts-crop.png', 0.6, 1.4, 6.6, 4.0);
  terminal(s, termFile('alert-rules.txt'), 7.45, 1.4, 5.28, 2.7, 11);
  bullets(s, [
    ['Fired for real:', 'SearchCacheFailing (Redis down), SearchApiDown (API scaled to 0), IndexingMessagesFailed (bad message).'],
    ['Not exercised:', 'MetricsPipelineDown and ServerErrorRateHigh were only checked for loading and evaluating.'],
  ], { x: 0.6, y: 5.55, w: 12.1, h: 1.3, fontSize: 14 });
}

{
  const s = content('5. Reindex through the pipeline',
    'To reindex: stop the API, run the Job, and the workers do the rest. RabbitMQ shows the queues while it runs; Grafana shows the same from Prometheus. Both come from the same run: one tokenizer and one writer, then four and four.');
  pic(s, SHOT + 'rabbitmq-queues-crop.png', 0.6, 1.4, 6.3, 2.2);
  caption(s, 'RabbitMQ management UI during a run.', 0.6, 3.7, 6.3);
  pic(s, SHOT + 'grafana-indexing-queues.png', 7.1, 1.4, 5.63, 2.2);
  caption(s, 'Queue depth and connected workers in Grafana.', 7.1, 3.7, 5.63);
  terminal(s, '$ ./k8s/pipeline-scaling.sh 1:1 4:4\ntokenizers  writers     seconds    docs/s\n1           1              21.4       141\n4           4               8.9       340', 0.6, 4.1, 6.3, 1.3, 12);
  bullets(s, [
    ['Order:', 'stop the API, run the Job (workers must be running), restart Redis, start the API.'],
    ['Why stop the API:', 'the index is empty and then fills up; a search during the run is incomplete.'],
  ], { x: 7.1, y: 4.3, w: 5.63, h: 1.5, fontSize: 14 });
  pic(s, SHOT + 'grafana-indexing-runs.png', 0.6, 5.55, 12.1, 1.35);
}

// ======================================================================
// PART 3: architecture and diagrams
// ======================================================================
newSection('Architecture and diagrams');
divider('Architecture and diagrams', 'The deployment, the UML diagrams the exam asks for, and the design of the indexer.', 'Backup section: diagrams.');

{
  const s = content('Kubernetes deployment: five namespaces',
    'One namespace per software system, following the teacher\'s C4 diagram. searchv2 holds the applications and the indexing workers; caching holds Redis; messaging holds RabbitMQ; database holds PostgreSQL from the Bitnami Helm chart; devops holds the observability stack. There are no NetworkPolicies, so a namespace is an organising boundary, not a security boundary.');
  const ns = [
    ['searchv2', HEX.accent1, 'blazor ×1\nsearch-api ×2\nindexer Job\nindexer-tokenizer ×2\nindexer-writer ×2\nDocuments: hostPath, read-only'],
    ['caching', HEX.accent2, 'redis ×1\n64 MB, allkeys-lru\nno volume (cache only)\nSecret: redis-credentials'],
    ['messaging', HEX.accent6, 'rabbitmq ×1\nqueues: discovered, tokenized, failed\nemptyDir (derived data)\nSecret: rabbitmq-credentials'],
    ['database', HEX.accent3, 'postgresql-db-0\nHelm chart 18.12.17\nPVC 2 GiB\nmetrics exporter'],
    ['devops', HEX.accent4, 'otel-collector\nprometheus (24 h)\nloki\ngrafana (provisioned dashboard)'],
  ];
  ns.forEach((n, i) => {
    const x = 0.6 + i * 2.45;
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.5, w: 2.3, h: 0.55, rectRadius: 0.08, fill: { color: n[1] }, line: { color: n[1], width: 0.5 }, objectName: 'Namespace: ' + n[0] });
    text(s, n[0], { x, y: 1.5, w: 2.3, h: 0.55, fontSize: 16, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    s.addText(n[2], { shape: pres.ShapeType.roundRect, rectRadius: 0.08, x, y: 2.15, w: 2.3, h: 3.2, isTextBox: true, margin: 0.12, fill: { color: C.background2 }, line: { color: C.background2, width: 0.5 }, fontSize: 14, color: C.text1, valign: 'top', objectName: 'Pods: ' + n[0] });
  });
  bullets(s, [
    ['Images:', 'built locally with Docker and loaded into Minikube (imagePullPolicy: Never); start.sh does everything.'],
    ['Secrets:', 'generated by start.sh, never in git; a copy of each password sits in the namespace that needs it.'],
    ['Network:', 'Services and cluster DNS; only the GUI, Grafana and RabbitMQ UI are forwarded to the laptop.'],
  ], { x: 0.6, y: 5.55, w: 12.1, h: 1.4, fontSize: 14 });
}

{
  const s = content('UML deployment diagram',
    'This is the deployment diagram from module 7 notation. It was drawn before the indexing pipeline, so RabbitMQ and the tokenizer and writer pods are not in this picture; they are on the previous slide and in the updated PlantUML source (uml/deployment-diagram.puml), which still has to be re-rendered.');
  pic(s, UML + 'deployment-diagram.png', 0.6, 1.35, 12.1, 5.2);
  caption(s, 'Rendered from uml/deployment-diagram.puml before the pipeline was added. The source has since been updated with RabbitMQ and the workers.', 0.6, 6.6, 12.1);
}

{
  const s = content('UML class diagram: GUI, API and shared model',
    'The class diagram follows module 2 version 2: Blazor client, SearchAPI with the onion layers, the Redis cache and the feature flag, and the shared SearchUtilities model. The SearchController depends on ISearchService, IDistributedCache and IFeatureManager, never on concrete classes, so the cache or the database can be replaced.');
  pic(s, UML + 'class-diagram.png', 0.6, 1.35, 12.1, 5.4);
}

{
  const s = content('Indexer design: ports and adapters',
    'The indexer follows the same onion structure as the API: the application layer depends only on ports in Core. The pipeline adds two ports, IMessageQueue and IDocumentWriter, with RabbitMQ and PostgreSQL adapters. One Program.cs picks the role. The messages are plain records. The older PlantUML class diagram shows the batch mode; this slide shows the current structure.');
  zone(s, 0.6, 1.4, 12.13, 5.4, 'Indexer (one image, four roles chosen by Program.cs)');
  node(s, 0.85, 1.95, 2.3, 0.8, 'Program\n(role: batch | pipeline |\ntokenizer | writer)', { size: 12, bold: true });
  node(s, 3.55, 1.95, 2.2, 0.8, 'IndexingService\n(batch)', { size: 12 });
  node(s, 6.0, 1.95, 2.2, 0.8, 'IndexingPipeline\n(stage 1, coordinator)', { size: 12 });
  node(s, 8.45, 1.95, 2.0, 0.8, 'TokenizerWorker\n(stage 2)', { size: 12 });
  node(s, 10.7, 1.95, 1.8, 0.8, 'WriterWorker\n(stage 3)', { size: 12 });
  text(s, 'Application layer: use cases, depend only on Core', { x: 0.85, y: 2.85, w: 8, h: 0.3, fontSize: 12, color: C.text2, italic: true });
  node(s, 0.85, 3.45, 2.3, 0.8, 'IDocumentSource\nlist · read', { fill: C.background2, size: 12 });
  node(s, 3.45, 3.45, 2.3, 0.8, 'IIndexStore\n(batch writes)', { fill: C.background2, size: 12 });
  node(s, 6.05, 3.45, 2.3, 0.8, 'IMessageQueue\npublish · consume · count', { fill: C.background2, size: 12 });
  node(s, 8.65, 3.45, 2.3, 0.8, 'IDocumentWriter\nreset · write · count', { fill: C.background2, size: 12 });
  node(s, 11.1, 3.45, 1.45, 0.8, 'Messages\n(records)', { fill: C.background2, size: 12 });
  text(s, 'Core: ports and entities', { x: 0.85, y: 4.35, w: 8, h: 0.3, fontSize: 12, color: C.text2, italic: true });
  node(s, 0.85, 4.95, 2.3, 0.8, 'FileSystemDocumentSource', { line: C.accent3, size: 12 });
  node(s, 3.45, 4.95, 2.3, 0.8, 'PostgresIndexStore', { line: C.accent3, size: 12 });
  node(s, 6.05, 4.95, 2.3, 0.8, 'RabbitMqQueue', { line: C.accent3, size: 12 });
  node(s, 8.65, 4.95, 2.3, 0.8, 'PostgresDocumentWriter', { line: C.accent3, size: 12 });
  text(s, 'Infrastructure: adapters, wired only in Program.cs', { x: 0.85, y: 5.85, w: 8, h: 0.3, fontSize: 12, color: C.text2, italic: true });
  text(s, 'DocumentDiscovered(Url, CreatedAt) · DocumentTokenized(Url, CreatedAt, Words)', { x: 0.85, y: 6.25, w: 11.5, h: 0.4, fontSize: 13 });
}

{
  const s = content('UML object diagram: one search',
    'A snapshot of the objects alive while search-api-1 answers one search for "apple": the request, the controller, the cache entry in Redis and the feature flag. It is a cache miss, so the controller calls the search service and stores the result.');
  pic(s, UML + 'object-diagram.png', 0.6, 1.35, 12.1, 5.4);
}

// ======================================================================
// PART 4: evidence
// ======================================================================
newSection('Evidence');
divider('Evidence', 'Performance test, caching, the indexer and the database, with the numbers and the screenshots.', 'Backup section: the measurements behind every claim.');

{
  const s = content('Performance test: what was measured and why',
    'Module 9 asks for metrics justified per category. I measure the user-visible requests (rate, p95, errors), the resources (CPU and memory per pod), the database path (time per operation), and the user experience in the browser. The load script uses only Python\'s standard library and spreads requests over both API pods. 80 percent of queries repeat from a pool of 50; 20 percent are one-offs.');
  table(s, ['Category', 'Metric', 'Why this one'], [
    ['API requests', 'requests/s, p95, 5xx rate', 'What the user feels; p95 because the slowest requests are the ones users notice'],
    ['Resources', 'CPU and memory per pod', 'A pod at its CPU limit explains latency with no other symptom'],
    ['Database', 'time per operation, connections, buffer cache hit ratio', 'Shows whether the API or the database is the bottleneck'],
    ['Cache', 'hits, misses, errors, hit ratio', 'Tells whether the cache pays for itself and when it fails'],
    ['Indexing', 'queue depth, workers, time per document, run time', 'Finds the slow pipeline stage'],
    ['User experience', 'search duration in the browser', 'A gap to the API p95 points at the GUI or the network'],
  ], { x: 0.6, y: 1.45, w: 12.13, colW: [2.2, 4.4, 5.53], rowH: [0.45, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72], fontSize: 14 });
  text(s, 'Target: p95 under 500 ms with the cache on. Script: k8s/load-test.py (stages 2, 8, 16 workers, 30/60/60 s).', { x: 0.6, y: 6.4, w: 12.1, h: 0.4, fontSize: 14, color: C.text2 });
}

{
  const s = content('Load test, cache on',
    'Cache on, both API pods, 27 November. Throughput 192, 486 and 556 requests per second at 2, 8 and 16 workers, p95 15, 24 and 42 ms, zero errors. The dashboard on the left was recorded during the run. The verification line: the client sent 68,325 requests and Prometheus counted 68,303.');
  pic(s, SHOT + 'grafana-load-cache-on.png', 0.6, 1.4, 7.3, 5.0);
  table(s, ['Workers', 'req/s', 'p50', 'p95', 'p99', 'Errors'], [
    ['2', '192', '8.9 ms', '14.9 ms', '25.8 ms', '0'],
    ['8', '486', '14.6 ms', '24.1 ms', '34.6 ms', '0'],
    ['16', '556', '26.8 ms', '41.9 ms', '57.9 ms', '0'],
  ], { x: 8.0, y: 1.5, w: 4.73, colW: [0.9, 0.65, 0.8, 0.8, 0.8, 0.78], rowH: [0.4, 0.45, 0.45, 0.45], fontSize: 12 });
  caption(s, 'Stages: 2 workers 30 s, 8 workers 60 s, 16 workers 60 s; requests spread over both API pods.', 0.6, 6.5, 7.3);
  bullets(s, [
    ['Both pods used:', '16,523 and 16,852 requests at 16 workers.'],
    ['CPU:', 'each API pod peaked at about 1 core.'],
    ['Check:', 'client sent 68,325, Prometheus counted 68,303.'],
    ['Cache:', '55,233 hits, 13,951 misses (80 %).'],
  ], { x: 8.0, y: 3.5, w: 4.73, h: 3.2, fontSize: 14 });
}

{
  const s = content('Load test, cache off',
    'The same test with the SearchCache flag switched off, after waiting two minutes for the flag to reach the pods. I confirmed in Prometheus that there were zero cache hits and zero misses during this run. Throughput 195, 454 and 521 requests per second. That is within 7 percent of the cache-on run, which was a surprise and led to the next slide.');
  pic(s, SHOT + 'grafana-load-cache-off.png', 0.6, 1.4, 7.3, 5.0);
  table(s, ['Workers', 'req/s', 'p50', 'p95', 'p99', 'Errors'], [
    ['2', '195', '9.4 ms', '13.7 ms', '28.6 ms', '0'],
    ['8', '454', '16.2 ms', '24.7 ms', '45.6 ms', '0'],
    ['16', '521', '28.8 ms', '44.0 ms', '71.9 ms', '0'],
  ], { x: 8.0, y: 1.5, w: 4.73, colW: [0.9, 0.65, 0.8, 0.8, 0.8, 0.78], rowH: [0.4, 0.45, 0.45, 0.45], fontSize: 12 });
  caption(s, 'Same stages and the same two API pods, with the SearchCache flag off for two minutes beforehand.', 0.6, 6.5, 7.3);
  bullets(s, [
    ['Verified off:', 'Prometheus shows 0 hits and 0 misses during the run.'],
    ['Count check:', 'client sent 64,374, Prometheus counted 64,374.'],
    ['Result:', 'within 7 % of cache on at 16 workers (521 against 556 req/s).'],
  ], { x: 8.0, y: 3.5, w: 4.73, h: 3.2, fontSize: 14 });
}

{
  const s = content('What the numbers taught me',
    'On 26 November the same test gave 135 requests per second with the cache on and 40 with it off, so the cache looked 3.4 times faster. The reason was that the PostgreSQL pod had a very small CPU limit: first the chart default of 150 millicores, then a 1 core limit I set myself. Without the limit the database path is fast and the cache gains about 7 percent. The cache still removes 80 percent of the queries from PostgreSQL, so its value is protecting the database when load or data grows. The same limit capped the indexing pipeline: with 1 CPU, one and four workers took the same time. Lesson: check resource limits before you trust a bottleneck.');
  s.addChart(pres.charts.LINE, [
    { name: 'Database limited to 1 CPU', labels: ['1 + 1', '2 + 2', '4 + 4'], values: [21.4, 16.8, 20.1] },
    { name: 'No database CPU limit', labels: ['1 + 1', '2 + 2', '4 + 4'], values: [24.6, 12.7, 10.4] },
  ], Object.assign({}, chartBase, { x: 0.6, y: 1.4, w: 6.1, h: 3.9, chartColors: [HEX.accent5, HEX.accent1], lineSize: 3, lineDataSymbolSize: 9, showLegend: true, legendPos: 'b', showValue: true, dataLabelPosition: 't', title: 'Reindex time in seconds, tokenizers + writers', valAxisMinVal: 0 }));
  bullets(s, [
    ['Cache:', 'looked 3.4× faster (135 vs 40 req/s). Without the database limit it is 7 % faster (556 vs 521).'],
    ['Pipeline:', 'with a 1 CPU database limit, 1 and 4 workers took the same time; without it, 24.6 s fell to 10.4 s.'],
    ['Proof:', 'the pod was throttled in 884 of 4,045 scheduling periods (135 s in total).'],
    ['Still true:', 'the cache takes 80 % of the queries off PostgreSQL, so it protects the database as load or data grows.'],
  ], { x: 7.0, y: 1.4, w: 5.7, h: 5.2, fontSize: 16, paraSpaceAfter: 12 });
  text(s, 'Fix: removed the CPU limit on PostgreSQL (the memory limit stays), like the other manifests.', { x: 0.6, y: 5.55, w: 6.1, h: 0.9, fontSize: 14, color: C.text2 });
}

{
  const s = content('Caching: position and design',
    'The exam requires a position on caching. Cache-aside in the API: look up a SHA-256 key of the request, return on a hit, otherwise search and store. One-minute sliding expiry keeps popular queries warm; a five-minute absolute limit stops a repeated query from serving the same result forever. Redis is limited to 64 MB with allkeys-lru, because every key is an equal-value cached result, and runs below the container limit so it evicts instead of being killed. If Redis fails the API falls back to PostgreSQL and counts the failure.');
  bullets(s, [
    ['Pattern:', 'cache-aside in the API; the key is a SHA-256 of the request.'],
    ['Expiry:', '1 minute sliding plus 5 minutes absolute, so results cannot go stale for ever.'],
    ['Memory:', 'Redis capped at 64 MB with allkeys-lru; eviction instead of an out-of-memory kill.'],
    ['Failure:', 'on a Redis error the API answers from PostgreSQL and counts it (searchv2.cache_errors).'],
    ['Position:', 'one Redis pod is enough; the cache holds only recalculable data. It scales by replicas, then Redis Cluster.'],
  ], { x: 0.6, y: 1.4, w: 5.8, h: 5.3, fontSize: 15 });
  pic(s, SHOT + 'grafana-cache-both.png', 6.7, 1.45, 6.03, 1.6);
  caption(s, 'Hit ratio about 80 % in run A; nothing at all when the flag was off (run B).', 6.7, 3.1, 6.03);
  pic(s, SHOT + 'grafana-outage-cache.png', 6.7, 3.65, 6.03, 1.6);
  caption(s, 'During the Redis outage: errors counted, answers still returned.', 6.7, 5.3, 6.03);
}

{
  const s = content('The indexer on the dashboard',
    'These six panels were added for the pipeline. Top: queue depth and connected workers. Middle: reindex time and throughput per worker combination, reported by the Job itself when it finishes and kept for 24 hours in Prometheus. Bottom: throughput and time per document for each stage, reported by the workers. The 1+1 run took 21.4 s and the 4+4 run 8.9 s; the bottom right shows the writer spending about ten times longer per document than the tokenizer.');
  pic(s, SHOT + 'grafana-indexing-all.png', 0.6, 1.35, 8.0, 5.3);
  bullets(s, [
    ['Run panels:', 'duration and documents per second, labelled with the worker counts.'],
    ['Stage panels:', 'documents per second and time per document, per stage.'],
    ['How:', 'System.Diagnostics.Metrics in the code, OpenTelemetry exporter in Program.cs, same collector as the API.'],
  ], { x: 8.9, y: 1.4, w: 3.85, h: 5.3, fontSize: 14 });
}

{
  const s = content('Pipeline: failures and per-stage time',
    'Two failure tests on the live cluster. First, a writer pod and a tokenizer pod were force-deleted in the middle of a run: the run still finished, in 13.5 seconds instead of 12.7, and the index was identical to a clean run. Second, a message the tokenizer cannot process, a path outside the document folder: it was logged, retried once, and then dead-lettered with its history, while the pipeline kept going, and the IndexingMessagesFailed alert fired after one minute. The chart on the right is the average time per document per stage.');
  table(s, ['Test', 'What happened'], [
    ['Writer pod and tokenizer pod force-deleted mid-run', 'Run finished: 3,034 documents, 0 failed, 13.5 s (12.7 s normal). Index identical to a clean run: 25,258 words, 462,828 occurrences, no duplicates.'],
    ['Message the tokenizer cannot process (path outside the document folder)', 'Logged "will retry", retried once, logged "giving up", landed in the failed queue with its history. Pipeline kept going. IndexingMessagesFailed fired after 1 minute.'],
    ['Eight parallel writers on overlapping words (integration test)', 'No deadlock, no duplicate words; redelivery of the same message is harmless.'],
  ], { x: 0.6, y: 1.45, w: 7.4, colW: [2.9, 4.5], rowH: [0.4, 1.35, 1.35, 1.0], fontSize: 13 });
  s.addChart(pres.charts.BAR, [{ name: 'ms per document', labels: ['Tokenizer', 'Writer'], values: [1.3, 9.6] }],
    Object.assign({}, chartBase, { x: 8.3, y: 1.4, w: 4.4, h: 3.6, barDir: 'col', chartColors: [HEX.accent6], showLegend: false, showValue: true, dataLabelPosition: 'outEnd', title: 'Average time per document (ms)', valAxisMinVal: 0 }));
  text(s, 'The writer is about seven times slower per document than the tokenizer, which is why adding writers is what helps.', { x: 8.3, y: 5.15, w: 4.4, h: 1.4, fontSize: 14, color: C.text2 });
}

{
  const s = content('PostgreSQL in Kubernetes',
    'PostgreSQL runs in the cluster, installed with the Bitnami Helm chart: a StatefulSet pod with a 2 GiB volume that survives pod replacement. The image tag floats because Bitnami no longer publishes versioned tags, which is a risk I wrote down: a major-version jump against an existing volume would need a dump and restore, but the index is derived data, so re-indexing is the recovery. Resources are explicit now, with no CPU limit. The metrics exporter feeds the two panels below. In production I would use a managed PostgreSQL.');
  bullets(s, [
    ['Why in the cluster:', 'the exam environment is one laptop, so a managed database would need an account and a network path; keeping it inside also lets the load test measure it.'],
    ['Cost:', 'we own upgrades, backups and failover; performance is shared with every other pod.'],
    ['Hardening:', 'explicit requests (250m CPU, 256 MiB), memory limit 512 MiB, no CPU limit, metrics exporter.'],
    ['Backup:', 'the index is derived data; recovery is to run the indexer again.'],
    ['Production:', 'a managed PostgreSQL or an operator, pinned images, real backups.'],
  ], { x: 0.6, y: 1.4, w: 6.3, h: 5.3, fontSize: 15 });
  pic(s, SHOT + 'grafana-postgres.png', 7.1, 1.5, 5.63, 1.5);
  caption(s, 'Connections and buffer cache hit ratio from the postgres-exporter.', 7.1, 3.05, 5.63);
  card(s, 7.1, 3.6, 5.63, 2.9, 'Z-axis and read replicas', 'Sharding by document is designed (next slide) but not built. Read replicas are documented as a decision and not adopted: they add read throughput, not capacity, and the cache already absorbs repeated queries.', { accent: HEX.accent3, size: 14 });
}

{
  const s = content('Z-axis design: sharding the index by document',
    'The exam requires showing how a database could scale on the z-axis. This is a design, not code. The index is split by document into buckets and shards. A router in the API (ShardedDocumentIndex behind the same IDocumentIndex interface) sends each query to every shard, a scatter-gather, and merges the results by score, which is only a sort. The word table is replicated to every shard. I chose sharding by document over sharding by word because the score is a per-document count, so each shard can run the existing SQL unchanged; sharding by word needs a distributed sum.');
  node(s, 0.9, 3.2, 2.3, 1.1, 'search-api\nShardedDocumentIndex\n(reception / router)', { line: C.accent1, bold: true, size: 13 });
  node(s, 4.6, 1.5, 2.6, 1.1, 'Shard A\ndocuments in buckets 0-9\n+ copy of word table', { line: C.accent3, size: 13 });
  node(s, 4.6, 3.2, 2.6, 1.1, 'Shard B\ndocuments in buckets 10-19\n+ copy of word table', { line: C.accent3, size: 13 });
  node(s, 4.6, 4.9, 2.6, 1.1, 'Shard C\ndocuments in buckets 20-29\n+ copy of word table', { line: C.accent3, size: 13 });
  arrow(s, 3.2, 3.55, 4.6, 2.1); arrow(s, 3.2, 3.75, 4.6, 3.75, 'scatter'); arrow(s, 3.2, 3.95, 4.6, 5.45);
  node(s, 0.9, 5.0, 2.3, 0.9, 'indexer writers\nhash(document) → bucket → shard', { size: 12, line: C.accent6 });
  card(s, 7.7, 1.5, 5.03, 2.3, 'Gain', 'Capacity grows with the number of shards; each query runs the existing SQL on every shard; the merge is just a sort by score.', { accent: HEX.accent4, size: 14 });
  card(s, 7.7, 4.0, 5.03, 2.8, 'Cost and downsides', 'Every query touches every shard; resharding means moving buckets; the word table must be kept identical on all shards; more databases to back up and monitor.', { accent: HEX.accent5, size: 14 });
}

{
  const s = content('Rolling updates and rollback',
    'Rolling updates use maxSurge 1 and maxUnavailable 0 with readiness probes, so old pods keep serving while a new one starts. revisionHistoryLimit is 5 and each release is annotated with a change cause. The demo releases an image tag that does not exist: the new pod never becomes Ready, the old pods stay in the Service, 253 of 253 requests during the bad release returned 200, and one command rolled it back. The schema note: the indexer drops and recreates the tables, so if a release changed the schema, roll back the API and re-run the indexer.');
  const text1 = [
    '=== 1. Bad release: image tag that does not exist',
    'search-api-854b459d86-dbdkc   0/1   ErrImageNeverPull',
    'search-api-d947c8b47-p6j99    1/1   Running',
    'search-api-d947c8b47-xsg24    1/1   Running',
    'As expected: the rollout does not complete.',
    '',
    '=== 2. Did users notice?   253 requests: 253 x 200',
    '',
    '=== 3. Roll back:  deployment.apps/search-api rolled back',
    '',
    '=== 4. History (change causes)',
    'REVISION  CHANGE-CAUSE',
    '9         demo: release ...:does-not-exist (broken on purpose)',
    '10        rollback: back to ...:1.0.1',
  ].join('\n');
  terminal(s, text1, 0.6, 1.4, 7.4, 5.3, 12);
  bullets(s, [
    ['Strategy:', 'RollingUpdate, maxSurge 1, maxUnavailable 0, readiness probes on /healthz.'],
    ['History:', 'revisionHistoryLimit 5, change-cause on every release.'],
    ['Barrier:', 'a pod that is not Ready never receives traffic.'],
    ['Schema:', 'roll back the API and re-run the indexer together.'],
    ['Limit:', 'not tested under real user traffic; cannot catch a release that starts but is wrong (the flag covers that).'],
  ], { x: 8.3, y: 1.4, w: 4.43, h: 5.3, fontSize: 14 });
}

// ======================================================================
// PART 5: decisions, limits, questions
// ======================================================================
newSection('Decisions and questions');
divider('Decisions, limits and questions', 'The choices behind the system, what is not done, and the questions I should be ready for.', 'Backup section: prepare for the 15-20 minutes of questions.');

{
  const s = content('Decisions and why',
    'Each decision has a reason, a cost and a production alternative; the full text is in k8s/DECISIONS.md. Read the reasons through before the exam and change any you would not say yourself, because you have to defend them.');
  table(s, ['Decision', 'Why', 'In production'], [
    ['PostgreSQL in the cluster', 'One laptop; self-contained demo; the load test can measure it', 'A managed PostgreSQL, pinned images, real backups'],
    ['Plain manifests + OpenTelemetry, not the guide\'s Helm charts', 'One collector to change backends; four small manifests are easy to explain', 'The charts, plus Alertmanager and longer retention'],
    ['hostPath volume for the documents', 'Simplest volume both pods can read on one node', 'Object storage or a shared volume'],
    ['RabbitMQ for the pipeline', 'Named in the exam; competing consumers and dead letters fit the job', 'A clustered broker with persistent queues'],
    ['Search synchronous, indexing asynchronous', 'A user waits for search; nobody waits for one document', 'Same; search agents could be another consumer'],
    ['No CPU limit on PostgreSQL', 'A 1 CPU limit throttled it and hid the pipeline scaling', 'Limits set from measurements, with headroom'],
  ], { x: 0.6, y: 1.45, w: 12.13, colW: [3.5, 5.0, 3.63], rowH: [0.4, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8], fontSize: 13 });
}

{
  const s = content('The scaling cube applied',
    'X is cloning, Y is splitting the code or data by function, Z is splitting by request or by data of the same type. The API is cloned (x). Indexing is split into services (y) and each stage is cloned (x). The database z-axis is a design only.');
  table(s, ['Axis', 'Search API', 'Indexing', 'Data'], [
    ['X: clone', '2 identical pods behind a Service', 'Tokenizers and writers cloned independently', 'Read replicas documented, not adopted'],
    ['Y: split by function', 'GUI and API are separate services', 'Crawler, tokenizer, writer are separate services joined by queues', '(not applicable)'],
    ['Z: split by data', 'Not applied', 'Not applied', 'Sharding by document: designed, not built'],
  ], { x: 0.6, y: 1.5, w: 12.13, colW: [2.2, 3.1, 3.7, 3.13], rowH: [0.45, 1.1, 1.1, 1.1], fontSize: 14 });
  text(s, 'Module 3 y-scale roadmap: interface and factory, copy the code behind an API, proxy it. The search logic is behind ISearchService and the GUI calls it over HTTP, so the first steps are in place; the pipeline stages use messages instead of an API and a proxy.', { x: 0.6, y: 5.9, w: 12.1, h: 1.0, fontSize: 15 });
}

{
  const s = content('What is not done',
    'Be honest about the gaps; the examiner will find them. Each has a reason and a next step.');
  bullets(s, [
    ['Z-axis sharding:', 'designed, not built.'],
    ['Alertmanager:', 'alerts show on the Prometheus page and the dashboard; nobody is notified.'],
    ['RabbitMQ:', 'one pod, no persistence; a restart during a run was not tested (the Job would stop after two minutes without progress).'],
    ['Search during a reindex:', 'incomplete, so the API is stopped first; a real system would swap in a new set of tables.'],
    ['Redis outage:', 'every search takes about 4 s because Redis is tried twice; a circuit breaker is not built.'],
    ['Autoscaling:', 'worker counts are set by hand; scaling on queue length (KEDA) is the next step.'],
    ['Alerts exercised:', 'MetricsPipelineDown and ServerErrorRateHigh were only checked for loading, not made to fire.'],
    ['Diagrams:', 'the PlantUML sources for the deployment and indexer class diagrams were updated but not re-rendered.'],
    ['Search agents, snippets, score, termnet:', 'descoped on purpose.'],
  ], { x: 0.6, y: 1.4, w: 12.1, h: 5.4, fontSize: 17, paraSpaceAfter: 10 });
}

{
  const s = content('Likely questions, and where the answers are',
    'Use this as a revision list. The answer column is the short version; the files named have the detail.');
  table(s, ['Question', 'Short answer', 'Where'], [
    ['Why Redis, what is cached, what happens when it dies?', 'Cache-aside, 1 min sliding + 5 min absolute, 64 MB LRU; on failure the API falls back to PostgreSQL (slower, not broken)', 'k8s/CACHING.md'],
    ['What was the bottleneck and how do you know?', 'The database path; and a CPU limit on the database was throttling it (884 of 4,045 periods)', 'k8s/PERFORMANCE-TEST.md'],
    ['How would the database scale on the z-axis?', 'Shard by document into buckets, scatter-gather in the API, replicate the word table', 'k8s/DATABASE-SCALING.md'],
    ['Why a message bus, and why RabbitMQ?', 'Decouples stages, scales them separately, survives worker crashes; RabbitMQ is named in the exam', 'k8s/INDEXING-PIPELINE.md'],
    ['What if a worker dies or a message is bad?', 'Redelivery plus idempotent writes; retry once then dead-letter; tested live', 'k8s/INDEXING-PIPELINE.md'],
    ['Secrets versus ConfigMaps?', 'Secrets are base64, not encrypted; generated by start.sh, never in git', 'c4reference/ decision log'],
    ['Why is the document volume a hostPath?', 'Simplest on one node; production would use object storage or a shared volume', 'k8s/DECISIONS.md'],
    ['How do you know something is wrong?', '9 alert rules, Grafana dashboard; no Alertmanager so nobody is notified', 'k8s/README.md, Alerting'],
  ], { x: 0.6, y: 1.4, w: 12.13, colW: [3.9, 6.0, 2.23], rowH: [0.38, 0.56, 0.56, 0.56, 0.56, 0.56, 0.56, 0.56, 0.56], fontSize: 12 });
}

{
  const s = content('Numbers to remember',
    'A cheat sheet. Know where each number came from.');
  const stats = [
    ['556', 'req/s at 16 workers, cache on (p95 42 ms)'],
    ['0', 'errors in 68,325 requests'],
    ['80 %', 'cache hit ratio (55,233 hits, 13,951 misses)'],
    ['+7 %', 'throughput from the cache once the database is healthy'],
    ['24.6 → 8.4 s', 'full reindex with 1+1 versus 8+8 workers'],
    ['1.3 vs 9.6 ms', 'per document: tokenizer versus writer'],
    ['3,034', 'documents; 25,258 words; 462,828 occurrences'],
    ['4 s', 'per search with Redis down (and still no errors)'],
  ];
  const accents = [C.accent1, C.accent4, C.accent2, C.accent5, C.accent6, C.accent3, C.accent1, C.accent2];
  stats.forEach((st, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    stat(s, 0.6 + col * 3.07, 1.6 + row * 2.6, 2.9, st[0], st[1], accents[i], i >= 4 ? 30 : 44);
  });
}

{
  const s = content('Where everything is',
    'Seven repositories under github.com/searchv2. The searchv2 repository holds the deployment, the documentation and this deck; each project has its own repository with its tests under tests/.');
  table(s, ['Repository / folder', 'Contents'], [
    ['searchv2', 'k8s/ (manifests, start.sh, docs), uml/, c4reference/, BACKLOG.md, presentation/'],
    ['search-api', 'ASP.NET Core search API (Core, Application, Infrastructure, Api) and tests/SearchAPI.Tests'],
    ['blazor-client-gui', 'Blazor Server GUI and tests/BlazorClientGui.Tests'],
    ['indexer', 'The indexer: batch mode and the pipeline roles, with tests/Indexer.Tests'],
    ['load-balancer', 'Own load balancer (docker compose only) and its tests'],
    ['search-utilities, console-search', 'Shared search model and tokenizer; console client (out of scope)'],
  ], { x: 0.6, y: 1.45, w: 12.13, colW: [3.5, 8.63], rowH: [0.4, 0.65, 0.65, 0.65, 0.65, 0.65, 0.65], fontSize: 14 });
  text(s, [
    { text: 'Start: ', options: { bold: true } },
    { text: './k8s/start.sh   ', options: {} },
    { text: 'Tests: ', options: { bold: true } },
    { text: 'python3 k8s/test-start.py · python3 k8s/smoke-test.py · dotnet test in each repository', options: {} },
  ], { x: 0.6, y: 6.1, w: 12.1, h: 0.6, fontSize: 14 });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
