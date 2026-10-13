/* First page ("cover"): the world pizza of the SMEP factsheet on a full page, in front of the explorer.
   It is drawn by the same component and with the same options as the pizza in the dock of the explorer, so the two are one picture
   at two sizes. "Explore the dashboard" cuts the page away with three slanted blades and rolls the big pizza into the dock
   (first / last / invert / play); "First page" in the dock plays the same film backwards.
   A click on a slice takes that piece: a copy flies to the board on the left, is cut by exporter and the pieces stand up as triangles
   (the spikes of the map). The pizza itself stays whole, so pizza = cut by product, triangles = cut by exporter.
   Every number on this page comes from the functions used everywhere else (NP.Xw, NP.ind): nothing is typed by hand. */
(function () {
"use strict";
const NP = window.NP, I = NP.ind, Y = NP.YEARS, Y1 = NP.LAST_FULL_YEAR, YMAX = Y[Y.length - 1];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const el = $("#cover"); if (!el) return;
const fx = $("#cv-pizza"), fy = fx.querySelector(".cv-fy"), spin = fx.querySelector(".cv-spin"), svg = $("#cover-pizza"), sheet = el.querySelector(".cv-sheet");
const blade = c => el.querySelector(".cv-blades ." + c), bBlue = blade("b1"), bNavy = blade("b2"), bGreen = blade("b3");
const board = $("#cv-board"), cut = d3.select("#cv-cut");
const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const UNDER = ["#main-header", "#kpi-bar", "#stage", "#timeline", "#foot"].map($);          // the explorer behind the page
const T = 1150;                                                                               // length of the film, ms
const H0 = 760, WMIN = 1250, WMAX = 1600;                                                     // the artboard: fixed height, width within these limits (see style.css)
let K = 1, stack = false, fitRaf = 0;
const TOP = 7;                                                                                // exporters that get a triangle; the rest is one note
let on = false, busy = false, pin = null, hover = null, cardKey = null, drawnYear = null, first = true, timer = null, cutRun = 0;
let hot = null, scrub = false;                                                                 // hot: the slice under the pointer, on the pizza or in the ribbon; scrub: the years are being dragged

/* ───────── the pizza: same options as the dock (NP.app.pizzaOpts), plus a line of figures where a slice has room ───────── */
const pz = NP.Pizza("#cover-pizza", {
  hover: (id, ev) => { if (busy) return; if (hot !== id) { hot = id; ribMark(); } if (pin) { NP.showTip(id ? sliceTip(id) : null, ev); return; } if (id === hover) return; hover = id; drawCard(); },
  select: id => { if (busy) return; if (pin === id) putBack(); else take(id); },
  up: () => { if (!busy && pin) putBack(); },
});
/* plain = without the taken piece (the picture the dock shows; needed for the film) */
function drawPizza(animate, dur, plain) {
  const o = NP.app.pizzaOpts("ALL", NP.app.state.year, null, "exp"), tot = o.total, p = plain ? null : pin;
  pz.render(Object.assign({}, o, { selected: p || "ALL", lift: p, canUp: p != null, animate: animate && !reduced, dur,
    detail: d => (tot > 0 && d.v > 0 ? `${NP.fmtUSD(d.v)} · ${NP.fmtPct(d.v / tot, 1)}` : null) }));
}
function sliceTip(id) {
  const n = NP.node[id], y = NP.app.state.year, v = NP.Xw(id, y), tot = NP.Xw("ALL", y);
  return `<b class="t">${esc(n.long || n.name)}${n.proxy ? "°" : ""}</b><table><tr><td>World exports, ${y}</td><td>${NP.fmtUSD(v)}</td></tr><tr><td>Share of the pizza</td><td>${NP.fmtPct(tot ? v / tot : null, 1)}</td></tr></table><div class="u" style="margin:4px 0 0">${id === pin ? "click to put it back" : "click to take this piece"}</div>`;
}

/* ───────── one scale for the whole page ─────────
   The artboard is designed once (760 high) and scaled as one object to the window: the factor is set by the window's height, or by its
   width when the window is too narrow for that height. Extra width only widens the artboard up to WMAX, then goes to the margins.
   So headline, text and pizza keep their proportions whatever the shape of the window. Below 0.76 the text would get too small:
   the page is stacked instead and scrolls (also on narrow windows, where the explorer stacks as well). */
function fit() {
  if (!on) return;
  const vw = el.clientWidth, vh = el.clientHeight, e = 58, k0 = Math.min(vh / H0, (vw - e) / WMIN), st = el.style;
  stack = vw <= 1050 || k0 < 0.76; el.classList.toggle("stack", stack);
  if (stack) { K = 1; ["--k", "--aw", "--ax", "--ay", "--gx", "--gy"].forEach(v => st.removeProperty(v)); return; }
  K = Math.min(k0, 2);
  const aw = Math.min(WMAX, (vw - e) / K);
  st.setProperty("--k", K.toFixed(4)); st.setProperty("--aw", aw.toFixed(1) + "px"); st.setProperty("--ax", ((vw - e - aw * K) / 2).toFixed(1) + "px"); st.setProperty("--ay", Math.max(0, (vh - H0 * K) / 2).toFixed(1) + "px");
  const r = fx.getBoundingClientRect(), c = el.getBoundingClientRect();                         // the light behind the pizza is painted on the sheet
  st.setProperty("--gx", (r.left + r.width / 2 - c.left).toFixed(0) + "px"); st.setProperty("--gy", (r.top + r.height / 2 - c.top).toFixed(0) + "px");
}
window.addEventListener("resize", () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fit); });

/* ───────── words and key numbers ───────── */
function drawText() {
  const y = NP.app.state.year, tot = NP.Xw("ALL", y), pl = NP.Xw("P_00", y), sb = NP.Xw("NPS000", y);
  const hp = NP.hsCount("P_00"), hsb = NP.hsCount("NPS000"), both = hp + hsb - NP.hsCount("ALL");
  const num = (v, l) => `<div class="cv-num"><b>${v}</b><span>${l}</span></div>`;
  $("#cv-eyebrow").textContent = `World exports ${y} · UNCTAD product groups (experimental)`;
  $("#cv-lead").innerHTML = `In ${y}, world exports of plastics, and of the natural and mineral materials that UNCTAD tracks as potential substitutes, came to about <b>${NP.fmtUSD(tot)}</b>. This page shows that total as a single pizza: every slice is proportional to export value.`
    + (y > Y1 ? ` <span class="cv-prov">${y} is provisional: ${NP.nReporters(y, "ALL")} economies had reported (${NP.nReporters(Y1, "ALL")} in ${Y1}).</span>` : "");
  $("#cv-nums").innerHTML = num(NP.fmtUSD(tot), `world exports of plastics and substitutes combined, ${y}`)
    + num(`<span class="c-p">${NP.fmtPct(tot ? pl / tot : null, 0)}</span><i>·</i><span class="c-s">${NP.fmtPct(tot ? sb / tot : null, 0)}</span>`, "of that value is plastics · is non-plastic substitutes")
    + num(`${hp} + ${hsb}`, `HS subheadings in the two groupings (${both} shared)`);
  $("#cv-range").value = y; $("#cv-year-out").textContent = y; $("#cv-year-tot").innerHTML = NP.fmtUSD(tot) + (y > Y1 ? "<i>provisional</i>" : "");
}

/* ───────── reading card: how to read the pizza, or the slice under the pointer ───────── */
function spark(vals, color, year) {
  const Wd = 320, Hd = 48, m = { l: 2, r: 4, t: 6, b: 13 }, max = Math.max(...vals) || 1, iL = Y.indexOf(Y1), iy = Y.indexOf(year), n = Y.length - 1;
  const x = i => m.l + (Wd - m.l - m.r) * i / n, yy = v => Hd - m.b - (Hd - m.b - m.t) * v / max;
  const line = (a, b) => vals.slice(a, b + 1).map((v, i) => (i ? "L" : "M") + x(a + i).toFixed(1) + "," + yy(v).toFixed(1)).join("");
  return `<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="World exports, ${Y[0]} to ${YMAX}"><line x1="${m.l}" x2="${Wd - m.r}" y1="${Hd - m.b}" y2="${Hd - m.b}" stroke="#ded9d5"/>
    <path d="${line(0, iL)}" fill="none" stroke="${color}" stroke-width="2"/>${iL < n ? `<path d="${line(iL, n)}" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3 3"/>` : ""}
    ${iy >= 0 ? `<circle cx="${x(iy).toFixed(1)}" cy="${yy(vals[iy]).toFixed(1)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2"/>` : ""}
    <text x="${m.l}" y="${Hd - 2}" font-size="10" fill="#6e6259">${Y[0]}</text><text x="${Wd - m.r}" y="${Hd - 2}" font-size="10" fill="#6e6259" text-anchor="end">${YMAX}${iL < n ? " (provisional)" : ""}</text></svg>`;
}
function drawCard() {
  const id = pin ? null : hover, y = NP.app.state.year, key = id + "|" + y, c = $("#cv-card");
  if (key === cardKey) return; cardKey = key;
  if (!id) {
    const S = NP.node.NPS000, groups = S.children.reduce((s, t) => s + t.children.length, 0);
    c.style.setProperty("--c", "var(--un-blue)");
    c.innerHTML = `<div class="cv-how"><b>How to read the pizza</b>
      <div><i style="background:${NP.node.P_00.color}"></i><span><b>Plastics</b>: ${NP.node.P_00.children.length} life-cycle stages, from primary forms to waste</span></div>
      <div><i style="background:${S.color}"></i><span><b>Non-plastic substitutes</b>: raw materials and value-added products, ${groups} groups and ${S.leaves.length} sub-groups</span></div>
      <p>Move over a slice for its value and trend. <b>Click a slice to take that piece</b> and see it cut by exporter.</p></div>`;
    return;
  }
  const n = NP.node[id], v = NP.Xw(id, y), tot = NP.Xw("ALL", y), g = y > Y[0] ? I.cagr(id, NP.W, Y[0], y) : null;
  const top = v > 0 ? I.ranking(id, y).slice(0, 3) : [], hs = NP.hsCount(id), path = NP.ancestors(id).reverse().slice(1, -1).map(a => a.short || a.name);
  c.style.setProperty("--c", n.color);
  c.innerHTML = `<div class="cv-ch"><b>${esc(n.long || n.name)}${n.proxy ? `<sup title="${esc(NP.PROXY_NOTE)}">°</sup>` : ""}</b><span>${path.length ? esc(path.join(" › ")) + " · " : ""}${hs} HS subheading${hs > 1 ? "s" : ""}</span></div>
    <div class="cv-cn"><div><b>${NP.fmtUSD(v)}</b><span>world exports, ${y}</span></div><div><b>${NP.fmtPct(tot ? v / tot : null, 1)}</b><span>of the whole pizza</span></div>${g != null ? `<div><b>${NP.fmtSigned(g)}</b><span>a year since ${Y[0]}</span></div>` : ""}</div>
    <div class="cv-cs">${spark(NP.seriesX(id, NP.W), NP.symbolColor(id), y)}</div>
    <div class="cv-ct">${top.length ? `<span>Largest exporters</span> ${top.map(d => `${esc(NP.shortName(d.e))} ${NP.fmtPct(d.v / v, 0)}`).join(" · ")}` : "&nbsp;"}</div>
    <div class="cv-cf"><span>Click to take this piece and cut it by exporter</span></div>`;
}

/* ───────── the board: a piece of the pizza, cut by exporter ─────────
   Drawing of 520 × 246. The piece arrives as a fan that hangs from its tip (FAN); the cut pieces then stand on a common base line (BAR).
   A piece is four points — tip, left corner, a control point for the curved crust, right corner — so fan and triangle are the same
   shape in two positions and one can be turned into the other without a break. In the fan the width of a piece is its value
   (same length for all); as a triangle its height is its value (same width for all).
   Triangles compare the largest exporters with each other. How much of the piece they hold together, and how much is left for
   everybody else, is a part-of-a-whole question: it is answered by the STRIP under them, the same cut laid flat and to scale. */
const FAN = { x: 260, y: 12, r: 166, half: 50 * Math.PI / 180 }, BAR = { x0: 15, slot: 70, w: 32, base: 174, h: 124 }, STRIP = { x: 15, w: 490, y: 212, h: 10 };
const fpt = (r, phi) => [FAN.x + r * Math.sin(phi), FAN.y + r * Math.cos(phi)];                   // phi: 0 = straight down, negative = left
const fanShape = (p0, p1, pad) => { const g = Math.min(pad, (p1 - p0) / 3), a = p0 + g, b = p1 - g; return [FAN.x, FAN.y].concat(fpt(FAN.r, a), fpt(FAN.r / Math.cos((b - a) / 2), (a + b) / 2), fpt(FAN.r, b)); };
const triShape = (x, w, h) => [x, BAR.base - h, x - w / 2, BAR.base, x, BAR.base, x + w / 2, BAR.base];
const slotX = i => BAR.x0 + BAR.slot * (i + 0.5);
const dOf = s => `M${s[0].toFixed(2)},${s[1].toFixed(2)}L${s[2].toFixed(2)},${s[3].toFixed(2)}Q${s[4].toFixed(2)},${s[5].toFixed(2)} ${s[6].toFixed(2)},${s[7].toFixed(2)}Z`;
/* top exporters of a slice and what is left for all the others (each node has its own values; nothing is summed over slices) */
function exporters(id, y) {
  const w = NP.Xw(id, y), all = w > 0 ? I.ranking(id, y) : [], top = all.slice(0, TOP).map((d, i) => ({ e: d.e, v: d.v, share: d.v / w, i }));
  const restV = Math.max(0, w - d3.sum(top, d => d.v)), rest = all.length > top.length && restV > 0 ? { e: "rest", rest: true, v: restV, share: restV / w, i: top.length, n: all.length - top.length } : null;
  const max = top.length ? top[0].v : 1, items = rest ? top.concat([rest]) : top.slice(), sum = d3.sum(items, d => d.v) || 1;
  top.forEach(d => { d.x = slotX(d.i); d.shape = triShape(d.x, BAR.w, Math.max(1.5, BAR.h * d.v / max)); d.top = d.shape[1]; });
  let x = STRIP.x; items.forEach(d => { d.s0 = x; x += STRIP.w * d.v / sum; d.s1 = x; });           // the strip: every piece at its true share
  if (rest) { const m = (rest.s0 + rest.s1) / 2, b = STRIP.y + STRIP.h; rest.shape = [m, STRIP.y, rest.s0, b, m, b, rest.s1, b]; }   // where the rest of the fan comes down
  return { w, items, top, rest, n: all.length, topShare: d3.sum(top, d => d.share) };
}
/* move a piece from the shape it has now to another one; the tip may overshoot a little, the base may not */
function morph(sel, target, dur, delay, bounce) {
  const back = d3.easeBackOut.overshoot(1.4);
  return sel.transition().delay(delay).duration(dur).ease(d3.easeLinear).attrTween("d", function (d, i) {
    const a = this.__s.slice(), b = target(d, i), node = this;
    return t => { const te = d3.easeCubicOut(t), tb = bounce ? back(t) : te, s = a.map((v, k) => v + (b[k] - v) * (k < 2 ? tb : te)); node.__s = s; return dOf(s); }; });
}
function nameLines(d) {
  const w = NP.shortName(d.e).split(" "); if (w.length < 2 || w.join(" ").length <= 10) return [w.join(" ")];
  let best = null; for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, l: [a, b] }; }
  return best.l;
}
const ecoTip = (d, ev) => NP.showTip(`<b class="t">${esc(NP.eco[d.e].n)}</b><div class="u">${esc(NP.node[pin].name)} · ${NP.app.state.year}</div><table><tr><td>Exports</td><td>${NP.fmtUSD(d.v)}</td></tr><tr><td>Share of world exports</td><td>${NP.fmtPct(d.share, 1)} · #${d.i + 1}</td></tr></table><div class="u" style="margin:4px 0 0">click to open this economy in the explorer</div>`, ev);
const hl = e => cut.selectAll(".lb").classed("hl", function () { return e != null && this.getAttribute("data-e") === String(e); });
/* figures above and names below the triangles; appear(d) = delay in ms, or null for at once */
function labels(X, appear) {
  const g = cut.select(".lbs"); g.selectAll("*").remove();
  const col = NP.symbolColor(pin);
  X.top.forEach(d => {
    const lb = g.append("g").attr("class", "lb").attr("data-e", d.e).attr("transform", `translate(${d.x},0)`);
    lb.append("text").attr("class", "sh").attr("y", d.top - 6).attr("fill", col).text(NP.fmtPct(d.share, d.share < 0.1 ? 1 : 0));
    const nm = lb.append("text").attr("class", "nm").attr("y", BAR.base + 15);
    nameLines(d).forEach((s, i) => nm.append("tspan").attr("x", 0).attr("dy", i ? 12.5 : 0).text(s));
    nm.selectAll("tspan").each(function () { if (this.getComputedTextLength() > BAR.slot - 3) d3.select(this).attr("textLength", BAR.slot - 3).attr("lengthAdjust", "spacingAndGlyphs"); });
    if (appear) lb.attr("opacity", 0).transition().delay(appear(d)).duration(260).attr("opacity", 1);
  });
  /* pointer targets: one column per exporter; a click opens the explorer on that economy and this slice */
  const h = cut.select(".hits"); h.selectAll("*").remove();
  X.top.forEach(d => h.append("rect").attr("class", "hit").attr("x", d.x - BAR.slot / 2).attr("y", 18).attr("width", BAR.slot).attr("height", BAR.base + 30 - 18)
    .on("mousemove", ev => { hl(d.e); ecoTip(d, ev); }).on("mouseleave", () => { hl(null); NP.showTip(null); }).on("click", () => { NP.showTip(null); enter({ node: pin, eco: d.e }); }));
}
/* the strip: how = "cut" (each segment appears as the knife passes; step = ms between cuts), "move" (another year) or "set" */
function strip(X, how, step) {
  const col = NP.symbolColor(pin), g = cut.select(".strip"), wd = d => Math.max(0.5, d.s1 - d.s0 - 1);
  const s = g.selectAll("rect.sg").data(X.items, d => d.e); s.exit().remove();
  const all = s.enter().append("rect").attr("class", d => "sg" + (d.rest ? " rest" : "")).attr("y", STRIP.y).attr("height", STRIP.h).attr("x", d => d.s0).attr("width", 0)
    .on("mousemove", (ev, d) => { if (d.rest) NP.showTip(`<b class="t">${d.n} other ${d.n === 1 ? "economy" : "economies"}</b><table><tr><td>Exports</td><td>${NP.fmtUSD(d.v)}</td></tr><tr><td>Share of world exports</td><td>${NP.fmtPct(d.share, 1)}</td></tr></table>`, ev); else { hl(d.e); ecoTip(d, ev); } })
    .on("mouseleave", () => { hl(null); NP.showTip(null); }).on("click", (ev, d) => { if (!d.rest) { NP.showTip(null); enter({ node: pin, eco: d.e }); } })
    .merge(s).attr("fill", d => (d.rest ? "url(#cv-hatch)" : col)).style("cursor", d => (d.rest ? "default" : "pointer"));
  if (how === "cut") all.transition().delay((d, i) => i * step + 70).duration(180).attr("x", d => d.s0).attr("width", wd);
  else if (how === "move" && !reduced) all.transition().duration(420).attr("x", d => d.s0).attr("width", wd);
  else all.interrupt().attr("x", d => d.s0).attr("width", wd);
  const t = cut.select(".stripl"), ty = STRIP.y + STRIP.h + 17; t.interrupt().selectAll("*").remove();
  const L = t.append("text").attr("class", "sl").attr("x", STRIP.x).attr("y", ty).style("text-anchor", "start");
  L.append("tspan").attr("class", "b").attr("fill", col).text(NP.fmtPct(X.topShare, 0)); L.append("tspan").attr("dx", 5).text(X.rest ? `the ${X.top.length} largest exporters together` : `all ${X.top.length} exporter${X.top.length === 1 ? "" : "s"}`);
  if (X.rest) { const Rr = t.append("text").attr("class", "sl").attr("x", STRIP.x + STRIP.w).attr("y", ty).style("text-anchor", "end");
    Rr.append("tspan").text(`${X.rest.n} other ${X.rest.n === 1 ? "economy" : "economies"}`); Rr.append("tspan").attr("class", "b").attr("dx", 5).text(NP.fmtPct(X.rest.share, 0)); }
  if (how === "cut") t.attr("opacity", 0).transition().delay(X.items.length * step + 220).duration(280).attr("opacity", 1); else t.attr("opacity", 1);
}
function scaffold() {
  cut.selectAll("*").interrupt(); cut.selectAll("*").remove();
  cut.append("defs").html(`<pattern id="cv-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#ebeae6"/><line x1="0" y1="0" x2="0" y2="5" stroke="#aea29a" stroke-width="1.6"/></pattern>`);
  cut.append("line").attr("class", "base").attr("x1", 6).attr("x2", 514).attr("y1", BAR.base + 0.5).attr("y2", BAR.base + 0.5);
  ["pcs", "knives", "strip", "stripl", "lbs", "hits"].forEach(c => cut.append("g").attr("class", c));
}
/* the triangles without the show: first drawing on the stacked page and with reduced motion, and every later change (year) */
function bars(animate) {
  const X = exporters(pin, NP.app.state.year), col = NP.symbolColor(pin), g = cut.select(".pcs");
  cut.selectAll(".none").remove(); g.selectAll("path.pc").interrupt("up").interrupt("fade");
  if (!X.top.length) { ["pcs", "strip", "stripl", "lbs", "hits"].forEach(c => cut.select("." + c).selectAll("*").remove());
    cut.append("text").attr("class", "none").attr("x", 260).attr("y", 110).text(`No exports of this piece were reported for ${NP.app.state.year}.`); return X; }
  const s = g.selectAll("path.pc").data(X.top, d => d.e), dur = animate && !reduced ? 420 : 0;
  s.exit().interrupt().remove();                                                                 // also the rest of a fan that was still in the air
  const en = s.enter().append("path").attr("class", "pc").each(function (d) { this.__s = triShape(d.x, BAR.w, 0); }).attr("d", function () { return dOf(this.__s); });
  const all = en.merge(s); all.interrupt("fill").attr("fill", col).attr("opacity", 1);
  if (dur) morph(all, d => d.shape, dur, (d, i) => i * 22, true); else all.interrupt().each(function (d) { this.__s = d.shape.slice(); }).attr("d", d => dOf(d.shape));
  strip(X, dur ? "move" : "set"); labels(X, dur ? d => 200 + d.i * 22 : null);
  return X;
}
/* where the piece lies in the pizza, in the coordinates of the board's drawing (the two drawings have different scales) */
function geom(id) {
  const a = pz.arcOf(id); if (!a) return null;
  const P = svg.getScreenCTM(), B = cut.node().getScreenCTM(), k = P.a / B.a, TAU = 2 * Math.PI;
  return { cx: (P.e + a.off[0] * P.a - B.e) / B.a, cy: (P.f + a.off[1] * P.d - B.f) / B.d, r0: a.y0 * k, r1: a.R * k, mid: (((a.a0 + a.a1) / 2) % TAU + TAU) % TAU, hw: (a.a1 - a.a0) / 2 };
}
function boardText() {
  const id = pin, y = NP.app.state.year, n = NP.node[id], v = NP.Xw(id, y), tot = NP.Xw("ALL", y), g = y > Y[0] ? I.cagr(id, NP.W, Y[0], y) : null, hs = NP.hsCount(id);
  const path = NP.ancestors(id).reverse();
  $("#cv-crumbs").innerHTML = path.map((a, i) => (i === path.length - 1 ? `<span class="cur">${esc(a.short || a.name)}</span>` : `<button data-take="${a.id}">${esc(a.short || a.name)}</button>`)).join(`<span class="sep">›</span>`);
  const bt = $("#cv-bt"); bt.style.setProperty("--c", n.color);
  bt.innerHTML = `<div><b>${esc(n.long || n.name)}${n.proxy ? `<sup title="${esc(NP.PROXY_NOTE)}">°</sup>` : ""}</b><span><b>${NP.fmtUSD(v)}</b> · ${NP.fmtPct(tot ? v / tot : null, 1)} of the pizza${g != null ? ` · ${NP.fmtSigned(g)} a year since ${Y[0]}` : ""} · ${hs} HS subheading${hs > 1 ? "s" : ""}</span></div>`;
  $("#cv-cap").innerHTML = `Who exports it · ${y}${y > Y1 ? " (provisional)" : ""}<small>height of a triangle = export value</small>`;
  /* the way down the hierarchy: the pieces inside this one; for a sub-group, the pieces next to it */
  const inside = !!n.children, kids = (inside ? n.children : n.parent.children).map(c => ({ c, v: NP.Xw(c.id, y) })).sort((a, b) => b.v - a.v), base = inside ? v : NP.Xw(n.parent.id, y);
  $("#cv-chips-cap").innerHTML = inside ? `Inside this piece<small>${kids.length} smaller pieces; click one to take it</small>` : `Next to it in ${esc((n.parent.short || n.parent.name).toLowerCase())}<small>${kids.length} pieces</small>`;
  $("#cv-chips").innerHTML = kids.map(k => `<button class="cv-chip${k.c.id === id ? " on" : ""}" data-take="${k.c.id}" title="${esc(k.c.long || k.c.name)}: ${NP.fmtUSD(k.v)}"><i style="background:${k.c.color}"></i><span>${esc(k.c.name)}</span><small>${NP.fmtPct(base ? k.v / base : null)}</small></button>`).join("");
  $("#cv-enter").firstChild.textContent = "Explore this piece in the dashboard ";
}
/* take a piece: the knife goes round it in the pizza, a copy flies to the board as a fan, is cut by exporter, and the pieces stand up */
function take(id) {
  if (!NP.node[id] || id === "ALL") return putBack();
  const open = pin != null, run = ++cutRun, sp = open ? 0.72 : 1;
  pin = id; hover = null; hot = null; NP.showTip(null); ribMark();
  el.classList.remove("intro"); el.classList.add("cut"); board.classList.remove("hidden");
  drawPizza(true, 420); boardText(); scaffold();
  const g0 = !reduced && !stack ? geom(id) : null;
  if (!g0) { bars(true); if (stack) board.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }); return; }
  const X = exporters(id, NP.app.state.year), n = NP.node[id], col = NP.symbolColor(id);
  if (!X.top.length) { bars(false); return; }
  el.classList.add("cutting");
  /* 1. flight: from where the piece lies in the pizza to a fan hanging from its tip on the board */
  const arc = d3.arc(), g1 = { cx: FAN.x, cy: FAN.y, r0: 0, r1: FAN.r, mid: Math.PI, hw: FAN.half }, lerp = (a, b, t) => a + (b - a) * t;
  const flyAt = t => ({ d: arc({ innerRadius: lerp(g0.r0, g1.r0, t), outerRadius: lerp(g0.r1, g1.r1, t), startAngle: lerp(g0.mid - g0.hw, g1.mid - g1.hw, t), endAngle: lerp(g0.mid + g0.hw, g1.mid + g1.hw, t) }),
    tr: `translate(${lerp(g0.cx, g1.cx, t)},${lerp(g0.cy, g1.cy, t) - 46 * Math.sin(Math.PI * t)})` });
  cut.append("path").attr("class", "fly").attr("fill", n.color).attr("opacity", 0).attr("d", flyAt(0).d).attr("transform", flyAt(0).tr)
    .transition().delay(190 * sp).duration(560 * sp).ease(d3.easeCubicInOut)
    .on("start", function () { d3.select(this).attr("opacity", 1); })
    .attrTween("d", () => t => flyAt(t).d).attrTween("transform", () => t => flyAt(t).tr)
    .on("end", function () {
      if (run !== cutRun) return;
      d3.select(this).remove(); el.classList.remove("cutting");
      /* 2. the cut: the fan is the same value split by exporter, largest on the left; the knife passes from left to right,
            and every cut is recorded in the strip below */
      let p = -FAN.half; X.items.forEach(d => { d.p0 = p; p += 2 * FAN.half * d.v / X.w; d.p1 = p; });
      const pcs = cut.select(".pcs").selectAll("path.pc").data(X.items, d => d.e).enter().append("path").attr("class", d => "pc" + (d.rest ? " rest" : "")).attr("fill", n.color)
        .each(function (d) { this.__s = fanShape(d.p0, d.p1, 0); }).attr("d", function () { return dOf(this.__s); });
      const step = 46 * sp, cuts = X.items.slice(1);
      cuts.forEach((d, j) => { const a = fpt(FAN.r + 7, d.p0), len = Math.hypot(a[0] - FAN.x, a[1] - FAN.y);
        cut.select(".knives").append("line").attr("class", "knife").attr("x1", a[0]).attr("y1", a[1]).attr("x2", FAN.x).attr("y2", FAN.y).attr("stroke-dasharray", len).attr("stroke-dashoffset", len)
          .transition().delay(j * step).duration(120).ease(d3.easeCubicIn).attr("stroke-dashoffset", 0).transition().duration(200).attr("opacity", 0).remove(); });
      morph(pcs, d => fanShape(d.p0, d.p1, 0.012), 170, (d, i) => Math.max(0, i - 1) * step + 100, false);
      strip(X, "cut", step);
      /* 3. the largest stand up: same width for all, height = value. What is left of the fan comes down on its part of the strip */
      const t3 = Math.max(0, cuts.length - 1) * step + 100 + 170 + 90;
      pcs.transition("up").delay((d, i) => t3 + i * 40 * sp).duration(0).on("end", function (d) { morph(d3.select(this), () => d.shape, (d.rest ? 520 : 640) * sp, 0, !d.rest); });
      pcs.filter(d => !d.rest).transition("fill").delay((d, i) => t3 + i * 40 * sp).duration(500 * sp).attrTween("fill", () => d3.interpolateRgb(n.color, col));
      pcs.filter(d => d.rest).transition("fade").delay(t3 + X.top.length * 40 * sp + 300 * sp).duration(260).attr("opacity", 0).remove();
      labels(X, d => t3 + d.i * 40 * sp + 430 * sp);
    });
}
function resetCut() { ++cutRun; pin = null; hot = null; ribMark(); cut.selectAll("*").interrupt(); cut.selectAll("*").remove(); el.classList.remove("cut", "cutting"); board.classList.add("hidden"); $("#cv-enter").firstChild.textContent = "Explore the dashboard "; NP.showTip(null); }
function putBack() { if (!pin) return; resetCut(); hover = null; drawPizza(true, 420); cardKey = null; drawCard(); }

/* called by the app after every state change; only the year matters here */
function render() {
  if (!on) return;
  const y = NP.app.state.year; if (y === drawnYear) return; drawnYear = y;
  drawText(); drawPizza(!busy, first ? 1000 : scrub ? 220 : 600); ribYear(!busy && !first); first = false; cardKey = null; drawCard();   // dragged years follow the hand; played years take their time
  if (pin) { ++cutRun; el.classList.remove("cutting"); boardText(); cut.selectAll(".fly,.knife").interrupt().remove(); if (cut.select(".pcs").empty()) scaffold(); cut.selectAll(".pc").interrupt("up"); bars(true); }
}

/* ───────── the ribbon: the same pizza over the years, and the way to choose one ─────────
   A stacked band, 2005–2024, in the colours of the pizza's second ring. Its height is the world total of the year; inside it every
   slice takes the part of the height that it takes of the circle (span() repeats the layout of js/pizza.js). So the pizza is the cut
   through the ribbon at the chosen year, and the ribbon is the pizza unrolled over time: what the fixed size of the pizza cannot
   show (the total doubled; 2009 and 2020) is read here without touching anything.
   Click or drag anywhere to cut the pizza at another year. A slice pointed at on the pizza, or taken as a piece, is drawn in the
   ribbon as its own band and the rest steps back; a band pointed at in the ribbon lights its slice on the pizza.
   The range input under the drawing is the same control for the keyboard and for assistive technology. */
const rib = d3.select("#cv-ribbon"), ribHost = $("#cv-rib");
const RING2 = NP.node.P_00.children.concat(NP.node.NPS000.children).map(c => c.id), TOT = Y.map(y => NP.Xw("ALL", y)), TMAX = d3.max(TOT) || 1;
const EVENTS = [[2009, "Financial crisis"], [2020, "COVID-19"]];
const spans = {};
/* the part of the whole that a slice takes in year Y[i], as [from, to] between 0 and 1 (children share their parent's part in proportion to their own values) */
function span(id, i) {
  const k = id + "|" + i; if (spans[k]) return spans[k];
  const n = NP.node[id]; if (!n.parent) return (spans[k] = [0, 1]);
  const p = span(n.parent.id, i), kids = n.parent.children, vs = kids.map(c => Math.max(0, NP.Xw(c.id, Y[i]) || 0)), tot = d3.sum(vs); let a = p[0], out = [p[0], p[0]];
  for (let j = 0; j < kids.length; j++) { const w = tot > 0 ? (p[1] - p[0]) * vs[j] / tot : 0; if (kids[j].id === id) { out = [a, a + w]; break; } a += w; }
  return (spans[k] = out);
}
let RB = null;                                                                                // scales of the drawing, set by drawRibbon()
function drawRibbon() {
  const W = ribHost.clientWidth, H = ribHost.clientHeight; if (!on || W < 60 || H < 30) return;
  const wide = W >= 380, m = { l: 3, r: 14, t: 15, b: 16 }, x = d3.scaleLinear([Y[0], YMAX], [m.l, W - m.r]), yv = d3.scaleLinear([0, TMAX], [H - m.b, m.t]);
  const area = id => d3.area().x((_, i) => x(Y[i])).y0((_, i) => yv(span(id, i)[0] * TOT[i])).y1((_, i) => yv(span(id, i)[1] * TOT[i]))(Y);
  RB = { W, H, m, x, yv, area };
  rib.attr("viewBox", `0 0 ${W} ${H}`).selectAll("*").interrupt(); rib.selectAll("*").remove();
  rib.append("defs").html(`<pattern id="cv-prov" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#fff" stroke-width="1.7"/></pattern>`);
  const g = rib.append("g").attr("class", "bands");
  RING2.forEach(id => g.append("path").attr("class", "bd").attr("data-id", id).attr("fill", NP.node[id].color).attr("d", area(id)));
  rib.append("path").attr("class", "hl");                                                      // the band of the slice pointed at or taken
  if (YMAX > Y1) rib.append("rect").attr("class", "pv").attr("x", x(Y1 + 0.5)).attr("width", x(YMAX) - x(Y1 + 0.5) + 1).attr("y", m.t - 4).attr("height", H - m.b - m.t + 4).attr("fill", "url(#cv-prov)");   // provisional: hatched
  const ax = rib.append("g").attr("class", "ax");
  ax.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", H - m.b + 0.5).attr("y2", H - m.b + 0.5);
  Y.filter(y => y % 5 === 0 || y === YMAX).forEach(y => { ax.append("line").attr("x1", x(y)).attr("x2", x(y)).attr("y1", H - m.b).attr("y2", H - m.b + 3);
    ax.append("text").attr("class", y > Y1 ? "prov" : null).attr("x", x(y)).attr("y", H - 3).attr("text-anchor", y === Y[0] ? "start" : "middle").text(y); });
  if (wide) {                                                                                  // what it is, and the two years in which the pizza shrank
    rib.append("text").attr("class", "rc").attr("x", m.l).attr("y", 9).text("The same pizza, year by year · drag to choose the year");
    EVENTS.forEach(([ey, t]) => { const i = Y.indexOf(ey); if (i < 0) return; const x1 = x(ey) + 3, x0 = x1 - t.length * 5 - 4;
      const top = d3.min(Y, (yy, k) => (x(yy) >= x0 - 8 && x(yy) <= x1 + 8 ? yv(TOT[k]) : Infinity));     // highest point of the ribbon under the words
      rib.append("text").attr("class", "ev").attr("x", x1).attr("y", top - 5).attr("text-anchor", "end").text(t);
      rib.append("line").attr("class", "evl").attr("x1", x(ey)).attr("x2", x(ey)).attr("y1", top - 2).attr("y2", yv(TOT[i]) - 2); });
  }
  rib.append("line").attr("class", "guide").attr("opacity", 0);
  const mk = rib.append("g").attr("class", "mk"); mk.append("line"); mk.append("circle").attr("r", 4);
  ribYear(false); ribMark();
}
/* the year of the pizza: a hairline and a ring on top of the ribbon, as on the time line of the explorer */
function ribYear(animate) {
  if (!RB) return;
  const y = NP.app.state.year, cx = RB.x(y), cy = RB.yv(TOT[Y.indexOf(y)]), dur = animate && !reduced ? (scrub ? 160 : 600) : 0;
  const to = s => (dur ? s.interrupt().transition().duration(dur).ease(scrub ? d3.easeCubicOut : d3.easeCubicInOut) : s.interrupt());
  to(rib.select(".mk line")).attr("x1", cx).attr("x2", cx).attr("y1", cy).attr("y2", RB.H - RB.m.b);                // from the ring down: it crosses none of the words above the ribbon
  to(rib.select(".mk circle")).attr("cx", cx).attr("cy", cy);
}
/* the slice under the pointer (or the piece that was taken) as its own band; the band of the ring it belongs to keeps part of its strength */
function ribMark() {
  if (!RB) return;
  const id = hot || pin, n = id && id !== "ALL" ? NP.node[id] : null, fam = n ? new Set(NP.ancestors(id).map(a => a.id)) : null;
  rib.classed("hot", !!n); rib.select(".hl").attr("d", n ? RB.area(id) : null).attr("fill", n ? n.color : null).attr("stroke", n ? n.color : null);
  rib.selectAll(".bd").classed("in", function () { return !!fam && fam.has(this.getAttribute("data-id")); });
}
const ribYearAt = ev => Math.max(Y[0], Math.min(YMAX, Math.round(RB.x.invert(d3.pointer(ev, rib.node())[0]))));
function ribBandAt(ev, i) { const v = RB.yv.invert(d3.pointer(ev, rib.node())[1]); if (!(v >= 0 && v <= TOT[i])) return null; const f = v / TOT[i]; return RING2.find(id => { const s = span(id, i); return f >= s[0] && f < s[1]; }) || null; }
/* the pointer over the ribbon without a button down: that year in figures, the band under it lit on the pizza. Nothing is selected */
function ribOver(ev) {
  const g = rib.select(".guide");
  if (!ev) { g.attr("opacity", 0); NP.showTip(null); if (hot != null) { hot = null; pz.highlight(null); ribMark(); } return; }
  const y = ribYearAt(ev), i = Y.indexOf(y), id = ribBandAt(ev, i), cx = RB.x(y), n = id ? NP.node[id] : null, v = id ? NP.Xw(id, y) : null;
  g.attr("opacity", y === NP.app.state.year ? 0 : 1).attr("x1", cx).attr("x2", cx).attr("y1", RB.yv(TOT[i])).attr("y2", RB.H - RB.m.b);
  if (id !== hot) { hot = id; pz.highlight(id); ribMark(); }
  NP.showTip(`<b class="t">${y}${y > Y1 ? " · provisional" : ""}</b><div class="u">World exports</div><table><tr><td>${esc(NP.node.ALL.name)}</td><td>${NP.fmtUSD(TOT[i])}</td></tr>`
    + (n ? `<tr><td>${esc(n.name)}</td><td>${NP.fmtUSD(v)} · ${NP.fmtPct(TOT[i] ? v / TOT[i] : null, 1)}</td></tr>` : "")
    + `</table><div class="u" style="margin:4px 0 0">${y === NP.app.state.year ? "the year of the pizza above" : "click to cut the pizza at " + y}</div>`, null);
  const tip = $("#tip"), r = rib.node().getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;      // above the ribbon, so that it never hides the years next to the pointer
  tip.style.left = Math.max(4, Math.min(innerWidth - w - 4, ev.clientX - w / 2)) + "px"; tip.style.top = Math.max(4, r.top - h - 4) + "px";
}
const ribSet = ev => { const y = ribYearAt(ev); if (y !== NP.app.state.year) NP.app.set({ year: y }); };
rib.on("pointerdown", ev => { if (busy || !RB) return; ev.preventDefault(); rib.node().setPointerCapture(ev.pointerId); stopPlay(); ribOver(null); scrub = true; ribSet(ev); })
  .on("pointermove", ev => { if (busy || !RB) return; if (scrub) ribSet(ev); else if (ev.pointerType !== "touch") ribOver(ev); })
  .on("pointerup pointercancel lostpointercapture", () => { scrub = false; })
  .on("pointerleave", () => { if (!scrub && RB) ribOver(null); });
new ResizeObserver(() => drawRibbon()).observe(ribHost);

/* ───────── years ───────── */
function stopPlay() { clearInterval(timer); timer = null; $("#cv-play").textContent = "▶"; }
function play() {
  if (timer) return stopPlay();
  if (NP.app.state.year >= Y1) NP.app.set({ year: Y[0] });
  $("#cv-play").textContent = "❚❚";
  timer = setInterval(() => { if (!on || NP.app.state.year >= Y1) return stopPlay(); NP.app.set({ year: NP.app.state.year + 1 }); }, 700);
}

/* ───────── the film ───────── */
const setInert = v => { document.body.classList.toggle("covered", v); UNDER.forEach(n => { if (n) { if (v) n.setAttribute("inert", ""); else n.removeAttribute("inert"); } }); };
const done = anims => Promise.all(anims.map(a => a.finished));
const fits = B => !reduced && !stack && B.width > 40 && B.top >= 0 && B.bottom <= innerHeight && B.left >= 0;
/* forward: page → explorer. back = the same keyframes in reverse, with the delays mirrored so that the words come last */
function film(back, B) {
  const W = el.clientWidth, A = svg.getBoundingClientRect(), e = $("#cv-edge").offsetWidth || 58, s = Math.min(0.11 * W, 190);
  const out = [], run = (node, frames, d, t, easing) => out.push(node.animate(frames, { duration: t, delay: back ? T - d - t : d, direction: back ? "reverse" : "normal", easing, fill: "both" }));
  /* 1. the words leave */
  const words = [el.querySelector(".cv-year"), el.querySelector(".cv-top")].concat([...el.querySelectorAll(".cv-edge > *")], [...el.querySelectorAll(".cv-text > *")]);   // what lies in the path of the blades goes first
  words.forEach((n, i) => run(n, n.closest(".cv-edge") ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: "translateX(0px)" }, { opacity: 0, transform: "translateX(-22px)" }], Math.min(i * 26, 260), 260, "cubic-bezier(.4,0,1,1)"));
  /* 2. the tab on the right edge becomes three slanted blades that cut the page away from right to left */
  const nv = 0.03 * W, bl = 0.13 * W, gr = 0.012 * W, L0 = W - e, L1 = -(nv + bl + gr) - s - 6;
  const poly = (a, b, c, d) => `polygon(${a}px 0%, ${b}px 0%, ${c}px 100%, ${d}px 100%)`, WE = "cubic-bezier(.72,0,.22,1)";
  run(sheet, [{ clipPath: poly(0, L0 + 1, L0 + 1, 0) }, { clipPath: poly(0, L1, L1 + s, 0) }], 130, 1000, WE);
  run(bNavy, [{ clipPath: poly(L0, L0, L0, L0) }, { clipPath: poly(L1, L1 + nv, L1 + s + nv, L1 + s) }], 130, 1000, WE);
  run(bBlue, [{ clipPath: poly(L0, W, W, L0) }, { clipPath: poly(L1 + nv, L1 + nv + bl, L1 + s + nv + bl, L1 + s + nv) }], 130, 1000, WE);
  run(bGreen, [{ clipPath: poly(W, W, W, W) }, { clipPath: poly(L1 + nv + bl, L1 + nv + bl + gr, L1 + s + nv + bl + gr, L1 + s + nv + bl) }], 130, 1000, WE);
  /* 3. the pizza rolls into the dock; x and y run on different curves, which bends the path */
  const dx = B.left + B.width / 2 - (A.left + A.width / 2), dy = B.top + B.height / 2 - (A.top + A.height / 2), k = B.width / A.width, PE = "cubic-bezier(.68,0,.2,1)";
  run(fx, [{ transform: "translateX(0px)" }, { transform: `translateX(${dx / K}px)` }], 90, 1060, PE);          // the pizza moves inside the scaled artboard
  run(fy, [{ transform: "translateY(0px)" }, { transform: `translateY(${dy / K}px)` }], 90, 1060, "cubic-bezier(.3,.55,.25,1)");
  run(spin, [{ transform: "rotate(0deg) scale(1)" }, { transform: `rotate(-360deg) scale(${k})` }], 90, 1060, PE);
  return out;
}
const fade = back => [el.animate(back ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 1 : 260, easing: "ease-out", fill: "both" })];

/* page → explorer. opt.node / opt.eco: open the explorer on that slice / economy (default: the piece on the board); opt.tour: start the story */
async function enter(opt) {
  opt = opt || {}; if (!on || busy) return; busy = true; stopPlay(); NP.showTip(null);
  const app = NP.app, dock = $("#pizza"), wrap = dock.parentNode, node = opt.node || pin;
  const patch = {}; if (node && NP.node[node]) patch.node = node; if (opt.eco != null && NP.eco[opt.eco]) { patch.eco = opt.eco; patch.lens = "exp"; }
  if (patch.node || patch.eco != null) app.set(Object.assign(patch, { view: "map", story: null }));   // the explorer changes behind the page
  if (pin) { ++cutRun; el.classList.remove("cutting"); cut.selectAll(".fly,.knife").interrupt().remove(); bars(false); }   // a running cut is finished at once: the board leaves with the words
  if (pin || hover) { hover = null; pz.highlight(null); drawPizza(false, 0, true); }             // the piece goes back into the pizza for the flight
  app.dockPizza.hold();                                                                            // the dock shows the picture that is about to land on it
  el.classList.remove("intro", "peek");
  const B = dock.getBoundingClientRect(), flying = fits(B);
  let anims = [];
  try {
    if (flying) { dock.style.visibility = "hidden"; svg.classList.add("flying"); document.body.classList.add("np-in"); setTimeout(() => app.replayMap(), 640); anims = film(false, B); }
    else anims = fade(false);
    await done(anims);
  } catch (e) { /* an interrupted animation must never leave the explorer covered */ }
  on = false; el.classList.add("off"); setInert(false); dock.style.visibility = ""; resetCut();
  anims.forEach(a => a.cancel()); svg.classList.remove("flying");
  if (flying) { wrap.classList.remove("landed"); void wrap.offsetWidth; wrap.classList.add("landed"); setTimeout(() => { wrap.classList.remove("landed"); document.body.classList.remove("np-in"); }, 1400); }
  app.dockPizza.release(true); app.render();                                                       // the landed pizza opens on the chosen slice; the address takes the view
  busy = false; drawnYear = null;
  const st = $("#stage"); st.setAttribute("tabindex", "-1"); st.focus({ preventScroll: true });
  if (opt.tour && NP.Story) NP.Story.start();
}
/* explorer → page */
async function show(animated) {
  if (on || busy) return; busy = true;
  const app = NP.app, dock = $("#pizza");
  app.stopPlay(); if (app.state.story != null) app.set({ story: null });
  const B = dock.getBoundingClientRect(), flying = !!animated && fits(B);
  on = true; resetCut(); hover = null; drawnYear = null; cardKey = null; first = false;
  el.classList.remove("off", "intro", "peek"); setInert(true); fit();
  drawText(); drawPizza(false); drawCard(); drawRibbon(); drawnYear = app.state.year;
  let anims = [];
  try {
    if (flying) { app.dockPizza.hold(); dock.style.visibility = "hidden"; svg.classList.add("flying"); setTimeout(() => svg.classList.remove("flying"), T - 260); anims = film(true, B); }
    else if (animated) anims = fade(true);
    await done(anims);
  } catch (e) { /* see enter() */ }
  anims.forEach(a => a.cancel()); dock.style.visibility = ""; svg.classList.remove("flying");
  if (flying) app.dockPizza.release(false);
  busy = false; app.render();                                                                      // the address becomes #cover
  $("#cv-enter").focus({ preventScroll: true });
}
/* a link with a view arrived while the page was up: no film */
function hide() { if (!on) return; stopPlay(); resetCut(); on = false; el.classList.add("off"); setInert(false); }
function init(showNow) {
  const r = $("#cv-range"); r.min = Y[0]; r.max = YMAX;
  on = !!showNow; el.classList.toggle("off", !on); setInert(on); fit(); drawRibbon();
  if (on && !reduced) { el.classList.add("intro"); setTimeout(() => el.classList.remove("intro"), 2000); }
}

/* ───────── events ───────── */
$("#cv-enter").onclick = () => enter();
$("#cv-edge").onclick = () => enter();
$("#cv-tour").onclick = () => enter({ tour: true });
$("#cv-method").onclick = () => $("#btn-method").click();
$("#cv-play").onclick = play;
$("#cv-back").onclick = putBack;
$("#cv-range").addEventListener("input", ev => { stopPlay(); NP.app.set({ year: +ev.target.value }); });
board.addEventListener("click", ev => { const b = ev.target.closest("[data-take]"); if (b && !busy) take(b.dataset.take); });
["mouseenter", "focus"].forEach(t => $("#cv-edge").addEventListener(t, () => { if (!busy) el.classList.add("peek"); }));
["mouseleave", "blur"].forEach(t => $("#cv-edge").addEventListener(t, () => el.classList.remove("peek")));
document.addEventListener("keydown", ev => { if (!on || busy) return;
  if (ev.key === "Escape" && pin && !$("#method").open) { ev.stopPropagation(); putBack(); }
  else if (ev.key === "Enter" && !ev.target.closest("button,input,select,a,dialog")) { ev.preventDefault(); enter(); } }, true);

NP.Cover = { init, render, enter, show, hide, take, putBack, exporters, geom, fit, isOn: () => on, isBusy: () => busy, pinned: () => pin, scale: () => (stack ? null : K), T };
})();
