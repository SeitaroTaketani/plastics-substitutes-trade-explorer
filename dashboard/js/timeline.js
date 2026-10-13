/* Timeline = the WHEN selector: an area chart that is also the year slider (click or drag). */
(function () {
"use strict";
const NP = window.NP;
NP.Timeline = function (sel, on) {
  const host = document.querySelector(sel), svg = d3.select(host).append("svg");
  const defs = svg.append("defs"), pt = defs.append("pattern").attr("id", "prov").attr("width", 5).attr("height", 5).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
  pt.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5).attr("stroke", "#b8aea7").attr("stroke-width", 1.2);
  const g = svg.append("g");
  let last = null, W = 0, H = 0, x = null;
  const Y = NP.YEARS, m = { l: 46, r: 158, t: 16, b: 18 };
  function yearAt(px) { return Math.max(Y[0], Math.min(Y[Y.length - 1], Math.round(x.invert(px)))); }
  svg.on("pointerdown", ev => { svg.node().setPointerCapture(ev.pointerId); on.year(yearAt(d3.pointer(ev, svg.node())[0])); })
     .on("pointermove", ev => { if (ev.buttons) on.year(yearAt(d3.pointer(ev, svg.node())[0])); });

  /* o: {series:[{name,color,values}], year, title, unitDiv, unitLabel, provisionalFrom, events:[{y,t}]} */
  function render(o) {
    last = o; const r = host.getBoundingClientRect(); W = Math.max(240, r.width); H = Math.max(60, r.height);
    svg.attr("viewBox", `0 0 ${W} ${H}`); g.selectAll("*").remove();
    const narrow = W < 560; m.r = narrow ? 12 : 158; m.l = narrow ? 34 : 46;
    x = d3.scaleLinear([Y[0], Y[Y.length - 1]], [m.l, W - m.r]);
    const gap = Y.map((_, i) => o.series.some(s => s.values[i] == null));          // null = no data for that year: leave a gap, never draw zero
    const tot = Y.map((_, i) => (gap[i] ? null : d3.sum(o.series, s => s.values[i]))), max = Math.max(d3.max(tot) || 0, o.overlay ? d3.max(o.overlay.values, v => v || 0) : 0) || 1;
    const y = d3.scaleLinear([0, max * 1.12], [H - m.b, m.t]);
    const base = new Array(Y.length).fill(0);
    o.series.forEach(s => {
      const lo = base.slice(); s.values.forEach((v, i) => { base[i] += v || 0; });
      const hi = base.slice();
      g.append("path").attr("fill", s.color).attr("fill-opacity", 0.82).attr("d", d3.area().defined((_, i) => !gap[i]).x((_, i) => x(Y[i])).y0((_, i) => y(lo[i])).y1((_, i) => y(hi[i]))(Y));
      Y.forEach((yy, i) => { if (!gap[i] && (i === 0 || gap[i - 1]) && (i === Y.length - 1 || gap[i + 1])) g.append("rect").attr("x", x(yy) - 2).attr("width", 4).attr("y", y(hi[i])).attr("height", Math.max(1, y(lo[i]) - y(hi[i]))).attr("fill", s.color); });   // isolated year
    });
    g.append("g").attr("class", "ax").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(Y).tickFormat(v => ((narrow ? v % 10 === 5 : v % 5 === 0) || v === Y[Y.length - 1] ? v : "")).tickSize(3).tickSizeOuter(0));
    g.append("g").attr("class", "ax").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(2).tickFormat(v => NP.fmtNum(v / o.unitDiv)).tickSize(3).tickSizeOuter(0));
    g.append("text").attr("class", "tl-lab").attr("x", m.l + 6).attr("y", 10).text(narrow && o.title.length > 44 ? o.title.slice(0, 43) + "…" : o.title);
    if (o.provisionalFrom) {
      const x0 = x(o.provisionalFrom - 0.5);
      g.append("rect").attr("x", x0).attr("y", m.t).attr("width", x(Y[Y.length - 1]) - x0 + 6).attr("height", H - m.b - m.t).attr("fill", "url(#prov)").attr("opacity", 0.55);
      if (!narrow) g.append("text").attr("class", "ev").attr("x", x(Y[Y.length - 1]) + 6).attr("y", m.t - 6).attr("text-anchor", "end").text(`${o.provisionalFrom}: provisional`);
    }
    if (!narrow) (o.events || []).slice().sort((a, b) => a.y - b.y).forEach((e, k, arr) => { g.append("line").attr("x1", x(e.y)).attr("x2", x(e.y)).attr("y1", m.t - 4).attr("y2", H - m.b).attr("stroke", "#aea29a").attr("stroke-dasharray", "2 2");
      const left = k < arr.length - 1 && x(arr[k + 1].y) - x(e.y) < e.t.length * 5.4 + 8;                     // would run into the next label: put it on the left of its line
      g.append("text").attr("class", "ev").attr("x", x(e.y) + (left ? -3 : 3)).attr("y", m.t + 4).attr("text-anchor", left ? "end" : "start").text(e.t); });
    if (o.overlay) g.append("path").attr("fill", "none").attr("stroke", "#231f20").attr("stroke-width", 1.6).attr("stroke-dasharray", "5 3")
      .attr("d", d3.line().defined(v => v != null).x((_, k) => x(Y[k])).y(v => y(v))(o.overlay.values));
    const i = NP.yi(o.year), cx = x(o.year);
    g.append("line").attr("x1", cx).attr("x2", cx).attr("y1", m.t - 6).attr("y2", H - m.b).attr("stroke", "#231f20").attr("stroke-width", 1);      // the year: a hairline and a small ring
    g.append("circle").attr("cx", cx).attr("cy", tot[i] == null ? H - m.b : y(tot[i])).attr("r", 4).attr("fill", "#fff").attr("stroke", "#231f20").attr("stroke-width", 1.4);
    if (narrow) return;
    let ly = m.t + 6;
    o.series.slice().reverse().forEach(s => { const val = s.values[i] == null ? "no data" : (o.fmt || NP.fmtUSD)(s.values[i]), one = (s.name + " " + val).length <= 25;
      const t = g.append("text").attr("x", W - m.r + 12).attr("y", ly).style("font-size", "10.5px").style("font-weight", 600).attr("fill", s.color);
      if (one) { t.text(s.name + " " + val); ly += 13; } else { t.text(s.name); g.append("text").attr("x", W - m.r + 12).attr("y", ly + 13).style("font-size", "10.5px").style("font-weight", 600).attr("fill", s.color).text(val); ly += 26; } });
    if (o.overlay) { g.append("text").attr("x", W - m.r + 12).attr("y", ly).style("font-size", "10.5px").style("font-weight", 600).attr("fill", "#231f20").text(`╌ ${o.overlay.name} ${o.overlay.values[i] == null ? "no data" : NP.fmtUSD(o.overlay.values[i])}`); ly += 13; }
    if (o.series.length > 1 && tot[i] != null) g.append("text").attr("x", W - m.r + 12).attr("y", ly).style("font-size", "10.5px").attr("fill", "#6e6259").text(`Total ${(o.fmt || NP.fmtUSD)(tot[i])}`);
  }
  new ResizeObserver(() => { if (last) render(last); }).observe(host);
  return { render };
};
})();
