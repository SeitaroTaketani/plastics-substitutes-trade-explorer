/* "Table" view: every economy with the indicators of the selected slice and year. Click a header to sort, a row to open the economy.
   Columns follow the same layers as the panel: the core columns are shown first, the rest appear with "All indicators".
   Two sides: under the Importers lens the table is the import-side one (imports first, sorted by imports, import-side indicators);
   otherwise it describes exports. Imports are each economy's own report; † = it did not report, value from the exporters' reports.
   Same numbers as everywhere else (NP.ind); the CSV button in the panel exports both sides. */
(function () {
"use strict";
const NP = window.NP, I = NP.ind;
const host = document.getElementById("tableview");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const y5 = y => Math.max(NP.YEARS[0], y - 5);
const net = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
/* key, header, definition key, value fn, formatter, core column?  — export side */
const COLS = NP.TABLE_COLS = [
  ["x",    "Exports",              "Exports",                               (n, e, y) => NP.X(n, e, y),                                   v => NP.fmtUSD(v), true],
  ["sh",   "World share",          "World market share",                    (n, e, y) => I.worldShare(n, e, y),                           v => NP.fmtShare(v), true],
  ["gr",   "Growth, 5 yrs",        "Growth (CAGR)",                         (n, e, y) => I.cagr(n, e, y5(y), y),                          v => NP.fmtSigned(v), true],
  ["subs", "Substitutes in pizza", "Substitutes in the pizza",              (n, e, y) => I.subsShare(e, y),                               v => NP.fmtPct(v, 0), true],
  ["va",   "Value-added share",    "Value-added share of substitutes",      (n, e, y) => I.valueAddedShare(e, y),                         v => NP.fmtPct(v, 0), true],
  ["net",  "Net position",         "Net position",                          (n, e, y) => I.netRatio(n, e, y),                             net, true],
  ["ms",   "% of goods exports",   "Share of merchandise exports",          (n, e, y) => { const m = I.merchShare(n, e, y); return m != null && m <= 1 ? m : null; }, v => NP.fmtPct(v, v < 0.1 ? 1 : 0), true],
  ["m",    "Imports",              "Imports",                               (n, e, y) => NP.D(n, e, y),                                   v => NP.fmtUSD(v), false],
  ["pp",   "Share change",         "Change in world share",                 (n, e, y) => I.shareChangePP(n, e, y5(y), y),                 v => NP.fmtPP(v), false],
  ["rca",  "RCA",                  "RCA (revealed comparative advantage)",  (n, e, y) => NP.rcaSafe(n, e, y),                             v => NP.fmtNum(v, v < 10 ? 2 : 0), false],
  ["hhi",  "Pizza HHI",            "Product concentration (HHI)",           (n, e, y) => I.productHHI(e, y),                              v => NP.fmtNum(v, 2), false],
  ["conc", "Export concentration", "Export concentration index",            (n, e, y) => NP.conc(e, y),                                   v => NP.fmtNum(v, 2), false],
  ["gdp",  "GDP per capita",       null,                                    (n, e, y) => NP.gdppc(e, y),                                  v => "US$" + NP.fmtNum(v), false],
  ["pci",  "PCI",                  "Productive capacities index (PCI)",     (n, e, y) => NP.pci(e, y),                                    v => NP.fmtNum(v, 1), false],
];
/* import side: the importer's own report, or the exporters' reports (†) where it did not report: known for every economy */
const COLS_M = NP.TABLE_COLS_M = [
  ["m",    "Imports",                "Imports",                             (n, e, y) => NP.D(n, e, y),                                   v => NP.fmtUSD(v), true],
  ["msh",  "Share of world imports", "Share of world imports",              (n, e, y) => I.worldShare(n, e, y, "D"),                      v => NP.fmtShare(v), true],
  ["mgr",  "Growth, 5 yrs",          "Growth (CAGR)",                       (n, e, y) => I.cagr(n, e, y5(y), y, "D"),                     v => NP.fmtSigned(v), true],
  ["msub", "Substitutes in imports", null,                                  (n, e, y) => I.subsShare(e, y, "D"),                          v => NP.fmtPct(v, 0), true],
  ["mva",  "Value-added share",      "Value-added share of substitutes",    (n, e, y) => I.valueAddedShare(e, y, "D"),                    v => NP.fmtPct(v, 0), true],
  ["net",  "Net position",           "Net position",                        (n, e, y) => I.netRatio(n, e, y),                             net, true],
  ["x",    "Exports",                "Exports",                             (n, e, y) => NP.X(n, e, y),                                   v => NP.fmtUSD(v), true],
  ["dx",   "Exporters report",       "Imports, as reported by exporters",   (n, e, y) => NP.Dx(n, e, y),                                  v => NP.fmtUSD(v), false],
  ["mpp",  "Share change",           "Change in world share",               (n, e, y) => I.shareChangePP(n, e, y5(y), y, "D"),            v => NP.fmtPP(v), false],
  ["mhhi", "Import mix HHI",         "Product concentration (HHI)",         (n, e, y) => I.productHHI(e, y, "D"),                         v => NP.fmtNum(v, 2), false],
  ["gdp",  "GDP per capita",         null,                                  (n, e, y) => NP.gdppc(e, y),                                  v => "US$" + NP.fmtNum(v), false],
  ["pci",  "PCI",                    "Productive capacities index (PCI)",   (n, e, y) => NP.pci(e, y),                                    v => NP.fmtNum(v, 1), false],
];
/* plastic waste by weight ("Measure: Tonnes"): tonnes first; the screen says whether a weight can be relied on */
const colsW = kind => [
  ["wt",   "Tonnes",                "Weight (plastic waste only)",         (n, e, y) => { const w = NP.Wt(n, e, y, kind); return w > 0 ? w : null; },         v => NP.fmtT(v), true],
  ["wsh",  "Share of world tonnes", null,                                  (n, e, y) => { const t = NP.WtWorld(n, y, kind), w = NP.Wt(n, e, y, kind); return t > 0 && w > 0 && !NP.wFlag(n, e, y, kind) ? w / t : null; }, v => NP.fmtShare(v), true],
  ["wv",   kind === "D" ? "Imports, value" : "Exports, value", null,       (n, e, y) => NP.side(kind)(n, e, y),                                             v => NP.fmtUSD(v), true],
  ["wq",   "Weight check",          "Weight (plastic waste only)",         (n, e, y) => { const f = NP.wFlag(n, e, y, kind); return f ? 1 : 0; },             v => (v ? "⚠ not reliable" : "ok"), true],
];
const ALWAYS = new Set(["wt", "wsh", "wv", "wq", "m", "gdp", "pci", "conc", "msh", "mgr", "msub", "mva", "mpp", "mhhi", "dx"]);       // defined for economies that did not report exports that year
const sort = { X: ["x", -1], D: ["m", -1], W: ["wt", -1] };   // each side, and the weight table, keeps its own sorting
/* the lens is the question in every view: switching it sorts the table by the column that answers it (the reader can re-sort afterwards) */
const LENS_SORT = NP.TABLE_LENS_SORT = { exp: ["X", "x"], dst: ["D", "m"], mix: ["X", "subs"], net: ["X", "net"], rca: ["X", "rca"] };
let lastRows = [], showAll = false, kind = "X", lastLens = null;
function render(st) {
  kind = st.lens === "dst" ? "D" : "X";
  if (st.lens !== lastLens) { const ls = LENS_SORT[st.lens]; if (ls) sort[ls[0]] = [ls[1], -1]; lastLens = st.lens; }
  const byWeight = st.meas === "w" && NP.hasWeight(st.node) && st.eco == null, sk = byWeight ? "W" : kind;
  const cols0 = byWeight ? colsW(kind) : kind === "D" ? COLS_M : COLS, [sortKey, sortDir] = sort[sk];
  const { node, year } = st, grp = NP.isGroup(st.eco) ? new Set(NP.membersOf(st.eco)) : null;
  const ecos = NP.countries.filter(e => (byWeight ? NP.side(kind)(node, e, year) > 0 : NP.isReporter(e, year, node) || NP.D(node, e, year) > 0) && (!grp || grp.has(e)));
  const rows = ecos.map(e => { const rep = NP.isReporter(e, year, node), r = { e, name: NP.eco[e].n, rep, mir: NP.impBasis(e, year, node) !== "own" };
    cols0.forEach(([k, , , fn]) => { r[k] = (rep || ALWAYS.has(k)) ? fn(node, e, year) : null; }); return r; });
  rows.sort((a, b) => { if (sortKey === "name") return sortDir * a.name.localeCompare(b.name); const va = a[sortKey], vb = b[sortKey]; if (va == null && vb == null) return a.name.localeCompare(b.name); if (va == null) return 1; if (vb == null) return -1; return sortDir * (va - vb) || a.name.localeCompare(b.name); });
  lastRows = rows;
  const cols = cols0.filter(c => showAll || c[5] || c[0] === sortKey), more = cols0.length - cols0.filter(c => c[5]).length;
  const def = k => { const d = k && NP.DEFS.find(x => x[0] === k); return d ? ` title="${esc(d[1])}"` : ""; };
  const arrow = k => (k === sortKey ? (sortDir < 0 ? " ▼" : " ▲") : "");
  host.innerHTML = `<div class="tv-note"><span>${rows.length} economies${grp ? " in " + esc(NP.scope(st.eco).short) : ""} · ${esc(NP.node[node].name)}, ${year}${byWeight ? " · <b>tonnes</b> as reported; ⚠ = the weight cannot be relied on (see Methodology)" : ""}${kind === "D" ? " · <b>imports</b>, as each economy reports them († did not report: exporters’ reports)" : ""} · growth and share change over ${y5(year)}–${year} · click a header to sort, a row for the profile${year > NP.LAST_FULL_YEAR ? " · " + year + " is provisional" : ""}</span>
      <button class="btn-line" id="tv-all" aria-pressed="${showAll}">${showAll ? "Core indicators only" : `All indicators (${more} more)`}</button></div>
    <div class="tv-scroll"><table class="tv"><thead><tr><th class="l" data-sort="name">Economy${arrow("name")}</th>${cols.map(c => `<th data-sort="${c[0]}"${def(c[2])}>${c[1]}${arrow(c[0])}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr data-eco="${r.e}" class="${r.e === st.eco ? "on" : ""}${r.rep ? "" : " norep"}" tabindex="0"><td class="l"><span class="rk">${i + 1}</span>${esc(r.name)}${r.rep ? "" : ' <small title="No export data reported for this year">no report</small>'}</td>${cols.map(c => `<td>${r[c[0]] == null || !isFinite(r[c[0]]) ? "–" : c[4](r[c[0]]) + (c[0] === "m" && r.mir ? '<sup class="mir" title="It did not report imports: as reported by the exporting economies">†</sup>' : "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
host.addEventListener("click", ev => {
  if (ev.target.closest("#tv-all")) { showAll = !showAll; render(NP.app.state); return; }
  const th = ev.target.closest("th[data-sort]"); if (th) { const k = th.dataset.sort, st0 = NP.app.state, s = sort[st0.meas === "w" && NP.hasWeight(st0.node) && st0.eco == null ? "W" : kind]; if (k === s[0]) s[1] = -s[1]; else { s[0] = k; s[1] = k === "name" ? 1 : -1; } render(NP.app.state); return; }
  const tr = ev.target.closest("tr[data-eco]"); if (tr) NP.app.set({ eco: +tr.dataset.eco === NP.app.state.eco ? null : +tr.dataset.eco });
});
host.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.matches("tr[data-eco]")) ev.target.click(); });
NP.Table = { render, rows: () => lastRows, side: () => kind, sort: (k, dir) => { sort[kind] = [k, dir]; render(NP.app.state); }, all: v => { showAll = !!v; render(NP.app.state); } };
})();
