/* App: state (WHAT = node, WHERE = economy, WHEN = year, lens), URL hash, wiring of pizza / map / timeline / panel. */
(function () {
"use strict";
const NP = window.NP, I = NP.ind, Y = NP.YEARS, YMAX = Y[Y.length - 1];
const DEFAULT = { year: NP.LAST_FULL_YEAR, node: "ALL", eco: null, lens: "exp", view: "map", story: null, sx: null, sy: null, sm: "eco", sk: null, globe: false, spec: "rca", fcol: "slice", cmp: null, meas: "v" };   // meas: "v" value, "w" tonnes (plastic waste, world view)
const state = Object.assign({}, DEFAULT);
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ───────── URL hash ───────── */
function readHash() {
  try { const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("y") && Y.includes(+h.get("y"))) state.year = +h.get("y");
    if (NP.node[h.get("n")]) state.node = h.get("n");
    const he = h.get("e") ? NP.ecoIdx[h.get("e")] : null;
    state.eco = he != null && (NP.eco[he].t === "country" || NP.scope(he)) ? he : null;
    if (["exp", "dst", "net", "rca", "mix", "flows"].includes(h.get("l"))) state.lens = h.get("l");
    state.view = ["scatter", "table"].includes(h.get("v")) ? h.get("v") : "map";
    state.sx = h.get("sx") || null; state.sy = h.get("sy") || null; state.sm = ["slices", "reg", "grp"].includes(h.get("sm")) ? h.get("sm") : "eco"; state.sk = h.get("sk") || null;      // axes and colour: only when the reader chose them (otherwise the lens suggests)
    state.story = h.get("s") != null && h.get("s") !== "" ? +h.get("s") : null;
    state.globe = h.get("g") === "1";
    state.spec = ["merch", "pizza"].includes(h.get("sp")) ? h.get("sp") : "rca";
    state.fcol = h.get("fc") === "ns" ? "ns" : "slice";
    state.meas = h.get("m") === "w" ? "w" : "v";
    const hc = h.get("c") ? NP.ecoIdx[h.get("c")] : null; state.cmp = hc != null && NP.eco[hc].t === "country" ? hc : null;
  } catch (e) { /* ignore */ }
}
function writeHash() {
  if (NP.Cover && NP.Cover.isOn()) { try { history.replaceState(null, "", "#cover"); } catch (e) { /* file:// in some browsers */ } return; }   // first page: the address does not carry a view
  const p = { y: state.year, n: state.node, l: state.lens };
  if (state.eco != null) p.e = NP.eco[state.eco].c;
  if (state.view !== "map") { p.v = state.view; if (state.sx) p.sx = state.sx; if (state.sy) p.sy = state.sy; if (state.sm !== "eco") p.sm = state.sm; if (state.sk && state.view === "scatter") p.sk = state.sk; }
  if (state.story != null) p.s = state.story;
  if (state.globe) p.g = 1;
  if (state.spec !== "rca") p.sp = state.spec;
  if (state.fcol === "ns") p.fc = "ns";
  if (state.meas === "w") p.m = "w";
  if (state.cmp != null && state.eco != null && !NP.isGroup(state.eco)) p.c = NP.eco[state.cmp].c;
  try { history.replaceState(null, "", "#" + new URLSearchParams(p)); } catch (e) { /* file:// in some browsers */ }
}

/* ───────── lazy flows ───────── */
const flowP = {}, flowOrder = [], flowsNow = {};
function loadFlows(code) {
  if (flowP[code]) return flowP[code];
  flowOrder.push(code);
  if (flowOrder.length > 14) { const old = flowOrder.shift(); delete flowP[old]; delete flowsNow[old]; if (window.NP_FLOWS) delete window.NP_FLOWS[old]; }
  return (flowP[code] = new Promise((res, rej) => {
    const done = () => { const F = window.NP_FLOWS[code]; if (F) F.code = code; res(F); };
    if (window.NP_FLOWS && window.NP_FLOWS[code]) return done();
    const s = document.createElement("script"); s.src = `data/flows/${code}.js`;
    s.onload = () => { done(); s.remove(); }; s.onerror = () => { delete flowP[code]; rej(new Error("flows " + code)); };
    document.head.appendChild(s);
  }));
}
function getFlows(code) { if (flowsNow[code]) return flowsNow[code]; loadFlows(code).then(F => { flowsNow[code] = F; render(); }).catch(() => {}); return null; }

/* ───────── colour scales ───────── */
const RCA_BREAKS = [0.5, 1, 2, 4, 8];
const RCA_RAMP = { pl: ["#e9e6e2", "#d3cdc7", "#c3dff0", "#7bb7e1", "#009edb", "#004990"], sub: ["#e9e6e2", "#d3cdc7", "#cfe8b9", "#9ad173", "#4f9d47", "#1d6b2e"], all: ["#e9e6e2", "#d3cdc7", "#e2d3e7", "#c7a9d0", "#a978b6", "#5e2b75"] };
const MIX_BREAKS = [0.1, 0.25, 0.5, 0.75, 0.9];
const MIX_RAMP = ["#004990", "#3f8fca", "#b3d4ea", "#cfe8b9", "#7dc257", "#1d6b2e"];
const cls = (v, br) => { let i = 0; while (i < br.length && v >= br[i]) i++; return i; };
const SEQ_RAMP = { pl: ["#eef3f8", "#c3dff0", "#7bb7e1", "#009edb", "#0077b8", "#004990"], sub: ["#eef5ea", "#cfe8b9", "#9ad173", "#72bf44", "#4f9d47", "#1d6b2e"], all: ["#f1edf3", "#e2d3e7", "#c7a9d0", "#a978b6", "#8a4f9e", "#5e2b75"] };
const SPEC = {
  rca:   { short: "RCA", breaks: RCA_BREAKS, ticks: ["0", "0.5", "1", "2", "4", "8+"], title: n => `Specialisation in ${n} (RCA)`, note: "above 1: a larger share of the economy’s exports than of world exports",
           val: (n, e, y) => { const m = I.merchShare(n, e, y); return m == null || m > 1 ? null : I.rcaBalassa(n, e, y); } },
  merch: { short: "% of goods exports", breaks: [0.001, 0.005, 0.02, 0.05, 0.2], ticks: ["0", "0.1%", "0.5%", "2%", "5%", "20%+"], title: n => `Weight of ${n} in each economy’s exports`, note: "share of the economy’s total merchandise exports (UNCTADstat)",
           val: (n, e, y) => { const m = I.merchShare(n, e, y); return m == null || m > 1 ? null : m; } },
  pizza: { short: "% of its pizza", breaks: [0.01, 0.05, 0.1, 0.25, 0.5], ticks: ["0", "1%", "5%", "10%", "25%", "50%+"], title: n => `Weight of ${n} in each economy’s pizza`, note: "share of the economy’s exports of plastics + substitutes",
           val: (n, e, y) => I.pizzaShare(n, e, y) },
};
NP.scales = { RCA_BREAKS, RCA_RAMP, MIX_BREAKS, MIX_RAMP, SEQ_RAMP, SPEC, cls };
const maxCache = {};
function nodeMax(node, kind, grpIdx) {                 // largest economy value in any year: spikes keep one scale while time plays
  const k = kind + node + (grpIdx != null ? "|" + grpIdx : ""); if (maxCache[k] != null) return maxCache[k];
  let m = 0; for (const e of (grpIdx != null ? NP.membersOf(grpIdx) : NP.countries)) for (const y of Y) { const v = kind === "D" ? NP.D(node, e, y) : NP.X(node, e, y); if (v > m) m = v; }
  return (maxCache[k] = m || 1);
}
const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p; };

/* ───────── tooltips ───────── */
const tip = $("#tip");
function showTip(html, ev) {
  if (!html) { tip.classList.add("hidden"); return; }
  tip.innerHTML = html; tip.classList.remove("hidden");
  if (!ev) return; const w = tip.offsetWidth, h = tip.offsetHeight; let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + w > innerWidth - 6) x = ev.clientX - w - 14; if (y + h > innerHeight - 6) y = ev.clientY - h - 14;
  tip.style.left = Math.max(4, x) + "px"; tip.style.top = Math.max(4, y) + "px";
}
NP.showTip = showTip;
/* which side the explorer is showing: "D" (imports) under the Importers lens, exports otherwise.
   EVERYTHING that names or ranks economies follows it: key numbers, tooltips, panel, pizza, table, time line.
   Imports are the importer's own report; where it did not report, the exporters' reports stand in and the value carries a †. */
const kindNow = () => (state.lens === "dst" ? "D" : "X");
/* tonnes instead of US$: only where weights are offered (plastic waste), in the world view of the two spike lenses (map or table).
   With one economy or a group selected, in other lenses and in the Compare view the explorer is always in value. */
const canWeigh = () => NP.hasWeight(state.node) && state.eco == null && (state.lens === "exp" || state.lens === "dst") && state.view !== "scatter";
const wOn = () => state.meas === "w" && canWeigh();
const W_WHY = fl => (fl.why === "missing" ? "no weight reported" : fl.why === "partners" ? `its partner rows add up to ${NP.fmtT(fl.partners)}` : "its value per tonne is far from every other economy’s");
NP.wWhy = W_WHY;
const wMax = {};
function nodeMaxW(node, kind) { const k = node + kind; if (wMax[k] != null) return wMax[k]; let m = 0; for (const e of NP.countries) for (const y of Y) { const w = NP.Wt(node, e, y, kind); if (w > m) m = w; } return (wMax[k] = m || 1); }
const notOwn = (e, node, year) => NP.impBasis(e, year, node) !== "own";
const DAG_NOTE = year => `It did not report imports for ${year}: value as reported by the exporting economies`;
const dag = (e, node, year) => (notOwn(e, node, year) ? `<sup class="mir" title="${DAG_NOTE(year)}">†</sup>` : "");
NP.dag = dag;
function miniPizza(e, y, kind) {
  const f = NP.side(kind), p = f("P_00", e, y), s = f("NPS000", e, y), t = p + s; if (!(t > 0)) return "";
  const a = 2 * Math.PI * p / t, arc = d3.arc().innerRadius(6).outerRadius(13);
  return `<div class="mini"><svg width="28" height="28" viewBox="-14 -14 28 28"><path d="${arc({ startAngle: 0, endAngle: a })}" fill="#004990"/><path d="${arc({ startAngle: a, endAngle: 2 * Math.PI })}" fill="#27833a"/></svg>
    <span>${kind === "D" ? "Its imports" : "Its pizza"}: ${NP.fmtUSD(t)}<br>${NP.fmtPct(p / t, 0)} plastics · ${NP.fmtPct(s / t, 0)} substitutes</span></div>`;
}
function ecoTip(e) {
  const { node, year, lens } = state, n = NP.node[node], E = NP.eco[e], rep = NP.isReporter(e, year, node), kind = kindNow();
  let rows = "";
  if (state.eco != null && e !== state.eco && (lens === "exp" || lens === "dst" || lens === "flows")) {
    const F = flowsNow[node], fl = F ? NP.flowsOf(F, year) : [], sel = state.eco;
    const out = fl.find(f => f.e === sel && f.p === e), inn = lens === "dst" && F ? NP.partnersOf(F, sel, year, "to").find(f => f.e === e) : fl.find(f => f.e === e && f.p === sel);   // imports of the selected economy: from its own records when it reported
    rows += `<tr><td>${esc(NP.shortName(sel))} → here</td><td>${out ? NP.fmtUSD(out.v) : "not in top " + NP.K.exp}</td></tr><tr><td>Here → ${esc(NP.shortName(sel))}</td><td>${inn ? NP.fmtUSD(inn.v) : "not in top " + NP.K.dst}</td></tr>`;
    const tii = out ? I.tradeIntensity(node, sel, e, year, out.v) : null; if (tii != null) rows += `<tr><td>Trade intensity (${esc(NP.shortName(sel))} → here)</td><td>${NP.fmtNum(tii, tii < 10 ? 1 : 0)}</td></tr>`;
  }
  const last = NP.lastReportYear(e, node), noRep = `<div class="warn">No export data reported for ${year}${last ? " (last: " + last + ")" : ""}.</div>`;
  if (wOn()) {                                           // tonnes first; the value for comparison; why a weight is not to be relied on
    const imp = kind === "D", w = NP.Wt(node, e, year, kind), fl = NP.wFlag(node, e, year, kind), wT = NP.WtWorld(node, year, kind), other = imp && notOwn(e, node, year);
    rows = `<tr><td>${imp ? "Imports" : "Exports"}, weight${other ? " †" : ""}</td><td>${w > 0 ? NP.fmtT(w) : "–"}</td></tr>` + (fl || !(wT > 0) ? "" : `<tr><td>Share of world tonnes</td><td>${NP.fmtShare(w / wT)}</td></tr>`)
      + `<tr><td>${imp ? "Imports" : "Exports"}, value</td><td>${NP.fmtUSD(NP.side(kind)(node, e, year))}</td></tr>`;
    return `<b class="t">${esc(E.n)}</b><div class="u">${esc(n.name)} · ${year} · by weight</div><table>${rows}</table>${fl ? `<div class="warn">⚠ Weight not reliable: ${W_WHY(fl)}.</div>` : ""}${other ? `<div class="warn">† ${DAG_NOTE(year)}.</div>` : ""}`;
  }
  if (kind === "D") {                                    // Importers lens: imports first, with the economy's place among importers
    const rk = I.rank(node, e, year, "D"), other = notOwn(e, node, year), dx = NP.Dx(node, e, year);
    rows += `<tr><td>Imports${other ? " †" : ""}</td><td>${NP.fmtUSD(NP.D(node, e, year))}</td></tr><tr><td>Share of world imports</td><td>${NP.fmtShare(I.worldShare(node, e, year, "D"))}${rk ? " · #" + rk : ""}</td></tr>`;
    if (!other && dx > 0) rows += `<tr><td>Exporters report</td><td>${NP.fmtUSD(dx)}</td></tr>`;                 // the same imports seen from the other side
    rows += `<tr><td>Exports</td><td>${rep ? NP.fmtUSD(NP.X(node, e, year)) : "not reported"}</td></tr>`;
    return `<b class="t">${esc(E.n)}</b><div class="u">${esc(n.name)} · ${year} · imports</div><table>${rows}</table>${miniPizza(e, year, "D")}${other ? `<div class="warn">† ${DAG_NOTE(year)}.</div>` : ""}${rep ? "" : noRep}`;
  }
  if (rep) {
    const x = NP.X(node, e, year), rk = I.rank(node, e, year), ms = I.merchShare(node, e, year), rca = ms != null && ms <= 1 ? I.rcaBalassa(node, e, year) : null;
    rows += `<tr><td>Exports</td><td>${NP.fmtUSD(x)}</td></tr><tr><td>Share of world exports</td><td>${NP.fmtShare(I.worldShare(node, e, year))}${rk ? " · #" + rk : ""}</td></tr>`;
    rows += `<tr><td>RCA</td><td>${rca == null ? "–" : NP.fmtNum(rca, rca < 10 ? 2 : 0)}</td></tr>`;
  }
  rows += `<tr><td>Imports${notOwn(e, node, year) ? " †" : ""}</td><td>${NP.fmtUSD(NP.D(node, e, year))}</td></tr>`;
  return `<b class="t">${esc(E.n)}</b><div class="u">${esc(n.name)} · ${year}</div><table>${rows}</table>${rep ? miniPizza(e, year) : noRep}${notOwn(e, node, year) ? `<div class="warn">† ${DAG_NOTE(year)}.</div>` : ""}`;
}
NP.ecoTip = ecoTip;
function sliceTip(id) {
  const n = NP.node[id], y = state.year, e = state.eco, kind = kindNow(), imp = kind === "D", f = NP.side(kind);
  const v = e != null ? f(id, e, y) : NP.worldOf(id, y, kind), tot = e != null ? f("ALL", e, y) : NP.worldOf("ALL", y, kind);
  let rows = `<tr><td>${e != null ? esc(NP.shortName(e)) + (imp ? " imports" : " exports") : imp ? "World imports" : "World exports"}</td><td>${NP.fmtUSD(v)}</td></tr><tr><td>Share of ${e != null ? (imp ? "its imports" : "its pizza") : "the pizza"}</td><td>${NP.fmtPct(tot ? v / tot : null, 1)}</td></tr>`;
  if (e != null) rows += `<tr><td>World pizza share</td><td>${NP.fmtPct(NP.worldOf(id, y, kind) / NP.worldOf("ALL", y, kind), 1)}</td></tr><tr><td>Its share of world ${imp ? "imports" : "exports"}</td><td>${NP.fmtPct(I.worldShare(id, e, y, kind), 1)}</td></tr>`;
  else { const top = I.ranking(id, y, kind)[0]; if (top) rows += `<tr><td>Largest ${imp ? "importer" : "exporter"}</td><td>${esc(NP.shortName(top.e))} ${NP.fmtPct(top.v / v, 0)}</td></tr>`; }
  const hs = NP.hsCount(id);
  return `<b class="t">${esc(n.long || n.name)}${n.proxy ? "°" : ""}</b>${n.uname && n.uname !== n.name ? `<div class="u">UNCTAD label: ${esc(n.uname)}</div>` : ""}<table>${rows}</table>${n.proxy ? `<div class="warn">° ${esc(NP.PROXY_NOTE)}</div>` : ""}<div class="u" style="margin:4px 0 0">${hs} HS subheading${hs > 1 ? "s" : ""} · click to select</div>`;
}

/* ───────── components ───────── */
const pizza = NP.Pizza("#pizza", {
  select: id => set({ node: id }),
  up: () => { const n = NP.node[state.node], f = n.children ? n : n.parent; set({ node: (f.parent || f).id }); },
  hover: (id, ev) => { showTip(id ? sliceTip(id) : null, ev); highlightRows("#slice-list", id);
    clearTimeout(pvTimer);
    if (id && id !== state.node) pvTimer = setTimeout(() => { if (preview !== id) { preview = id; renderMap(); } }, 180);
    else if (preview) pvTimer = setTimeout(() => { preview = null; renderMap(); }, 120); },
});
const map = NP.Map({
  select: e => set({ eco: state.eco === e ? null : e }),
  hover: (e, ev) => { showTip(e != null ? ecoTip(e) : null, ev); highlightRows("#panel", e); },
  resized: () => { renderMap(); syncTop(); if (state.view === "scatter" && NP.Scatter && NP.Scatter.render) NP.Scatter.render(state); },
});
const timeline = NP.Timeline("#tl", { year: y => { if (y !== state.year) set({ year: y }); } });
/* the chart and the table start below the tool bar, however many rows it takes in this window */
function syncTop() { const h = Math.ceil($(".map-top").getBoundingClientRect().height); if (h > 0) $("#mapwrap").style.setProperty("--toph", h + "px"); }
function highlightRows(sel, key) { document.querySelectorAll(sel + " .row").forEach(r => r.classList.toggle("hl", key != null && (r.dataset.eco === String(key) || r.dataset.node === String(key)))); }

function set(patch) { Object.assign(state, patch); render(); }
NP.app = { state, set, render: () => render(), map, loadFlows, DEFAULT, nodeMax };

/* ───────── KPI bar = layer 1: the four numbers a first-time reader needs, nothing else ───────── */
function renderKpis() {
  const { node, year, eco: e } = state, n = NP.node[node], kind = kindNow(), imp = kind === "D";
  const DEFK = { "world exports": "Exports", "exports": "Exports", "net exporter": "Net exports", "net importer": "Net exports", "of world exports · rank": "World market share", "of world exports": "World market share",
    "of its pizza is substitutes": "Substitutes in the pizza", "of the pizza is substitutes": "Substitutes in the pizza", "of its own pizza": "Share of own pizza",
    "world imports": "Imports", "imports": "Imports", "imports, as reported by exporters": "Imports", "of world imports · rank": "Share of world imports", "of world imports": "Share of world imports" };
  const defOf = l => { const k = DEFK[l] || (l.startsWith("a year since") ? "Growth (CAGR)" : null), d = k && NP.DEFS.find(x => x[0] === k); return d ? ` title="${esc(d[1])}"` : ""; };
  const item = (v, l, c) => `<div class="kpi-divider"></div><div class="kpi-item ${c || ""}"${defOf(l)}><span class="kpi-value">${v}</span><span class="kpi-label">${l}</span></div>`;
  let h = `<div class="kpi-ctx"><b>${esc(n.name)}</b><span>${e != null ? esc(NP.scopeName(e)) : "World"} · ${year}${imp ? " · imports" : ""}</span></div>`;
  if (wOn()) {                                           // tonnes; economies whose weight cannot be relied on are left out of the ranking
    const wT = NP.WtWorld(node, year, kind), rk = I.rankingW(node, year, kind), top = rk.find(d => !d.flag), nq = rk.filter(d => d.flag).length;
    h = h.replace(`${year}${imp ? " · imports" : ""}</span>`, `${year}${imp ? " · imports" : ""} · by weight</span>`);
    h += item(NP.fmtT(wT), imp ? "world imports, by weight" : "world exports, by weight", "kpi-lead");
    if (top) h += item(`${esc(NP.shortName(top.e))} ${NP.fmtPct(wT ? top.w / wT : null, 0)}${top.m ? " †" : ""}`, imp ? "largest importer by weight" : "largest exporter by weight");
    h += item(NP.fmtPct(wT ? NP.Wt(node, NP.GROUP.developing, year, kind) / wT : null, 0), imp ? "of the tonnes go to developing economies" : "of the tonnes come from developing economies");
    h += item(String(nq), "economies with a weight that cannot be relied on");
  } else if (e == null) {                                // each side has its own world total: reporting exporters, reporting importers
    const w = NP.worldOf(node, year, kind), top = I.ranking(node, year, kind)[0], g = I.cagr(node, NP.W, Y[0], year, kind);
    h += item(NP.fmtUSD(w), imp ? "world imports" : "world exports", "kpi-lead");
    if (top) h += item(`${esc(NP.shortName(top.e))} ${NP.fmtPct(top.v / w, 0)}${top.m ? " †" : ""}`, imp ? "largest importer" : "largest exporter");
    h += item(NP.fmtPct(I.groupShare(node, NP.GROUP.developing, year, kind), 0), imp ? "goes to developing economies" : "from developing economies");
    if (year > Y[0]) h += item(NP.fmtSigned(g), `a year since ${Y[0]}`);
  } else if (imp) {                                      // its own report; the exporters' reports (†) if it did not report
    const m = NP.D(node, e, year), rk = I.rank(node, e, year, "D"), rep = NP.isReporter(e, year, node), net = I.netExports(node, e, year);
    h += item(NP.fmtUSD(m) + dag(e, node, year), notOwn(e, node, year) ? "imports, as reported by exporters" : "imports", "kpi-lead");
    h += item(NP.fmtShare(I.worldShare(node, e, year, "D")) + (rk ? ` · #${rk}` : ""), rk ? "of world imports · rank" : "of world imports");
    h += node === "ALL" ? item(NP.fmtPct(I.subsShare(e, year, "D"), 0), "of its imports are substitutes", "c-s") : item(NP.fmtPct(I.pizzaShare(node, e, year, "D"), 0), "of its imports of the pizza");
    h += rep ? item(NP.fmtUSD(net), net >= 0 ? "net exporter" : "net importer") : item("no data", `exports not reported for ${year}`);
  } else {
    const rep = NP.isReporter(e, year, node), x = NP.X(node, e, year), rk = I.rank(node, e, year), net = I.netExports(node, e, year);
    if (rep) { h += item(NP.fmtUSD(x), "exports", "kpi-lead"); h += item(NP.fmtShare(I.worldShare(node, e, year)) + (rk ? ` · #${rk}` : ""), rk ? "of world exports · rank" : "of world exports");
      h += node === "ALL" ? item(NP.fmtPct(I.subsShare(e, year), 0), "of its pizza is substitutes", "c-s") : item(NP.fmtPct(I.pizzaShare(node, e, year), 0), "of its own pizza");
      h += item(NP.fmtUSD(net), net >= 0 ? "net exporter" : "net importer"); }
    else { h += item("no data", `exports not reported for ${year}`, "kpi-lead"); h += item(NP.fmtUSD(NP.D(node, e, year)) + dag(e, node, year), notOwn(e, node, year) ? "imports, as reported by exporters" : "imports"); }
  }
  if (year > NP.LAST_FULL_YEAR) h += `<span class="kpi-warn" title="World totals are the sum of reporting economies">${year} is provisional: ${NP.nReporters(year, node)} economies reported (${NP.nReporters(NP.LAST_FULL_YEAR, node)} in ${NP.LAST_FULL_YEAR})</span>`;
  $("#kpis").innerHTML = h;
}

/* ───────── pizza dock ───────── */
/* what a pizza shows for a slice, a year and an economy; the first page asks for the world's whole pizza with the same function,
   so the big pizza and the one in the dock are the same picture */
function pizzaOpts(node, year, e, lens) {
  const n = NP.node[node], f = n.children ? n : n.parent;
  const imp = lens === "dst";                                                  // import side: also for the world (world imports by slice)
  const val = e != null ? (imp ? id => NP.D(id, e, year) : id => NP.X(id, e, year)) : imp ? id => NP.Mw(id, year) : id => NP.Xw(id, year);
  const total = val(f.id), fname = f.short || f.name;
  const who = e == null ? "World" : NP.scope(e) ? NP.scope(e).short : NP.eco[e].iso || NP.shortName(e).slice(0, 14);
  const center = [{ c: "c-eyebrow", t: who + " · " + year },
    { c: "c-big", t: total > 0 ? NP.fmtUSD(total) : imp ? "no imports" : e != null && !NP.isReporter(e, year, "ALL") ? "no data" : "no exports" }, { c: "c-sub", t: fname.length > 22 ? fname.slice(0, 21) + "…" : fname }];
  if (f.parent) center.push({ c: "c-hint", t: "▲ back" });
  return { focus: f.id, selected: node, val, ref: e != null ? id => NP.worldOf(id, year, imp ? "D" : "X") : null, center, canUp: !!f.parent, f, imp, total, fname };
}
function renderPizza(animate) {
  const { node, year, eco: e } = state, o = pizzaOpts(node, year, e, state.lens), { f, imp, val, total, fname } = o, full = e != null ? NP.scopeName(e) : "";
  pizza.render(Object.assign({ animate }, o));
  const path = NP.ancestors(node).reverse();
  $("#crumbs").innerHTML = path.map((p, i) => (i === path.length - 1 ? `<span class="cur">${esc(p.short || p.name)}</span>` : `<button data-node="${p.id}">${esc(p.short || p.name)}</button>`)).join(`<span class="sep">›</span>`);
  const basis = imp && e != null ? NP.impBasis(e, year, node) : null;
  $("#pizza-note").textContent = wOn() ? "The pizza shows value. Map, numbers and panel are in tonnes." : e == null ? (imp ? "World imports, as reported by the importers. Click a slice to select it." : "Click a slice to select it; click the centre to go back.")
    : imp ? `${full}: imports${basis === "own" ? "" : basis === "mixed" ? ", partly as reported by exporters (†)" : ", as reported by exporters (†): it did not report"}. Outer ring = world.`
    : NP.isReporter(e, year, "ALL") ? `${full}: exports. Outer ring = world.` : `${full} did not report exports for ${year}. “Importers” shows its imports.`;
  const kids = f.children.map(c => ({ n: c, v: val(c.id) })), max = d3.max(kids, d => d.v) || 1;
  const unknown = e != null && !imp && !NP.isReporter(e, year, "ALL");                // no report for the year: unknown, not zero
  $("#slice-list").innerHTML = unknown ? `<div class="group-h">${esc(fname)}</div><p class="pizza-note" style="text-align:left">No export data for ${year}${NP.lastReportYear(e, "ALL") ? " (last reported: " + NP.lastReportYear(e, "ALL") + ")" : ""}. Choose “Its imports” to see what other economies exported to it.</p>`
    : `<div class="group-h">${esc(fname)} · ${NP.fmtUSD(total)}</div>` + kids.map(d =>
    `<div class="row${d.n.id === node ? " on" : ""}" data-node="${d.n.id}" tabindex="0" role="button"><span class="sw" style="background:${d.n.color}"></span><span class="nm${d.n.proxy ? " px" : ""}" title="${esc(d.n.long || d.n.name)}${d.n.proxy ? " — ° " + esc(NP.PROXY_NOTE) : ""}">${d.n.proxy ? `<span>${esc(d.n.name)}</span><b>°</b>` : esc(d.n.name)}</span><span class="vl">${NP.fmtUSD(d.v)} · ${NP.fmtPct(total ? d.v / total : null, 1)}</span><div class="bar"><i style="width:${100 * d.v / max}%;--c:${NP.symbolColor(d.n.id)}"></i></div></div>`).join("");      // the bar lies behind the words, in a tint of the family colour (style.css)
}

/* ───────── map ───────── */
const NS_COL = { SS: "#e08a00", SN: "#4f9d47", NS: "#009edb", NN: "#a066aa" }, IN_COL = "#d67c29";      // IN_COL: flows into the selected economy (UN yellow, dark step)
const NET_BREAKS = [-0.6, -0.2, 0.2, 0.6], NET_RAMP = ["#733d96", "#c7a9d0", "#e3dfdb", "#fcd58a", "#e08a00"], PALE = "#eeece9";
NP.scales.NET_BREAKS = NET_BREAKS; NP.scales.NET_RAMP = NET_RAMP;
/* one key of a legend: a square (or the dot of a flow) with its word; a line of keys wraps between keys, never inside one */
const lgKey = (c, t, dot) => `<span class="k">${dot ? `<span style="color:${c}">●</span>` : `<i style="background:${c}"></i>`}${t}</span>`;
let preview = null, pvTimer = null;                       // slice hovered on the pizza: previewed on the map without selecting it
function renderMap() {
  const { year, eco: sel, lens } = state, canPreview = (lens === "exp" || lens === "dst") && !(sel != null && !NP.isGroup(sel));
  const node = preview && canPreview ? preview : state.node;
  const col = NP.symbolColor(node), fam = NP.node[node].family, n = NP.node[node], lname = esc(n.name.toLowerCase());
  const grp = NP.isGroup(sel) ? new Set(NP.membersOf(sel)) : null, one = sel != null && !grp ? sel : null, inS = e => !grp || grp.has(e);
  const where = grp ? ` · ${esc(NP.scope(sel).short)}` : "";
  const needF = lens === "flows" || (one != null && (lens === "exp" || lens === "dst"));
  const twoFam = lens === "flows" && one == null && node === "ALL";           // whole pizza: plastics and substitutes flows in their own colours
  const Fp = twoFam ? getFlows("P_00") : null, Fs = twoFam ? getFlows("NPS000") : null;
  const F = !needF ? null : twoFam ? (Fp && Fs ? Fp : null) : getFlows(node);
  let msg = "", legend = "";
  map.setSelected(one); map.setCompared(one != null ? state.cmp : null);
  const neutral = e => (inS(e) ? "var(--land)" : PALE), reporterFill = e => (!inS(e) ? PALE : NP.isReporter(e, year, node) ? "var(--land)" : null);
  const hatchLi = `<div class="li"><i class="hatch"></i> no export data reported for ${year}</div>` + (grp ? `<div class="li"><i style="background:${PALE}"></i> not in ${esc(NP.scope(sel).short)}</div>` : "");
  const spikeLegend = (title, max, fmt) => { const hm = Math.min(170, map.size()[1] * 0.34), v = nice(max * 30 / hm), hh = hm * v / max;
    return `<b>${title}</b><div class="li"><svg width="16" height="${Math.ceil(hh) + 2}"><path d="M2,${hh + 1}L8,1L14,${hh + 1}Z" fill="${col}" fill-opacity=".5" stroke="${col}"/></svg> = ${(fmt || NP.fmtUSD)(v)} · same scale in every year</div>`; };
  const selDot = one != null ? { items: [{ e: one, color: "#004990", r: 3.4 }], always: true } : null;      // the selected economy: navy, like its outline (style.css, --sel)
  const choropleth = (val, html) => { const f = e => (inS(e) ? val(e) : PALE);
    map.setSpikes(null); map.setFlows(null); map.setFill(f);
    map.setDots({ items: NP.countries.filter(e => inS(e) && map.hasAnchor(e) && val(e) != null).map(e => ({ e, color: val(e) })) }); legend = html + hatchLi; };
  if (lens === "exp" || lens === "dst") {
    const kind = lens === "dst" ? "D" : "X";
    if (one == null && wOn()) {                          // tonnes: height = weight; hatched = the weight cannot be relied on
      const items = NP.countries.filter(e => inS(e) && NP.side(kind)(node, e, year) > 0).map(e => ({ e, v: NP.Wt(node, e, year, kind), q: !!NP.wFlag(node, e, year, kind), m: kind === "D" && notOwn(e, node, year) })).filter(d => d.v > 0 && map.hasAnchor(d.e));
      const max = nodeMaxW(node, kind), nq = I.rankingW(node, year, kind).filter(d => d.flag).length;
      map.setFill(kind === "X" ? reporterFill : neutral); map.setFlows(null); map.setDots(null);
      map.setSpikes({ items, max, color: col, labels: 9, fmt: NP.fmtT });
      legend = spikeLegend((kind === "X" ? `Who exports ${lname}, in tonnes` : `Who imports ${lname}, in tonnes`), max, NP.fmtT)
        + `<div class="li"><svg width="16" height="14"><path d="M2,13L8,1L14,13Z" fill="url(#nodata)" stroke="${col}"/></svg> weight not reliable: ${nq} economies (listed in the panel)</div>`
        + (kind === "X" ? hatchLi : items.some(d => d.m) ? `<div class="li"><svg width="16" height="14"><path d="M2,13L8,1L14,13Z" fill="${col}" fill-opacity=".1" stroke="${col}" stroke-dasharray="2 1.5"/></svg> † did not report: as reported by exporters</div>` : "");
    } else if (one == null) {
      const get = kind === "D" ? NP.D : NP.X;
      const items = NP.countries.filter(inS).map(e => ({ e, v: get(node, e, year), m: kind === "D" && notOwn(e, node, year) })).filter(d => d.v > 0 && map.hasAnchor(d.e));   // m: drawn hollow
      if (node === "ALL") items.forEach(d => { const p = get("P_00", d.e, year) / d.v; d.parts = [{ f: p, c: "#004990" }, { f: 1 - p, c: "#27833a" }]; });   // exact split: blue = plastics, green = substitutes
      const max = nodeMax(node, kind, grp ? sel : null);                 // a group is drawn on its own scale
      map.setFill(kind === "X" ? reporterFill : neutral); map.setFlows(null); map.setDots(null);
      map.setSpikes({ items, max, color: col, labels: 9 });
      legend = spikeLegend((kind === "X" ? `Who exports ${lname}` : `Who imports ${lname}`) + where, max)
        + (node === "ALL" ? `<div class="li keys">${lgKey("#004990", "plastics")} ${lgKey("#27833a", "substitutes")} <span>(share of each spike)</span></div>` : "")
        + (kind === "X" ? hatchLi : `<div class="li">as each importer reports it${items.some(d => d.m) ? `</div><div class="li"><svg width="16" height="14"><path d="M2,13L8,1L14,13Z" fill="${col}" fill-opacity=".1" stroke="${col}" stroke-dasharray="2 1.5"/></svg> † did not report: as reported by exporters` : ""}</div>`);
    } else {
      map.setFill(neutral); map.setDots(selDot);
      if (!F) { map.setSpikes(null); map.setFlows(null); msg = "Loading partners…"; }
      else {
        const dir = lens === "dst" ? "to" : "from", ps = NP.partnersOf(F, one, year, dir), other = d => (dir === "to" ? d.e : d.p);
        let max = 0; for (const y of Y) { const p = NP.partnersOf(F, one, y, dir)[0]; if (p && p.v > max) max = p.v; }
        map.setSpikes({ items: ps.map(d => ({ e: other(d), v: d.v })).filter(d => map.hasAnchor(d.e)), max: max || 1, color: col, labels: 8 });
        const tot = d3.sum(ps, d => d.v), unit = nice((tot || 1) / 260);
        map.setFlows(ps.length ? { items: ps.map(d => ({ a: d.e, b: d.p, v: d.v, color: col })), unit, max: ps[0].v } : null);
        const base = dir === "to" ? NP.D(node, one, year) : NP.X(node, one, year);
        legend = spikeLegend(dir === "to" ? `Who supplies ${esc(NP.shortName(one))}: ${lname}` : `Where ${esc(NP.shortName(one))}’s exports go: ${lname}`, max || 1)
          + `<div class="li">● 1 dot ≈ ${NP.fmtUSD(unit)} · top ${ps.length} partners = ${NP.fmtPct(base ? tot / base : null, 0)} of the total</div>`
          + (dir === "to" ? `<div class="li">${NP.suppliersOwn(F, one, year) ? "origins as " + esc(NP.shortName(one)) + " reports them" : "† it did not report imports: as reported by the exporters"}</div>` : "");
        if (!ps.length) msg = dir === "from" && !NP.isReporter(one, year, node) ? `${NP.eco[one].n} did not report exports for ${year}. “Importers” shows what others exported to it.` : "No flows for this slice and year.";
      }
    }
  } else if (lens === "rca") {
    /* "for whom does this slice matter": RCA (default), share of all merchandise exports, or share of the economy's own pizza */
    const sp = SPEC[state.spec] && !(state.spec === "pizza" && node === "ALL") ? state.spec : "rca", S = SPEC[sp], ramp = sp === "rca" ? RCA_RAMP[fam] : SEQ_RAMP[fam];
    choropleth(e => { if (!NP.isReporter(e, year, node)) return null; const v = S.val(node, e, year); return v == null ? null : ramp[cls(v, S.breaks)]; },
      `<b>${S.title(lname)}${where}</b><div class="lg-seg">${Object.entries(SPEC).map(([k, o]) => `<button data-spec="${k}" class="${k === sp ? "on" : ""}" ${k === "pizza" && node === "ALL" ? "disabled" : ""}>${o.short}</button>`).join("")}</div>
      <div class="sw-row">${ramp.map(c => `<i style="background:${c}"></i>`).join("")}</div>
      <div class="ticks">${S.ticks.map(t => `<span>${t}</span>`).join("")}<span></span></div>
      <div class="li">${S.note}</div>`);
  } else if (lens === "mix") {
    choropleth(e => { if (!NP.isReporter(e, year, "ALL")) return null; const s = I.subsShare(e, year); return s == null ? null : MIX_RAMP[cls(s, MIX_BREAKS)]; },
      `<b>Which half of the pizza is bigger${where}</b><div class="sw-row">${MIX_RAMP.map(c => `<i style="background:${c}"></i>`).join("")}</div>
      <div class="ticks"><span>0%</span><span>10</span><span>25</span><span>50</span><span>75</span><span>90</span><span>100%</span></div>
      <div class="li">substitutes as a share of each economy’s exports of plastics + substitutes (world: ${NP.fmtPct(I.subsShare(NP.W, year), 0)})</div>`);
  } else if (lens === "net") {
    choropleth(e => { if (!NP.isReporter(e, year, node)) return null; const r = I.netRatio(node, e, year); return r == null ? null : NET_RAMP[cls(r, NET_BREAKS)]; },
      `<b>Net exporters and importers of ${lname}${where}</b><div class="sw-row">${NET_RAMP.map(c => `<i style="background:${c}"></i>`).join("")}</div>
      <div class="ticks"><span>only imports</span><span>balanced</span><span>only exports</span></div>
      <div class="li">(exports − imports) ÷ (exports + imports), each as the economy reports it</div>`);
  } else {
    map.setFill(neutral); map.setSpikes(null); map.setDots(selDot);
    if (!F) { map.setFlows(null); msg = "Loading flows…"; }
    else {
      let items, note, keys = false;
      if (one == null) {
        const tag = (FF, c) => NP.flowsOf(FF, year).filter(d => inS(d.e)).map(d => ({ a: d.e, b: d.p, v: d.v, color: c }));
        const all = (twoFam ? tag(Fp, "#004990").concat(tag(Fs, "#27833a")) : tag(F, col)).sort((a, b) => b.v - a.v).slice(0, twoFam ? 170 : 140), tot = d3.sum(all, d => d.v), w = NP.X(node, grp ? sel : NP.W, year);
        items = all; note = `${all.length} largest flows${grp ? " out of " + esc(NP.scope(sel).short) : ""} = ${NP.fmtPct(w ? tot / w : null, 0)} of ${grp ? "the group’s exports" : "world trade"} in this slice`
          + (twoFam ? `</div><div class="li keys">${lgKey("#004990", "plastics", 1)} ${lgKey("#27833a", "substitutes", 1)}` : "");
      } else {
        const out = NP.partnersOf(F, one, year, "from"), inn = NP.partnersOf(F, one, year, "to");
        items = out.map(d => ({ a: d.e, b: d.p, v: d.v, color: col })).concat(inn.map(d => ({ a: d.e, b: d.p, v: d.v, color: IN_COL })));
        note = `${lgKey(col, "out of " + esc(NP.shortName(one)), 1)} ${lgKey(IN_COL, "into " + esc(NP.shortName(one)), 1)} <span>top ${NP.K.exp} each way</span>`; keys = true;
      }
      const ns = state.fcol === "ns";
      if (ns) { const dv = e => (NP.eco[e].dev === "1400" ? "S" : NP.eco[e].dev === "1500" ? "N" : null); items.forEach(d => { const k = dv(d.a) && dv(d.b) ? dv(d.a) + dv(d.b) : null; d.color = k ? NS_COL[k] : "#aea29a"; });
        note = note.split("</div>")[0] + `</div><div class="li" style="display:block;line-height:1.5">` + [["SS", "South→South"], ["SN", "South→North"], ["NS", "North→South"], ["NN", "North→North"]].map(([k, t]) => `<span style="color:${NS_COL[k]}">●</span> ${t}`).join(" &nbsp;") + `<br>North = developed, South = developing economies`; }
      const tot = d3.sum(items, d => d.v), unit = nice((tot || 1) / (one == null ? 900 : 320)), max = d3.max(items, d => d.v) || 1;
      map.setFlows(items.length ? { items, unit, max } : null);
      legend = `<b>Trade flows: ${lname}</b><div class="lg-seg"><button data-fcol="slice" class="${ns ? "" : "on"}">Colour by slice</button><button data-fcol="ns" class="${ns ? "on" : ""}">by North–South direction</button></div>
        <div class="li">● 1 dot ≈ ${NP.fmtUSD(unit)}, moving from exporter to destination</div><div class="li${keys ? " keys" : ""}">${note}</div>`;
      if (!items.length) msg = "No flows for this slice and year.";
    }
  }
  const lg = $("#legend"); lg.innerHTML = legend ? legend + `<span class="lg-t">Legend</span><button class="lg-x" aria-label="Collapse or expand the legend" title="Collapse / expand">${lg.classList.contains("min") ? "+" : "–"}</button>` : "";
  lg.classList.toggle("hidden", !legend || state.view !== "map" || state.story != null);
  const mm = $("#mapmsg"); mm.textContent = msg; mm.classList.toggle("hidden", !msg || state.view !== "map");
  const sc = $("#scope");
  if (sel != null) { sc.innerHTML = `<span>${esc(NP.scopeName(sel))}${grp ? ` · ${grp.size} economies` : ""}</span><button class="x" id="scope-x" aria-label="Back to world view" title="Back to world view (Esc)">×</button>`; sc.classList.remove("hidden"); }
  else sc.classList.add("hidden");
  $("#scope-sel").value = grp ? NP.eco[sel].c : "";
  $("#mapwrap").classList.toggle("has-scope", sel != null);
  $("#mapwrap").classList.toggle("choro", lens === "rca" || lens === "mix" || lens === "net");      // the colour of the land is the data: the selected economy is outlined, not washed over
}

function renderPanel() {
  const st = { node: state.node, year: state.year, eco: state.eco, lens: state.lens, dir: state.lens === "dst" ? "to" : "from", cmp: state.cmp };
  $("#panel").innerHTML = state.eco == null ? (wOn() ? NP.Panel.weight(st) : NP.Panel.world(st)) : NP.Panel.economy(st, getFlows(state.node));
}

function renderTimeline() {
  const { node, year, eco: e } = state, n = NP.node[node], imp = state.lens === "dst";
  /* imports of an economy: its own reports, with gaps where it did not report; if it did not report the selected year, the exporters' reports throughout */
  const impSer = (id, o) => (NP.impBasis(o, year, id) === "mirror" ? NP.seriesDx(id, o) : Y.map(y => (NP.impBasis(o, y, id) !== "mirror" ? NP.D(id, o, y) : null)));
  const ser = id => (e == null ? (imp ? NP.seriesM(id, NP.W) : NP.seriesX(id, NP.W)) : imp ? impSer(id, e) : NP.seriesX(id, e).map((v, i) => (NP.isReporter(e, Y[i], id) ? v : null)));   // null = did not report
  const series = node === "ALL" ? [{ name: "Plastics", color: "#004990", values: ser("P_00") }, { name: "Substitutes", color: "#27833a", values: ser("NPS000") }]
    : [{ name: n.name.length > 20 ? n.name.slice(0, 19) + "…" : n.name, color: NP.symbolColor(node), values: ser(node) }];
  const c2 = state.cmp, overlay = c2 != null && e != null ? { name: NP.eco[c2].iso || NP.shortName(c2), values: imp ? impSer(node, c2) : NP.seriesX(node, c2).map((v, i) => (NP.isReporter(c2, Y[i], node) ? v : null)) } : null;
  const max = Math.max(d3.max(Y.map((_, i) => d3.sum(series, s => s.values[i] || 0))) || 0, overlay ? d3.max(overlay.values, v => v || 0) || 0 : 0) || 1, unitDiv = max >= 2e9 ? 1e9 : max >= 2e6 ? 1e6 : 1e3;
  const events = e == null ? [{ y: 2009, t: "Financial crisis" }, { y: 2020, t: "COVID-19" }].concat(node === "P_05" ? [{ y: 2018, t: "China’s waste import ban" }] : []) : [];
  const mirrorNow = imp && e != null && NP.impBasis(e, year, node) === "mirror";
  if (wOn()) {                                           // world tonnes of the side shown
    const wv = Y.map(y => NP.WtWorld(node, y, imp ? "D" : "X")), wm = d3.max(wv) || 1, ud = wm >= 2e6 ? 1e6 : 1e3;
    timeline.render({ series: [{ name: n.name, color: NP.symbolColor(node), values: wv }], year, unitDiv: ud, events, overlay: null, provisionalFrom: NP.LAST_FULL_YEAR + 1, fmt: NP.fmtT,
      title: `${imp ? "Imports" : "Exports"} of ${n.name.toLowerCase()} · world · ${ud === 1e6 ? "million" : "thousand"} tonnes, as reported` });
    $("#year-out").textContent = year; $("#foot-year").textContent = year > NP.LAST_FULL_YEAR ? `${year} is provisional (${NP.nReporters(year, "ALL")} reporters).` : "";
    return;
  }
  timeline.render({ series, year, unitDiv, events, overlay, provisionalFrom: NP.LAST_FULL_YEAR + 1,
    title: `${imp ? (mirrorNow ? "Imports, as reported by exporters (†)," : "Imports") : "Exports"} of ${n.name.toLowerCase()} · ${e != null ? NP.scopeName(e) : "world"} · US$ ${unitDiv === 1e9 ? "bn" : unitDiv === 1e6 ? "m" : "k"}, current prices` });
  $("#year-out").textContent = year;
  $("#foot-year").textContent = year > NP.LAST_FULL_YEAR ? `${year} is provisional (${NP.nReporters(year, "ALL")} reporters).` : "";
}

function renderChrome() {
  const sc = state.view !== "map";
  if (map.isGlobe() !== !!state.globe) { map.setGlobe(state.globe); memo.map = null; }
  $("#zglobe").setAttribute("aria-pressed", state.globe ? "true" : "false");
  const single = state.eco != null && !NP.isGroup(state.eco), LBL = single ? { exp: "Its exports", dst: "Its imports" } : { exp: "Exporters", dst: "Importers" };
  /* the lens is the question, in every view: the map, the chart and the table answer the same one. Only the arrows of "Flows" need a map */
  $("#lens-cap").textContent = LENS_CAP[state.view];
  document.querySelectorAll("#lens button[data-v]").forEach(b => { const v = b.dataset.v, on = v === state.lens; b.classList.toggle("active", on); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    b.classList.toggle("hidden", sc && v === "flows"); if (LENS_TIP[state.view][v]) b.title = LENS_TIP[state.view][v]; if (LBL[v]) b.textContent = LBL[v]; });
  const MORE = { net: "Balance", rca: "Specialisation" }, mb = $("#lens-more");                 // second-layer lenses live in the menu; the button shows which one is on
  mb.textContent = (MORE[state.lens] || (sc ? "More" : "More maps")) + " ▾"; mb.classList.toggle("active", !!MORE[state.lens]);
  document.querySelectorAll("#view button").forEach(b => { const on = b.dataset.v === state.view; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  $("#scatter").classList.toggle("hidden", state.view !== "scatter"); $("#tableview").classList.toggle("hidden", state.view !== "table");
  $("#meas-fld").classList.toggle("hidden", !canWeigh());
  document.querySelectorAll("#meas button").forEach(b => { const on = (b.dataset.v === "w") === wOn(); b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
  ["#zglobe", "#zin", "#zout", "#zreset"].forEach(id => $(id).classList.toggle("hidden", sc));
  $("#zshot").classList.toggle("hidden", state.view === "table");
}

const LENS_CAP = { map: "Map shows", scatter: "Chart shows", table: "Table shows" };
const LENS_TIP = {
  map: { exp: "Height of each spike = export value", dst: "Height of each spike = import value, as each economy reports it (hollow: as reported by the exporters)", flows: "Moving dots = exports from one economy to another",
    mix: "Colour = is the economy’s pizza mostly plastics or mostly substitutes?" },
  scatter: { exp: "Who sells the most, and who is gaining ground?", dst: "Who buys the most, and whose demand is growing?", mix: "Plastics or substitutes: what do poorer and richer economies sell?" },
  table: { exp: "Exports first, sorted by exports", dst: "Imports first, sorted by imports", mix: "Sorted by the share of substitutes in each economy’s pizza" } };
/* each component re-renders only when something it depends on changed (keeps year playback and hover cheap) */
const memo = {}; let first = true, flowsBack = false, lastView = "map";
const changed = (k, v) => (memo[k] === v ? false : ((memo[k] = v), true));
function render() {
  if (state.cmp != null && (state.eco == null || NP.isGroup(state.eco) || state.cmp === state.eco)) state.cmp = null;     // a comparison needs one selected economy
  if (state.meas === "w" && !canWeigh()) state.meas = "v";
  /* "Flows" is arrows between economies: a map. The chart and the table start from the exporters instead, and the map gets its arrows back */
  if (state.view !== "map" && state.lens === "flows") { state.lens = "exp"; flowsBack = true; }
  else if (state.view === "map" && lastView !== "map" && flowsBack && state.lens === "exp") state.lens = "flows";
  if (state.view === "map") flowsBack = false;
  lastView = state.view;
  const s = state, side = s.lens === "dst", base = `${s.node}|${s.year}|${s.eco}|${side}|${s.cmp}|${s.meas}`, fl = Object.keys(flowsNow).length;
  renderChrome();
  if (changed("kpi", base)) renderKpis();
  if (changed("pizza", base)) renderPizza(!first);
  if (changed("map", `${base}|${s.lens}|${s.spec}|${s.fcol}|${s.view}|${s.story}|${fl}`)) renderMap();
  if (changed("panel", `${base}|${s.lens}|${fl}`)) renderPanel();
  if (changed("tl", base)) renderTimeline();
  if (s.view !== "map") syncTop();
  if (s.view === "scatter" && NP.Scatter && NP.Scatter.render) NP.Scatter.render(s);
  if (s.view === "table" && NP.Table && changed("table", `${base}|${s.view}|${s.lens}`)) NP.Table.render(s);
  if (s.view !== "table") memo.table = null;
  if (NP.Story && NP.Story.render) NP.Story.render(s);
  if (NP.Cover) NP.Cover.render(s);
  writeHash(); first = false;
}
/* first page (cover): while the big pizza is in flight the dock pizza holds the same picture (world, whole pizza);
   released, it morphs into the current slice and economy. replayMap lets the spikes grow again once the map is uncovered. */
NP.app.pizzaOpts = pizzaOpts;
NP.app.dockPizza = { hold: () => pizza.render(Object.assign({ animate: false }, pizzaOpts("ALL", state.year, null, "exp"))),
  release: animate => { if (!(state.node === "ALL" && state.eco == null && state.lens !== "dst")) renderPizza(animate); } };
NP.app.replayMap = () => { if (state.view === "map" && (state.lens === "exp" || state.lens === "dst")) { map.setSpikes(null); renderMap(); } };

/* ───────── events ───────── */
document.querySelectorAll("#lens button[data-v]").forEach(b => b.addEventListener("click", () => { $("#lens-menu").classList.add("hidden"); $("#lens-more").setAttribute("aria-expanded", "false");
  const v = b.dataset.v, pair = l => l === "exp" || l === "dst"; flowsBack = false;
  set(pair(v) && pair(state.lens) ? { lens: v } : { lens: v, sx: null, sy: null }); }));          // another question: the chart goes back to its suggested axes (Exporters ↔ Importers only changes the side)
$("#lens-more").addEventListener("click", ev => { ev.stopPropagation(); const m = $("#lens-menu"); m.classList.toggle("hidden"); $("#lens-more").setAttribute("aria-expanded", m.classList.contains("hidden") ? "false" : "true"); });
document.addEventListener("click", ev => { if (!ev.target.closest(".more")) { $("#lens-menu").classList.add("hidden"); $("#lens-more").setAttribute("aria-expanded", "false"); } });
/* sections of the panel that the reader opened stay open when the panel is redrawn */
$("#panel").addEventListener("toggle", ev => { const d = ev.target; if (d.matches && d.matches("details.sec")) { if (d.open) NP.Panel.open.add(d.dataset.sec); else NP.Panel.open.delete(d.dataset.sec); } }, true);
document.querySelectorAll("#view button").forEach(b => b.addEventListener("click", () => set({ view: b.dataset.v })));
document.querySelectorAll("#meas button").forEach(b => b.addEventListener("click", () => set({ meas: b.dataset.v })));
document.addEventListener("click", ev => { const b = ev.target.closest("[data-meas]"); if (b) set({ meas: b.dataset.meas }); });
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-node],[data-eco],#scope-x"); if (!t) return;
  if (t.id === "scope-x") return set({ eco: null });
  if (t.dataset.node && NP.node[t.dataset.node] && t.closest("#dock,#panel")) return set({ node: t.dataset.node });
  if (t.dataset.eco != null && t.closest("#panel")) { const e = +t.dataset.eco; if (NP.eco[e] && NP.eco[e].t === "country") set({ eco: e }); }
});
$("#panel").addEventListener("mouseover", ev => { const r = ev.target.closest(".row[data-node]"); pizza.highlight(r ? r.dataset.node : null); });
$("#panel").addEventListener("mouseleave", () => pizza.highlight(null));
$("#slice-list").addEventListener("mouseover", ev => { const r = ev.target.closest(".row[data-node]"); pizza.highlight(r ? r.dataset.node : null); });
$("#slice-list").addEventListener("mouseleave", () => pizza.highlight(null));
$("#zglobe").onclick = () => set({ globe: !state.globe });
const shoot = () => { if (state.view === "table") { set({ view: "map" }); setTimeout(shoot, 700); return; } if (NP.snapshot) NP.snapshot().catch(e => { const m = $("#mapmsg"); m.textContent = "The image could not be created in this browser: " + e.message; m.classList.remove("hidden"); }); };
$("#zshot").onclick = shoot;
document.addEventListener("click", ev => { if (ev.target.closest("[data-png]")) shoot(); });
$("#zin").onclick = () => map.zoomBy(1.6); $("#zout").onclick = () => map.zoomBy(1 / 1.6); $("#zreset").onclick = () => map.resetZoom();
let timer = null;
function stopPlay() { clearInterval(timer); timer = null; $("#play").textContent = "▶"; }
NP.app.stopPlay = stopPlay;
NP.app.play = (from, to, ms) => { stopPlay(); set({ year: from }); $("#play").textContent = "❚❚";
  timer = setInterval(() => { if (state.year >= (to || YMAX)) return stopPlay(); set({ year: state.year + 1 }); }, ms || 900); };
$("#play").onclick = () => { if (timer) return stopPlay(); NP.app.play(state.year >= YMAX ? Y[0] : state.year, YMAX); };
$("#btn-reset").onclick = () => { stopPlay(); map.resetZoom(); Object.assign(state, DEFAULT); render(); };
NP.app.reset = () => $("#btn-reset").onclick();
document.addEventListener("keydown", ev => {
  if (ev.target.matches("input,select,textarea")) return;
  if (ev.key === "ArrowRight" && state.year < YMAX) set({ year: state.year + 1 });
  if (ev.key === "ArrowLeft" && state.year > Y[0]) set({ year: state.year - 1 });
  if (ev.key === "Escape" && state.eco != null) set({ eco: null });
});

/* CSV export of what is on screen (every value from NP.ind; US$ unless stated) */
function csvDownload(name, head, rows) {
  const q = v => (v == null || (typeof v === "number" && !isFinite(v)) ? "" : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const body = [head].concat(rows).map(r => r.map(q).join(",")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const rcaSafe = NP.rcaSafe, IMP_SRC = { own: "own report", mirror: "reports of the exporting economies", mixed: "own report for one family, exporters' reports for the other" };
NP.csv = {
  world(node, year) {
    const head = ["economy", "code", "iso3", "region", "development_status", "slice", "year", "exports_usd", "world_share", "rank", "rca_balassa", "share_of_merchandise_exports", "share_of_gdp", "exports_per_capita_usd",
      "imports_exporter_reported_usd", "net_exports_usd", "substitutes_share_of_own_pizza", "gdp_per_capita_usd", "population", "reported_exports_this_year", "imports_usd", "imports_source", "share_of_world_imports", "rank_among_importers"];
    const rows = NP.countries.filter(e => NP.isReporter(e, year, node) || NP.D(node, e, year) > 0).map(e => { const E = NP.eco[e], rep = NP.isReporter(e, year, node);
      return [E.n, E.c, E.iso || "", NP.regionName(E.reg), E.dev === "1400" ? "Developing" : E.dev === "1500" ? "Developed" : "", NP.node[node].name, year, rep ? NP.X(node, e, year) : null, rep ? I.worldShare(node, e, year) : null, rep ? I.rank(node, e, year) : null,
        rep ? rcaSafe(node, e, year) : null, rep ? I.merchShare(node, e, year) : null, rep ? I.gdpShare(node, e, year) : null, rep ? I.perCapita(node, e, year) : null, NP.Dx(node, e, year), rep ? I.netExports(node, e, year) : null,
        rep ? I.subsShare(e, year) : null, NP.gdppc(e, year), NP.pop(e, year), rep ? "yes" : "no",
        NP.D(node, e, year), IMP_SRC[NP.impBasis(e, year, node)], I.worldShare(node, e, year, "D"), I.rank(node, e, year, "D")]; }).sort((a, b) => (state.lens === "dst" ? (b[20] || 0) - (a[20] || 0) : (b[7] || 0) - (a[7] || 0)));
    return { name: `plastics_substitutes_${node}_${year}.csv`, head, rows };
  },
  economy(node, e) {
    const head = ["economy", "code", "slice", "year", "exports_usd", "world_share", "rank", "rca_balassa", "share_of_merchandise_exports", "share_of_gdp", "imports_exporter_reported_usd", "net_exports_usd", "world_exports_usd", "reported_exports_this_year", "imports_usd", "imports_source", "world_imports_usd"];
    const E = NP.eco[e], rows = Y.map(y => { const rep = NP.isReporter(e, y, node);
      return [E.n, E.c, NP.node[node].name, y, rep ? NP.X(node, e, y) : null, rep ? I.worldShare(node, e, y) : null, rep ? I.rank(node, e, y) : null, rep ? rcaSafe(node, e, y) : null, rep ? I.merchShare(node, e, y) : null, rep ? I.gdpShare(node, e, y) : null,
        NP.Dx(node, e, y), rep ? I.netExports(node, e, y) : null, NP.Xw(node, y), rep ? "yes" : "no", NP.D(node, e, y), IMP_SRC[NP.impBasis(e, y, node)], NP.Mw(node, y)]; });
    return { name: `plastics_substitutes_${node}_${E.iso || E.c}.csv`, head, rows };
  },
};
document.addEventListener("click", ev => { const b = ev.target.closest("[data-csv]"); if (!b) return;
  const c = b.dataset.csv === "eco" && state.eco != null ? NP.csv.economy(state.node, state.eco) : NP.csv.world(state.node, state.year); csvDownload(c.name, c.head, c.rows); });

/* legend can be collapsed (small screens) */
$("#legend").addEventListener("click", ev => { const lg = $("#legend"); const sb = ev.target.closest("[data-spec]"); if (sb) { set({ spec: sb.dataset.spec }); return; }
  const fb = ev.target.closest("[data-fcol]"); if (fb) { set({ fcol: fb.dataset.fcol }); return; } if (ev.target.closest(".lg-x") || lg.classList.contains("min")) { lg.classList.toggle("min"); const b = lg.querySelector(".lg-x"); if (b) b.textContent = lg.classList.contains("min") ? "+" : "–"; } });
/* rows are keyboard-operable */
document.addEventListener("keydown", ev => { if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches && ev.target.matches(".row[tabindex]")) { ev.preventDefault(); ev.target.click(); } });

/* compare with a second economy (input with suggestions in the economy panel) */
const cmpList = document.createElement("datalist"); cmpList.id = "cmp-list";
cmpList.innerHTML = NP.countries.filter(e => NP.lastReportYear(e, "ALL")).map(e => `<option value="${esc(NP.eco[e].n)}"></option>`).join(""); document.body.appendChild(cmpList);
document.addEventListener("change", ev => { if (ev.target.id !== "cmp-input") return; const q = ev.target.value.trim().toLowerCase(); if (!q) return set({ cmp: null });
  const hit = NP.countries.find(e => NP.eco[e].n.toLowerCase() === q) ?? NP.countries.find(e => (NP.eco[e].iso || "").toLowerCase() === q) ?? NP.countries.find(e => NP.lastReportYear(e, "ALL") && NP.eco[e].n.toLowerCase().startsWith(q));
  if (hit != null && hit !== state.eco) set({ cmp: hit }); });
document.addEventListener("click", ev => { if (ev.target.closest("[data-cmp-clear]")) set({ cmp: null }); });

/* group scope */
const scopeSel = $("#scope-sel");
scopeSel.innerHTML = `<option value="">All economies</option>` + [["dev", "Development groups"], ["cont", "Continents"], ["sub", "Regions"], ["other", "Other groupings"]]
  .map(([k, t]) => { const ss = NP.SCOPES.filter(s => s.kind === k); return ss.length ? `<optgroup label="${t}">${ss.map(s => `<option value="${s.code}">${esc(s.name)}</option>`).join("")}</optgroup>` : ""; }).join("");
function frameScope(e) { const sc = e != null ? NP.scope(e) : null; if (sc && (sc.kind === "cont" || sc.kind === "sub")) map.fitEcos(NP.membersOf(e)); else map.resetZoom(); }      // a continent or a region is framed on the map
scopeSel.onchange = () => { const e = scopeSel.value ? NP.ecoIdx[scopeSel.value] : null; set({ eco: e, view: state.view }); frameScope(e); };

/* search: economies, groups and product slices in one box (arrow keys + Enter) */
const sIn = $("#search-input"), sList = $("#search-list");
const fold = s => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const searchable = NP.countries.filter(e => NP.lastReportYear(e, "ALL") || d3.sum(NP.seriesD("ALL", e)) > 0).map(e => ({ kind: "eco", key: e, n: NP.eco[e].n, alt: NP.eco[e].iso || "", tag: NP.eco[e].iso || "" }))
  .concat(NP.SCOPES.map(s => ({ kind: "eco", key: s.e, n: s.name, alt: s.short, tag: "group" })))
  .concat(Object.values(NP.node).filter(n => n.id !== "ALL").map(n => ({ kind: "node", key: n.id, n: n.name, alt: (n.uname || "") + " " + (n.long || ""), tag: n.parent && n.parent.id !== "ALL" ? "slice · " + (n.parent.short || n.parent.name) : "slice" })))
  .map(d => Object.assign(d, { f: fold(d.n), fa: fold(d.alt) })).sort((a, b) => a.n.localeCompare(b.n));
let sHits = [], sAt = 0;
function drawHits() { sList.innerHTML = sHits.length ? sHits.map((d, i) => `<li role="option" data-i="${i}" class="${i === sAt ? "on" : ""}"><span>${esc(d.n)}</span><small>${esc(d.tag)}</small></li>`).join("") : `<li><span>Nothing found</span></li>`; sList.classList.remove("hidden"); }
function doSearch() {
  const q = fold(sIn.value.trim()); if (!q) { sList.classList.add("hidden"); sHits = []; return; }
  const score = d => (d.f.startsWith(q) || d.fa.startsWith(q) ? 0 : d.f.includes(" " + q) ? 1 : d.f.includes(q) ? 2 : d.fa.includes(q) ? 3 : 9);
  sHits = searchable.map(d => [score(d), d]).filter(x => x[0] < 9).sort((a, b) => a[0] - b[0] || (a[1].kind === "eco" ? 0 : 1) - (b[1].kind === "eco" ? 0 : 1)).slice(0, 14).map(x => x[1]); sAt = 0; drawHits();
}
function pick(d) { if (!d) return; sIn.value = ""; sList.classList.add("hidden"); sHits = [];
  if (d.kind === "node") return set({ node: d.key });
  set({ eco: d.key, view: "map" }); if (NP.isGroup(d.key)) frameScope(d.key); else map.flyTo(d.key); }
sIn.addEventListener("input", doSearch);
sIn.addEventListener("keydown", ev => {
  if (ev.key === "Enter") pick(sHits[sAt]);
  else if (ev.key === "ArrowDown" && sHits.length) { ev.preventDefault(); sAt = (sAt + 1) % sHits.length; drawHits(); }
  else if (ev.key === "ArrowUp" && sHits.length) { ev.preventDefault(); sAt = (sAt + sHits.length - 1) % sHits.length; drawHits(); }
  else if (ev.key === "Escape") { sIn.value = ""; sList.classList.add("hidden"); sHits = []; } });
sList.addEventListener("mousedown", ev => { const li = ev.target.closest("li[data-i]"); if (li) { ev.preventDefault(); pick(sHits[+li.dataset.i]); } });
sIn.addEventListener("blur", () => setTimeout(() => sList.classList.add("hidden"), 150));

/* methodology */
$("#btn-method").onclick = () => {
  const YL = NP.LAST_FULL_YEAR, own = NP.countries.filter(e => NP.impBasis(e, YL, "P_00") === "own" && NP.M("P_00", e, YL) > 1e6 && NP.Dx("P_00", e, YL) > 1e6);
  const apart = own.filter(e => Math.abs(NP.M("P_00", e, YL) / NP.Dx("P_00", e, YL) - 1) > 0.2).length;                // economies whose own import figure and the exporters' differ by more than a fifth
  const nMir = NP.countries.filter(e => NP.impBasis(e, YL, "P_00") === "mirror" && NP.Dx("P_00", e, YL) > 0).length;
  $("#method-body").innerHTML = `<h2>Methodology</h2>
    <p>This explorer shows world trade in plastics (five life-cycle stages) and in the natural and mineral materials UNCTAD tracks as potential substitutes (2 tiers, 10 groups, 71 sub-groups). Both groupings are experimental UNCTAD classifications built on HS 2022 subheadings (${NP.hsCount("P_00")} for plastics, ${NP.hsCount("NPS000")} for substitutes; five are in both).</p>
    <h3>Basis</h3>
    <p>All values are in current US$ <b>as each economy reports them: exports by the exporter, imports by the importer</b> (imports include freight and insurance, exports do not). The pizza on the first page and every export figure use exports; <b>Importers</b> switches the whole explorer to imports.</p>
    <p>Where an economy did not report imports for a year, what the reporting economies say they exported to it is shown instead and marked <b>†</b> (${nMir} economies for plastics in ${YL}). These values are not part of the world import total. Next to an economy’s own import figure the explorer also quotes what the exporters report: the two rarely agree exactly (valuation, timing, goods in transit, misdeclaration) — for plastics in ${YL} they differ by more than a fifth for ${apart} of ${own.length} economies.</p>
    <p>“World” is the sum of reporting economies on each side, so world exports (${NP.fmtUSD(NP.Xw("ALL", YL))} in ${YL}) and world imports (${NP.fmtUSD(NP.Mw("ALL", YL))}) are two different totals; nothing is estimated for non-reporters. ${NP.nReporters(2023, "ALL")} economies reported 2023 and ${NP.nReporters(2024, "ALL")} had reported 2024 when the data were extracted, so <b>2024 is provisional</b> and not comparable with earlier years. Some large economies stop reporting in certain years (for example the Russian Federation after 2021).</p>
    <h3>Indicators</h3><p>They are shown in layers: a few key numbers in the bar at the top, a profile in the panel, and more detail and context in the sections that open on a click.</p>
    ${[1, 2, 3, 4].map(L => `<h4 class="lay">${NP.LAYERS[L]}</h4><dl>${NP.DEFS.filter(d => d[2] === L).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`).join("")}
    <h3>Things to keep in mind</h3>
    <ul><li>Most substitute lines are broad HS headings that are also traded for food, feed, construction and other uses. A high value does not mean that plastics are being replaced.</li>
    <li>Sub-groups are named by their HS content (as in the SMEP factsheet); UNCTAD’s own labels, which describe the intended substitute use, are shown in tooltips.</li>
    <li>° marks a proxy, as in the factsheet: ${esc(NP.PROXY_NOTE.charAt(0).toLowerCase() + NP.PROXY_NOTE.slice(1))} ${Object.values(NP.node).filter(n => n.proxy).length} of the 71 sub-groups carry the mark.</li>
    <li>Five HS subheadings (about US$5 billion a year) are in both groupings and are counted in both halves of the pizza: cellulose ethers (HS 3912), natural polymers (HS 3913) and cellulose-derivative sheet (HS 3920.79) are chemically modified natural materials that UNCTAD also counts as plastics.</li>
    <li>The same material can appear under a raw-material group and a product group (cork, bamboo, jute, glass, aluminium). That is gross trade at two points of the chain, not the same shipment counted twice.</li>
    <li>Wood-based sub-groups of “Plant/tree-based (raw)” share HS codes, mainly before 2017, so they can add up to more than their group. Every slice shows its own reported value and sub-group slices are scaled inside their group.</li>
    <li>RCA and “share of merchandise exports” divide the product series by UNCTADstat’s “Merchandise: total trade” (exports). Both come from UNCTADstat, but they are separate tables; in the rare case where a slice exceeds the economy’s reported total, the ratio is not shown.</li>
    <li>Flow maps show the ${NP.K.exp} largest partners of each economy; partner counts and concentration indices use all partners.</li>
    <li>Groups (developing and developed economies, LDCs, LLDCs, SIDS, regions) use UNCTAD’s own aggregate rows for their totals and UNCTADstat’s current classification for their members. Region-to-region trade uses the same aggregate rows; the small remainder goes to partners outside the five regions (ship stores, free zones, unspecified).</li>
    <li><b>Importers</b> switches the whole explorer to the import side: key numbers, tooltips, panel, pizza, table and time line then describe each economy’s imports (its share of world imports, its rank among importers, the growth and make-up of its imports, where they come from according to its own records). The triangles on the map are those import values; hollow triangles are † values. An economy’s own exports are quoted only where they are labelled as exports.</li>
    <li>Growth and changes of share on the import side are shown only when both years rest on the same kind of report.</li>
    <li><b>Weight</b> is offered for plastic waste only (“Measure: Tonnes”, world view of Exporters and Importers). Tonnes are the unit in which waste is regulated, and value understates low-grade waste. But the weights of the source are patchy, so every weight is screened: no weight for a value of US$0.1 million or more; partner rows that add up to at least 20% (and 100 tonnes) more than the row to the world; or a value per tonne more than eight times above or below the median. In ${YL} this sets aside ${I.rankingW("P_05", YL, "X").filter(d => d.flag).length} exporters and ${I.rankingW("P_05", YL, "D").filter(d => d.flag).length} importers; they are hatched on the map and left out of rankings, and the world total in tonnes inherits their gaps. No value per tonne is shown anywhere.</li>
    <li>† values only contain what reporting economies exported. Supplies from economies that did not report in a year (for example the Russian Federation after 2021) are missing from their partners’ imports.</li>
    <li>“Economies” are the reporting units of UNCTADstat. They include territories and special administrative regions; this does not imply any opinion on their legal status.</li>
    <li>The globe view shows the same United Nations map geometry on a sphere.</li></ul>
    <h3>Sources</h3>
    <p>UNCTADstat Data Centre: “Plastics trade by partner, annual (analytical)”, “Trade in non-plastic substitutes, annual (analytical)”, “Gross domestic product”, “Total and urban population”, “Merchandise: total trade”; UNCTADstat classifications (product hierarchies, economy groupings). UNCTAD calculations based on UN Comtrade. Concept and first page after the SMEP factsheet “Plastics and their substitutes in global trade” (H. Pacini, UNCTAD).</p>
    <h3>Map disclaimer</h3>
    <p>The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the United Nations. Dotted and dashed lines represent approximate borders for which the final status has not yet been agreed.</p>
    <p style="color:#6e6259">Data build: ${window.NP_META.built}.</p>`;
  $("#method").showModal();
};
$("#method-close").onclick = () => $("#method").close();
$("#btn-story").onclick = () => { if (NP.Story && NP.Story.start) NP.Story.start(); };
$("#btn-link").onclick = () => { const b = $("#btn-link"), done = t => { b.textContent = t; setTimeout(() => { b.textContent = "Copy link"; }, 1600); };
  try { navigator.clipboard.writeText(location.href).then(() => done("Link copied"), () => done("Copy the address bar")); } catch (e) { done("Copy the address bar"); } };
window.addEventListener("hashchange", () => {
  if (location.hash.length <= 1 || location.hash === "#cover") { if (NP.Cover) NP.Cover.show(false); return; }
  const before = JSON.stringify(state); readHash(); const covered = NP.Cover && NP.Cover.isOn(); if (covered) NP.Cover.hide();
  if (covered || JSON.stringify(state) !== before) render(); });
/* back to the first page: from the dock (the pizza grows back into the page) or from the logo */
$("#btn-cover").onclick = () => { if (NP.Cover) NP.Cover.show(true); };
$(".header-logo").onclick = () => { if (NP.Cover) NP.Cover.show(true); };

/* ───────── the stage follows the shape of the window ─────────
   The world map is 2.05 times as wide as it is high (Equal Earth), so its size is set by whichever of width and height runs out first.
   What is left over in the other direction is put to use instead of lying empty around the map:
     · window higher than the map needs → the time line grows (up to 200 px) and the panels give the map their spare width;
     · window wider than the map needs  → the two panels grow (up to 80 and 100 px more).
   The text never changes size (browser zoom keeps working); stacked windows (≤ 1050 px) are left to the style sheet. */
const MAP_ASPECT = (() => { const b = d3.geoPath(d3.geoEqualEarth()).bounds({ type: "Sphere" }); return (b[1][0] - b[0][0]) / (b[1][1] - b[0][1]); })();
function layoutStage() {
  const root = document.documentElement.style;
  if (innerWidth <= 1050) { ["--dockw", "--panelw", "--tlh"].forEach(v => root.removeProperty(v)); return null; }
  const vw = innerWidth, cl = (a, v, b) => Math.max(a, Math.min(b, v));
  let dock = cl(270, 0.22 * vw, 340), panel = cl(300, 0.25 * vw, 380), tl = 92;
  const flexH = $("#stage").clientHeight + $("#timeline").offsetHeight;                    // what stage and time line share; does not depend on how they share it
  const needH = w => (w - 20) / MAP_ASPECT + 58, needW = h => (h - 58) * MAP_ASPECT + 20;   // 46 px above the map for the toolbar, 12 below, 10 on each side (map.js)
  let mapW = vw - dock - panel; const stageH = flexH - tl;
  if (stageH > needH(mapW) + 30) {                         // higher than the map needs
    const d = Math.min(dock - 270, 40), q = Math.min(panel - 300, 50); dock -= d; panel -= q; mapW += d + q;
    tl = Math.round(cl(92, flexH - needH(mapW) - 30, 200));
  } else if (mapW > needW(stageH) + 40) {                  // wider than the map needs
    const extra = mapW - needW(stageH) - 40; dock += Math.min(80, extra * 0.45); panel += Math.min(100, extra * 0.55);
  }
  root.setProperty("--dockw", Math.round(dock) + "px"); root.setProperty("--panelw", Math.round(panel) + "px"); root.setProperty("--tlh", tl + "px");
  return { dock: Math.round(dock), panel: Math.round(panel), tl };
}
NP.app.layoutStage = layoutStage;
let lsRaf = 0; window.addEventListener("resize", () => { cancelAnimationFrame(lsRaf); lsRaf = requestAnimationFrame(layoutStage); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutStage).catch(() => {});

/* a link with a view opens the explorer; anything else opens the first page */
const deepLinked = location.hash.length > 1 && location.hash !== "#cover";
readHash();
if (NP.Cover) NP.Cover.init(!deepLinked);
render();
layoutStage();
if (map.size()[1] < 340) $("#legend").classList.add("min");
const ld = document.getElementById("loader"); if (ld) ld.remove();
})();
