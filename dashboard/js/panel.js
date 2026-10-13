/* Right-hand panel, in layers so that a first-time reader is not handed thirty numbers at once:
     layer 1  key numbers           → the KPI bar (app.js)
     layer 2  profile               → always visible here: a few facts, the make-up of the pizza, trend, partners, slices
     layer 3  go deeper             → collapsed sections (specialisation, partners in detail, concentration, regional pattern, comparison)
     layer 4  the economy (context) → collapsed: GDP, population, UNCTAD indices — not specific to plastics
   Which indicator sits in which layer is decided HERE and in NP.DEFS (core.js, third element). Opened sections stay open while the
   panel re-renders. All numbers come from NP.ind. Clicks are delegated by app.js through data-eco / data-node attributes.
   TWO SIDES: under the Importers lens (st.lens === "dst") the whole panel describes imports: every fact, list, trend and section
   below takes the import-side twin of its indicator (kind "D"). Nothing export-only is left in it except what is explicitly labelled
   "exports". Imports are the importer's own report; where it did not report, the exporters' reports stand in and carry a †. */
(function () {
"use strict";
const NP = window.NP, I = NP.ind;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DEF = {}; NP.DEFS.forEach(([k, v]) => { DEF[k] = v; });
const OPEN = new Set();                                   // ids of the sections the reader has opened
const fact = (v, l, defKey, cls) => `<div class="fact ${cls || ""}"><div class="v">${v}</div><div class="l">${defKey && DEF[defKey] ? `<abbr title="${esc(DEF[defKey])}">${l}</abbr>` : l}</div></div>`;
const facts = arr => { const a = arr.filter(Boolean); return a.length ? `<div class="facts">${a.join("")}</div>` : ""; };
const sec = (id, title, hint, body) => (body ? `<details class="sec" data-sec="${id}"${OPEN.has(id) ? " open" : ""}><summary><span class="st">${title}</span><span class="sh">${hint || ""}</span></summary><div class="sb">${body}</div></details>` : "");
const bars = (items, max, color, attr) => items.map((d, i) => `<div class="row rank" ${attr}="${d.key}" tabindex="0" role="button"><span class="rk">${d.rk != null ? d.rk : i + 1}</span>${attr === "data-node" && NP.node[d.key] && NP.node[d.key].proxy ? `<span class="nm px" title="${esc(d.name)} — ° ${esc(NP.PROXY_NOTE)}"><span>${esc(d.name)}</span><b>°</b></span>` : `<span class="nm" title="${esc(d.name)}">${esc(d.name)}</span>`}<span class="vl">${d.text}</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, 100 * d.v / max))}%;--c:${attr === "data-node" && NP.node[d.key] ? NP.symbolColor(d.key) : color}"></i></div></div>`).join("");   // the bar lies behind the words, in a tint of the family colour (style.css)
function spark(values, color, year, fmt) {
  fmt = fmt || NP.fmtUSD;
  const Wd = 320, Hd = 62, m = { l: 2, r: 6, t: 16, b: 14 }, Y = NP.YEARS, max = Math.max(...values.map(v => v || 0)) || 1;
  const x = i => m.l + (Wd - m.l - m.r) * i / (Y.length - 1), y = v => Hd - m.b - (Hd - m.b - m.t) * v / max;
  let d = "", open = false;
  values.forEach((v, i) => { if (v > 0) { d += (open ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1); open = true; } else open = false; });
  const i = NP.yi(year);
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Trend"><line x1="${m.l}" x2="${Wd - m.r}" y1="${Hd - m.b}" y2="${Hd - m.b}" stroke="#ded9d5"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>${values[i] > 0 ? `<circle cx="${x(i)}" cy="${y(values[i])}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/>` : ""}
    <text x="${m.l}" y="${Hd - 2}" font-size="10" fill="#6e6259">${Y[0]}</text><text x="${Wd - m.r}" y="${Hd - 2}" font-size="10" fill="#6e6259" text-anchor="end">${Y[Y.length - 1]}</text>
    <text x="${m.l}" y="9" font-size="10" fill="#6e6259">peak ${fmt(max)}${values[i] > 0 ? " · " + year + ": " + fmt(values[i]) : ""}</text></svg>`;
}
const DAG = year => `<sup class="mir" title="It did not report imports for ${year}: value as reported by the exporting economies">†</sup>`;
const overlapNote = node => (NP.ancestors(node).some(n => n.id === "NPS210") ? `<p class="note">Wood-based sub-groups of this group share some HS codes (mainly before 2017), so sub-groups can add up to more than the group. Each slice shows its own value.</p>` : "");
const downloads = kind => `<p class="note dl"><button class="btn-line" data-csv="${kind}">${kind === "eco" ? "Download this economy’s series (CSV)" : "Download all economies for this slice and year (CSV)"}</button> &nbsp; <button class="btn-line" data-png="1">Download this view (PNG)</button></p>`;
/* make-up of a pizza as two stacked bars: plastics by life-cycle stage, substitutes by raw materials / value-added products */
const SHORT = { P_01: "Primary forms", P_02: "Intermediate forms", P_03: "Intermediate goods", P_04: "Final goods", P_05: "Waste", NPS102: "Raw materials", NPS101: "Value-added products" };
function makeup(get) {
  const row = (ids, total, label, min) => (total > 0 ? `<div class="cmp-l"><span>${label}</span><span>${NP.fmtUSD(total)}</span></div><div class="cmp-bar">${ids.map(id => `<i style="width:${100 * get(id) / total}%;background:${NP.node[id].color}" title="${esc(NP.node[id].name)}: ${NP.fmtPct(get(id) / total, 0)}"></i>`).join("")}</div>
      <div class="mk-l">${ids.filter(id => get(id) / total >= min).map(id => `<span style="--c:${NP.node[id].color}">${SHORT[id]} ${NP.fmtPct(get(id) / total, get(id) / total < 0.01 ? 1 : 0)}</span>`).join("")}</div>` : "");
  return row(NP.node.P_00.children.map(c => c.id), get("P_00"), "Plastics, by stage of the life cycle", 0.07) + row(["NPS102", "NPS101"], get("NPS000"), "Substitutes, by degree of processing", 0);
}

NP.Panel = {
  open: OPEN,
  openAll() { document.querySelectorAll("#panel details.sec").forEach(d => { d.open = true; OPEN.add(d.dataset.sec); }); },

  /* ───────── world (or a slice of the pizza) ───────── */
  world(st) {
    const { node, year } = st, n = NP.node[node], kind = st.lens === "dst" ? "D" : "X", imp = kind === "D", w = NP.worldOf(node, year, kind);
    const rk = I.ranking(node, year, kind), max = rk.length ? rk[0].v : 1;
    const y5 = Math.max(NP.YEARS[0], year - 5), g5 = I.cagr(node, NP.W, y5, year, kind), gAll = I.cagr(node, NP.W, NP.YEARS[0], year, kind);
    const ns = I.nsMatrix(node, year), col = NP.symbolColor(node);
    let h = `<div class="panel"><h2>${esc(n.long || n.name)}${n.proxy ? "°" : ""}</h2><div class="sub">${n.uname && n.uname !== n.name ? "UNCTAD label: " + esc(n.uname) + " · " : ""}World, ${year}${imp ? " · importers" : ""}</div>`;
    if (n.proxy) h += `<p class="note"><span class="tag warn">° proxy</span> ${esc(NP.PROXY_NOTE)}</p>`;
    /* layer 2: profile */
    h += facts([
      node === "ALL" ? fact(NP.fmtPct(I.subsShare(NP.W, year, kind), 0), "of the pizza is substitutes", "Substitutes in the pizza") : fact(NP.fmtPct(w / NP.worldOf("ALL", year, kind), 1), "of the whole pizza"),
      fact(NP.fmtSigned(g5), `a year since ${y5}`, "Growth (CAGR)", g5 > 0 ? "pos" : g5 < 0 ? "neg" : ""),
      fact(NP.fmtPct(I.groupShare(node, NP.GROUP.ldc, year, kind), 1), imp ? "goes to least developed countries" : "from least developed countries"),
      fact(NP.fmtPct(I.ssShare(node, year), 0), "is South–South trade", "South–South share"),
    ]);
    if (node === "ALL" || node === "P_00" || node === "NPS000") h += `<div class="group-h">${imp ? "What the world imports" : "What the world’s pizza is made of"}</div>` + makeup(id => NP.worldOf(id, year, kind));
    h += `<div class="group-h">${imp ? "Largest importers" : "Largest exporters"} · ${rk.length} economies</div>`;
    h += bars(rk.slice(0, 10).map(d => ({ key: d.e, name: NP.eco[d.e].n, v: d.v, text: `${NP.fmtUSD(d.v)}${d.m ? DAG(year) : ""} · ${NP.fmtPct(d.v / w)}` })), max, col, "data-eco");
    h += imp ? `<p class="note">Each economy’s imports as it reports them: ${NP.nImpReporters(year, node)} economies reported ${year}${year > NP.LAST_FULL_YEAR ? " — provisional" : ""}. † ${rk.filter(d => d.m).length} others did not: what the reporting economies exported to them is shown instead and is not part of the world total. Click an economy for its profile.</p>`
      : `<p class="note">${NP.nReporters(year, node)} economies reported ${year}${year > NP.LAST_FULL_YEAR ? " — provisional: several large exporters have not reported yet" : ""}. Click an economy for its profile.</p>`;
    /* layer 3: go deeper */
    h += `<div class="layer-h">Go deeper</div>`;
    const rm = I.regionMatrix(node, year); let who = "";
    if (ns) who += `<div class="group-h">Developed (North) and developing (South) economies</div>
      <div class="ns"><i style="width:${ns.SS * 100}%;background:#fbaf17"></i><i style="width:${ns.SN * 100}%;background:#72bf44"></i><i style="width:${ns.NS * 100}%;background:#009edb"></i><i style="width:${ns.NN * 100}%;background:#a066aa"></i></div>
      <div class="ns-l"><span style="--c:#fbaf17">South→South ${NP.fmtPct(ns.SS, 0)}</span><span style="--c:#72bf44">South→North ${NP.fmtPct(ns.SN, 0)}</span><span style="--c:#009edb">North→South ${NP.fmtPct(ns.NS, 0)}</span><span style="--c:#a066aa">North→North ${NP.fmtPct(ns.NN, 0)}</span></div>`;
    if (rm) { const tot5 = rm.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0), mx5 = Math.max(...rm.map(r => Math.max(...r))), short = ["Africa", "Americas", "Asia", "Europe", "Oceania"];
      if (tot5 > 0) who += `<div class="group-h">From region (rows) to region (columns), % of trade in this slice</div><table class="rr"><tr><th></th>${short.map(s => `<th>${s.slice(0, 3)}</th>`).join("")}</tr>`
        + rm.map((r, i) => `<tr><th>${short[i]}</th>${r.map((v, j) => `<td class="${i === j ? "d" : ""}${v / mx5 > 0.3 ? " hi" : ""}" style="background:${NP.heat(col, v / mx5)}" title="${short[i]} → ${short[j]}: ${NP.fmtUSD(v)}">${v / tot5 >= 0.0005 ? (100 * v / tot5).toFixed(v / tot5 < 0.1 ? 1 : 0) : "·"}</td>`).join("")}</tr>`).join("")
        + `</table><p class="note">${NP.fmtPct(I.intraRegionalWorld(node, year), 0)} of this trade stays within the same region (outlined cells).</p>`; }
    h += sec("who", "Who trades with whom", `${NP.fmtPct(I.groupShare(node, NP.GROUP.developing, year, kind), 0)} ${imp ? "goes to" : "from"} developing economies${rm ? " · " + NP.fmtPct(I.intraRegionalWorld(node, year), 0) + " stays in its region" : ""}`, who);
    let conc = facts([
      fact(NP.fmtPct(I.cr(node, year, 3, kind)), imp ? "taken by the top 3 importers" : "held by the top 3 exporters", "Exporter concentration (HHI), top-3 share"),
      fact(NP.fmtNum(I.exporterHHI(node, year, kind), 3), imp ? "importer concentration (HHI)" : "exporter concentration (HHI)", "Exporter concentration (HHI), top-3 share"),
      fact(NP.fmtNum(I.nExporters(node, year, 1e6, kind)), imp ? "economies importing over US$1 m" : "economies exporting over US$1 m"),
      fact(NP.fmtSigned(gAll), `a year since ${NP.YEARS[0]}`, "Growth (CAGR)", gAll > 0 ? "pos" : gAll < 0 ? "neg" : ""),
    ]);
    let mvHint = "";
    if (year > NP.YEARS[0]) {              // who is gaining and losing market share (economies reporting in both years)
      const mv = I.movers(node, y5, year, kind), up = mv.slice(0, 4).filter(d => d.pp > 0), dn = mv.slice(-3).reverse().filter(d => d.pp < 0);
      if (up.length + dn.length) conc += `<div class="group-h">Largest changes in ${imp ? "share of world imports" : "world share"} since ${y5}</div>` + up.concat(dn).map(d =>
        `<div class="row rank" data-eco="${d.e}" tabindex="0" role="button"><span class="rk">${d.pp >= 0 ? "▲" : "▼"}</span><span class="nm">${esc(NP.eco[d.e].n)}</span><span class="vl" style="color:${d.pp >= 0 ? "#27833a" : "#ab1d37"};font-weight:600">${NP.fmtPP(d.pp)}</span></div>`).join("");
      if (up.length) mvHint = ` · ${esc(NP.shortName(up[0].e))} ${NP.fmtPP(up[0].pp)}`;
    }
    h += sec("conc", "Concentration and movers", `top 3 ${imp ? "take" : "hold"} ${NP.fmtPct(I.cr(node, year, 3, kind), 0)}${mvHint}`, conc);
    const hs = NP.hs(node), nh = NP.hsCount(node);
    h += sec("hs", "HS codes in this slice", `${nh} subheading${nh > 1 ? "s" : ""}${hs ? "" : " in " + n.leaves.length + " slices"}`,
      hs ? `<div class="hs">${hs.map(c => `<div title="${esc(c[1])}"><b>${c[0].slice(0, 4)}.${c[0].slice(4)}</b> ${esc(c[1])}</div>`).join("")}</div>` : `<p class="note">Select a single slice of the pizza to list its HS 2022 subheadings.</p>`);
    h += downloads("world") + overlapNote(node) + `</div>`;
    return h;
  },

  /* ───────── plastic waste by weight (world view, "Measure: Tonnes") ─────────
     Everything in this panel is in tonnes. Economies whose weight cannot be relied on (NP.wFlag) are kept out of the ranking and
     listed with the reason, so that a reader never mistakes a hole in the source for a small trader. */
  weight(st) {
    const { node, year } = st, n = NP.node[node], kind = st.lens === "dst" ? "D" : "X", imp = kind === "D", col = NP.symbolColor(node);
    const wT = NP.WtWorld(node, year, kind), rk = I.rankingW(node, year, kind), ok = rk.filter(d => !d.flag), bad = rk.filter(d => d.flag).sort((a, b) => NP.side(kind)(node, b.e, year) - NP.side(kind)(node, a.e, year));
    const top3 = ok.slice(0, 3).reduce((s, d) => s + d.w, 0), max = ok.length ? ok[0].w : 1;
    let h = `<div class="panel"><h2>${esc(n.name)}, by weight</h2><div class="sub">World, ${year} · ${imp ? "importers" : "exporters"} · tonnes as reported</div>`;
    h += `<p class="note"><span class="tag warn">Read with care</span> Tonnes are the unit in which waste is regulated, and value understates low-grade waste. But the weights in the source are patchy: for <b>${bad.length}</b> of ${rk.length} economies the weight of ${year} cannot be relied on. They are hatched on the map and listed below; the world total inherits their gaps.</p>`;
    h += facts([
      fact(NP.fmtT(wT), imp ? "world imports" : "world exports"),
      fact(NP.fmtPct(wT ? top3 / wT : null, 0), "of the tonnes: the three largest with a usable weight"),
      fact(NP.fmtPct(wT ? NP.Wt(node, NP.GROUP.developing, year, kind) / wT : null, 0), imp ? "of the tonnes go to developing economies" : "of the tonnes come from developing economies"),
      fact(NP.fmtUSD(NP.worldOf(node, year, kind)), "the same trade in value"),
    ]);
    h += `<div class="group-h">Largest ${imp ? "importers" : "exporters"} by weight · ${ok.length} economies with a usable weight</div>`;
    h += bars(ok.slice(0, 10).map(d => ({ key: d.e, name: NP.eco[d.e].n, v: d.w, text: `${NP.fmtT(d.w)}${d.m ? DAG(year) : ""} · ${NP.fmtPct(wT ? d.w / wT : null)}` })), max, col, "data-eco");
    if (bad.length) h += `<div class="group-h">Weight not usable · ${bad.length} economies, largest by value first</div>`
      + bad.slice(0, 14).map(d => `<div class="row rank wq" data-eco="${d.e}" tabindex="0" role="button"><span class="rk">⚠</span><span class="nm" title="${esc(NP.eco[d.e].n)}">${esc(NP.eco[d.e].n)}</span><span class="vl">${NP.fmtUSD(NP.side(kind)(node, d.e, year))} · ${d.w > 0 ? NP.fmtT(d.w) : "no weight"}</span><div class="why">${esc(NP.wWhy(d.flag))}</div></div>`).join("")
      + (bad.length > 14 ? `<p class="note">and ${bad.length - 14} smaller ones.</p>` : "");
    h += `<p class="note">A weight is set aside when it is missing for a value of US$0.1 million or more, when the economy’s partner rows add up to at least 20% (and 100 tonnes) more than its row to the world, or when its value per tonne is more than eight times above or below the median. No value per tonne is shown.</p>`;
    h += `<p class="note dl"><button class="btn-line" data-meas="v">Back to US$ (partners, trends, all indicators)</button></p></div>`;
    return h;
  },

  /* ───────── one economy or a group ───────── */
  economy(st, F) {
    const { node, year, eco: e } = st, n = NP.node[node], E = NP.eco[e], col = NP.symbolColor(node);
    const x = NP.X(node, e, year), rep = NP.isReporter(e, year, node), lastY = NP.lastReportYear(e, node);
    const y5 = Math.max(NP.YEARS[0], year - 5), dir = st.dir === "to" ? "to" : "from", imp = dir === "to", kind = imp ? "D" : "X";
    const grp = NP.isGroup(e), members = grp ? NP.membersOf(e) : null, title = grp ? NP.scopeName(e) : E.n;
    const tags = [];
    if (grp) tags.push(`<span class="tag grey">Group of ${members.length} economies</span>`, `<span class="tag grey">${members.filter(m => NP.isReporter(m, year, node)).length} reported ${year}</span>`);
    if (E.reg) tags.push(`<span class="tag grey">${NP.regionName(E.reg)}</span>`);
    if (E.dev) tags.push(`<span class="tag grey">${E.dev === "1400" ? "Developing economy" : "Developed economy"}</span>`);
    if (E.ldc) tags.push(`<span class="tag">LDC</span>`); if (E.sids) tags.push(`<span class="tag">SIDS</span>`); if (E.lldc) tags.push(`<span class="tag">LLDC</span>`);
    if (!rep) tags.push(`<span class="tag warn">No export data for ${year}${lastY ? " · last: " + lastY : ""}</span>`);
    if (!grp && NP.impBasis(e, year, node) !== "own") tags.push(`<span class="tag warn" title="It did not report imports for ${year}: import values are what the reporting economies exported to it">† imports: exporters’ reports</span>`);
    let h = `<div class="panel"><h2>${esc(title)}</h2><div class="tags">${tags.join("")}</div><div class="sub">${esc(n.long || n.name)}${n.proxy ? `° <span title="${esc(NP.PROXY_NOTE)}" style="cursor:help">(proxy)</span>` : ""} · ${year}${imp ? (NP.impBasis(e, year, node) === "own" ? " · imports" : " · imports, as reported by exporters †") : ""}</div>`;
    const rank = I.rank(node, e, year), nexp = I.nExporters(node, year), ms = I.merchShare(node, e, year), odd = ms != null && ms > 1;
    const rca = odd ? null : I.rcaBalassa(node, e, year), g5 = I.cagr(node, e, y5, year), gw = I.cagr(node, NP.W, y5, year), pp = I.shareChangePP(node, e, y5, year);
    const mval = NP.D(node, e, year), dx = NP.Dx(node, e, year), basis = NP.impBasis(e, year, node), dg = basis === "own" ? "" : DAG(year), family = node === "ALL" || node === "P_00" || node === "NPS000";
    const gap = basis === "own" && dx > 0 && mval > 0 ? mval / dx - 1 : null;                                    // its own import figure against the exporters'

    /* layer 2: profile */
    if (imp) {                                           // imports: known for every economy, reporter or not
      const gm = I.cagr(node, e, y5, year, "D"), gwm = I.cagr(node, NP.W, y5, year, "D");
      h += facts([
        fact(NP.fmtSigned(gm), `a year since ${y5}${grp ? ", like for like" : ""} <small>(world ${NP.fmtSigned(gwm)})</small>`, "Growth (CAGR)", gm > 0 ? "pos" : gm < 0 ? "neg" : ""),
        node === "ALL" ? fact(NP.fmtPct(I.valueAddedShare(e, year, "D"), 0), `of the substitutes it imports are value-added products <small>(world ${NP.fmtPct(I.valueAddedShare(NP.W, year, "D"), 0)})</small>`, "Value-added share of substitutes")
                       : fact(NP.fmtPct(I.pizzaShare(node, e, year, "D")), "of its imports of the pizza"),
        basis === "own" ? fact(NP.fmtUSD(dx), `is what exporters report shipping to it${gap != null ? ` <small>(its own figure is ${NP.fmtPct(Math.abs(gap), 0)} ${gap >= 0 ? "higher" : "lower"})</small>` : ""}`, "Imports, as reported by exporters")
                        : fact(NP.fmtUSD(mval) + dg, "imports, as reported by exporters: it did not report", "Imports"),
        fact(rep ? NP.fmtUSD(x) : "no data", rep ? "its exports of this slice" : `exports: not reported for ${year}`, "Exports"),
      ]);
    } else if (rep) {
      h += facts([
        fact(odd ? "–" : NP.fmtPct(ms, ms < 0.1 ? 1 : 0), grp ? "of the goods exports of the members that reported" : "of its total goods exports", "Share of merchandise exports"),
        fact(NP.fmtSigned(g5), `a year since ${y5}${grp ? ", like for like" : ""} <small>(world ${NP.fmtSigned(gw)})</small>`, "Growth (CAGR)", g5 > 0 ? "pos" : g5 < 0 ? "neg" : ""),
        node === "ALL" ? fact(NP.fmtPct(I.valueAddedShare(e, year), 0), `of its substitutes are value-added products <small>(world ${NP.fmtPct(I.valueAddedShare(NP.W, year), 0)})</small>`, "Value-added share of substitutes")
                       : fact(NP.fmtPct(I.pizzaShare(node, e, year)), "of its own pizza", "Share of own pizza"),
        fact(NP.fmtUSD(mval) + dg, basis === "own" ? "imports" : "imports, as reported by exporters", "Imports"),
      ]);
      if (odd) h += `<p class="note"><span class="tag warn">Check source</span> Reported exports of this slice exceed the economy’s total merchandise exports in ${year}; shares and RCA are not shown.</p>`;
    } else h += `<p class="note">This economy did not report exports for ${year}. ${basis === "own" ? "Its imports below are its own report." : "Its imports below are what other economies reported exporting to it (†)."}</p>` + facts([fact(NP.fmtUSD(mval) + dg, basis === "own" ? "imports" : "imports, as reported by exporters", "Imports")]);
    if (grp && year > NP.YEARS[0] && (imp || rep)) { const L = I.likeForLike(node, e, y5, year, kind);              // a group is compared with itself: only the members that reported in both years
      h += `<p class="note lfl">Growth is like for like: over the <b>${L.n} of ${L.of}</b> members that reported ${imp ? "imports" : "exports"} in both ${y5} and ${year}. The group’s total is the sum of the members that reported in each year.</p>`; }
    if (NP.hasWeight(node) && !grp) {                    // tonnes of this economy (plastic waste only), with the screen
      const part = k => { const w = NP.Wt(node, e, year, k), fl = NP.wFlag(node, e, year, k); if (!(w > 0) && !fl) return null;
        const r = fl ? -1 : I.rankingW(node, year, k).filter(d => !d.flag).findIndex(d => d.e === e);
        return `${k === "D" ? "imports" : "exports"} <b>${w > 0 ? NP.fmtT(w) : "no weight"}</b>${fl ? ` ⚠ <span title="${esc(NP.wWhy(fl))}" style="cursor:help;border-bottom:1px dotted">not reliable</span>` : r >= 0 ? ` (#${r + 1} by weight)` : ""}`; };
      const ps = [rep ? part("X") : null, part("D")].filter(Boolean);
      if (ps.length) h += `<p class="note wnote"><b>By weight</b> — ${ps.join(" · ")}.</p>`;
    }
    if (family && (rep || dir === "to")) { const side = dir === "to" ? NP.D : NP.X;
      h += `<div class="group-h">${dir === "to" ? "What it imports" : "What its pizza is made of"}</div>` + makeup(id => side(id, e, year)); }
    /* imports over time: its own reports (gaps where it did not report); the exporters' reports throughout if it did not report this year */
    const impSeries = basis === "mirror" ? NP.seriesDx(node, e) : NP.YEARS.map(y => (NP.impBasis(e, y, node) !== "mirror" ? NP.D(node, e, y) : 0));
    const sx = imp ? impSeries : NP.seriesX(node, e), sw = imp ? NP.seriesM(node, NP.W) : NP.seriesX(node, NP.W), shareSeries = sx.map((v, i) => (sw[i] > 0 && (imp || NP.isReporter(e, NP.YEARS[i], node)) ? v / sw[i] : 0));
    h += `<div class="group-h">${imp ? (basis === "mirror" ? "Imports of this slice, as reported by exporters (†)" : "Imports of this slice") : "Exports of this slice"}, ${NP.YEARS[0]}–${NP.YEARS[NP.YEARS.length - 1]}</div><div class="spark">${spark(sx, col, year)}</div>`;
    /* partners (or members of a group): the five largest here, the rest under "go deeper" */
    let partnerDetail = "", partnerHint = "";
    if (grp) {
      const get = dir === "to" ? NP.D : NP.X, base = get(node, e, year);
      const mr = members.map(m => ({ key: m, name: NP.eco[m].n, v: get(node, m, year) })).filter(d => d.v > 0).sort((a, b) => b.v - a.v);
      h += `<div class="group-h">${dir === "to" ? "Largest importers in the group" : "Largest exporters in the group"} · ${mr.length} economies</div>`;
      h += bars(mr.slice(0, 8).map(d => Object.assign(d, { text: `${NP.fmtUSD(d.v)} · ${NP.fmtPct(base ? d.v / base : null)}` })), mr.length ? mr[0].v : 1, col, "data-eco");
      if (mr.length > 2) h += `<p class="note">The three largest account for ${NP.fmtPct(base ? (mr[0].v + mr[1].v + mr[2].v) / base : null, 0)} of the group’s ${dir === "to" ? "imports" : "exports"} of this slice.</p>`;
      if (NP.REGIONS.some(r => r[0] === E.c)) { const ir = I.intraRegion(node, E.c, year); if (ir != null) h += `<p class="note"><b>${NP.fmtPct(ir, 0)}</b> of the region’s exports of this slice stay within ${esc(title)}.</p>`; }
    } else {
      h += `<div class="group-h">${dir === "to" ? (F && !NP.suppliersOwn(F, e, year) ? "Largest suppliers, as reported by the exporters (†)" : "Largest suppliers (origins in its own import records)") : "Largest destinations"}</div>`;
      if (!F) h += `<p class="note">Loading partners…</p>`;
      else {
        const ps = NP.partnersOf(F, e, year, dir), base = dir === "to" ? mval : x, st1 = dir === "to" ? I.supplierStats(F, e, year) : I.partnerStats(F, e, year);
        if (!ps.length) h += `<p class="note">No partner data for ${year}.</p>`;
        else {
          const item = d => { const o = dir === "to" ? d.e : d.p; return { key: o, name: NP.eco[o].n, v: d.v, text: `${NP.fmtUSD(d.v)} · ${NP.fmtPct(d.v / base)}` }; };
          h += bars(ps.slice(0, 5).map(item), ps[0].v, col, "data-eco");
          partnerDetail = (st1 ? facts([
              fact(NP.fmtNum(st1.n), dir === "to" ? "supplier economies" : "destination economies", "Number of partners"),
              fact(NP.fmtNum(st1.hhi, 3), "concentration (HHI)", "Market concentration (HHI)"),
              dir === "from" && st1.developing != null ? fact(NP.fmtPct(st1.developing), "goes to developing economies", "Share to developing economies") : "",
              dir === "from" && st1.intraRegional != null ? fact(NP.fmtPct(st1.intraRegional), `stays in ${NP.regionName(E.reg)}`, "Intra-regional share") : "" ]) : "")
            + `<div class="group-h">Top ${Math.min(ps.length, NP.K.exp)} ${dir === "to" ? "suppliers" : "destinations"}, with the trade intensity index</div>`
            + bars(ps.map(d => { const o = item(d), tii = I.tradeIntensity(node, d.e, d.p, year, d.v); o.text += tii != null ? ` · <abbr title="${esc(DEF["Trade intensity index"])}">TII ${NP.fmtNum(tii, tii < 10 ? 1 : 0)}</abbr>` : ""; return o; }), ps[0].v, col, "data-eco");
          partnerHint = st1 ? `${NP.fmtNum(st1.n)} ${dir === "to" ? "suppliers" : "destinations"} · the largest takes ${NP.fmtPct(ps[0].v / base, 0)}` : "";
        }
      }
    }
    /* the largest slices of its pizza (or of its imports) */
    if (rep || dir === "to") {
      const side = dir === "to" ? NP.D : NP.X, tot = side("ALL", e, year);
      const leaves = NP.TREE.leaves.map(id => ({ key: id, name: NP.node[id].name, v: side(id, e, year), color: NP.node[id].color })).filter(d => d.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
      if (leaves.length) h += `<div class="group-h">${dir === "to" ? "Largest slices of its imports" : "Largest slices of its pizza"} · ${NP.fmtUSD(tot)}</div>`
        + bars(leaves.map(d => Object.assign(d, { text: `${NP.fmtUSD(d.v)} · ${NP.fmtPct(d.v / tot)}` })), leaves[0].v, col, "data-node");
    }

    /* layer 3: go deeper */
    h += `<div class="layer-h">Go deeper</div>`;
    if (imp) {                                           // its place among importers
      const shM = I.worldShare(node, e, year, "D"), rkM = I.rank(node, e, year, "D"), nimp = I.nExporters(node, year, 0, "D"), ppM = I.shareChangePP(node, e, y5, year, "D"), net = I.netExports(node, e, year);
      let comp = facts([
        fact(NP.fmtShare(shM) + (rkM ? ` <small style="font-weight:500;color:#6e6259">#${rkM} of ${nimp}</small>` : ""), "of world imports", "Share of world imports"),
        fact(NP.fmtPP(ppM), `share of world imports since ${y5}`, "Change in world share", ppM > 0 ? "pos" : ppM < 0 ? "neg" : ""),
        rep ? fact(NP.fmtShare(I.worldShare(node, e, year)) + (rank ? ` <small style="font-weight:500;color:#6e6259">#${rank} of ${nexp}</small>` : ""), "of world exports", "World market share") : "",
        rep ? fact(NP.fmtUSD(Math.abs(net)), net >= 0 ? "net exports" : "net imports", "Net exports") : "",
      ]);
      if (!grp) {
        const peers = [], add = (list, label) => { const r = I.rankIn(node, e, year, list, "D"); if (r && r.of > 1) peers.push(`#${r.rank} of ${r.of} ${label}`); };
        if (E.reg) add(NP.countries.filter(c => NP.eco[c].reg === E.reg), `in ${NP.regionName(E.reg)}`);
        if (E.ldc) add(NP.countries.filter(c => NP.eco[c].ldc), "among LDCs");
        if (E.sids) add(NP.countries.filter(c => NP.eco[c].sids), "among SIDS");
        if (E.lldc) add(NP.countries.filter(c => NP.eco[c].lldc), "among LLDCs");
        if (!E.ldc && !E.sids && !E.lldc && E.dev) add(NP.countries.filter(c => NP.eco[c].dev === E.dev), E.dev === "1400" ? "among developing economies" : "among developed economies");
        if (peers.length) comp += `<p class="note">Importer rank among peers: ${peers.join(" · ")}.</p>`;
      }
      comp += `<div class="group-h">Share of world imports of this slice</div><div class="spark">${spark(shareSeries, "#6e6259", year, v => NP.fmtPct(v, v < 0.1 ? 1 : 0))}</div>`;
      const big = NP.TREE.leaves.map(id => ({ key: id, name: NP.node[id].name, x: NP.D(id, e, year), v: I.worldShare(id, e, year, "D"), color: NP.node[id].color })).filter(d => d.x >= 1e6 && d.v > 0).sort((a, b) => b.v - a.v).slice(0, 6);
      if (big.length) comp += `<div class="group-h">Where it takes the largest share of world imports (imports over US$1 m)</div>`
        + bars(big.map(d => Object.assign(d, { text: `${NP.fmtShare(d.v)} of world · ${NP.fmtUSD(d.x)}` })), big[0].v, col, "data-node");
      h += sec("comp", "Position among importers", `${NP.fmtShare(shM)} of world imports${rkM ? " · #" + rkM : ""} · ${NP.fmtPP(ppM)} since ${y5}`, comp);
    } else if (rep) {
      let comp = facts([
        fact(rca == null ? "–" : NP.fmtNum(rca, rca < 10 ? 2 : 0), "RCA" + (rca != null ? (rca >= 1 ? " · specialised" : " · not specialised") : ""), "RCA (revealed comparative advantage)", rca >= 1 ? "pos" : ""),
        fact(NP.fmtPP(pp), `world share since ${y5}`, "Change in world share", pp > 0 ? "pos" : pp < 0 ? "neg" : ""),
        fact(NP.fmtShare(I.worldShare(node, e, year)) + (rank ? ` <small style="font-weight:500;color:#6e6259">#${rank} of ${nexp}</small>` : ""), "of world exports", "World market share"),
        fact(NP.fmtShare(I.importShare(node, e, year)), "of world imports", "Share of world imports"),
      ]);
      if (!grp) {                                        // position among peers, same slice and year
        const peers = [], add = (list, label) => { const r = I.rankIn(node, e, year, list); if (r && r.of > 1) peers.push(`#${r.rank} of ${r.of} ${label}`); };
        if (E.reg) add(NP.countries.filter(c => NP.eco[c].reg === E.reg), `in ${NP.regionName(E.reg)}`);
        if (E.ldc) add(NP.countries.filter(c => NP.eco[c].ldc), "among LDCs");
        if (E.sids) add(NP.countries.filter(c => NP.eco[c].sids), "among SIDS");
        if (E.lldc) add(NP.countries.filter(c => NP.eco[c].lldc), "among LLDCs");
        if (!E.ldc && !E.sids && !E.lldc && E.dev) add(NP.countries.filter(c => NP.eco[c].dev === E.dev), E.dev === "1400" ? "among developing economies" : "among developed economies");
        if (peers.length) comp += `<p class="note">Exporter rank among peers: ${peers.join(" · ")}.</p>`;
      }
      comp += `<div class="group-h">Share of world exports of this slice</div><div class="spark">${spark(shareSeries, "#6e6259", year, v => NP.fmtPct(v, v < 0.1 ? 1 : 0))}</div>`;
      const sp = NP.TREE.leaves.map(id => { const v = NP.X(id, e, year), m = I.merchShare(id, e, year); return { key: id, name: NP.node[id].name, x: v, v: m != null && m <= 1 && v >= 1e6 ? I.rcaBalassa(id, e, year) : null, color: NP.node[id].color }; })
        .filter(d => d.v != null && d.v > 1).sort((a, b) => b.v - a.v).slice(0, 6);
      if (sp.length) comp += `<div class="group-h">Where it is most specialised (RCA, exports over US$1 m)</div>`
        + bars(sp.map(d => Object.assign(d, { text: `RCA ${NP.fmtNum(d.v, d.v < 10 ? 1 : 0)} · ${NP.fmtUSD(d.x)}`, v: Math.log10(d.v + 1) })), Math.log10(sp[0].v + 1), col, "data-node");
      h += sec("comp", "Specialisation and market share", `RCA ${rca == null ? "–" : NP.fmtNum(rca, rca < 10 ? 2 : 0)} · world share ${NP.fmtPP(pp)} since ${y5}`, comp);
    }
    if (!grp) h += sec("part", "Partners in detail", partnerHint, partnerDetail);
    if (imp) {
      const sup = !grp && F ? I.supplierStats(F, e, year) : null;
      h += sec("div", "Concentration of its imports", `import mix HHI ${NP.fmtNum(I.productHHI(e, year, "D"), 2)} · ${NP.fmtNum(I.nSlices(e, year, 1e6, "D"))} slices over US$1 m`, facts([
        fact(NP.fmtNum(I.productHHI(e, year, "D"), 3), "concentration of its imports across the pizza (HHI)", "Product concentration (HHI)"),
        fact(NP.fmtNum(I.nSlices(e, year, 1e6, "D")), `of ${NP.TREE.leaves.length} slices imported over US$1 m`),
        sup ? fact(NP.fmtNum(sup.hhi, 3), "concentration of its suppliers of this slice (HHI)", "Market concentration (HHI)") : "" ])
        + `<p class="note">Both describe plastics and substitutes only, on the import side.</p>`);
    } else if (rep) {
      const cI = NP.lastWith(NP.conc, e, year), dI = NP.lastWith(NP.divers, e, year);
      h += sec("div", "Concentration and diversification", `pizza HHI ${NP.fmtNum(I.productHHI(e, year), 2)} · ${NP.fmtNum(I.nSlices(e, year, 1e6))} slices over US$1 m`, facts([
        fact(NP.fmtNum(I.productHHI(e, year), 3), "concentration of its pizza (HHI)", "Product concentration (HHI)"),
        fact(NP.fmtNum(I.nSlices(e, year, 1e6)), `of ${NP.TREE.leaves.length} slices exported over US$1 m`),
        cI ? fact(NP.fmtNum(cI.v, 2), `export concentration, all goods${cI.y !== year ? ", " + cI.y : ""}`, "Export concentration index") : "",
        dI ? fact(NP.fmtNum(dI.v, 2), `export diversification index${dI.y !== year ? ", " + dI.y : ""}`, "Export diversification index") : "" ])
        + `<p class="note">The first two describe plastics and substitutes only; the two UNCTAD indices describe all of the economy’s merchandise exports.</p>`);
    }
    if (!grp) {                                          // compare with a second economy: same indicators side by side, and the make-up of the two pizzas
      const c2 = st.cmp; if (c2 != null) OPEN.add("cmp");
      let cb = `<div class="cmp-pick"><input id="cmp-input" list="cmp-list" placeholder="Type the name of another economy…" aria-label="Compare with another economy" value="${c2 != null ? esc(NP.eco[c2].n) : ""}">${c2 != null ? `<button class="btn-line" data-cmp-clear="1">Remove</button>` : ""}</div>`;
      if (c2 != null && c2 !== e) {
        const cell = (fn, o) => (imp || NP.isReporter(o, year, node) ? fn(o) : "no data"), name = o => esc(NP.shortName(o));
        const xOr = fn => o => (NP.isReporter(o, year, node) ? fn(o) : "no data");
        const rows = imp ? [
          ["Imports", o => NP.fmtUSD(NP.D(node, o, year)) + (NP.impBasis(o, year, node) === "own" ? "" : DAG(year))], ["Share of world imports", o => NP.fmtShare(I.worldShare(node, o, year, "D"))], ["Rank among importers", o => { const r = I.rank(node, o, year, "D"); return r ? "#" + r : "–"; }],
          [`Growth a year since ${y5}`, o => NP.fmtSigned(I.cagr(node, o, y5, year, "D"))], ["Substitutes in its imports", o => NP.fmtPct(I.subsShare(o, year, "D"), 0)],
          ["Value-added share of substitutes", o => NP.fmtPct(I.valueAddedShare(o, year, "D"), 0)], ["Concentration of its imports (HHI)", o => NP.fmtNum(I.productHHI(o, year, "D"), 3)] ] : [
          ["Exports", o => NP.fmtUSD(NP.X(node, o, year))], ["Share of world exports", o => NP.fmtShare(I.worldShare(node, o, year))], ["Rank", o => { const r = I.rank(node, o, year); return r ? "#" + r : "–"; }],
          ["% of goods exports", o => { const m = I.merchShare(node, o, year); return m == null || m > 1 ? "–" : NP.fmtPct(m, m < 0.1 ? 1 : 0); }],
          [`Growth a year since ${y5}`, o => NP.fmtSigned(I.cagr(node, o, y5, year))], ["Substitutes in its pizza", o => NP.fmtPct(I.subsShare(o, year), 0)],
          ["Value-added share of substitutes", o => NP.fmtPct(I.valueAddedShare(o, year), 0)], ["Net exports", o => NP.fmtUSD(I.netExports(node, o, year))],
          ["RCA", o => { const v = NP.rcaSafe(node, o, year); return v == null ? "–" : NP.fmtNum(v, v < 10 ? 2 : 0); }], ["Concentration of its pizza (HHI)", o => NP.fmtNum(I.productHHI(o, year), 3)] ];
        const gdpRow = ["GDP per capita", o => { const v = NP.gdppc(o, year); return v == null ? "–" : "US$" + NP.fmtNum(v); }];
        const always = imp ? [["Exports", xOr(o => NP.fmtUSD(NP.X(node, o, year)))], ["Net exports", xOr(o => NP.fmtUSD(I.netExports(node, o, year)))], gdpRow] : [["Imports", o => NP.fmtUSD(NP.D(node, o, year)) + (NP.impBasis(o, year, node) === "own" ? "" : DAG(year))], gdpRow];
        cb += `<table class="cmp"><tr><th>${esc(n.name.length > 22 ? n.name.slice(0, 21) + "…" : n.name)}, ${year}</th><th title="${esc(NP.eco[e].n)}">${name(e)}</th><th title="${esc(NP.eco[c2].n)}">${name(c2)}</th></tr>`
          + rows.map(([l, fn]) => `<tr><td>${l}</td><td>${cell(fn, e)}</td><td>${cell(fn, c2)}</td></tr>`).join("") + always.map(([l, fn]) => `<tr><td>${l}</td><td>${fn(e)}</td><td>${fn(c2)}</td></tr>`).join("") + `</table>`;
        const f = NP.side(kind), has = o => imp || NP.isReporter(o, year, "ALL");
        const bar = o => { const t = f("ALL", o, year); if (!(t > 0) || !has(o)) return `<div class="cmp-bar"></div>`;
          return `<div class="cmp-bar">${NP.GROUPS15.map(id => `<i style="width:${100 * f(id, o, year) / t}%;background:${NP.node[id].color}" title="${esc(NP.node[id].name)}: ${NP.fmtPct(f(id, o, year) / t, 0)}"></i>`).join("")}</div>`; };
        cb += `<div class="cmp-l"><span>${name(e)} · make-up of its ${imp ? "imports" : "pizza"}</span><span>${NP.fmtUSD(f("ALL", e, year))}</span></div>${bar(e)}<div class="cmp-l"><span>${name(c2)}</span><span>${has(c2) ? NP.fmtUSD(f("ALL", c2, year)) : "no data"}</span></div>${bar(c2)}`;
      }
      h += sec("cmp", "Compare with another economy", c2 != null ? `with ${esc(NP.shortName(c2))}` : "side by side", cb);
    }
    /* layer 4: the economy as a whole (context, not specific to plastics) */
    const gp = NP.gdppc(e, year), pop = NP.pop(e, year), mx = NP.merchX(e, year), pci = NP.lastWith(NP.pci, e, year), pc = imp || rep ? I.perCapita(node, e, year, kind) : null, word = imp ? "imports" : "exports";
    h += `<div class="layer-h">Context</div>` + sec("ctx", "The economy as a whole (UNCTADstat)", `${gp != null ? "GDP per capita US$" + NP.fmtNum(gp) : ""}${pop != null ? " · " + (pop >= 1e6 ? NP.fmtNum(pop / 1e6, 1) + " m people" : NP.fmtNum(pop) + " people") : ""}`, facts([
      gp != null ? fact("US$" + NP.fmtNum(gp), `GDP per capita, ${year}`) : "",
      pop != null ? fact(pop >= 1e6 ? NP.fmtNum(pop / 1e6, 1) + " m" : NP.fmtNum(pop), `population, ${year}`) : "",
      mx != null ? fact(NP.fmtUSD(mx), `all merchandise exports${NP.openness(e, year) != null ? " · " + NP.fmtPct(NP.openness(e, year), 0) + " of GDP" : ""}`, "Merchandise exports, % of GDP") : "",
      pci ? fact(NP.fmtNum(pci.v, 1), `productive capacities index${pci.y !== year ? ", " + pci.y : ""}`, "Productive capacities index (PCI)") : "",
      imp || rep ? fact(NP.fmtPct(I.gdpShare(node, e, year, kind), 2), `${word} of this slice, % of GDP`, "Exports, % of GDP / per person") : "",
      pc != null ? fact("US$" + NP.fmtNum(pc, pc < 10 ? 2 : 0), `${word} of this slice per person`, "Exports, % of GDP / per person") : "" ]));
    h += downloads("eco") + overlapNote(node) + `</div>`;
    return h;
  },
};
})();
