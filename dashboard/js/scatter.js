/* "Compare" view: the question of the lens, as a chart.
   The lens bar ("Exporters", "Importers", "Which side", "Balance", "Specialisation") is the same one that drives the map: each
   lens has one chart for every kind of dot, so the map, the chart and the table always talk about the same thing. Every chart
   carries its question as a title, one sentence computed from the dots on screen (facts → text), the lines that divide it
   (world growth, balance, RCA 1 …) and, for the selected dot, its path over the years.
   WHAT A DOT IS ("Each dot is one …"):
   - economy: the two axes are the suggestion of the lens and can be changed in the two menus on the axes (IND below).
     Under the Importers lens every indicator is its import-side twin (kind "D"); values that rest on the exporters' reports
     because the economy did not report imports are drawn hollow (†), as on the map.
   - region: the 20 sub-regions of the UN's M49 standard. Together they are the world and none overlaps another.
   - group: development groups and other groupings (BRICS, EU, OECD, G20, G-77). They overlap: their bubbles do not add up.
     Regions and groups use the same axes and menus as economies. Their growth is like for like (members that reported in
     both years) and their ratios are over the members that reported (core.js, indicators 5 and 9).
   - slice: the slices of the selected economy or group, or of the world's pizza when nothing is selected.
   WHAT THE COLOUR IS ("Colour" in the key, SCHEMES below): a classification, never decoration. A name in the key is a door:
   it selects that region, development group or slice everywhere in the explorer.
   Axes keep one domain for all years, so bubbles move smoothly when the time line plays. */
(function () {
"use strict";
const NP = window.NP, I = NP.ind, Y = NP.YEARS, W = NP.W;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pct = v => NP.fmtPct(v, Math.abs(v) < 0.1 ? 1 : 0), pct0 = v => NP.fmtPct(v, 0), usd = v => NP.fmtUSD(v).replace("US$", "$");
const si = v => d3.format(".3~s")(v);
const pctLog = v => (v == null || !isFinite(v) ? "–" : +(v * 100).toPrecision(v < 0.1 ? 1 : 2) + "%");       // ticks of a logarithmic axis: 0.003%, 0.3%, 30%
const rcaSafe = (n, e, y) => { const m = I.merchShare(n, e, y); return m != null && m <= 1 ? I.rcaBalassa(n, e, y) : null; };
NP.rcaSafe = rcaSafe;
const y5 = y => Math.max(Y[0], y - 5), y10 = y => Math.max(Y[0], y - 10);
const word = k => (k === "D" ? "imports" : "exports"), Word = k => (k === "D" ? "Imports" : "Exports"), other = k => (k === "D" ? "X" : "D");
const FLOOR = 1e6, FLOOR_SLICE = 1e5;      // smallest trade value drawn: an economy, region or group (US$1 million), a slice of one economy (US$100,000)
const LOW = 5000, HIGH = 20000;            // GDP per capita marks used in the sentence of the "Which side" chart
NP.SCATTER_RULES = { FLOOR, FLOOR_SLICE, LOW, HIGH };
const growth = (n, e, y, k) => (y > Y[0] ? I.cagr(n, e, y5(y), y, k) : null);

/* ───────── indicators for the axes (dots = economies, regions, groups) ─────────
   label(kind), fn(node, economy, year, kind), log?, tick format, ref(node, year, kind) = value of a dividing line, refText,
   trim = share of all values over the years that the axis covers (the rest sticks to the edge). */
const IND = NP.SCATTER_IND = {
  exports: { label: k => `${Word(k)} of the slice (US$)`, fn: (n, e, y, k) => NP.side(k)(n, e, y), log: true, fmt: usd, trim: [0.03, 1] },
  m:       { label: k => `${Word(other(k))} of the slice (US$)`, fn: (n, e, y, k) => NP.side(other(k))(n, e, y), log: true, fmt: usd, trim: [0.03, 1], imp: k => k !== "D" },
  share:   { label: k => `Share of world ${word(k)}`, fn: (n, e, y, k) => I.worldShare(n, e, y, k), log: true, fmt: pctLog, tip: v => NP.fmtShare(v), trim: [0.03, 1] },
  growth:  { label: k => `Growth of ${word(k)}, % a year over 5 years`, fn: growth, fmt: v => NP.fmtSigned(v), ref: (n, y, k) => growth(n, W, y, k), refText: v => `World ${NP.fmtSigned(v)} a year`, trim: [0.05, 0.95] },
  net:     { label: () => "Net position (−1 only imports … +1 only exports)", fn: (n, e, y) => I.netRatio(n, e, y), fmt: v => d3.format("+.1f")(v), ref: () => 0, refText: () => "balanced", imp: () => true },
  subs:    { label: k => (k === "D" ? "Substitutes, share of its imports of plastics + substitutes" : "Substitutes, share of its pizza"), fn: (n, e, y, k) => I.subsShare(e, y, k), fmt: pct0, ref: (n, y, k) => I.subsShare(W, y, k), refText: v => `World ${pct0(v)}` },
  va:      { label: k => `Value-added products, share of its substitutes ${word(k)}`, fn: (n, e, y, k) => I.valueAddedShare(e, y, k), fmt: pct0 },
  plfinal: { label: k => `Final goods, share of its plastics ${word(k)}`, fn: (n, e, y, k) => I.plasticsStageShare("P_04", e, y, k), fmt: pct0 },
  pizza:   { label: k => (k === "D" ? "The slice, share of its imports of plastics + substitutes" : "The slice, share of its pizza"), fn: (n, e, y, k) => (n === "ALL" ? null : I.pizzaShare(n, e, y, k)), log: true, fmt: pctLog, tip: pct },
  rca:     { label: () => "RCA of its exports (Balassa index)", fn: rcaSafe, log: true, fmt: v => d3.format("~g")(v), tip: v => NP.fmtNum(v, v < 10 ? 2 : 0), ref: () => 1, refText: () => "RCA 1" },
  merch:   { label: () => "The slice, share of all its goods exports", fn: (n, e, y) => { const m = I.merchShare(n, e, y); return m != null && m <= 1 ? m : null; }, log: true, fmt: pctLog, tip: pct },
  hhi:     { label: k => (k === "D" ? "Product concentration of its imports (HHI)" : "Product concentration of its pizza (HHI)"), fn: (n, e, y, k) => I.productHHI(e, y, k), fmt: v => d3.format(".2f")(v) },
  gdp:     { label: k => `${Word(k)} of the slice, % of GDP`, fn: (n, e, y, k) => I.gdpShare(n, e, y, k), log: true, fmt: pctLog, tip: v => NP.fmtPct(v, v < 0.01 ? 2 : 1) },
  percap:  { label: k => `${Word(k)} of the slice per person (US$)`, fn: (n, e, y, k) => I.perCapita(n, e, y, k), log: true, fmt: v => "$" + si(v) },
  gdppc:   { label: () => "GDP per capita (US$)", fn: (n, e, y) => NP.gdppc(e, y), log: true, fmt: v => "$" + si(v) },
  pop:     { label: () => "Population", fn: (n, e, y) => NP.pop(e, y), log: true, fmt: si },
  open:    { label: () => "All goods exports, % of GDP", fn: (n, e, y) => NP.openness(e, y), log: true, fmt: pctLog, tip: pct0 },
  pci:     { label: () => "Productive capacities index (UNCTAD PCI)", fn: (n, e, y) => NP.pci(e, y), fmt: v => d3.format(".0f")(v) },
  pcinat:  { label: () => "PCI: natural capital", fn: (n, e, y) => NP.pciNat(e, y), fmt: v => d3.format(".0f")(v) },
  conc:    { label: () => "Export concentration, all goods (UNCTAD index)", fn: (n, e, y) => NP.conc(e, y), fmt: v => d3.format(".2f")(v) },
  divers:  { label: () => "Export diversification index (UNCTAD)", fn: (n, e, y) => NP.divers(e, y), fmt: v => d3.format(".2f")(v) },
};
/* the axis menus follow the same layers as the panel: plastics and substitutes first, general context last */
const AXIS_GROUPS = NP.SCATTER_GROUPS = [["The slice", ["exports", "m", "share", "growth", "net", "pizza", "gdp", "percap"]], ["Its pizza: what it is made of", ["subs", "va", "plfinal", "hhi"]],
  ["Specialisation", ["rca", "merch"]], ["The economy as a whole (context)", ["gdppc", "pop", "open", "pci", "pcinat", "conc", "divers"]]];
/* the suggestion of each lens when dots are economies, regions or groups. size = the slice whose value sets the bubble area */
const ECO = NP.SCATTER_ECO = {
  exp: () => ({ x: "exports", y: "growth" }), dst: () => ({ x: "exports", y: "growth" }),
  mix: () => ({ x: "gdppc", y: "subs", size: "ALL" }),
  net: () => ({ x: "exports", y: "m", diag: true }),
  rca: st => ({ x: "share", y: st.spec === "merch" ? "merch" : st.spec === "pizza" && st.node !== "ALL" ? "pizza" : "rca" }),
};

/* ───────── what a dot stands for ───────── */
const nm = e => NP.shortName(e), sliceName = id => NP.node[id].name;
const SUBS = NP.SCOPES.filter(s => s.kind === "sub"), GRPS = NP.SCOPES.filter(s => s.kind === "dev" || s.kind === "other");
const DOTS = NP.SCATTER_DOTS = {
  eco: { one: "economy", many: "economies", list: NP.countries, label: e => NP.eco[e].iso || nm(e), name: e => NP.eco[e].n, short: nm },
  reg: { one: "region", many: "regions", list: SUBS.map(s => s.e), label: e => NP.scope(e).short, name: e => NP.scope(e).name, short: e => NP.scope(e).short, agg: true },
  grp: { one: "group", many: "groups", list: GRPS.map(s => s.e), label: e => NP.scope(e).short, name: e => NP.scope(e).name, short: e => NP.scope(e).short, agg: true },
};
const modeOf = st => (st.sm === "slices" || DOTS[st.sm] ? st.sm : "eco");
NP.SCATTER_MODES = ["eco", "reg", "grp", "slices"];

/* ───────── what the colour stands for ─────────
   Hues: continents as on the rest of the page; development status in UN yellow (its darkest step = least developed, a part of
   the developing economies) against purple; plastics blue and substitutes green are kept for the pizza itself. */
const REG_COLOR = { "5100": "#fbaf17", "5200": "#eb1f48", "5300": "#009edb", "5400": "#a066aa", "5500": "#72bf44" };
const FAM_COLOR = { pl: "#004990", sub: "#27833a" }, DEV_COLOR = { "1500": "#a05fb4", "1400": "#fbaf17", "1610": "#b06e2a" }, KIND_COLOR = { dev: "#d67c29", other: "#a05fb4" }, NO_CLASS = "#aea29a";
const SCHEMES = NP.SCATTER_SCHEMES = {
  eco: [["reg", "Region"], ["dev", "Development status"], ["mix", "Plastics or substitutes"]],
  reg: [["reg", "Continent"], ["mix", "Plastics or substitutes"]],
  grp: [["kind", "Kind of group"], ["mix", "Plastics or substitutes"]],
  slices: [["fam", "Plastics or substitutes"], ["tier", "As in the pizza"]],
};
const MIX_NAMES = ["under 10% substitutes", "10–25%", "25–50%", "50–75%", "75–90%", "90% or more"];
const STAGE_KEY = { P_01: "Plastics: primary forms", P_02: "intermediate forms", P_03: "intermediate goods", P_04: "final goods", P_05: "waste" };
/* → { key, cls(d) = class of a dot, color(class), items: [{k, label, on, pick}] }. pick = what a click on the name in the key selects */
function schemeOf(st, mode, kind) {
  const opts = SCHEMES[mode], key = opts.some(o => o[0] === st.sk) ? st.sk : opts[0][0], at = c => NP.ecoIdx[c];
  const eco = c => ({ on: st.eco === at(c), pick: () => NP.app.set({ eco: st.eco === at(c) ? null : at(c) }) });
  const nod = id => ({ on: st.node === id, pick: () => NP.app.set({ node: st.node === id ? "ALL" : id }) });
  if (key === "reg") return { key, cls: mode === "reg" ? d => NP.scope(d.key).parent : d => NP.eco[d.key].reg || null, color: c => REG_COLOR[c] || NO_CLASS,
    items: NP.REGIONS.map(([c, n]) => Object.assign({ k: c, label: n }, eco(c))) };
  if (key === "dev") return { key, cls: d => { const E = NP.eco[d.key]; return E.ldc ? "1610" : E.dev || null; }, color: c => DEV_COLOR[c] || NO_CLASS,
    items: [["1500", "Developed"], ["1400", "Developing"], ["1610", "Least developed"]].map(([c, n]) => Object.assign({ k: c, label: n }, eco(c))) };
  if (key === "mix") return { key, pale: true, cls: d => { const s = I.subsShare(d.key, st.year, kind); return s == null ? null : NP.scales.cls(s, NP.scales.MIX_BREAKS); }, color: c => (c == null ? NO_CLASS : NP.scales.MIX_RAMP[c]),
    items: MIX_NAMES.map((n, i) => ({ k: i, label: n })) };
  if (key === "kind") return { key, cls: d => (NP.scope(d.key).kind === "dev" ? "dev" : "other"), color: c => KIND_COLOR[c], items: [{ k: "dev", label: "Development groups" }, { k: "other", label: "Other groupings" }] };
  if (key === "tier") { const tier = id => (NP.node[id].family === "pl" ? id : NP.ancestors(id).find(a => a.id === "NPS101" || a.id === "NPS102").id), ids = NP.node.P_00.children.map(c => c.id).concat("NPS102", "NPS101");
    return { key, pale: true, cls: d => tier(d.key), color: c => NP.node[c].color, items: ids.map(id => Object.assign({ k: id, label: STAGE_KEY[id] || NP.node[id].name }, nod(id))) }; }
  return { key: "fam", cls: d => NP.node[d.key].family, color: c => FAM_COLOR[c], items: [Object.assign({ k: "pl", label: "Plastics" }, nod("P_00")), Object.assign({ k: "sub", label: "Substitutes" }, nod("NPS000"))] };
}

/* ───────── markup ───────── */
const host = document.getElementById("scatter");
host.innerHTML = `<div class="sc-side">
    <div class="sc-dots"><span class="tb-cap">Each dot is one</span><div class="tb-seg" id="sc-mode" role="group" aria-label="What a dot stands for">
      <button class="btn-toggle" data-v="eco" title="Every economy that trades the slice">economy</button><button class="btn-toggle" data-v="reg" title="The 20 sub-regions of the world: together they are the world, none overlaps another">region</button><button class="btn-toggle" data-v="grp" title="Development groups, BRICS, European Union, OECD, G20, G-77: they overlap">group</button><button class="btn-toggle" data-v="slices" title="The slices of the pizza of the world, or of the economy or group that is selected">slice</button></div></div>
    <div class="sc-eye" id="sc-eye"></div><h4 id="sc-title"></h4><p class="sc-find" id="sc-find" aria-live="polite"></p><p class="sc-sel hidden" id="sc-sel"></p>
    <div class="sc-keyblock"><label class="sc-colby">Colour <select id="sc-col" aria-label="What the colour of the dots stands for"></select></label><div class="sc-leg" id="sc-leg"></div></div>
    <p class="sc-hint" id="sc-hint"></p></div>
  <div class="sc-main">
    <div class="sc-yrow"><span class="sc-arr">↑</span><select id="sc-y" aria-label="Indicator on the vertical axis"></select><span class="sc-axt" id="sc-yt"></span><button class="btn-line hidden" id="sc-reset" title="Back to the chart suggested for this lens">↺ Suggested chart</button></div>
    <div class="sc-body"><svg id="sc-svg" role="img"></svg></div>
    <div class="sc-xrow"><span class="sc-note" id="sc-note"></span><span class="sc-xr"><select id="sc-x" aria-label="Indicator on the horizontal axis"></select><span class="sc-axt" id="sc-xt"></span><span class="sc-arr">→</span></span></div>
  </div>`;
const $ = s => host.querySelector(s), sx = $("#sc-x"), sy = $("#sc-y"), scol = $("#sc-col");
sx.onchange = () => NP.app.set({ sx: sx.value }); sy.onchange = () => NP.app.set({ sy: sy.value });
scol.onchange = () => NP.app.set({ sk: scol.value });
$("#sc-reset").onclick = () => NP.app.set({ sx: null, sy: null });
host.querySelectorAll("#sc-mode button").forEach(b => { b.onclick = () => NP.app.set({ sm: b.dataset.v }); });
let keyPick = {};                                                          // class → what a click on its name selects
$("#sc-leg").addEventListener("click", ev => { const k = ev.target.closest("[data-k]"); if (k && keyPick[k.dataset.k]) keyPick[k.dataset.k](); });
$("#sc-leg").addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { const k = ev.target.closest("[data-k]"); if (k && keyPick[k.dataset.k]) { ev.preventDefault(); keyPick[k.dataset.k](); } } });
const svg = d3.select("#sc-svg"), gYear = svg.append("text").attr("class", "sc-year"), gAx = svg.append("g"), gTrail = svg.append("g"), gHover = svg.append("g"), gBub = svg.append("g"), gNote = svg.append("g"), gLab = svg.append("g");
const dot = (c, hollow) => `<i class="sc-dot${hollow ? " hol" : ""}" style="${hollow ? "border-color" : "background"}:${c}"></i>`;
let menuKind = null, colMode = null;
function fillMenus(kind) { if (menuKind === kind) return; menuKind = kind;
  const h = AXIS_GROUPS.map(([g, keys]) => `<optgroup label="${g}">${keys.map(k => `<option value="${k}">${esc(IND[k].label(kind))}</option>`).join("")}</optgroup>`).join(""); sx.innerHTML = h; sy.innerHTML = h; }

/* ───────── scales ───────── */
const logTicks = sc => { const [a, b] = sc.domain(), dec = Math.log10(b / a), mult = dec > 5 ? [1] : dec > 2.5 ? [1, 3] : [1, 2, 5], out = [];
  for (let k = Math.floor(Math.log10(a)); k <= Math.ceil(Math.log10(b)); k++) for (const mm of mult) { const v = mm * Math.pow(10, k); if (v >= a && v <= b) out.push(v); }
  return dec > 9 ? out.filter((_, i) => i % 2 === 0) : out; };
function mkScale(log, ext, range) {
  if (log) return d3.scaleLog([ext[0] * 0.8, ext[1] * 1.25], range).clamp(true);
  const pad = (ext[1] - ext[0]) * 0.06 || 1; return d3.scaleLinear([ext[0] - pad, ext[1] + pad], range).clamp(true);
}
/* trimmed extent over all years, so that a single outlier year does not flatten the plot */
function extentAll(vals, log, trim) { const v = vals.filter(x => x != null && isFinite(x) && (!log || x > 0)).sort((a, b) => a - b); if (!v.length) return null;
  const q = p => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))], t = trim || [0.01, 0.99]; return [q(t[0]), q(t[1])]; }
const ok = (v, log) => v != null && isFinite(v) && (!log || v > 0);

/* ───────── the charts ─────────
   Each returns { key, ax, ay, make(year) → [{key, x, y, v, m}], diag, zones, facts(pts, year), text(F, year) …}.
   facts() counts the dots that are drawn (and not faded): the sentence under the title says what the reader sees. */
const lower = id => (id === "ALL" ? "plastics + substitutes" : sliceName(id).toLowerCase());
const list = (a, max) => { a = a.slice(); if (a.length > max) { const rest = a.length - (max - 1); a = a.slice(0, max - 1).concat(`${rest} others`); } return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; };
const top = (pts, f, k) => pts.slice().sort((a, b) => f(b) - f(a)).slice(0, k);
const notOwn = (e, y, node) => NP.impBasis(e, y, node) !== "own";
/* a scope inside a sentence: "the world", "Viet Nam", "developing economies" (plural), "Africa", "the European Union" */
const GROUP_WORDS = { "1400": ["developing economies", 1], "1500": ["developed economies", 1], "1610": ["the least developed countries", 1], "1620": ["landlocked developing countries", 1], "1640": ["small island developing States", 1],
  "5200": ["the Americas", 1], "5221": ["the Caribbean", 0], "5510": ["Oceania without Australia and New Zealand", 0], "2711": ["the BRICS", 1], "3412": ["the European Union", 0], "3905": ["the OECD", 0], "3916": ["the G20", 0], "3919": ["the Group of 77", 0] };
const scopeWords = S => { if (S === W) return { name: "the world", plural: false }; if (!NP.isGroup(S)) return { name: nm(S), plural: false };
  const w = GROUP_WORDS[NP.eco[S].c]; return w ? { name: w[0], plural: !!w[1] } : { name: NP.scopeName(S), plural: false }; };
const poss = n => n + (/s$/.test(n) ? "’" : "’s"), cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const over = (pts, ref) => (ref == null ? [] : pts.filter(d => d.y > ref));      // a missing dividing line is not zero

/* dots = economies, regions or groups */
function dotChart(st, mode) {
  const K = DOTS[mode], agg = !!K.agg, lens = ECO[st.lens] ? st.lens : "exp", kind = lens === "dst" ? "D" : "X", P = ECO[lens](st), node = st.node, sizeNode = P.size || node;
  const kx = IND[st.sx] ? st.sx : P.x, ky = IND[st.sy] ? st.sy : P.y, custom = kx !== P.x || ky !== P.y, ix = IND[kx], iy = IND[ky], f = NP.side(kind);
  const usesImp = kind === "D" || !!(ix.imp && ix.imp(kind)) || !!(iy.imp && iy.imp(kind)), diag = !custom && !!P.diag;
  /* the scope chosen in the header, on the map or in the key: which dots step back, which one is marked */
  const sc = NP.isGroup(st.eco) ? NP.scope(st.eco) : null; let inScope = null, sel = null, who = "", selNote = "";
  if (mode === "eco") { if (sc) { const set = new Set(NP.membersOf(st.eco)); inScope = e => set.has(e); who = ` in ${scopeWords(st.eco).name}`; } else if (st.eco != null) sel = st.eco; }
  else if (mode === "reg") {
    if (sc && sc.kind === "cont") { inScope = e => NP.scope(e).parent === sc.code; who = ` in ${scopeWords(st.eco).name}`; }
    else if (sc && sc.kind === "sub") sel = st.eco;
    else if (st.eco != null && !sc && NP.eco[st.eco].sub) { sel = NP.ecoIdx[NP.eco[st.eco].sub]; selNote = `the region of ${nm(st.eco)}`; } }
  else if (sc && K.list.includes(st.eco)) sel = st.eco;
  const sn = custom ? node : sizeNode, val = diag ? (e, y) => (NP.isReporter(e, y, node) ? NP.X(node, e, y) + NP.D(node, e, y) : 0) : (e, y) => f(sn, e, y);   // balance: exports + imports of those that reported exports
  const make = y => K.list.map(e => { const v = val(e, y); if (!(v >= FLOOR)) return null;
    const x = ix.fn(node, e, y, kind), yy = iy.fn(node, e, y, kind); return ok(x, ix.log) && ok(yy, iy.log) ? { key: e, x, y: yy, v, m: usesImp && notOwn(e, y, node) } : null; }).filter(Boolean);
  const names = (keys, max) => esc(list(keys.map(K.short), max || 6)), tell = keys => (agg && keys.length ? ": " + names(keys) : "");
  const C = { mode, agg, lens, kind, custom, kx, ky, diag, make, key: `${mode}|${lens}|${kind}|${node}|${kx}|${ky}|${custom ? "" : sizeNode}`,
    ax: { key: kx, label: ix.label(kind), log: !!ix.log, fmt: ix.fmt, tip: ix.tip, trim: ix.trim, ref: y => (ix.ref ? ix.ref(node, y, kind) : null), refText: ix.refText },
    ay: { key: ky, label: iy.label(kind), log: !!iy.log, fmt: iy.fmt, tip: iy.tip, trim: iy.trim, ref: y => (iy.ref ? iy.ref(node, y, kind) : null), refText: iy.refText },
    label: d => K.label(d.key), name: d => K.name(d.key), faded: d => (inScope ? !inScope(d.key) : false), sel, selNote, cmp: mode === "eco" ? st.cmp : null,
    tip: d => NP.ecoTip(d.key), click: d => NP.app.set({ eco: st.eco === d.key ? null : d.key }),
    size: `Bubble area: ${word(kind)} of ${lower(sn)}`, hollow: usesImp, labelAll: agg,
    eye: `${agg ? cap(K.many) : kind === "D" ? "Importers" : "Exporters"}${who} · ${sliceName(sn)}`, sizeShort: `Area: ${word(kind)} of the slice`,
    count: n => (mode === "reg" ? `${n} of the ${K.list.length} regions${who}` : mode === "grp" ? `${n} groups; they overlap` : `${n} economies${who} with ${word(kind)} of US$1 million or more`),
    notes: agg && (kx === "growth" || ky === "growth") ? ["growth over the members that reported in both years"] : [] };
  if (custom) return Object.assign(C, { title: () => "Your own chart", facts: pts => ({ n: pts.length }),
    text: () => `↑ ${esc(iy.label(kind))}<br>→ ${esc(ix.label(kind))}<br>Choose other indicators in the two menus on the axes, or go back to the chart suggested for this lens.` });
  const S = lower(node), ex = agg ? K.many : kind === "D" ? "importers" : "exporters", count0 = C.count;
  if (lens === "exp" || lens === "dst") return Object.assign(C, {
    title: () => (agg ? (kind === "D" ? `Which ${K.many} buy the most, and whose demand is growing?` : `Which ${K.many} sell the most, and which are gaining ground?`) : kind === "D" ? "Who buys the most, and whose demand is growing?" : "Who sells the most, and who is gaining ground?"),
    ay: Object.assign(C.ay, { above: kind === "D" ? "growing faster than world imports" : "gaining world market share", below: kind === "D" ? "growing slower" : "losing share" }),
    facts: (pts, y) => { const wg = growth(node, W, y, kind), up = over(pts, wg), t10 = top(pts, d => d.x, 10), t10up = over(t10, wg);
      return { n: pts.length, up: up.length, world: wg, y0: y5(y), top10: t10.length, top10up: t10up.map(d => d.key), upKeys: top(up, d => d.x, 99).map(d => d.key) }; },
    text: (F, y) => `<b>${F.up} of ${F.n}</b> ${ex}${who} grew faster than world ${word(kind)} of ${S} (${NP.fmtSigned(F.world)} a year, ${F.y0}–${y})`
      + (agg ? `${tell(F.upKeys)}. Each ${K.one} is compared with itself: only the members that reported in both years count.`
             : `${kind === "D" ? "" : ": they gained market share"}. Of the ${F.top10 < 10 ? F.top10 : "ten"} largest, ${F.top10up.length === 0 ? "none did" : F.top10up.length === F.top10 ? "all did" : `${F.top10up.length} did: ${names(F.top10up, 5)}`}.`),
    verdict: (d, F) => (d.y > F.world ? (kind === "D" ? "growing faster than world imports" : "gaining share") : kind === "D" ? "growing slower than world imports" : "losing share") });
  if (lens === "mix") return Object.assign(C, {
    title: () => (agg ? `Plastics or substitutes: what does each ${K.one} sell?` : "Plastics or substitutes: what do poorer and richer economies sell?"),
    ay: Object.assign(C.ay, { above: "more substitutes than the world’s pizza", below: "more plastics" }),
    facts: (pts, y) => { const lo = pts.filter(d => d.x < LOW), hi = pts.filter(d => d.x >= HIGH), med = a => (a.length ? d3.median(a, d => d.y) : null), maj = pts.filter(d => d.y > 0.5);
      return { n: pts.length, lowN: lo.length, lowMed: med(lo), highN: hi.length, highMed: med(hi), world: I.subsShare(W, y), majority: maj.length, majorityKeys: top(maj, d => d.y, 99).map(d => d.key) }; },
    text: F => (mode === "grp" ? `Substitutes are the bigger half of the pizza for <b>${F.majority} of ${F.n}</b> groups${tell(F.majorityKeys)}. `
        : `Where GDP per capita is below US$${NP.fmtNum(LOW)}, substitutes are typically <b>${pct0(F.lowMed)}</b> of the pizza (median of ${F.lowN} ${K.many}${who}); above US$${NP.fmtNum(HIGH)}, <b>${pct0(F.highMed)}</b> (${F.highN} ${K.many}). Substitutes are the bigger half for ${F.majority} of ${F.n} ${K.many}${tell(F.majorityKeys)}; `)
      + `${mode === "grp" ? "In" : "in"} the world’s pizza they are ${pct0(F.world)}.`,
    verdict: d => (d.y > 0.5 ? "mostly substitutes" : "mostly plastics") });
  if (lens === "net") return Object.assign(C, {
    title: () => (agg ? `Which ${K.many} sell more than they buy?` : "Who sells more than it buys?"),
    zones: [["net importers: buy more than they sell", "tl"], ["net exporters: sell more than they buy", "br"]],
    size: `Bubble area: exports + imports of ${S}`, sizeShort: "Area: exports + imports", eye: `${cap(K.many)}${who} · ${sliceName(node)}`,
    count: n => (agg ? count0(n) : `${n} economies${who} that export and import it, US$1 million or more in all`),
    facts: pts => { const sur = pts.filter(d => d.x > d.y), def = pts.filter(d => d.x < d.y), a = top(pts, d => d.x - d.y, 1)[0], b = top(pts, d => d.y - d.x, 1)[0];
      return { n: pts.length, surplus: sur.length, deficit: def.length, maxSurplus: a && a.x > a.y ? [a.key, a.x - a.y] : null, maxDeficit: b && b.y > b.x ? [b.key, b.y - b.x] : null, surplusKeys: top(sur, d => d.x - d.y, 99).map(d => d.key) }; },
    text: F => `<b>${F.surplus} of ${F.n}</b> ${K.many}${who} export more ${S} than they import${tell(F.surplusKeys)}; ${F.deficit} import more.`
      + (F.maxSurplus ? ` Largest surplus: ${esc(K.short(F.maxSurplus[0]))} (${NP.fmtUSD(F.maxSurplus[1])}).` : "") + (F.maxDeficit ? ` Largest deficit: ${esc(K.short(F.maxDeficit[0]))} (${NP.fmtUSD(F.maxDeficit[1])}).` : ""),
    verdict: d => (d.x > d.y ? `net exporter (${NP.fmtUSD(d.x - d.y)})` : `net importer (${NP.fmtUSD(d.y - d.x)})`) });
  /* specialisation */
  if (ky === "rca") return Object.assign(C, {
    title: () => (agg ? `Which ${K.many} are specialised, and which also weigh in the world market?` : "Who is specialised, and who also weighs in the world market?"),
    ay: Object.assign(C.ay, { above: "specialised", below: "not specialised" }),
    notes: agg ? ["goods exports of the members that reported"] : [],
    facts: pts => { const sp = pts.filter(d => d.y > 1), big = top(sp.filter(d => d.x > 0.01), d => d.x, 99); return { n: pts.length, specialised: sp.length, big: big.map(d => d.key), specialisedKeys: top(sp, d => d.y, 99).map(d => d.key) }; },
    text: F => `<b>${F.specialised} of ${F.n}</b> ${ex}${who} are specialised in ${S}: it is a larger part of their goods exports than of the world’s (RCA above 1)`
      + (agg ? `${tell(F.specialisedKeys)}.` : ". " + (F.big.length ? `${F.big.length} of them also hold more than 1% of world exports: ${names(F.big, 5)}.` : "None of them holds more than 1% of world exports.")),
    verdict: d => (d.y > 1 ? "specialised" : "not specialised") });
  return Object.assign(C, {
    title: () => `For whom do ${S} weigh the most?`,
    facts: pts => ({ n: pts.length, top3: top(pts, d => d.y, 3).map(d => [d.key, d.y]) }),
    text: F => (F.top3.length ? `Of ${F.n} ${ex}${who}, ${S} weigh the most in the ${ky === "merch" ? "goods exports" : "pizza"} of ${esc(list(F.top3.map(([e, v]) => `${K.short(e)} (${pct(v)})`), 3))}.` : "") });
}

/* dots = slices */
function sliceChart(st) {
  const lens = ECO[st.lens] ? st.lens : "exp", kind = lens === "dst" ? "D" : "X", S = st.eco != null ? st.eco : W, world = st.eco == null, one = !world && !NP.isGroup(S), f = NP.side(kind);
  const SW = scopeWords(S), nameS = SW.name, its = poss(nameS), v = (a, b) => (SW.plural ? b : a), Its = world ? "World" : v("Its", "Their");
  /* a group of slices is selected: the other slices are faded and the sentence counts only its own. A single slice is only marked */
  const sel = st.node, grpSel = sel !== "ALL" && !!NP.node[sel].children, leavesOn = new Set(NP.node[sel].leaves), ofSel = grpSel ? ` of ${lower(sel)}` : "";
  const fam = id => NP.node[id].family, lin = { log: false }, lg = { log: true };
  const C = { mode: "slices", lens, kind, custom: false, label: d => { const n = sliceName(d.key); return n.length > 20 ? n.slice(0, 19) + "…" : n; }, name: d => NP.node[d.key].long || sliceName(d.key),
    faded: d => grpSel && !leavesOn.has(d.key), sel: NP.node[sel].children ? null : sel, cmp: null,
    click: d => NP.app.set({ node: d.key === sel ? NP.node[d.key].parent.id : d.key }), hollow: false, notes: [],
    eye: `Slices · ${esc(cap(nameS))}${kind === "D" ? " · imports" : ""}`,
    count: n => `${n} slices${ofSel}` + (world ? "" : ` with ${word(kind)} of US$100,000 or more`) };
  const hol = (id, y) => kind === "D" && one && notOwn(S, y, id);
  /* a group's total is the sum of the members that reported. Its growth is computed like for like (core.js); the sentence says over how
     many members. Shares of the pizza in two years are not: there the sentence says how many members reported in each. */
  const members = !world && !one ? NP.membersOf(S) : null, nRep = y => (members ? members.filter(e => (kind === "D" ? NP.impBasis(e, y, "ALL") !== "mirror" : NP.isReporter(e, y, "ALL"))).length : null);
  const nBoth = (y0, y) => (members ? I.likeForLike("ALL", S, y0, y, kind).n : null);
  const caution = (F, y) => (members && F.rep0 !== F.rep1 ? ` <span class="sc-warn">Not like for like: ${F.rep0} of the ${members.length} members reported ${word(kind)} in ${F.y0}, ${F.rep1} in ${y}.</span>` : "");
  C.tip = d => `<b class="t">${esc(C.name(d))}</b><table><tr><td>${world ? "World" : esc(cap(nameS))} ${word(kind)}</td><td>${NP.fmtUSD(f(d.key, S, st.year))}</td></tr></table>`;
  if (lens === "exp" || lens === "dst") { const g = (id, y) => growth(id, S, y, kind), whole = kind === "D" ? "imports of plastics + substitutes" : "pizza";
    return Object.assign(C, { key: `s|sz|${kind}|${S}`,
      title: () => (world ? (kind === "D" ? "Which slices is the world buying more of?" : "Which slices of the pizza are growing?") : kind === "D" ? `What ${v("is", "are")} ${nameS} buying more of?` : `Which slices drive ${its} exports?`),
      ax: Object.assign({ key: "value", label: `${Its} ${word(kind)} of the slice (US$)`, fmt: usd, trim: [0.03, 1] }, lg),
      ay: Object.assign({ key: "growth", label: `Growth of these ${word(kind)}, % a year over 5 years`, fmt: v2 => NP.fmtSigned(v2), trim: [0.05, 0.95], ref: y => g("ALL", y), refText: v2 => `${kind === "D" ? "All slices" : "Whole pizza"} ${NP.fmtSigned(v2)} a year`,
        above: "growing faster than the whole", below: "growing slower" }, lin),
      make: y => NP.TREE.leaves.map(id => { const val = f(id, S, y), yy = g(id, y); return val >= FLOOR_SLICE && ok(yy) ? { key: id, x: val, y: yy, v: val, m: hol(id, y) } : null; }).filter(Boolean),
      size: `Bubble area: ${word(kind)} of the slice`, hollow: kind === "D" && one, notes: members ? ["growth over the members that reported in both years"] : [],
      facts: (pts, y) => { const wg = g("ALL", y), up = over(pts, wg), t10 = top(pts, d => d.x, 10), fast = top(t10, d => d.y, 1)[0];
        return { n: pts.length, up: up.length, upSubs: up.filter(d => fam(d.key) === "sub").length, upPlastics: up.filter(d => fam(d.key) === "pl").length, pizza: wg, y0: y5(y), fastest: fast ? [fast.key, fast.y] : null, both: nBoth(y5(y), y), members: members ? members.length : null }; },
      text: (F, y) => (F.pizza == null ? `${F.n} slices${ofSel}, ${F.y0}–${y}.` : `<b>${F.up} of ${F.n}</b> slices${ofSel} grew faster than ${its} ${whole} as a whole (${NP.fmtSigned(F.pizza)} a year, ${F.y0}–${y}): ${F.upSubs} are substitutes, ${F.upPlastics} plastics.`)
        + (F.fastest ? ` Fastest of the ${F.n < 10 ? F.n : "ten"} largest: ${esc(sliceName(F.fastest[0]))} (${NP.fmtSigned(F.fastest[1])}).` : "")
        + (members ? ` Like for like: over the ${F.both} of ${F.members} members that reported ${word(kind)} in both years.` : ""),
      verdict: (d, F) => (F.pizza == null ? "" : d.y > F.pizza ? "growing faster than the whole" : "growing slower than the whole") }); }
  if (lens === "mix") { const sh = (id, y) => I.pizzaShare(id, S, y);
    return Object.assign(C, { key: `s|mix|${S}`, diag: true, title: y => `How has ${its} pizza changed since ${y10(y)}?`,
      ax: Object.assign({ key: "then", label: `Share of ${its} pizza in ${y10(st.year)}`, fmt: pctLog, tip: pct, trim: [0.03, 1] }, lg), ay: Object.assign({ key: "now", label: `Share of the pizza in ${st.year}`, fmt: pctLog, tip: pct, trim: [0.03, 1] }, lg),
      zones: [["a bigger slice than before", "tl"], ["a smaller slice than before", "br"]],
      make: y => (y > Y[0] ? NP.TREE.leaves.map(id => { const val = f(id, S, y), a = sh(id, y10(y)), b = sh(id, y); return val >= FLOOR_SLICE && ok(a, true) && ok(b, true) ? { key: id, x: a, y: b, v: val } : null; }).filter(Boolean) : []),
      size: "Bubble area: exports of the slice", count: n => `${n} slices${ofSel} exported in both years`,
      facts: (pts, y) => { const up = pts.filter(d => d.y > d.x), g = top(pts, d => d.y - d.x, 1)[0], l = top(pts, d => d.x - d.y, 1)[0];
        return { n: pts.length, bigger: up.length, y0: y10(y), subsThen: I.subsShare(S, y10(y)), subsNow: I.subsShare(S, y), gained: g && g.y > g.x ? [g.key, (g.y - g.x) * 100] : null, lost: l && l.x > l.y ? [l.key, (l.x - l.y) * 100] : null, rep0: nRep(y10(y)), rep1: nRep(y) }; },
      text: (F, y) => `<b>${F.bigger} of ${F.n}</b> slices${ofSel} are a bigger part of ${its} pizza than in ${F.y0}. Substitutes as a whole went from ${pct0(F.subsThen)} to <b>${pct0(F.subsNow)}</b>.`
        + (F.gained ? ` Gained most: ${esc(sliceName(F.gained[0]))} (${NP.fmtPP(F.gained[1])}).` : "") + (F.lost ? ` Lost most: ${esc(sliceName(F.lost[0]))} (${NP.fmtPP(-F.lost[1])}).` : "") + caution(F, y),
      verdict: d => (d.y > d.x ? "a bigger slice than before" : "a smaller slice than before") }); }
  if (lens === "net") {
    if (world) { const dev = NP.GROUP.developing, a = (id, y) => I.groupShare(id, dev, y), b = (id, y) => I.groupShare(id, dev, y, "D");
      return Object.assign(C, { key: "s|net|w", diag: true, title: () => "Developing economies: sellers or buyers?",
        ax: Object.assign({ key: "devX", label: "Developing economies, share of world exports", fmt: pct0, dom: [0, 1] }, lin), ay: Object.assign({ key: "devM", label: "Developing economies, share of world imports", fmt: pct0, dom: [0, 1] }, lin),
        zones: [["larger share of imports than of exports", "tl"], ["larger share of exports than of imports", "br"]],
        make: y => NP.TREE.leaves.map(id => { const val = NP.Xw(id, y), x = a(id, y), yy = b(id, y); return val >= FLOOR_SLICE && ok(x) && ok(yy) ? { key: id, x, y: yy, v: val } : null; }).filter(Boolean),
        size: "Bubble area: world exports of the slice",
        facts: (pts, y) => ({ n: pts.length, sellers: pts.filter(d => d.x > d.y).length, allX: a("ALL", y), allM: b("ALL", y) }),
        text: F => `In <b>${F.sellers} of ${F.n}</b> slices${ofSel} developing economies hold a larger share of world exports than of world imports. For the whole pizza: ${pct0(F.allX)} of exports, ${pct0(F.allM)} of imports.`,
        verdict: d => `developing economies: larger share of ${d.x > d.y ? "exports than of imports" : "imports than of exports"}` }); }
    return Object.assign(C, { key: `s|net|${S}`, diag: true, title: () => `What ${v("does", "do")} ${nameS} sell, and what ${v("does it", "do they")} buy?`,
      ax: Object.assign({ key: "x", label: `${Its} exports of the slice (US$)`, fmt: usd, trim: [0.03, 1] }, lg), ay: Object.assign({ key: "m", label: `${Its} imports of the slice (US$)`, fmt: usd, trim: [0.03, 1] }, lg),
      zones: [[`${v("buys", "buy")} more than ${v("it sells", "they sell")}`, "tl"], [`${v("sells", "sell")} more than ${v("it buys", "they buy")}`, "br"]],
      make: y => NP.TREE.leaves.map(id => { const x = NP.X(id, S, y), m = NP.D(id, S, y); return x + m >= FLOOR_SLICE && x > 0 && m > 0 ? { key: id, x, y: m, v: x + m, m: one && notOwn(S, y, id) } : null; }).filter(Boolean),
      size: "Bubble area: exports + imports of the slice", sizeShort: "Area: exports + imports", hollow: one, count: n => `${n} slices${ofSel} that ${v("it both exports and imports", "they both export and import")}`,
      facts: pts => { const sur = pts.filter(d => d.x > d.y), a = top(pts, d => d.x - d.y, 1)[0], b = top(pts, d => d.y - d.x, 1)[0];
        return { n: pts.length, surplus: sur.length, maxSurplus: a && a.x > a.y ? [a.key, a.x - a.y] : null, maxDeficit: b && b.y > b.x ? [b.key, b.y - b.x] : null }; },
      text: F => `${esc(cap(nameS))} ${v("exports", "export")} more than ${v("it imports", "they import")} in <b>${F.surplus} of ${F.n}</b> slices${ofSel}.`
        + (F.maxSurplus ? ` Largest surplus: ${esc(sliceName(F.maxSurplus[0]))} (${NP.fmtUSD(F.maxSurplus[1])}).` : "") + (F.maxDeficit ? ` Largest deficit: ${esc(sliceName(F.maxDeficit[0]))} (${NP.fmtUSD(F.maxDeficit[1])}).` : ""),
      verdict: d => (d.x > d.y ? `net exports ${NP.fmtUSD(d.x - d.y)}` : `net imports ${NP.fmtUSD(d.y - d.x)}`) }); }
  /* specialisation */
  if (world) return Object.assign(C, { key: "s|rca|w", title: () => "Which slices are in few hands?",
    ax: Object.assign({ key: "value", label: "World exports of the slice (US$)", fmt: usd, trim: [0.03, 1] }, lg),
    ay: Object.assign({ key: "cr3", label: "Share of the three largest exporters", fmt: pct0, trim: [0, 1], ref: () => 0.5, refText: () => "half of world exports", above: "three exporters sell more than half", below: "supply is spread more widely" }, lin),
    make: y => NP.TREE.leaves.map(id => { const val = NP.Xw(id, y), c = I.cr(id, y, 3); return val >= FLOOR_SLICE && ok(c) ? { key: id, x: val, y: c, v: val } : null; }).filter(Boolean),
    size: "Bubble area: world exports of the slice",
    facts: (pts, y) => { const m = top(pts, d => d.y, 1)[0]; return { n: pts.length, half: pts.filter(d => d.y > 0.5).length, most: m ? [m.key, m.y, I.ranking(m.key, y)[0].e] : null }; },
    text: F => `In <b>${F.half} of ${F.n}</b> slices${ofSel} the three largest exporters sell more than half of the world total.` + (F.most ? ` Most concentrated: ${esc(sliceName(F.most[0]))} (${pct0(F.most[1])}; largest exporter ${esc(nm(F.most[2]))}).` : ""),
    verdict: d => (d.y > 0.5 ? "three exporters sell more than half" : "supply is spread more widely") });
  const wgr = (id, y) => growth(id, W, y);
  return Object.assign(C, { key: `s|rca|${S}`, title: () => `Where ${v("is", "are")} ${nameS} specialised, and are those markets growing?`,
    ax: Object.assign({ key: "wgrowth", label: "Growth of the world market for the slice, % a year over 5 years", fmt: v2 => NP.fmtSigned(v2), trim: [0.05, 0.95], ref: y => wgr("ALL", y), refText: v2 => `Whole pizza ${NP.fmtSigned(v2)}` }, lin),
    ay: Object.assign({ key: "rca", label: `${Its} RCA in the slice`, fmt: v2 => d3.format("~g")(v2), tip: v2 => NP.fmtNum(v2, v2 < 10 ? 2 : 0), ref: () => 1, refText: () => "RCA 1" }, lg),
    zones: [["specialised · slower market", "tl"], ["specialised · faster market", "tr"], ["not specialised · slower market", "bl"], ["not specialised · faster market", "br"]],
    make: y => NP.TREE.leaves.map(id => { const val = NP.X(id, S, y), x = wgr(id, y), r = rcaSafe(id, S, y); return val >= FLOOR_SLICE && ok(x) && ok(r, true) ? { key: id, x, y: r, v: val } : null; }).filter(Boolean),
    size: "Bubble area: exports of the slice", notes: members ? ["goods exports of the members that reported"] : [],
    facts: (pts, y) => { const wg = wgr("ALL", y), sp = pts.filter(d => d.y > 1); return { n: pts.length, specialised: sp.length, growing: wg == null ? 0 : sp.filter(d => d.x > wg).length, pizza: wg, y0: y5(y) }; },
    text: (F, y) => `${esc(cap(nameS))} ${v("is", "are")} specialised (RCA above 1) in <b>${F.specialised} of the ${F.n}</b> slices${ofSel} ${v("it exports", "they export")}; ${F.growing} of those are markets that grew faster than the pizza as a whole (${NP.fmtSigned(F.pizza)} a year, ${F.y0}–${y}).`,
    verdict: d => (d.y > 1 ? "specialised" : "not specialised") });
}

/* all years of a chart are computed once: fixed axes, paths over time, cheap playback */
const cache = {}, order = [];
function dataOf(C) {
  if (cache[C.key]) return cache[C.key];
  const by = {}; Y.forEach(y => { by[y] = C.make(y); });
  const all = [].concat(...Y.filter(y => y <= NP.LAST_FULL_YEAR).map(y => by[y]));
  let dom = null;
  if (all.length) { let dx = C.ax.dom || extentAll(all.map(d => d.x), C.ax.log, C.ax.trim), dy = C.ay.dom || extentAll(all.map(d => d.y), C.ay.log, C.ay.trim);
    if (C.diag && dx && dy) dx = dy = [Math.min(dx[0], dy[0]), Math.max(dx[1], dy[1])];                          // one scale on both axes: the diagonal is "equal"
    dom = dx && dy ? { x: dx, y: dy, v: d3.max(all, d => d.v) } : null; }
  order.push(C.key); if (order.length > 16) delete cache[order.shift()];
  return (cache[C.key] = { by, dom });
}

/* ───────── drawing ───────── */
let lastKey = null, last = null;
function plot(C, D, pts, year) {
  const body = $(".sc-body").getBoundingClientRect(), Wd = Math.max(280, body.width), H = Math.max(180, body.height), m = { l: 50, r: 16, t: 8, b: 24 }, ax = C.ax, ay = C.ay, dom = D.dom;
  svg.attr("viewBox", `0 0 ${Wd} ${H}`); gAx.selectAll("*").remove(); gLab.selectAll("*").remove(); gTrail.selectAll("*").remove(); gNote.selectAll("*").remove(); gHover.selectAll("*").remove();
  gYear.attr("x", Wd - m.r - 8).attr("y", H - m.b - 12).attr("text-anchor", "end").text(pts.length ? year : "");
  if (!pts.length || !dom) { gBub.selectAll("*").remove(); lastKey = null;
    const t = gAx.append("text").attr("class", "sc-empty").attr("x", Wd / 2).attr("y", H / 2 - 8).attr("text-anchor", "middle"); (C.empty || "Nothing to show for this selection and year.").split("\n").forEach((s, i) => t.append("tspan").attr("x", Wd / 2).attr("dy", i ? 18 : 0).text(s)); return; }
  const rmax = (C.agg ? 0.7 : 1) * Math.max(14, Math.min(30, Wd / 24)), r = d3.scaleSqrt([0, dom.v || 1], [2.5, rmax]), in0 = Math.round(rmax * 0.6);
  svg.classed("few", !!C.agg);
  const x = mkScale(ax.log, dom.x, [m.l + 6, Wd - m.r - in0]), y = mkScale(ay.log, dom.y, [H - m.b - 6, m.t + in0]);
  const axis = (g, sc, a, horiz) => { const A = (horiz ? d3.axisBottom(sc) : d3.axisLeft(sc)).tickFormat(a.fmt).tickSizeOuter(0).tickSize(horiz ? -(H - m.t - m.b) : -(Wd - m.l - m.r));
    if (a.log) A.tickValues(logTicks(sc)); else A.ticks(horiz ? Math.max(3, Math.round(Wd / 110)) : Math.max(3, Math.round(H / 55)));
    g.attr("class", "ax").call(A).call(s => s.select(".domain").remove()).selectAll("line").attr("stroke-dasharray", "2 3"); };
  axis(gAx.append("g").attr("transform", `translate(0,${H - m.b})`), x, ax, true);
  axis(gAx.append("g").attr("transform", `translate(${m.l},0)`), y, ay, false);
  const inX = v => v != null && isFinite(v) && x.domain()[0] < v && x.domain()[1] > v, inY = v => v != null && isFinite(v) && y.domain()[0] < v && y.domain()[1] > v;
  const rx = ax.ref ? ax.ref(year) : null, ry = ay.ref ? ay.ref(year) : null, taken = [], note = (t, X, Yp, anchor, cls) => { const w = t.length * 5.7; taken.push({ x0: anchor === "end" ? X - w : X, x1: anchor === "end" ? X : X + w, y0: Yp - 11, y1: Yp + 3 });
    return gNote.append("text").attr("class", cls || "sc-quad").attr("x", X).attr("y", Yp).attr("text-anchor", anchor || "start").text(t); };
  if (inX(rx)) { gAx.append("line").attr("class", "refline").attr("x1", x(rx)).attr("x2", x(rx)).attr("y1", m.t).attr("y2", H - m.b);
    if (ax.refText) note(ax.refText(rx), x(rx) + 4, m.t + 27, "start", "sc-ref"); }
  if (inY(ry)) { gAx.append("line").attr("class", "refline").attr("x1", m.l).attr("x2", Wd - m.r).attr("y1", y(ry)).attr("y2", y(ry));
    if (ay.refText) note(ay.refText(ry), m.l + 5, y(ry) - 4, "start", "sc-ref");
    if (ay.above && y(ry) - m.t > 34) note("↑ " + ay.above, m.l + 6, m.t + 12); if (ay.below && H - m.b - y(ry) > 34) note("↓ " + ay.below, m.l + 6, H - m.b - 8); }
  if (C.diag) { const lo = Math.max(x.domain()[0], y.domain()[0]), hi = Math.min(x.domain()[1], y.domain()[1]); gAx.append("line").attr("class", "refline diag").attr("x1", x(lo)).attr("y1", y(lo)).attr("x2", x(hi)).attr("y2", y(hi)); }
  if (C.zones && (C.diag || (inX(rx) && inY(ry)))) C.zones.forEach(([t, p]) => note(t, p[1] === "r" ? Wd - m.r - 6 : m.l + 6, p[0] === "t" ? m.t + 12 : H - m.b - 8, p[1] === "r" ? "end" : "start"));
  /* paths over the years: of the selected dot, of the economy it is compared with, and of the dot under the pointer */
  const trail = (g0, key, cls, years) => { if (key == null) return; const tr = Y.map(yr => { const d = D.by[yr].find(p => p.key === key); return d ? { yr, px: x(d.x), py: y(d.y) } : null; }).filter(Boolean); if (tr.length < 2) return;
    const g = g0.append("g").attr("class", "trail " + cls).attr("data-key", key); g.append("path").attr("d", d3.line().x(d => d.px).y(d => d.py).curve(d3.curveCatmullRom.alpha(0.5))(tr));
    g.selectAll("circle").data(tr).enter().append("circle").attr("cx", d => d.px).attr("cy", d => d.py).attr("r", d => (d.yr === year ? 0 : 1.8));
    if (years) [tr[0], tr[tr.length - 1]].forEach(d => { if (d.yr !== year) g.append("text").attr("x", d.px + 4).attr("y", d.py - 4).text(d.yr); }); };
  trail(gTrail, C.cmp, "cmp", true); trail(gTrail, C.sel, "sel", true);
  const hover = key => { gHover.selectAll("*").remove(); if (key != null && key !== C.sel && key !== C.cmp) trail(gHover, key, "hov", true); };
  pts.sort((a, b) => b.v - a.v);
  const same = C.key === lastKey; lastKey = C.key;                       // same chart, another year or selection: move the bubbles instead of redrawing
  const j = gBub.selectAll("circle").data(pts, d => d.key);
  j.exit().remove();
  const en = j.enter().append("circle").attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).attr("r", same ? 0 : d => r(d.v));
  const all = en.merge(j).attr("class", d => "bub" + (d.sel ? " sel" : "") + (d.cmp ? " cmp" : "") + (d.m ? " hol" : "")).attr("data-key", d => d.key).attr("data-c", d => (d.c == null ? "" : d.c)).attr("fill", d => d.color).style("stroke", d => (d.m ? d.color : d.edge)).style("fill-opacity", d => (d.faded ? 0.1 : null)).style("stroke-opacity", d => (d.faded ? 0.25 : null))
    .on("mouseenter", (ev, d) => hover(d.key))
    .on("mousemove", (ev, d) => NP.showTip(C.tip(d) + `<table style="margin-top:4px"><tr><td>${esc(ax.label)}</td><td>${(ax.tip || ax.fmt)(d.x)}</td></tr><tr><td>${esc(ay.label)}</td><td>${(ay.tip || ay.fmt)(d.y)}</td></tr></table>`, ev))
    .on("mouseleave", () => { NP.showTip(null); hover(null); }).on("click", (ev, d) => C.click(d)).order();
  (same && !NP.app.map.reduced ? all.transition().duration(520).ease(d3.easeCubicInOut) : all.interrupt()).attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).attr("r", d => r(d.v));
  /* names: the largest, the extremes, and what is selected; every dot when dots are regions or groups */
  const act = pts.filter(d => !d.faded), byY = act.slice().sort((a, b) => b.y - a.y), want = new Set((C.labelAll ? act : act.slice(0, 11).concat(byY.slice(0, 2), byY.slice(-2))).map(d => d.key));
  const lab = pts.filter(d => d.sel || d.cmp).concat(act.filter(d => want.has(d.key) && !d.sel && !d.cmp)), boxes = taken.slice();
  const free = bx => !boxes.some(b => bx.x0 < b.x1 && bx.x1 > b.x0 && bx.y0 < b.y1 && bx.y1 > b.y0);
  lab.forEach(d => { const t = d.label, hw = t.length * 3.1 + 2, R = r(d.v), px = x(d.x), py = y(d.y), cl = v => Math.max(m.l + hw, Math.min(Wd - m.r - hw, v)), must = d.sel || d.cmp;
    const around = [[cl(px), py - R - 13], [cl(px), py + R + 2], [cl(px + R + hw + 3), py - 6], [cl(px - R - hw - 3), py - 6]].filter(c => c[1] >= m.t - 2 && c[1] + 12 <= H - m.b + 2);
    const spot = (C.labelAll || must ? around : around.slice(0, 1)).map(([cx, y0]) => ({ x0: cx - hw, x1: cx + hw, y0, y1: y0 + 12 })).find(free) || (must && around.length ? { x0: around[0][0] - hw, x1: around[0][0] + hw, y0: around[0][1], y1: around[0][1] + 12 } : null);
    if (!spot) return; boxes.push(spot);
    gLab.append("text").attr("class", "blab" + (d.sel ? " sel" : "")).attr("x", (spot.x0 + spot.x1) / 2).attr("y", spot.y0 + 10).attr("text-anchor", "middle").style("opacity", same ? 0 : 1).text(t).transition().delay(same ? 380 : 0).duration(150).style("opacity", 1); });
}

function render(st) {
  if (!IND[st.sx]) st.sx = null; if (!IND[st.sy]) st.sy = null;
  const mode = modeOf(st), slices = mode === "slices", year = st.year, C = slices ? sliceChart(st) : dotChart(st, mode), D = dataOf(C), SC = schemeOf(st, mode, C.kind);
  host.classList.toggle("narrow", host.getBoundingClientRect().width < 520);
  host.querySelectorAll("#sc-mode button").forEach(b => { const on = b.dataset.v === mode; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  /* axes: menus when dots are economies, regions or groups; plain titles when they are slices */
  fillMenus(C.kind); sx.classList.toggle("hidden", slices); sy.classList.toggle("hidden", slices);
  if (!slices) { sx.value = C.kx; sy.value = C.ky; }
  $("#sc-xt").textContent = slices ? C.ax.label : ""; $("#sc-yt").textContent = slices ? C.ay.label : ""; $("#sc-xt").title = C.ax.label; $("#sc-yt").title = C.ay.label;
  $("#sc-reset").classList.toggle("hidden", !C.custom);
  const rim = {}, rimOf = col => rim[col] || (rim[col] = d3.color(col).darker(0.8).formatHex());      // pale classes (25–50%, plastic waste …) stay visible on the pale ground
  const pts = D.by[year].map(d => { const c = SC.cls(d), col = SC.color(c); return Object.assign({}, d, { c, color: col, edge: SC.pale ? rimOf(col) : null, label: C.label(d), faded: C.faded(d), sel: d.key === C.sel, cmp: C.cmp != null && d.key === C.cmp }); });
  const act = pts.filter(d => !d.faded), F = C.facts(act, year);
  if (!pts.length) C.empty = year === Y[0] && (C.ay.key === "growth" || C.ax.key === "wgrowth" || C.ay.key === "now") ? `This chart compares ${year} with earlier years.\nMove the time line forward.`
    : slices && st.eco != null ? `${NP.scopeName(st.eco)} has no ${C.kind === "D" ? "imports" : "exports"} to show here for ${year}.` : null;
  plot(C, D, pts, year);
  $("#sc-eye").innerHTML = `${C.eye} · ${year}`;
  $("#sc-title").textContent = C.title(year);
  $("#sc-find").innerHTML = act.length ? C.text(F, year) : "";
  /* the selected dot in words */
  const selEl = $("#sc-sel"), sd = C.sel != null ? pts.find(d => d.sel) : null;
  selEl.classList.toggle("hidden", C.sel == null); if (C.sel == null) selEl.textContent = "";
  const vd = sd && C.verdict ? C.verdict(sd, F) : "", since = C.sel != null ? Y.find(yr => D.by[yr].some(p => p.key === C.sel)) : null, selName = C.sel == null ? "" : slices ? sliceName(C.sel) : DOTS[mode].name(C.sel);
  if (C.sel != null) selEl.innerHTML = sd ? `${dot(sd.color, sd.m)}<b>${esc(C.name(sd))}</b>${C.selNote ? ` <span class="sc-path">(${esc(C.selNote)})</span>` : ""}${vd ? " — " + vd : ""}<br><span class="sc-xy">→ ${(C.ax.tip || C.ax.fmt)(sd.x)} &nbsp; ↑ ${(C.ay.tip || C.ay.fmt)(sd.y)}</span>${since != null && since < year ? `<br><span class="sc-path">line: its path since ${since}</span>` : ""}`
    : `<b>${esc(selName)}</b> is not in this chart for ${year}${slices || C.agg ? "" : C.kind !== "D" && !NP.isReporter(C.sel, year, st.node) ? ": it did not report exports" : ": no value on one of the two axes, or below US$1 million"}.`;
  /* the key: what the colour stands for (a menu), every class with the number of its dots; a name is a door to that region, group or slice */
  if (colMode !== mode) { colMode = mode; scol.innerHTML = SCHEMES[mode].map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join(""); }
  scol.value = SC.key; keyPick = {};
  const nOf = k => pts.filter(d => d.c === k).length;
  $("#sc-leg").innerHTML = SC.items.map(it => { if (it.pick) keyPick[it.k] = it.pick;
      return `<span class="sc-key${it.pick ? " door" : ""}${it.on ? " on" : ""}" data-k="${it.k}"${it.pick ? ` role="button" tabindex="0" aria-pressed="${it.on ? "true" : "false"}" title="${it.on ? "Back to all" : "Select " + esc(it.label) + " everywhere"}"` : ""}>${dot(SC.color(it.k))}${esc(it.label)} <small>${nOf(it.k)}</small></span>`; }).join("")
    + `<span class="sz" title="${esc(C.size)}"><i class="sc-size"></i>${esc(C.sizeShort || C.size.replace("Bubble area", "Area"))}</span>` + (C.hollow && pts.some(d => d.m) ? `<span class="sz">${dot("#6e6259", true)}† imports as reported by the exporters</span>` : "");
  $("#sc-hint").textContent = slices ? (st.eco == null ? "These are the slices of the world’s pizza. Pick an economy or a group (search box, map or table) to see its slices instead." : "Click a slice to select it everywhere.")
    : mode === "reg" ? "The 20 regions together are the world; none overlaps another. Click one to look at it everywhere."
    : mode === "grp" ? "Groups overlap (the least developed countries are developing economies too): their bubbles do not add up. Point at a group to see its path over the years."
    : st.eco == null ? "Click a bubble to open an economy and see its path over the years." : NP.isGroup(st.eco) ? "Economies outside the group are faded." : "";
  $("#sc-note").textContent = [C.count(act.length)].concat(C.notes || [], ["same axes in every year: press ▶"], C.ax.log || C.ay.log ? ["logarithmic scale" + (C.ax.log && C.ay.log ? "s" : "")] : [], year > NP.LAST_FULL_YEAR ? [`${year} is provisional`] : []).join(" · ");
  const sideEl = $(".sc-side"); sideEl.classList.remove("tight"); if (sideEl.scrollHeight > sideEl.clientHeight + 2) sideEl.classList.add("tight");
  last = { mode: C.mode, lens: C.lens, kind: C.kind, custom: C.custom, key: C.key, x: C.ax.key, y: C.ay.key, xLabel: C.ax.label, yLabel: C.ay.label, title: C.title(year), finding: $("#sc-find").textContent, facts: F,
    scheme: SC.key, classes: SC.items.map(it => ({ k: it.k, label: it.label, color: SC.color(it.k), n: nOf(it.k), door: !!it.pick, on: !!it.on })),
    refX: C.ax.ref ? C.ax.ref(year) : null, refY: C.ay.ref ? C.ay.ref(year) : null, pts: pts.map(d => ({ key: d.key, x: d.x, y: d.y, v: d.v, m: !!d.m, faded: !!d.faded, sel: !!d.sel, c: d.c })), domain: D.dom };
}
NP.Scatter = { render, info: () => last };
})();
