/* NP core: data access, product tree, formatting and ALL indicator formulas (pure functions).
   Loaded in the browser (window.NP) and in Node for QA (dashboard/qa/qa.cjs) — keep it free of DOM code.
   Units: totals.js and flows are in THOUSAND US$; every accessor here returns US$.
   Basis: each economy's OWN report — exports as the exporter reports them, imports as the importer reports them.
   Where an economy did not report imports, what the reporting economies exported to it stands in (flagged "mirror"). */
(function (root) {
"use strict";
const M = root.NP_META, T = root.NP_TOTALS, EC = root.NP_ECON;
const NP = root.NP = root.NP || {};

/* ───────── dimensions ───────── */
const YEARS = NP.YEARS = M.years, NY = YEARS.length, Y0 = YEARS[0];
const yi = NP.yi = y => y - Y0;
NP.LAST_FULL_YEAR = 2023;                       // 2024 has far fewer reporters: provisional
NP.eco = M.eco;
/* The aggregate rows of the trade data count Cyprus in Asia (Western Asia), as the UN's M49 standard does; the current classification
   file has it in Europe. A region is what its aggregate row adds up, so Cyprus is shown and counted where the data count it (QC A3). */
{ const cy = M.eco.find(e => e.c === "196"); if (cy) { cy.reg = "5300"; cy.sub = "5340"; } }
NP.ecoIdx = {}; M.eco.forEach((e, i) => { NP.ecoIdx[e.c] = i; });
const W = NP.W = M.world;
NP.countries = M.eco.map((e, i) => (e.t === "country" ? i : -1)).filter(i => i >= 0);
const G = code => NP.ecoIdx[code];
NP.GROUP = { developing: G("1400"), developed: G("1500"), ldc: G("1610"), lldc: G("1620"), sids: G("1640") };
NP.REGIONS = [["5100", "Africa"], ["5200", "Americas"], ["5300", "Asia"], ["5400", "Europe"], ["5500", "Oceania"]];
NP.regionName = code => (NP.REGIONS.find(r => r[0] === code) || [null, "—"])[1];
/* aggregates that can be chosen as a scope (their totals come from UNCTAD's own aggregate rows; members from the classification file) */
/* The 20 sub-regions (UN M49): together they are the world and none overlaps another. [code, name, continent, short] */
NP.SUBREGIONS = [["5110", "Northern Africa", "5100"], ["5121", "Eastern Africa", "5100"], ["5122", "Middle Africa", "5100"], ["5123", "Southern Africa", "5100"], ["5124", "Western Africa", "5100"],
  ["5210", "Northern America", "5200"], ["5221", "Caribbean", "5200"], ["5222", "Central America", "5200"], ["5223", "South America", "5200"],
  ["5310", "Central Asia", "5300"], ["5320", "Southern Asia", "5300"], ["5330", "Eastern Asia", "5300"], ["5340", "Western Asia", "5300"], ["5350", "South-eastern Asia", "5300"],
  ["5410", "Eastern Europe", "5400"], ["5420", "Northern Europe", "5400"], ["5430", "Southern Europe", "5400"], ["5440", "Western Europe", "5400"],
  ["5510", "Oceania excluding Australia and New Zealand", "5500", "Oceania excl. Aus. & NZ"], ["5520", "Australia and New Zealand", "5500", "Australia & New Zealand"]];
/* groupings whose members are listed in meta.groups (from the classification file) */
NP.OTHER_GROUPS = [["2711", "BRICS", "BRICS"], ["3412", "European Union", "EU"], ["3905", "OECD", "OECD"], ["3916", "G20", "G20"], ["3919", "Group of 77 (G-77)", "G-77"]];
const GM = M.groups || {};
/* kind: "dev" development groups · "cont" continents · "sub" sub-regions · "other" other groupings. test(E, index) says who is a member */
NP.SCOPES = [["1400", "Developing economies", "Developing", E => E.dev === "1400"], ["1500", "Developed economies", "Developed", E => E.dev === "1500"],
  ["1610", "Least developed countries (LDCs)", "LDCs", E => !!E.ldc], ["1620", "Landlocked developing countries (LLDCs)", "LLDCs", E => !!E.lldc],
  ["1640", "Small island developing States (SIDS)", "SIDS", E => !!E.sids]].map(a => a.concat("dev"))
  .concat(NP.REGIONS.map(([c, n]) => [c, n, n, E => E.reg === c, "cont"]))
  .concat(NP.SUBREGIONS.map(([c, n, par, sh]) => [c, n, sh || n, E => E.sub === c, "sub", par]))
  .concat(NP.OTHER_GROUPS.filter(([c]) => GM[c] && GM[c].length).map(([c, n, sh]) => { const set = new Set(GM[c]); return [c, n, sh, (E, k) => set.has(k), "other"]; }))
  .filter(a => NP.ecoIdx[a[0]] != null)
  .map(([c, n, sh, test, kind, parent]) => ({ code: c, e: NP.ecoIdx[c], name: n, short: sh, test, kind, parent: parent || null }));
const scopeBy = new Map(NP.SCOPES.map(s => [s.e, s]));
NP.scope = e => scopeBy.get(e) || null;
const memberCache = {};
NP.membersOf = e => memberCache[e] || (memberCache[e] = NP.countries.filter(c => NP.scope(e).test(NP.eco[c], c)));
NP.scopeName = e => (NP.scope(e) ? NP.scope(e).name : NP.eco[e].n);
/* a group or region whose members are known: its growth is computed like for like and its ratios over the members that reported (see indicators 5 and 9) */
NP.isScope = e => e != null && !!NP.scope(e);

/* ───────── raw accessors (US$) ───────── */
const ZERO = new Array(NY).fill(0);
const row = (kind, node, e) => (T[kind] && T[kind][node] && T[kind][node][e]) || ZERO;
NP.X = (node, e, y) => row("X", node, e)[yi(y)] * 1000;          // exports of e to the world, as e reports them
NP.M = (node, e, y) => row("M", node, e)[yi(y)] * 1000;          // imports of e from the world, as e reports them (0 if it did not report)
NP.Dx = (node, e, y) => row("D", node, e)[yi(y)] * 1000;         // what the world's reporters say they exported to e (the "mirror" of its imports)
NP.Xw = (node, y) => NP.X(node, W, y);
NP.Mw = (node, y) => NP.M(node, W, y);                           // world imports = sum of the economies that reported imports
NP.seriesX = (node, e) => row("X", node, e).map(v => v * 1000);
NP.seriesM = (node, e) => row("M", node, e).map(v => v * 1000);
NP.seriesDx = (node, e) => row("D", node, e).map(v => v * 1000);
const DS_TOTAL = { plastic: "P_00", non_plastic: "NPS000" };
NP.datasetOf = node => (node === "ALL" ? "all" : M.products[node].ds);
/* reporter in year y for the dataset that holds this node (ALL: reported either dataset) */
NP.isGroup = e => e != null && NP.eco[e].t !== "country";
NP.isReporter = (e, y, node) => {
  if (NP.isGroup(e)) return NP.X(NP.datasetOf(node || "ALL") === "all" ? "ALL" : DS_TOTAL[NP.datasetOf(node)], e, y) > 0;   // aggregates: any member reported
  const ds = NP.datasetOf(node || "ALL"), f = d => { const s = M.rep[d].by[e]; return !!s && s[yi(y)] === "1"; };
  return ds === "all" ? f("plastic") || f("non_plastic") : f(ds);
};
NP.nReporters = (y, node) => { const ds = NP.datasetOf(node || "ALL"); return ds === "all" ? Math.max(M.rep.plastic.n[yi(y)], M.rep.non_plastic.n[yi(y)]) : M.rep[ds].n[yi(y)]; };
NP.lastReportYear = (e, node) => { for (let y = YEARS[NY - 1]; y >= Y0; y--) if (NP.isReporter(e, y, node)) return y; return null; };
/* IMPORTS AS SHOWN. An economy's imports are its own report. For an economy that did not report imports in a year, what the
   reporting economies exported to it stands in ("mirror"); the UI marks such values. impBasis tells which of the two applies:
   "own" | "mirror" | "mixed" (whole pizza only: it reported one of the two data sets). Aggregates are UNCTAD's own rows. */
const repM = (ds, e, y) => { const s = M.repm && M.repm[ds].by[e]; return !!s && s[yi(y)] === "1"; };
NP.impBasis = (e, y, node) => {
  if (NP.isGroup(e)) return "own";
  const ds = NP.datasetOf(node || "ALL");
  if (ds !== "all") return repM(ds, e, y) ? "own" : "mirror";
  const a = repM("plastic", e, y), b = repM("non_plastic", e, y); return a && b ? "own" : !a && !b ? "mirror" : "mixed";
};
const dOne = (node, e, y) => (NP.isGroup(e) || repM(NP.datasetOf(node), e, y) ? NP.M(node, e, y) : NP.Dx(node, e, y));
NP.D = (node, e, y) => (node === "ALL" ? dOne("P_00", e, y) + dOne("NPS000", e, y) : dOne(node, e, y));
NP.seriesD = (node, e) => YEARS.map(y => NP.D(node, e, y));
NP.nImpReporters = (y, node) => { const ds = NP.datasetOf(node || "ALL"), n = M.repm; return ds === "all" ? Math.max(n.plastic.n[yi(y)], n.non_plastic.n[yi(y)]) : n[ds].n[yi(y)]; };
NP.lastImpReportYear = (e, node) => { for (let y = YEARS[NY - 1]; y >= Y0; y--) if (NP.impBasis(e, y, node) !== "mirror") return y; return null; };
const econ = (key, e, y) => { const a = EC[key][e]; const v = a ? a[yi(y)] : null; return v == null ? null : v; };
NP.gdp = (e, y) => { const v = econ("gdp", e, y); return v == null ? null : v * 1e6; };          // US$
NP.gdppc = (e, y) => econ("gdppc", e, y);                                                       // US$
NP.pop = (e, y) => { const v = econ("pop", e, y); return v == null ? null : v * 1e3; };          // persons
NP.merchX = (e, y) => { const v = econ("mx", e, y); return v == null ? null : v * 1e6; };        // US$, all merchandise exports
NP.merchM = (e, y) => { const v = econ("mm", e, y); return v == null ? null : v * 1e6; };
NP.pci = (e, y) => econ("pci", e, y);                 // UNCTAD Productive Capacities Index, overall, 0–100
NP.pciNat = (e, y) => econ("pci_nat", e, y);          // natural-capital component
NP.conc = (e, y) => econ("conc", e, y);               // UNCTAD export concentration index, all merchandise, 0–1
NP.divers = (e, y) => econ("divers", e, y);           // UNCTAD export diversification index, 0–1
NP.openness = (e, y) => { const a = NP.merchX(e, y), b = NP.gdp(e, y); return a != null && b ? a / b : null; };   // merchandise exports ÷ GDP
NP.lastWith = (fn, e, y) => { for (let k = y; k >= YEARS[0]; k--) { const v = fn(e, k); if (v != null) return { v, y: k }; } return null; };

/* ───────── product tree ───────── */
const GROUP_NAME = { NPS210: "Plant/tree-based (raw)", NPS206: "Minerals", NPS207: "Agricultural by-products", NPS209: "Dedicated crops",
  NPS208: "Animal-based", NPS203: "Mineral products", NPS204: "Plant/tree-based products", NPS205: "Natural-fibre products",
  NPS202: "Fishing gear, other", NPS201: "Fishing gear, natural fibres" };
const GROUP_COLOR = { NPS210: "#1d6b2e", NPS206: "#2a7d38", NPS207: "#3f9447", NPS209: "#5fab4c", NPS208: "#86c266",
  NPS203: "#2f7d3a", NPS204: "#4f9d47", NPS205: "#72bf44", NPS202: "#9ad173", NPS201: "#bfe2a6" };
const STAGE = { P_01: ["Plastics in primary forms", "#004990"], P_02: ["Intermediate forms of plastic", "#0077b8"],
  P_03: ["Intermediate manufactured plastic goods", "#009edb"], P_04: ["Final manufactured plastic goods", "#7bb7e1"], P_05: ["Plastic waste", "#c3dff0"] };
/* Sub-group names: by HS content, from the SMEP factsheet (page 2: full name `long`; page 1: short name used in the pizza where it has one).
   UNCTAD's own labels describe the intended substitute use and are kept as `uname`. `proxy` = the factsheet's ° mark:
   a broad HS line traded mainly for food, feed or other non-substitute uses. All of it arrives in meta.js (reference/factsheet_names.json). */
NP.PROXY_NOTE = M.proxy_note || "Broad HS line traded mainly for food, feed or other non-substitute uses.";
const mix = (hex, t) => {                           // towards white
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = v => Math.round(v + (255 - v) * t);
  return "#" + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, "0")).join("");
};
const P = M.products;
const refYi = yi(2023);
const worldVal = code => ((T.X[code] || {})[W] || ZERO)[refYi];
const byWorld = codes => codes.slice().sort((a, b) => worldVal(b) - worldVal(a));     // fixed order: 2023 world ranking
/* UNCTAD labels such as "Rubber, Natural Fibres - Dedicated Crops" repeat their group: shown as "Rubber (dedicated crops)". Wording stays UNCTAD's; the full label is in `uname`. */
const tidy = l => { const m = l.match(/^(.+?)\s*,\s*Natural Fibres - (.+)$/); return (m ? `${m[1]} (${m[2].toLowerCase()})` : l).replace(/\s{2,}/g, " "); };
NP.tidyLabel = tidy;
function subNode(code, base, i) { return { id: code, name: P[code].fshort || P[code].fname || tidy(P[code].label), long: P[code].fname || null, proxy: !!P[code].proxy, uname: P[code].label, color: mix(base, 0.12 + 0.05 * (i % 5)), family: "sub" }; }
function groupNode(code) {
  return { id: code, name: GROUP_NAME[code], uname: P[code].label, color: GROUP_COLOR[code], family: "sub",
    children: byWorld(P[code].children).map((c, i) => subNode(c, GROUP_COLOR[code], i)) };
}
NP.TREE = { id: "ALL", name: "Plastics + substitutes", short: "Whole pizza", color: "#6e6259", family: "all", children: [
  { id: "P_00", name: "Plastics", uname: P.P_00.label, color: "#003a75", family: "pl",
    children: P.P_00.children.slice().sort().map(c => ({ id: c, name: STAGE[c][0], uname: P[c].label, color: STAGE[c][1], family: "pl" })) },
  { id: "NPS000", name: "Substitutes", uname: P.NPS000.label, color: "#27833a", family: "sub", children: [
    { id: "NPS102", name: "Raw materials", uname: P.NPS102.label, color: "#1f7030", family: "sub", children: byWorld(P.NPS102.children).map(groupNode) },
    { id: "NPS101", name: "Value-added products", uname: P.NPS101.label, color: "#5aa845", family: "sub", children: byWorld(P.NPS101.children).map(groupNode) },
  ] },
] };
NP.node = {};                                        // id -> plain node (with parent / depth / leaves)
(function walk(n, parent, depth) {
  n.parent = parent; n.depth = depth; NP.node[n.id] = n;
  n.leaves = n.children ? [].concat(...n.children.map(c => walk(c, n, depth + 1))) : [n.id];
  return n.leaves;
})(NP.TREE, null, 0);
NP.heat = (hex, t) => mix(hex, 1 - 0.85 * Math.sqrt(Math.max(0, Math.min(1, t))));     // light → hex, square-root so small cells stay visible
NP.hs = id => P[id] && P[id].hs;
NP.hsCount = id => { const s = new Set(); NP.node[id].leaves.forEach(l => ((P[l] && P[l].hs) || []).forEach(h => s.add(h[0]))); return s.size; };   // distinct HS 6-digit subheadings
NP.ancestors = id => { const out = []; for (let n = NP.node[id]; n; n = n.parent) out.push(n); return out; };
/* colour used for symbols of a node: saturated family hue for pale leaves */
NP.symbolColor = id => { const n = NP.node[id]; return n.family === "pl" ? "#004990" : n.family === "sub" ? "#27833a" : "#4f4740"; };

/* ───────── formatting ───────── */
const sig = (v, d) => { const s = Number(v).toPrecision(d); return String(+s); };
NP.fmtUSD = v => {
  if (v == null || isNaN(v)) return "–";
  const a = Math.abs(v), sg = v < 0 ? "−" : "";
  if (a >= 1e12) return sg + "US$" + sig(a / 1e12, 3) + " trn";
  if (a >= 1e9) return sg + "US$" + sig(a / 1e9, 3) + " bn";
  if (a >= 1e6) return sg + "US$" + sig(a / 1e6, 3) + " m";
  if (a >= 1e3) return sg + "US$" + sig(a / 1e3, 3) + " k";
  return sg + "US$" + Math.round(a);
};
NP.fmtPct = (v, d) => (v == null || isNaN(v) ? "–" : (v * 100).toFixed(d == null ? (Math.abs(v) < 0.1 ? 1 : 0) : d) + "%");
NP.fmtShare = v => (v == null || isNaN(v) ? "–" : v >= 0.1 ? (v * 100).toFixed(0) + "%" : v >= 0.001 || v === 0 ? (v * 100).toFixed(1) + "%" : v >= 0.00005 ? (v * 100).toFixed(2) + "%" : "<0.01%");
NP.fmtPP = v => (v == null || isNaN(v) ? "–" : Math.abs(v) < 0.05 ? "0.0 pp" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0) + " pp");
NP.fmtSigned = v => (v == null || isNaN(v) ? "–" : (v >= 0 ? "+" : "−") + (Math.abs(v) * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0) + "%");
NP.fmtNum = (v, d) => (v == null || isNaN(v) ? "–" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }));
NP.fmtX = v => (v == null || isNaN(v) ? "–" : v >= 100 ? Math.round(v) + "×" : v >= 10 ? v.toFixed(0) + "×" : v.toFixed(1) + "×");
NP.shortName = e => {
  const n = NP.eco[e].n;
  return ({ "United States of America": "United States", "Netherlands (Kingdom of the)": "Netherlands", "Republic of Korea": "Rep. of Korea",
    "China, Hong Kong SAR": "Hong Kong SAR", "China, Taiwan Province of": "Taiwan Prov. of China", "China, Macao SAR": "Macao SAR",
    "Russian Federation": "Russian Fed.", "United Arab Emirates": "UAE", "Iran (Islamic Republic of)": "Iran (Islamic Rep. of)",
    "Venezuela (Bolivarian Rep. of)": "Venezuela (Bol. Rep. of)", "Bolivia (Plurinational State of)": "Bolivia (Plur. State of)",
    "United Kingdom": "United Kingdom", "Dem. Rep. of the Congo": "DR Congo", "Lao People's Dem. Rep.": "Lao PDR",
    "United Republic of Tanzania": "UR Tanzania", "Micronesia (Federated States of)": "Micronesia (Fed. States of)" })[n] || n;
};

/* ───────── indicators: every formula used anywhere in the UI lives here ───────── */
const I = NP.ind = {};
const div = (a, b) => (b ? a / b : null);
/* THE TWO SIDES. X = what an economy exported to the world (its own report). D = its imports as shown: its own report, or the
   exporters' reports where it did not report (NP.D above). Each side has its own world total: NP.Xw (reporting exporters) and
   NP.Mw (reporting importers); they differ, as in every trade statistic (imports include freight and insurance; different reporters).
   Indicators below take an optional last argument `kind`: "D" computes the import-side twin (share of world imports, rank among
   importers, growth of imports …); without it they describe exports. The explorer passes "D" whenever the Importers lens is on. */
const side = kind => (kind === "D" ? NP.D : NP.X);
const world = (node, y, kind) => (kind === "D" ? NP.Mw(node, y) : NP.Xw(node, y));
/* economies whose value is part of that world total: every economy for exports (non-reporters are zero), reporting importers for imports */
const inTotal = (node, y, kind) => (kind === "D" ? NP.countries.filter(e => NP.impBasis(e, y, node) !== "mirror") : NP.countries);
NP.side = side; NP.worldOf = world;
/* 1. World market share: economy's exports of the node / world exports of the node (kind "D": its imports / world imports) */
I.worldShare = (node, e, y, kind) => div(side(kind)(node, e, y), world(node, y, kind));
/* 2. Rank among exporting (importing) economies (countries/territories only; 1 = largest). null when the value is zero */
I.rank = (node, e, y, kind) => { const f = side(kind), x = f(node, e, y); if (!(x > 0) || NP.isGroup(e)) return null; let r = 1; for (const o of NP.countries) if (f(node, o, y) > x) r++; return r; };
I.ranking = (node, y, kind) => NP.countries.map(e => ({ e, v: kind === "D" ? NP.D(node, e, y) : NP.X(node, e, y), m: kind === "D" && NP.impBasis(e, y, node) === "mirror" })).filter(d => d.v > 0).sort((a, b) => b.v - a.v);   // m: value from the exporters' reports
/* 3. Share of the economy's own pizza (plastics + substitutes exports; kind "D": of its imports) */
I.pizzaShare = (node, e, y, kind) => div(side(kind)(node, e, y), side(kind)("ALL", e, y));
/* 4. Specialisation within the pizza: own-pizza share / world-pizza share (Balassa index restricted to the pizza basket) */
I.rcaPizza = (node, e, y) => { const a = I.pizzaShare(node, e, y), b = div(NP.Xw(node, y), NP.Xw("ALL", y)); return a == null || !b ? null : a / b; };
/* 5. Share of the economy's total merchandise exports (UNCTADstat total merchandise trade) */
/* A group's or a region's exports are those of the members that reported that year. What they are divided by — goods exports, GDP,
   people — must be the same members; the group's own total would include the members that did not report and understate every ratio. */
const reported = (e, y, node, kind) => (kind === "D" ? NP.impBasis(e, y, node) !== "mirror" : NP.isReporter(e, y, node));
const ofReporters = (g, y, node, kind, f) => { let s = 0, n = 0; for (const e of NP.membersOf(g)) if (reported(e, y, node, kind)) { const v = f(e, y); if (v != null) { s += v; n++; } } return n ? s : null; };
NP.merchXof = (node, e, y) => (NP.isScope(e) ? ofReporters(e, y, node, "X", NP.merchX) : NP.merchX(e, y));
I.merchShare = (node, e, y) => div(NP.X(node, e, y), NP.merchXof(node, e, y));
/* reporters' total merchandise exports: the reference "world" uses the same economies that report the product data */
const mrCache = {};
I.merchReporters = (node, y) => { const k = NP.datasetOf(node) + y; if (mrCache[k] != null) return mrCache[k]; let s = 0; for (const e of NP.countries) if (NP.isReporter(e, y, node)) s += NP.merchX(e, y) || 0; return (mrCache[k] = s); };
/* 6. Revealed comparative advantage (Balassa): (x_ij / X_i) / (x_wj / X_w), X = total merchandise exports, w = reporting economies */
I.rcaBalassa = (node, e, y) => { const a = I.merchShare(node, e, y), b = div(NP.Xw(node, y), I.merchReporters(node, y)); return a == null || !b ? null : a / b; };
/* 7. Exports relative to GDP and per person */
I.gdpShare = (node, e, y, kind) => div(side(kind)(node, e, y), NP.isScope(e) ? ofReporters(e, y, node, kind, NP.gdp) : NP.gdp(e, y));
I.perCapita = (node, e, y, kind) => div(side(kind)(node, e, y), NP.isScope(e) ? ofReporters(e, y, node, kind, NP.pop) : NP.pop(e, y));
/* 8. Imports as shown (own report, else exporters' reports), the exporters' reports on their own, and net exports */
I.imports = (node, e, y) => NP.D(node, e, y);
I.mirrorImports = (node, e, y) => NP.Dx(node, e, y);
I.netExports = (node, e, y) => NP.X(node, e, y) - NP.D(node, e, y);
I.netRatio = (node, e, y) => { const x = NP.X(node, e, y), m = NP.D(node, e, y); return x + m > 0 ? (x - m) / (x + m) : null; };   // −1 … +1
/* rank inside a set of economies (peers) */
I.rankIn = (node, e, y, list, kind) => { const f = side(kind), x = f(node, e, y); if (!(x > 0)) return null; let r = 1, n = 0; for (const o of list) { const v = f(node, o, y); if (v > 0) n++; if (v > x) r++; } return { rank: r, of: n }; };
/* largest changes of world market share between two years (economies reporting in both), in percentage points */
I.movers = (node, y0, y1, kind) => NP.countries.map(e => ({ e, pp: I.shareChangePP(node, e, y0, y1, kind) })).filter(d => d.pp != null).sort((a, b) => b.pp - a.pp);
/* 9. Growth: compound annual growth rate of export (import) value, and change of world share in percentage points */
/* imports: only when both years rest on the same basis (both its own report, or both the exporters' reports) */
const sameBasis = (node, e, y0, y1) => NP.impBasis(e, y0, node) === NP.impBasis(e, y1, node);
/* GROWTH OF A GROUP OR A REGION IS LIKE FOR LIKE. Its total is the sum of the members that reported in that year, and who reports
   changes (least developed countries: 36 reported imports in 2018, 28 in 2023; their total fell by 10.8% a year while the exporters'
   reports show their imports rising). Two years are therefore compared over the members that reported in BOTH. For the whole pizza
   the two data sets are taken one by one, each with its own reporters. The world total is left as the source gives it — the sum of
   the reporters of each year, as in UNCTAD's factsheet (NP.LFL_WORLD switches that). */
NP.LFL_WORLD = false;
const repX = (ds, e, y) => { const s = M.rep[ds].by[e]; return !!s && s[yi(y)] === "1"; };
I.likeForLike = (node, g, y0, y1, kind) => {
  const mem = g === W ? NP.countries : NP.membersOf(g), parts = node === "ALL" ? ["P_00", "NPS000"] : [node], R = kind === "D" ? repM : repX, V = kind === "D" ? NP.M : NP.X, both = new Set();
  let a = 0, b = 0;
  for (const p of parts) { const ds = NP.datasetOf(p); for (const e of mem) if (R(ds, e, y0) && R(ds, e, y1)) { a += V(p, e, y0); b += V(p, e, y1); both.add(e); } }
  return { a, b, n: both.size, of: mem.length };
};
NP.isLikeForLike = e => NP.isScope(e) || (e === W && NP.LFL_WORLD);
I.cagr = (node, e, y0, y1, kind) => {
  if (NP.isLikeForLike(e)) { const L = I.likeForLike(node, e, y0, y1, kind); return L.a > 0 && L.b > 0 && y1 > y0 ? Math.pow(L.b / L.a, 1 / (y1 - y0)) - 1 : null; }
  if (kind === "D" && !sameBasis(node, e, y0, y1)) return null; const f = side(kind), a = f(node, e, y0), b = f(node, e, y1); return a > 0 && b > 0 && y1 > y0 ? Math.pow(b / a, 1 / (y1 - y0)) - 1 : null; };
/* exports: only when the economy reported in BOTH years — a year without a report is "unknown", not "zero share".
   imports: exist for every economy in every year (they come from the exporters), so no such condition; economies without imports in both years are left out */
I.shareChangePP = (node, e, y0, y1, kind) => {
  if (kind === "D") { if (!sameBasis(node, e, y0, y1) || (!(NP.D(node, e, y0) > 0) && !(NP.D(node, e, y1) > 0))) return null; } else if (!NP.isReporter(e, y0, node) || !NP.isReporter(e, y1, node)) return null;
  const a = I.worldShare(node, e, y0, kind), b = I.worldShare(node, e, y1, kind); return a == null || b == null ? null : (b - a) * 100; };
/* 10. Substitutes as a share of the economy's pizza (kind "D": of its imports) */
I.subsShare = (e, y, kind) => div(side(kind)("NPS000", e, y), side(kind)("ALL", e, y));
/* 10b. How far up the chain: value-added products as a share of the economy's substitutes exports; stages of its plastics exports */
I.valueAddedShare = (e, y, kind) => div(side(kind)("NPS101", e, y), side(kind)("NPS000", e, y));
I.plasticsStageShare = (stage, e, y, kind) => div(side(kind)(stage, e, y), side(kind)("P_00", e, y));
/* 11. World-level structure of a node: concentration among exporters (kind "D": among importers) */
I.exporterHHI = (node, y, kind) => { const w = world(node, y, kind), f = side(kind); if (!w) return null; let s = 0; for (const e of inTotal(node, y, kind)) { const v = f(node, e, y) / w; s += v * v; } return s; };
I.cr = (node, y, k, kind) => { const w = world(node, y, kind); if (!w) return null; return I.ranking(node, y, kind).filter(d => !d.m).slice(0, k).reduce((s, d) => s + d.v, 0) / w; };
I.nExporters = (node, y, min, kind) => NP.countries.filter(e => side(kind)(node, e, y) > (min || 0)).length;
I.groupShare = (node, groupIdx, y, kind) => div(side(kind)(node, groupIdx, y), world(node, y, kind));
I.ssShare = (node, y) => { const m = M.ns[node]; if (!m) return null; const i = yi(y), t = m.SS[i] + m.SN[i] + m.NS[i] + m.NN[i]; return t ? m.SS[i] / t : null; };
I.nsMatrix = (node, y) => { const m = M.ns[node], i = yi(y), t = m.SS[i] + m.SN[i] + m.NS[i] + m.NN[i]; return t ? { SS: m.SS[i] / t, SN: m.SN[i] / t, NS: m.NS[i] / t, NN: m.NN[i] / t } : null; };
/* 13. How concentrated an economy's pizza is: HHI across the 15 additive groups (5 plastics stages + 10 substitute groups), and number of slices exported */
NP.GROUPS15 = P.P_00.children.concat(P.NPS101.children, P.NPS102.children);
I.productHHI = (e, y, kind) => { const vs = NP.GROUPS15.map(c => side(kind)(c, e, y)), s = vs.reduce((a, b) => a + b, 0); return s > 0 ? vs.reduce((a, v) => a + (v / s) * (v / s), 0) : null; };
I.nSlices = (e, y, min, kind) => NP.TREE.leaves.filter(id => side(kind)(id, e, y) > (min || 0)).length;
/* 14. Share of world imports */
I.importShare = (node, e, y) => div(NP.D(node, e, y), NP.Mw(node, y));
/* 15. Trade intensity index of exporter i with partner j: (x_ij / X_i) / (M_j / (M_w − M_i)); above 1 = more trade than the partner's weight in world imports */
I.tradeIntensity = (node, i, j, y, xij) => { const xi = NP.X(node, i, y), mj = NP.D(node, j, y), rest = NP.Mw(node, y) - NP.D(node, i, y); return xi > 0 && mj > 0 && rest > 0 ? (xij / xi) / (mj / rest) : null; };
/* 16. Region-to-region trade (UNCTAD continent aggregates): matrix of US$ values, rows = exporter, columns = destination */
const RG = root.NP_REGIONS;
I.regionMatrix = (node, y) => { const a = RG && RG.m[node] && RG.m[node][yi(y)]; if (!a) return null; const m = []; for (let i = 0; i < 5; i++) m.push(a.slice(i * 5, i * 5 + 5).map(v => v * 1000)); return m; };
I.intraRegionalWorld = (node, y) => { const m = I.regionMatrix(node, y); if (!m) return null; let d = 0, t = 0; m.forEach((r, i) => r.forEach((v, j) => { t += v; if (i === j) d += v; })); return t ? d / t : null; };
I.intraRegion = (node, regionCode, y) => { const m = I.regionMatrix(node, y), i = RG ? RG.regions.indexOf(regionCode) : -1; if (!m || i < 0) return null; const t = m[i].reduce((a, b) => a + b, 0); return t ? m[i][i] / t : null; };
/* 12. Partner statistics (from the lazily loaded flows file F of the node; computed in the pipeline on ALL partners) */
I.partnerStats = (F, e, y) => {
  const s = F && F.xs[e]; if (!s || !s.n[yi(y)]) return null; const i = yi(y);
  return { n: s.n[i], hhi: s.h[i] / 10000, top1: s.t[i] / 1000, developing: s.d[i] < 0 ? null : s.d[i] / 1000, intraRegional: s.r[i] < 0 ? null : s.r[i] / 1000 };
};
/* suppliers of e: counted on its own import records when it reported, otherwise on what the exporters reported (F.code = slice of the flows file) */
const ownImports = (F, e, y) => !!(F && F.fm) && NP.impBasis(e, y, F.code || "ALL") === "own";
I.supplierStats = (F, e, y) => { const s = F && (ownImports(F, e, y) ? F.ms[e] : F.ds[e]); if (!s || !s.n[yi(y)]) return null; return { n: s.n[yi(y)], hhi: s.h[yi(y)] / 10000 }; };
/* flows of a year as objects {e, p, v(US$)}: e = exporter / origin, p = destination / importer.
   flowsOf: as reported by the exporter. importFlowsOf: as reported by the importer (its 12 largest origins). */
NP.flowsOf = (F, y) => { const a = (F && F.f[y]) || [], out = []; for (let i = 0; i < a.length; i += 3) out.push({ e: a[i], p: a[i + 1], v: a[i + 2] * 1000 }); return out; };
NP.importFlowsOf = (F, y) => { const a = (F && F.fm && F.fm[y]) || [], out = []; for (let i = 0; i < a.length; i += 3) out.push({ e: a[i + 1], p: a[i], v: a[i + 2] * 1000 }); return out; };
/* partners of e. "from": where its exports go (its own report). "to": where its imports come from — its own report, else the exporters' reports */
NP.partnersOf = (F, e, y, dir) => (dir === "to" && ownImports(F, e, y) ? NP.importFlowsOf(F, y) : NP.flowsOf(F, y)).filter(f => (dir === "to" ? f.p === e : f.e === e)).sort((a, b) => b.v - a.v).slice(0, dir === "to" ? M.k.dst : M.k.exp);
NP.suppliersOwn = ownImports;
NP.K = M.k;

/* ───────── weight (tonnes): plastic waste only ─────────
   Tonnes are the unit in which waste is regulated, and value understates low-grade waste. But the weights of the source are patchy:
   some are missing, some "to World" rows are far smaller than the same economy's partner rows added up (United Kingdom, exports of
   plastic waste 2023: 24 kt against 559 kt), some imply a value per tonne that is far from everybody else's. wFlag screens every
   weight with these three tests; the UI draws flagged economies hatched and never shows a value per tonne. */
const WG = (root.NP_WEIGHTS && root.NP_WEIGHTS.w) || {};
const wrow = (node, k, e) => (WG[node] && WG[node][k] && WG[node][k][e]) || ZERO;
NP.hasWeight = node => !!WG[node];
/* tonnes on the side shown: exports = the exporter's row to World; imports = the importer's own row, or the exporters' rows where it did not report */
NP.Wt = (node, e, y, kind) => (kind === "D" ? wrow(node, NP.impBasis(e, y, node) === "mirror" ? "D" : "M", e) : wrow(node, "X", e))[yi(y)];
NP.WtPartners = (node, e, y, kind) => (kind === "D" ? (NP.impBasis(e, y, node) === "mirror" ? null : wrow(node, "Mp", e)[yi(y)]) : wrow(node, "Xp", e)[yi(y)]);   // the same trade, added up over partner economies
NP.WtWorld = (node, y, kind) => wrow(node, kind === "D" ? "M" : "X", W)[yi(y)];
const uvCache = {};
function typicalValuePerTonne(node, y, kind) {                 // median over economies with at least US$0.1 m; a yardstick for the screen only
  const k = node + y + kind; if (uvCache[k] !== undefined) return uvCache[k];
  const a = []; for (const e of NP.countries) { const v = side(kind)(node, e, y), w = NP.Wt(node, e, y, kind); if (v >= 1e5 && w > 0) a.push(v / w); }
  a.sort((p, q) => p - q); return (uvCache[k] = a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null);
}
NP.W_RULES = { minValue: 1e5, partnersOver: 1.2, minGap: 100, offBy: 8 };
/* null = usable; otherwise why the weight should not be read: "missing" | "partners" (partner rows add up to much more) | "outlier" */
NP.wFlag = (node, e, y, kind) => {
  const R = NP.W_RULES, v = side(kind)(node, e, y), w = NP.Wt(node, e, y, kind); if (!(v > 0)) return null;
  if (!(w > 0)) return v >= R.minValue ? { why: "missing" } : null;
  const wp = NP.WtPartners(node, e, y, kind);
  if (wp != null && wp > w * R.partnersOver && wp - w >= R.minGap) return { why: "partners", partners: wp };
  const m = typicalValuePerTonne(node, y, kind), u = v / w;
  if (m && v >= R.minValue && (u > R.offBy * m || u < m / R.offBy)) return { why: "outlier" };
  return null;
};
/* economies by tonnes, largest first, each with its flag */
I.rankingW = (node, y, kind) => NP.countries.filter(e => side(kind)(node, e, y) > 0).map(e => ({ e, w: NP.Wt(node, e, y, kind), flag: NP.wFlag(node, e, y, kind), m: kind === "D" && NP.impBasis(e, y, node) === "mirror" })).filter(d => d.w > 0 || d.flag).sort((a, b) => b.w - a.w);   // only economies with a trade value
NP.fmtT = t => (t == null || isNaN(t) ? "–" : t >= 1e6 ? sig(t / 1e6, 3) + " Mt" : t >= 1e3 ? sig(t / 1e3, 3) + " kt" : Math.round(t) + " t");

/* Definitions shown in the methodology dialog and in tooltips (kept next to the formulas on purpose).
   Third element = LAYER: 1 key numbers (KPI bar) · 2 profile (panel, always visible) · 3 go deeper (collapsed) · 4 the economy as a whole (context). */
NP.LAYERS = { 1: "Key numbers", 2: "Profile", 3: "Go deeper", 4: "The economy as a whole (context)" };
NP.DEFS = [
  ["Exports", "Export value in current US$ as reported by the exporting economy. “World” is the sum of the economies that reported in that year; it is not estimated for non-reporters.", 1],
  ["World market share", "Exports of the economy ÷ world exports, for the selected slice and year.", 1],
  ["Rank", "Position among exporting economies for the selected slice and year (1 = largest).", 1],
  ["Substitutes in the pizza", "Exports of substitutes ÷ exports of plastics and substitutes together: which half of the pizza is bigger.", 1],
  ["Net exports", "Exports − imports, each as the economy itself reports it. Imports include freight and insurance, exports do not.", 1],
  ["Share of merchandise exports", "Exports of the slice ÷ the economy’s total merchandise exports (UNCTADstat, total merchandise trade): how much the slice matters to the economy. For a group or a region: ÷ the goods exports of the members that reported the slice that year.", 2],
  ["Growth (CAGR)", "Compound annual growth rate of export value between two years: (end ÷ start)^(1 ÷ years) − 1. Current prices, not adjusted for inflation. For a group or a region the two years are compared like for like: over the members that reported in both years (a group’s total is the sum of the members that reported, and who reports changes). The world total is the sum of the reporters of each year.", 2],
  ["Value-added share of substitutes", "Exports of value-added substitute products ÷ all exports of substitutes (raw materials + value-added products): how far up the chain the economy sells.", 2],
  ["Stage of plastics exports", "Exports of one life-cycle stage (primary forms, intermediate forms, intermediate goods, final goods, waste) ÷ all plastics exports of the economy.", 2],
  ["Share of own pizza", "Exports of the slice ÷ the economy’s exports of plastics and substitutes together.", 2],
  ["Imports", "Import value as reported by the importing economy (including freight and insurance). For an economy that did not report, what all reporting economies say they exported to it stands in; such values are marked †.", 2],
  ["Imports, as reported by exporters", "What all reporting economies say they exported to the economy. Shown next to the economy’s own import figure as a cross-check: the two rarely agree exactly (valuation, timing, goods in transit, misdeclaration).", 3],
  ["South–South share", "Developing-to-developing exports ÷ all exports between the developing and developed groups.", 2],
  ["RCA (revealed comparative advantage)", "Balassa index: (slice ÷ total merchandise exports of the economy) ÷ (slice ÷ total merchandise exports of all reporting economies). Above 1 the economy is more specialised in the slice than the world.", 3],
  ["Specialisation within the pizza", "Same idea with the pizza as the basket: own-pizza share ÷ world-pizza share.", 3],
  ["Change in world share", "World market share in the end year minus the start year, in percentage points. Shown only when the economy reported in both years.", 3],
  ["Share of world imports", "Imports of the economy ÷ world imports of the slice (the sum of the economies that reported imports).", 3],
  ["Net position", "Net exports ÷ (exports + imports), from −1 (only imports) to +1 (only exports).", 3],
  ["Weight (plastic waste only)", "Tonnes as reported. Weights are screened: missing, far smaller than the same economy’s partner rows added up, or implying a value per tonne more than eight times away from the median. Screened economies are hatched; no value per tonne is shown.", 3],
  ["Number of partners", "Destination economies with exports above zero.", 3],
  ["Market concentration (HHI)", "Herfindahl–Hirschman index of destinations: sum of squared shares of each partner in the economy’s exports of the slice. 1 = a single buyer; near 0 = evenly spread.", 3],
  ["Share to developing economies", "Exports to the UNCTAD group “Developing economies” ÷ exports to the world.", 3],
  ["Intra-regional share", "Exports to the economy’s own continent ÷ exports to the world.", 3],
  ["Trade intensity index", "(Exports to the partner ÷ the economy’s exports of the slice) ÷ (the partner’s imports ÷ world imports excluding the economy’s own). Above 1 the two trade more than the partner’s weight in world imports would suggest.", 3],
  ["Product concentration (HHI)", "Herfindahl–Hirschman index of the economy’s exports across the 15 groups of the pizza (5 plastics stages, 10 substitute groups). 1 = a single group.", 3],
  ["Exporter concentration (HHI), top-3 share", "The same index across exporting economies for a slice, and the combined share of the three largest exporters.", 3],
  ["Region-to-region trade", "Exports of one continent to another, from UNCTAD’s regional aggregates. “Stays in the region” = exports to the same continent ÷ exports to all five continents.", 3],
  ["Export concentration index", "UNCTAD’s concentration index of all merchandise exports (0–1). Close to 1 = exports depend on very few products. Source: UNCTADstat.", 3],
  ["Export diversification index", "UNCTAD’s index of how far an economy’s export structure is from the world’s (0–1). Source: UNCTADstat.", 3],
  ["Merchandise exports, % of GDP", "Total merchandise exports ÷ GDP, both in current US$ (UNCTADstat).", 4],
  ["Exports, % of GDP / per person", "Exports of the slice ÷ GDP in current US$ / ÷ population (UNCTADstat).", 4],
  ["Productive capacities index (PCI)", "UNCTAD’s composite index (0–100) of an economy’s productive capacities: human capital, natural capital, energy, transport, ICT, institutions, private sector and structural change. Source: UNCTADstat.", 4],
];
if (typeof module !== "undefined" && module.exports) module.exports = NP;
})(typeof window !== "undefined" ? window : globalThis);
