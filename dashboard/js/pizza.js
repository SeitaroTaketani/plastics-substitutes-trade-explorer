/* Pizza (sunburst) = the WHAT selector.
   Every node shows its OWN data value; children are scaled inside their parent's angle (sub-groups of NPS210 overlap,
   so leaves must never be summed). An optional thin outer ring shows the world's split for comparison. */
(function () {
"use strict";
const NP = window.NP;
const TAU = 2 * Math.PI;
const heightOf = n => (n._h != null ? n._h : (n._h = n.children ? 1 + Math.max(...n.children.map(heightOf)) : 0));
const lum = c => { const k = d3.color(c); return k ? (0.299 * k.r + 0.587 * k.g + 0.114 * k.b) / 255 : 0; };
function wrapName(name) {
  const w = name.split(" "); if (w.length < 2) return [name];
  let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), m = Math.max(a.length, b.length); if (!best || m < best.m) best = { m, l: [a, b] }; }
  return best.l;
}
function wrap3(name) {                                   // three lines, the longest as short as possible
  const w = name.split(" "); if (w.length < 3) return null;
  let best = null;
  for (let i = 1; i < w.length - 1; i++) for (let j = i + 1; j < w.length; j++) { const l = [w.slice(0, i).join(" "), w.slice(i, j).join(" "), w.slice(j).join(" ")], m = Math.max(...l.map(s => s.length)); if (!best || m < best.m) best = { m, l }; }
  return best.l;
}

NP.Pizza = function (sel, on) {
  const svg = d3.select(sel);
  const R = 170, R0 = 47, RW0 = 176, RW1 = 185, CH = 4.5;       // CH = approx. char width at 8.5px
  const gArcs = svg.append("g"), gCut = svg.append("g"), gRef = svg.append("g"), gLab = svg.append("g"), gCtr = svg.append("g"), LIFT = 9;
  const arc = d3.arc().startAngle(d => d.a0).endAngle(d => d.a1).innerRadius(d => d.y0).outerRadius(d => d.y1);
  let last = null, hoverId = null, labTimer = null, lastData = [], lifted = null, lastOff = null;
  const subtree = id => { const s = new Set(); (function d(n) { s.add(n.id); (n.children || []).forEach(d); })(NP.node[id]); return s; };

  function layout(f, val) {
    const out = [], band = (R - R0) / Math.max(heightOf(f), 1), start = f.id === "ALL" ? (120 * Math.PI) / 180 : 0;
    (function rec(n, a0, a1) {
      if (n !== f) { const rd = n.depth - f.depth; out.push({ n, a0, a1, y0: R0 + (rd - 1) * band, y1: n.children ? R0 + rd * band : R, v: val(n.id) }); }
      if (n.children) {
        const vs = n.children.map(c => Math.max(0, val(c.id) || 0)), tot = d3.sum(vs); let a = a0;
        n.children.forEach((c, i) => { const w = tot > 0 ? (a1 - a0) * vs[i] / tot : 0; rec(c, a, a + w); a += w; });
      }
    })(f, start, start + TAU);
    return out;
  }
  function textFor(d, det) {
    const name = d.n.name, rm = (d.y0 + d.y1) / 2, arcLen = (d.a1 - d.a0) * rm, band = d.y1 - d.y0, w1 = name.length * CH + 6;
    const mid = (d.a0 + d.a1) / 2, th = (mid * 180 / Math.PI) % 360, x = rm * Math.sin(mid), y = -rm * Math.cos(mid);
    let mode = null, lines = [name];
    if (arcLen >= w1 && band >= 12) mode = "tan"; else if (band >= w1 && arcLen >= 11) mode = "rad";
    else { const wl = wrapName(name), wb = Math.max(...wl.map(s => s.length)) * CH + 6;
      if (wl.length === 2) { if (arcLen >= wb && band >= 22) mode = "tan"; else if (band >= wb && arcLen >= 22) mode = "rad"; if (mode) lines = wl; }
      const w3 = !mode && wrap3(name), wc = w3 ? Math.max(...w3.map(s => s.length)) * CH + 6 : 0;
      if (w3) { if (arcLen >= wc && band >= 33) mode = "tan"; else if (band >= wc && arcLen >= 33) mode = "rad"; if (mode) lines = w3; } }
    if (!mode) return null;
    /* optional line of figures under the name (first page): only along the arc and only where one more line fits */
    const extra = det && mode === "tan" && lines.length < 3 && band >= lines.length * 10 + 14 && arcLen >= det.length * CH * 0.9 + 6 ? det : null;
    let rot = mode === "tan" ? th : th - 90;
    if (mode === "tan" && th > 90 && th < 270) rot += 180;
    if (mode === "rad" && th > 180) rot += 180;
    return { x, y, a: mid, r: rm, mode, rot, lines, extra, dark: lum(d.n.color) > 0.62 };
  }
  /* A label is kept for as long as its slice has room for it. When the same pizza is drawn with other values (another year, another
     economy, a piece taken out) it travels with its slice, along the ring, and only its figures change: the reader can follow a
     name while the years play. It is replaced (short fade) only when its words wrap differently or it has to turn round to stay
     upright, and dropped when the slice gets too thin. p = where a label is: angle a, radius r, rotation, offset of a lifted piece. */
  const labs = new Map();                                   // slice id → its <text>
  const at = p => `translate(${p.r * Math.sin(p.a) + p.ox},${-p.r * Math.cos(p.a) + p.oy}) rotate(${p.rot})`;
  const turn = (r0, r1) => ((r1 - r0) % 360 + 540) % 360 - 180;   // shortest way from one rotation to another, in degrees
  const shape = t => t.mode + "|" + t.lines.join("\n") + "|" + (t.extra ? 1 : 0);
  function fill(el, t) {
    el.attr("class", t.dark ? "dark" : null);
    if (t.lines.length === 1 && !t.extra) { el.text(t.lines[0]); return; }
    t.lines.forEach((s, i) => el.append("tspan").attr("x", 0).attr("dy", i ? "1.15em" : t.lines.length === 3 ? "-1.15em" : t.lines.length === 2 ? (t.extra ? "-1.1em" : "-0.55em") : "-0.5em").text(s));
    if (t.extra) el.append("tspan").attr("class", "dl").attr("x", 0).attr("dy", 10).text(t.extra);
  }
  function addLabel(t, delay) {                             // delay: fade in after so many ms; null = there at once
    const el = gLab.append("text"), n = el.node(); fill(el, t); n.__p = { a: t.a, r: t.r, rot: t.rot, ox: t.ox, oy: t.oy }; n.__k = shape(t); el.attr("transform", at(n.__p)); labs.set(t.id, n);
    if (delay != null) el.style("opacity", 0).transition().delay(delay).duration(220).style("opacity", 1);
  }
  function dropLabel(id, fade) { const n = labs.get(id); if (!n) return; labs.delete(id); const s = d3.select(n).interrupt(); if (fade) s.transition().duration(140).style("opacity", 0).remove(); else s.remove(); }
  function related(id) { const s = new Set(); NP.ancestors(id).forEach(n => s.add(n.id)); (function d(n) { s.add(n.id); (n.children || []).forEach(d); })(NP.node[id]); return s; }
  function applyHL() {
    if (!last) return;
    const key = hoverId || (last.selected !== last.focus ? last.selected : null), rel = key ? related(key) : null;
    gArcs.selectAll(".arc").style("opacity", d => (!rel || rel.has(d.n.id) ? 1 : hoverId ? 0.3 : 0.5)).classed("sel", d => d.n.id === last.selected);
  }

  /* o: {focus, selected, val(id), ref(id)|null, center:[{c,t}], canUp, animate, dur, detail(d)|null, lift: id|null} */
  function render(o) {
    const ride = !!last && last.focus === o.focus;          // the same pizza with other values: slices and labels move, nothing is drawn afresh
    last = o;
    const f = NP.node[o.focus], data = layout(f, o.val), dur = o.animate === false ? 0 : o.dur || 600;
    /* optional (first page): one piece — a slice with everything outside it — is moved out of the pizza and outlined, as if cut out */
    const ld = o.lift ? data.find(d => d.n.id === o.lift) : null, lset = ld ? subtree(o.lift) : null, lm = ld ? (ld.a0 + ld.a1) / 2 : 0;
    const off = ld ? [LIFT * Math.sin(lm), -LIFT * Math.cos(lm)] : [0, 0], moved = d => (lset && lset.has(d.n.id) ? off : [0, 0]);
    lastData = data; lastOff = ld ? off : null;
    const s = gArcs.selectAll("path.arc").data(data, d => d.n.id);
    s.exit().transition().duration(dur / 2).style("opacity", 0).remove();
    s.enter().append("path").attr("class", "arc")
      .each(function (d) { this.__c = { a0: d.a0, a1: d.a0, y0: d.y0, y1: d.y1 }; })
      .on("mousemove", (ev, d) => { hoverId = d.n.id; applyHL(); on.hover(d.n.id, ev); })
      .on("mouseleave", () => { hoverId = null; applyHL(); on.hover(null); })
      .on("click", (ev, d) => on.select(d.n.id))
      .merge(s).attr("fill", d => d.n.color)
      .transition().duration(dur).call(t => { if ("lift" in o) t.attr("transform", d => `translate(${moved(d)[0]},${moved(d)[1]})`); })
      .attrTween("d", function (d) { const node = this, i = d3.interpolate(this.__c, { a0: d.a0, a1: d.a1, y0: d.y0, y1: d.y1 }); return t => arc(node.__c = i(t)); });   // __c = where the slice is NOW: a drawing that interrupts this one (the years being dragged) starts from there, without a jump
    /* world reference ring: depth-1 children of the focus, world values */
    let ref = [];
    if (o.ref && f.children) {
      const vs = f.children.map(c => Math.max(0, o.ref(c.id) || 0)), tot = d3.sum(vs), start = f.id === "ALL" ? (120 * Math.PI) / 180 : 0; let a = start;
      if (tot > 0) ref = f.children.map((c, i) => { const w = TAU * vs[i] / tot, d = { n: c, a0: a, a1: a + w, y0: RW0, y1: RW1 }; a += w; return d; });
    }
    const r = gRef.selectAll("path.wref").data(ref, d => d.n.id);
    r.exit().remove();
    r.enter().append("path").attr("class", "wref").merge(r).attr("fill", d => d.n.color).attr("d", arc);
    gRef.selectAll("text").remove();
    if (ref.length) gRef.append("text").attr("class", "wref-label").attr("x", 0).attr("y", -RW1 - 6).attr("text-anchor", "middle").text("outer ring: world");
    /* labels (see addLabel above) */
    clearTimeout(labTimer); gLab.interrupt().style("opacity", 1);
    const specs = []; data.forEach(d => { const t = textFor(d, o.detail ? o.detail(d) : null); if (t) { t.id = d.n.id; t.ox = moved(d)[0]; t.oy = moved(d)[1]; specs.push(t); } });
    if (ride && dur) {                                      // the same pizza, moving: every label goes with its slice
      const seen = new Set();
      specs.forEach(t => { seen.add(t.id); const n = labs.get(t.id);
        if (!n || n.__k !== shape(t) || Math.abs(turn(n.__p.rot, t.rot)) > 90) { dropLabel(t.id, true); addLabel(t, dur * (n ? 0.45 : 0.6)); return; }
        if (t.extra) d3.select(n).select("tspan.dl").text(t.extra);
        const p0 = n.__p, p1 = { a: t.a, r: t.r, rot: p0.rot + turn(p0.rot, t.rot), ox: t.ox, oy: t.oy }, mix = k => u => p0[k] + (p1[k] - p0[k]) * u, m = { a: mix("a"), r: mix("r"), rot: mix("rot"), ox: mix("ox"), oy: mix("oy") };
        d3.select(n).interrupt().style("opacity", 1).transition().duration(dur).attrTween("transform", () => u => at(n.__p = { a: m.a(u), r: m.r(u), rot: m.rot(u), ox: m.ox(u), oy: m.oy(u) })); });
      [...labs.keys()].forEach(id => { if (!seen.has(id)) dropLabel(id, true); });
    } else {                                                // another drawing (the reader went into a slice), or no movement: labels are set when the slices have arrived
      [...labs.keys()].forEach(id => dropLabel(id, false)); gLab.selectAll("text").interrupt().remove();
      const place = () => specs.forEach(t => addLabel(t, null));
      if (dur) labTimer = setTimeout(() => { place(); gLab.style("opacity", 0).transition().duration(220).style("opacity", 1); }, dur + 30); else place();
    }
    /* outline of the lifted piece: drawn like a cut the first time, then it moves out with the piece */
    gCut.selectAll("*").remove();
    if (ld) { const fresh = lifted !== o.lift && dur > 0, p = gCut.append("path").attr("class", "cutline" + (fresh ? " draw" : "")).attr("pathLength", 1).attr("d", arc({ a0: ld.a0, a1: ld.a1, y0: ld.y0, y1: R }));
      if (fresh) p.attr("transform", "translate(0,0)").transition().duration(dur).attr("transform", `translate(${off[0]},${off[1]})`); else p.attr("transform", `translate(${off[0]},${off[1]})`); }
    lifted = ld ? o.lift : null;
    /* centre */
    gCtr.selectAll("*").remove();
    gCtr.append("circle").attr("class", "hole").attr("r", R0 - 2);
    const ys = o.center.length === 4 ? [-21, -5, 9, 22] : [-15, 1, 16];
    o.center.forEach((l, i) => gCtr.append("text").attr("class", l.c).attr("text-anchor", "middle").attr("y", ys[i]).text(l.t));
    gCtr.append("circle").attr("class", "center-hit").attr("r", R0 - 2).style("cursor", o.canUp ? "pointer" : "default").on("click", () => { if (o.canUp) on.up(); });
    applyHL();
  }
  /* where a slice lies in the drawing (angles, inner radius, crust radius, offset if lifted): used to let a copy of it fly away */
  function arcOf(id) { const d = lastData.find(x => x.n.id === id); return d ? { a0: d.a0, a1: d.a1, y0: d.y0, R, off: lifted === id && lastOff ? lastOff : [0, 0] } : null; }
  return { render, arcOf, highlight(id) { hoverId = id; applyHL(); } };
};
})();
