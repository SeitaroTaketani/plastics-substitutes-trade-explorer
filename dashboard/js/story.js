/* Story mode: a short guided tour. Each chapter is nothing more than an explorer state plus a caption.
   Every number in the captions is computed from the data at run time (NP.ind) — nothing is typed by hand. */
(function () {
"use strict";
const NP = window.NP, I = NP.ind, E = c => NP.ecoIdx[c];
const p0 = v => NP.fmtPct(v, 0), usd = NP.fmtUSD, b = s => `<b>${s}</b>`;
const share = (node, code, y) => I.worldShare(node, E(code), y);
const top = (node, y, k) => I.ranking(node, y).slice(0, k).map(d => `${NP.shortName(d.e)} ${p0(d.v / NP.Xw(node, y))}`).join(", ");
/* where exported waste went: by definition the exporters' reports (NP.Dx), measured against world exports */
const toChina = y => (NP.Dx("P_05", E("156"), y) + NP.Dx("P_05", E("344"), y)) / NP.Xw("P_05", y);        // China + Hong Kong SAR
const wasteGainers = (y0, y1, k) => NP.countries.map(e => ({ e, d: NP.Dx("P_05", e, y1) - NP.Dx("P_05", e, y0) })).sort((a, b) => b.d - a.d).slice(0, k).map(d => NP.shortName(d.e));
const list = a => (a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : a[0]);
const Y1 = NP.LAST_FULL_YEAR, Y0 = NP.YEARS[0];

const CH = [
  { title: "One pizza", state: { node: "ALL", lens: "exp", year: Y1, eco: null },
    text: () => `In ${Y1} economies exported ${b(usd(NP.Xw("ALL", Y1)))} of plastics and of the natural and mineral materials that could replace them. ${b(p0(NP.Xw("P_00", Y1) / NP.Xw("ALL", Y1)))} of that value is plastics (blue), ${b(p0(I.subsShare(NP.W, Y1)))} is substitutes (green). Each spike on the map is one exporter.` },
  { title: "Who bakes it", state: { node: "P_00", lens: "exp", year: Y1, eco: null }, play: [Y0, Y1, 420],
    text: () => `China’s share of world plastics exports rose from ${b(p0(share("P_00", "156", Y0)))} in ${Y0} to ${b(p0(share("P_00", "156", Y1)))} in ${Y1}. Developing economies now ship ${b(p0(I.groupShare("P_00", NP.GROUP.developing, Y1)))} of all plastics, up from ${p0(I.groupShare("P_00", NP.GROUP.developing, Y0))}. Watch the spikes grow.` },
  { title: "From pellets…", state: { node: "P_01", lens: "exp", year: Y1, eco: null },
    text: () => `Plastics start as resins and pellets. These “primary forms” are worth ${usd(NP.Xw("P_01", Y1))}, and their largest exporters are not the same as for finished goods: ${b(top("P_01", Y1, 4))}.` },
  { title: "…to products", state: { node: "P_04", lens: "exp", year: Y1, eco: null },
    text: () => `Finished plastic goods are the biggest slice (${usd(NP.Xw("P_04", Y1))}), and the map looks different: ${b("China alone exports " + p0(share("P_04", "156", Y1)))}, and ${p0(share("P_03", "156", Y1))} of the intermediate goods one step earlier.` },
  { title: "Where the waste went", state: { node: "P_05", lens: "flows", year: Y1, eco: null }, play: [2012, Y1, 1300],
    text: () => `In 2012, ${b(p0(toChina(2012)))} of traded plastic waste went to China and Hong Kong SAR. China restricted imports in 2018: the share fell to ${b(p0(toChina(2018)))} that year and ${b(p0(toChina(Y1)))} in ${Y1}. The destinations that gained most since 2016 are ${list(wasteGainers(2016, Y1, 3))}, and the trade itself shrank from ${usd(NP.Xw("P_05", 2012))} to ${usd(NP.Xw("P_05", Y1))}.` },
  { title: "The other half of the pizza", state: { node: "NPS000", lens: "mix", year: Y1, eco: null },
    text: () => { const s = c => p0(I.subsShare(E(c), Y1)); const big = NP.countries.filter(e => NP.isReporter(e, Y1, "ALL") && NP.X("ALL", e, Y1) > 1e9); const n = big.filter(e => I.subsShare(e, Y1) > 0.5).length;
      return `Economies sit on very different halves of the pizza. Substitutes are ${b(s("392"))} of Japan’s and ${s("410")} of the Republic of Korea’s exports, but ${b(s("076"))} of Brazil’s, ${s("152")} of Chile’s and ${s("384")} of Côte d’Ivoire’s. Green means substitutes are the larger half: ${n} of the ${big.length} economies exporting more than US$1 billion.`; } },
  { title: "Two sides of one economy", state: { node: "ALL", lens: "dst", year: Y1, eco: E("076") },
    text: () => { const e = E("076"), x = NP.X("ALL", e, Y1), m = NP.D("ALL", e, Y1);
      const top = NP.node.NPS000.leaves.map(id => ({ id, v: NP.X(id, e, Y1) })).sort((a, b) => b.v - a.v).slice(0, 3).map(d => NP.node[d.id].name.toLowerCase().replace(/[;,(].*$/, "").trim());
      return `Exports and imports can tell opposite stories. ${b(p0(I.subsShare(e, Y1)))} of what Brazil sells is substitutes — ${top.join(", ")} — but ${b(p0(NP.D("P_00", e, Y1) / m))} of what it buys is plastics. The pizza on the left now shows Brazil’s imports (${usd(m)}), as Brazil reports them; its exports are ${usd(x)}.`; } },
  { title: "The smallest slice of all", state: { node: "ALL", lens: "exp", year: Y1, eco: NP.GROUP.ldc },
    text: () => { const g = NP.GROUP.ldc, mem = NP.membersOf(g).map(e => ({ e, v: NP.X("ALL", e, Y1) })).sort((a, b) => b.v - a.v);
      return `The least developed countries (${NP.membersOf(g).length} economies in UNCTAD’s grouping) together export ${b(usd(NP.X("ALL", g, Y1)))} of plastics and substitutes: ${b(NP.fmtPct(I.worldShare("ALL", g, Y1), 1))} of the pizza. ${b(p0(I.subsShare(g, Y1)))} of it is substitutes, and three economies — ${mem.slice(0, 3).map(d => NP.shortName(d.e)).join(", ")} — account for ${p0((mem[0].v + mem[1].v + mem[2].v) / NP.X("ALL", g, Y1))}. Choose any group in the menu at the top.`; } },
  { title: "Small slices, few hands", state: { node: "NPS365", lens: "rca", year: Y1, eco: null },
    text: () => `Many substitutes depend on a handful of producers. Natural rubber: ${b(top("NPS365", Y1, 3))}. For Côte d’Ivoire it is ${b(p0(I.merchShare("NPS365", E("384"), Y1)))} of all merchandise exports. Least developed countries supply only ${b(NP.fmtPct(I.groupShare("NPS000", NP.GROUP.ldc, Y1), 1))} of world substitute exports. Colour shows where a slice matters most (RCA above 1).` },
  { title: "Find your economy", state: { node: "ALL", lens: "exp", year: Y1, eco: null }, last: true,
    text: () => `Now explore. Click a slice of the pizza to choose ${b("what")}, an economy on the map (or the search box) to choose ${b("where")}, and drag the timeline to choose ${b("when")}. “Compare” plots economies against GDP per capita and other indicators; “Methodology” explains every number.` },
];

const el = document.getElementById("story");
function draw(i) {
  const c = CH[i];
  el.innerHTML = `<div class="step">Story · ${i + 1} of ${CH.length}</div><h3>${c.title}</h3><p>${c.text()}</p>
    <div class="nav"><div class="dots">${CH.map((_, k) => `<i class="${k === i ? "on" : ""}" data-step="${k}" title="${CH[k].title}"></i>`).join("")}</div>
    <button class="btn-line" id="story-close">${c.last ? "Close" : "Skip"}</button><button class="btn-line" id="story-back" ${i ? "" : "disabled"}>Back</button>
    <button class="btn-solid" id="story-next">${c.last ? "Explore" : "Next"}</button></div>`;
  el.querySelector("#story-close").onclick = stop;
  el.querySelector("#story-back").onclick = () => go(i - 1);
  el.querySelector("#story-next").onclick = () => (c.last ? stop() : go(i + 1));
  el.querySelectorAll(".dots i").forEach(d => { d.onclick = () => go(+d.dataset.step); });
}
let shown = null;
function go(i) {
  if (i < 0 || i >= CH.length) return;
  const c = CH[i]; NP.app.stopPlay(); NP.app.map.resetZoom();
  NP.app.set(Object.assign({ view: "map", story: i }, c.state));
  if (c.play && !NP.app.map.reduced) setTimeout(() => { if (NP.app.state.story === i) { NP.app.play(c.play[0], c.play[1], c.play[2]); } }, 700);
}
function stop() { NP.app.stopPlay(); NP.app.set({ story: null }); }
function render(st) {
  if (st.story == null || !CH[st.story]) { el.classList.add("hidden"); shown = null; return; }
  el.classList.remove("hidden");
  if (shown !== st.story) { shown = st.story; draw(st.story); }
}
/* the tour is offered on the first page (js/cover.js) and by the Story button; it never starts uninvited */
NP.Story = { start: () => go(0), render, count: CH.length, chapters: CH };
})();
