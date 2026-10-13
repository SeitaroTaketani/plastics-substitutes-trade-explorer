/* UN base map (geometry, borders and disputed areas exactly as in the UNCTAD template file assets/un_map.js) + data layers.
   Geography rules kept from the WWT dashboard: Equal Earth; the file is pre-shifted −11.31° in longitude and is projected
   WITHOUT rotation; polygons are rewound; borders are white (plain / dashed / dotted / dash-dotted); Aksai Chin is hatched;
   "no data" is a hatch so it can never be read as a low value. Symbols on top (spikes, dots, flows) are our own design.
   Optional globe view: the same UN geometry on an orthographic projection (drag to rotate, wheel to zoom). */
(function () {
"use strict";
const NP = window.NP;
const SHIFT = 11.31;                                    // real longitude = file longitude + SHIFT
function rewind(f) {                                   // d3 needs clockwise outer rings; reverse anything larger than a hemisphere
  const g = f.geometry; if (!g) return f;
  const fix = poly => (d3.geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI ? poly.map(r => r.slice().reverse()) : poly);
  if (g.type === "Polygon") g.coordinates = fix(g.coordinates); else if (g.type === "MultiPolygon") g.coordinates = g.coordinates.map(fix);
  return f;
}

NP.Map = function (on) {
  const wrap = document.getElementById("mapwrap"), svg = d3.select("#map"), over = d3.select("#mapover"), canvas = document.getElementById("flowcanvas"), ctx = canvas.getContext("2d");
  const topo = window.UN_TOPO;
  const feats = topojson.feature(topo, topo.objects.economies).features.map(rewind);
  const anchor = {};                                   // eco idx -> [lon, lat] in the file's frame
  topojson.feature(topo, topo.objects["economies-point"]).features.forEach(f => { const e = NP.ecoIdx[f.properties.code]; if (e != null) anchor[e] = f.geometry.coordinates; });
  feats.forEach(f => {
    const p = f.properties, own = NP.ecoIdx[p.code];
    f.eco = own != null && NP.eco[own].t === "country" ? own : null;          // interactive only for economies in the data
    const cc = p["color-code"]; f.colorEco = f.eco != null ? f.eco : (cc && NP.ecoIdx[cc] != null ? NP.ecoIdx[cc] : null);   // disputed areas follow the template's colour code
  });
  const borders = [["plain-borders", "border-plain"], ["dashed-borders", "border-dashed"], ["dotted-borders", "border-dotted"], ["dash-dotted-borders", "border-dashdot"]]
    .map(([k, c]) => ({ c, geo: topojson.feature(topo, topo.objects[k]) }));
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* lighter copies (every 6th vertex) used only while the globe is being dragged or zoomed; the full UN geometry is redrawn as soon as the gesture ends */
  const thin = line => { const o = line.filter((p, i) => i % 6 === 0 || i === line.length - 1); return o; };
  const thinGeom = g => { if (!g) return g;
    if (g.type === "Polygon") { const r = g.coordinates.map(thin).filter(x => x.length >= 4); return r.length ? { type: "Polygon", coordinates: r } : null; }
    if (g.type === "MultiPolygon") { const ps = g.coordinates.map(poly => poly.map(thin).filter(x => x.length >= 4)).filter(p => p.length); return ps.length ? { type: "MultiPolygon", coordinates: ps } : null; }
    if (g.type === "LineString") return { type: "LineString", coordinates: thin(g.coordinates) };
    if (g.type === "MultiLineString") return { type: "MultiLineString", coordinates: g.coordinates.map(thin) };
    return g; };
  feats.forEach(f => { f.low = thinGeom(f.geometry); });
  borders.forEach(b => { b.low = { type: "GeometryCollection", geometries: b.geo.features.map(f => thinGeom(f.geometry)).filter(Boolean) }; });

  /* ── static structure ── */
  const defs = svg.append("defs");
  const hatch = (id, bg, line, sw) => { const p = defs.append("pattern").attr("id", id).attr("width", 5).attr("height", 5).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(45)");
    p.append("rect").attr("width", 5).attr("height", 5).attr("fill", bg); p.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 5).attr("stroke", line).attr("stroke-width", sw); };
  hatch("nodata", "#f7f5f3", "#b8aea7", 1.3);
  const pa = defs.append("pattern").attr("id", "aksai").attr("width", 4).attr("height", 4).attr("patternUnits", "userSpaceOnUse").attr("patternTransform", "rotate(60)");
  pa.append("line").attr("x1", 0).attr("y1", 0).attr("x2", 0).attr("y2", 4).attr("stroke", "rgba(110,98,89,.55)").attr("stroke-width", 1.2);
  const gz = svg.append("g");
  const sphere = gz.append("path").attr("class", "sphere"), grat = gz.append("path").attr("class", "graticule");
  const lands = gz.append("g").selectAll("path").data(feats).join("path").attr("class", d => "land" + (d.eco == null ? " nohit" : "")).attr("data-code", d => d.properties.code)
    .on("mousemove", (ev, d) => { if (d.eco != null && !dragging) hover(d.eco, ev); })
    .on("mouseleave", () => hover(null))
    .on("click", (ev, d) => { if (d.eco != null && !moved) on.select(d.eco); });
  const aksaiF = feats.find(f => f.properties.code === "C00002");
  const aksai = gz.append("path").attr("fill", "url(#aksai)").style("pointer-events", "none");
  const gB = gz.append("g"); borders.forEach(b => { b.el = gB.append("path").attr("class", "border " + b.c); });
  /* the selected economy is a shape laid over the land (pale wash + hairline, style.css), so the land keeps the fill that carries the data; the halo is the white casing of that hairline on coloured maps */
  const selHalo = gz.append("path").attr("class", "sel-halo"), selOutline = gz.append("path").attr("class", "sel-outline"), cmpOutline = gz.append("path").attr("class", "sel-outline cmp"), hoverOutline = gz.append("path").attr("class", "hover-outline");
  const gSpikes = over.append("g"), gDots = over.append("g"), gLabels = over.append("g");

  let W = 0, H = 0, proj = null, path = null, T = d3.zoomIdentity, area = {}, featOf = {};
  feats.forEach(f => { if (f.eco != null) featOf[f.eco] = f; });
  let compared = null, selected = null, hovered = null, spikes = null, dots = null, flows = null, raf = null;
  let globe = false, rot = [0, -18], gk = 1, s0 = 1, flatScale = 1, vers = 0, dragging = false, moved = false, geoRaf = null, fastNext = false, wheelT = null;

  const zoom = d3.zoom().scaleExtent([1, 14]).on("zoom", ev => { if (globe) return; T = ev.transform; gz.attr("transform", T); drawOverlay(); if (flows && (reduced || !raf)) drawFlows(0); });
  svg.call(zoom).on("dblclick.zoom", null);
  /* globe interaction: drag rotates, wheel zooms */
  const drag = d3.drag().filter(() => globe)
    .on("start", () => { dragging = true; moved = false; })
    .on("drag", ev => { if (Math.abs(ev.dx) + Math.abs(ev.dy) > 0) moved = true; const k = 180 / Math.PI / proj.scale(); rot = [rot[0] + ev.dx * k, Math.max(-75, Math.min(75, rot[1] - ev.dy * k))]; scheduleGeo(true); })
    .on("end", () => { dragging = false; setTimeout(() => { moved = false; }, 0); scheduleGeo(false); });
  svg.call(drag);
  svg.node().addEventListener("wheel", ev => { if (!globe) return; ev.preventDefault(); ev.stopPropagation(); gk = Math.max(0.7, Math.min(8, gk * Math.pow(1.0015, -ev.deltaY))); scheduleGeo(true);
    clearTimeout(wheelT); wheelT = setTimeout(() => scheduleGeo(false), 180); }, { passive: false, capture: true });

  const visible = a => !globe || d3.geoDistance(a, [-rot[0], -rot[1]]) < Math.PI / 2 - 0.02;
  const P = e => { const a = anchor[e]; if (!a || !visible(a)) return null; const p = proj(a); return p ? (globe ? p : T.apply(p)) : null; };

  function buildProj() {
    if (globe) { proj = d3.geoOrthographic().clipAngle(90).rotate([rot[0], rot[1]]).fitExtent([[10, 52], [W - 10, H - 16]], { type: "Sphere" }); s0 = proj.scale(); proj.scale(s0 * gk); }
    else proj = d3.geoEqualEarth().fitExtent([[10, 46], [W - 10, H - 12]], { type: "Sphere" });
    path = d3.geoPath(proj);
  }
  function redrawGeo(fast) {
    fast = fast === true && globe; geoRaf = null; vers++;
    if (globe) proj.rotate([rot[0], rot[1]]).scale(s0 * gk);
    sphere.attr("d", path({ type: "Sphere" }));
    const gp = globe ? d3.geoOrthographic().clipAngle(90).scale(proj.scale()).translate(proj.translate()).rotate([rot[0] - SHIFT, rot[1]])
                     : d3.geoEqualEarth().scale(proj.scale()).translate(proj.translate()).rotate([-SHIFT, 0]);
    grat.attr("d", d3.geoPath(gp)(d3.geoGraticule10()));     // graticule in real coordinates
    lands.attr("d", fast ? d => (d.low ? path(d.low) : null) : path);
    aksai.attr("d", fast ? null : path(aksaiF));
    borders.forEach(b => b.el.attr("d", path(fast ? b.low : b.geo)));
    const sd = selected != null && featOf[selected] ? path(featOf[selected]) : null; selOutline.attr("d", sd); selHalo.attr("d", sd);
    cmpOutline.attr("d", compared != null && featOf[compared] ? path(featOf[compared]) : null);
    hoverOutline.attr("d", !fast && hovered != null && featOf[hovered] ? path(featOf[hovered]) : null);
    drawOverlay();
    if (flows && (reduced || !raf)) drawFlows(0);
  }
  function scheduleGeo(fast) { fastNext = !!fast; if (!geoRaf) geoRaf = requestAnimationFrame(() => redrawGeo(fastNext)); }

  function resize() {
    const r = wrap.getBoundingClientRect(); W = Math.max(200, r.width); H = Math.max(160, r.height);
    svg.attr("viewBox", `0 0 ${W} ${H}`); over.attr("viewBox", `0 0 ${W} ${H}`);
    const dpr = window.devicePixelRatio || 1; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const flat = d3.geoEqualEarth().fitExtent([[10, 46], [W - 10, H - 12]], { type: "Sphere" }), fp = d3.geoPath(flat); flatScale = flat.scale();
    feats.forEach(f => { if (f.eco != null) area[f.eco] = fp.area(f); });               // size of each economy on the flat map (used to decide which need a dot)
    buildProj();
    zoom.translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]]);
    if (flows) prepFlows();
    redrawGeo();
  }
  const areaNow = e => (area[e] || 0) * (globe ? Math.pow(proj.scale() / flatScale, 2) * 0.55 : T.k * T.k);

  function hover(e, ev) { hovered = e; hoverOutline.attr("d", e != null && featOf[e] ? path(featOf[e]) : null); on.hover(e, ev); }
  function setFill(fn) { lands.attr("fill", d => { if (d.colorEco == null) return "var(--land)"; const c = fn(d.colorEco); return c == null ? "url(#nodata)" : c; }); if (dots) drawOverlay(); }
  function setSelected(e) { selected = e; const d = e != null && featOf[e] ? path(featOf[e]) : null; selOutline.attr("d", d); selHalo.attr("d", d); }
  function setCompared(e) { compared = e; cmpOutline.attr("d", e != null && featOf[e] ? path(featOf[e]) : null); }

  /* ── spikes, dots, labels (screen space: constant size while zooming) ── */
  /* s: {items:[{e,v,parts?}], max, color, labels:n} ; d: {items:[{e,color}], always:boolean} */
  function setSpikes(s) { spikes = s; drawOverlay(true); }
  function setDots(d) { dots = d; drawOverlay(); }
  function drawOverlay(animate) {
    if (!proj) return;
    const hmax = Math.min(170, H * 0.34);
    let sp = [];
    if (spikes) sp = spikes.items.map(d => { const p = P(d.e); if (!p) return null; const h = Math.max(d.v > 0 ? 1.5 : 0, hmax * d.v / spikes.max);
        return { e: d.e, v: d.v, x: p[0], y: p[1], h, w: Math.max(1.3, Math.min(3.6, 1 + h * 0.22)), c: d.color || spikes.color, parts: d.parts, m: !!d.m, q: !!d.q }; })
      .filter(d => d && d.x > -20 && d.x < W + 20 && d.y > -20 && d.y < H + 220).sort((a, b) => a.y - b.y);
    /* a spike can be split bottom-to-top into parts [{f: share, c: colour}] (e.g. plastics / substitutes) */
    const segs = [];
    for (const d of sp) { let t0 = 0; for (const [i, pt] of (d.parts && d.parts.length ? d.parts : [{ f: 1, c: d.c }]).entries()) { const t1 = Math.min(1, t0 + pt.f);
        if (t1 > t0) segs.push({ k: d.e + "_" + i, e: d.e, v: d.v, h: d.h, c: pt.c, m: d.m, q: d.q, flat: `M${d.x - d.w},${d.y}L${d.x - d.w},${d.y}L${d.x + d.w},${d.y}L${d.x + d.w},${d.y}Z`,
          d: `M${d.x - d.w * (1 - t0)},${d.y - d.h * t0}L${d.x - d.w * (1 - t1)},${d.y - d.h * t1}L${d.x + d.w * (1 - t1)},${d.y - d.h * t1}L${d.x + d.w * (1 - t0)},${d.y - d.h * t0}Z` }); t0 = t1; } }
    const sj = gSpikes.selectAll("path.spike").data(segs, d => d.k);
    sj.exit().remove();
    const sm = sj.enter().append("path").attr("class", "spike").attr("d", d => (animate && !reduced ? d.flat : d.d)).merge(sj).attr("fill", d => (d.q ? "url(#nodata)" : d.c)).attr("fill-opacity", d => (d.m ? 0.1 : d.q ? 1 : 0.55)).attr("stroke", d => d.c).attr("stroke-dasharray", d => (d.m ? "2 1.5" : null))   // m: not the economy's own report (hollow); q: weight not reliable (hatched)
      .attr("data-e", d => d.e).attr("data-h", d => d.h.toFixed(3));
    if (animate && !reduced) sm.transition().duration(380).attr("d", d => d.d); else sm.interrupt().attr("d", d => d.d);   // spikes grow and shrink as the year or slice changes
    gSpikes.selectAll("path.spike-hit").data(sp, d => d.e).join("path").attr("class", "spike-hit").attr("d", d => `M${d.x - 6},${d.y + 4}L${d.x - 3},${d.y - d.h - 2}L${d.x + 3},${d.y - d.h - 2}L${d.x + 6},${d.y + 4}Z`)
      .attr("fill", "transparent").on("mousemove", (ev, d) => { if (!dragging) hover(d.e, ev); }).on("mouseleave", () => hover(null)).on("click", (ev, d) => { if (!moved) on.select(d.e); });
    /* dots for economies too small to see (or all listed when always) */
    let dd = [];
    if (dots) dd = dots.items.map(d => { const p = P(d.e); if (!p) return null; const small = areaNow(d.e) < 40; return (dots.always || small) ? { e: d.e, x: p[0], y: p[1], c: d.color, r: d.r || 3.2 } : null; })
      .filter(d => d && d.x > 0 && d.x < W && d.y > 0 && d.y < H);
    gDots.selectAll("circle").data(dd, d => d.e).join("circle").attr("class", "dot").attr("cx", d => d.x).attr("cy", d => d.y).attr("r", d => d.r).attr("fill", d => d.c)
      .on("mousemove", (ev, d) => { if (!dragging) hover(d.e, ev); }).on("mouseleave", () => hover(null)).on("click", (ev, d) => { if (!moved) on.select(d.e); });
    /* labels: largest first, skip overlaps */
    const lab = [], boxes = [];
    if (spikes && spikes.labels) {
      for (const d of sp.slice().sort((a, b) => b.v - a.v)) {
        if (lab.length >= spikes.labels) break;
        const t1 = NP.shortName(d.e), t2 = (spikes.fmt || NP.fmtUSD)(d.v), wd = Math.max(t1.length, t2.length) * 6 + 6, bx = { x0: d.x - wd / 2, x1: d.x + wd / 2, y0: d.y - d.h - 30, y1: d.y - d.h - 2 };
        if (bx.y0 < 44 || bx.x0 < 0 || bx.x1 > W) continue;
        if (boxes.some(b => bx.x0 < b.x1 && bx.x1 > b.x0 && bx.y0 < b.y1 && bx.y1 > b.y0)) continue;
        boxes.push(bx); lab.push({ e: d.e, x: d.x, y: d.y - d.h - 17, t1, t2 });
      }
    }
    const L = gLabels.selectAll("text").data(lab, d => d.e).join("text").attr("class", "lbl").attr("x", d => d.x).attr("y", d => d.y);
    L.selectAll("tspan").remove();
    L.append("tspan").attr("x", d => d.x).text(d => d.t1);
    L.append("tspan").attr("class", "v").attr("x", d => d.x).attr("dy", "1.1em").text(d => d.t2);
  }

  /* ── flows: great-circle arcs with dots moving from exporter to destination (1 dot = fixed amount) ── */
  /* f: {items:[{a,b,v,color}], unit(US$ per dot), max} */
  function setFlows(f) { flows = f; cancelAnimationFrame(raf); raf = null; ctx.clearRect(0, 0, W, H); if (!f) return; prepFlows(); if (reduced) drawFlows(0); else loop(); }
  function prepFlows() {
    flows.paths = flows.items.map(fl => {
      const A = anchor[fl.a], B = anchor[fl.b]; if (!A || !B) return null;
      const dist = d3.geoDistance(A, B), it = d3.geoInterpolate(A, B), n = Math.max(10, Math.min(56, Math.round(dist * 30))), geo = [];
      for (let i = 0; i <= n; i++) geo.push(it(i / n));
      const nd = Math.max(1, Math.min(60, Math.round(fl.v / flows.unit)));
      return { fl, geo, dist, nd, ph: Math.random(), w: 0.5 + 2.6 * Math.sqrt(fl.v / flows.max), vers: -1, pts: null, cum: null, len: 0 };
    }).filter(p => p && p.dist > 0.004);
  }
  /* screen positions of a path's sample points; recomputed when the projection changed. brk = do not draw the segment ending here */
  function project(p) {
    if (p.vers === vers) return; p.vers = vers;
    const pts = [], cum = [0]; let len = 0;
    for (let i = 0; i < p.geo.length; i++) {
      const q = proj(p.geo[i]), vis = visible(p.geo[i]); q.vis = vis; pts.push(q);
      if (i) { const a = pts[i - 1], dx = q[0] - a[0], dy = q[1] - a[1]; q.brk = globe ? !(vis && a.vis) : Math.abs(dx) > W / 3;
        len += globe ? p.dist / (p.geo.length - 1) * proj.scale() : (q.brk ? 0 : Math.hypot(dx, dy)); cum.push(len); }
    }
    p.pts = pts; p.cum = cum; p.len = len;
  }
  function posAt(p, s) {                                  // point at arc length s (null when hidden behind the globe)
    const c = p.cum; let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= s) lo = m; else hi = m; }
    const a = p.pts[lo], b = p.pts[hi]; if (b.brk) return globe ? null : a;
    const t = (s - c[lo]) / Math.max(1e-6, c[hi] - c[lo]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }
  function drawFlows(time) {
    ctx.clearRect(0, 0, W, H); if (!flows) return;
    const k = globe ? 1 : T.k, tx = globe ? 0 : T.x, ty = globe ? 0 : T.y;
    for (const p of flows.paths) {                        // faint arc lines
      project(p); if (p.len <= 2) continue;
      ctx.beginPath(); p.pts.forEach((q, i) => { const x = q[0] * k + tx, y = q[1] * k + ty; if (!i || q.brk) { if (!globe || q.vis) ctx.moveTo(x, y); } else ctx.lineTo(x, y); });
      ctx.strokeStyle = p.fl.color; ctx.globalAlpha = reduced ? 0.45 : 0.16; ctx.lineWidth = p.w; ctx.stroke();
    }
    ctx.globalAlpha = 0.92;
    const speed = 42;                                     // px per second along the path (unzoomed)
    for (const p of flows.paths) {
      if (p.len <= 2) continue;
      ctx.fillStyle = p.fl.color;
      for (let i = 0; i < p.nd; i++) {
        const s = reduced ? p.len * (i + 0.5) / p.nd : ((time / 1000 * speed + (p.ph + i / p.nd) * p.len) % p.len);
        const q = posAt(p, s); if (!q) continue; const x = q[0] * k + tx, y = q[1] * k + ty;
        if (x < -5 || x > W + 5 || y < -5 || y > H + 5) continue;
        ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.2832); ctx.fill();
      }
      if (reduced) { const q = posAt(p, p.len * 0.98), q0 = posAt(p, p.len * 0.9); if (!q || !q0) continue; const an = Math.atan2(q[1] - q0[1], q[0] - q0[0]), x = q[0] * k + tx, y = q[1] * k + ty;   // arrowhead
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7 * Math.cos(an - 0.4), y - 7 * Math.sin(an - 0.4)); ctx.lineTo(x - 7 * Math.cos(an + 0.4), y - 7 * Math.sin(an + 0.4)); ctx.closePath(); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  function loop() { const step = t => { if (!flows) return; if (!document.hidden) drawFlows(t); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }

  /* ── camera ── */
  function animRot(to, toK, ms) {                         // rotate / zoom the globe smoothly
    const from = rot.slice(), k0 = gk, i = d3.interpolate(from, to), t0 = performance.now();
    if (reduced || !ms) { rot = to; gk = toK; redrawGeo(); return; }
    const step = now => { const t = Math.min(1, (now - t0) / ms), e = d3.easeCubicInOut(t); rot = i(e); gk = k0 + (toK - k0) * e; redrawGeo(t < 1); if (t < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  /* Fly to an economy only when it is too small to see; large ones keep the world in view so their partners stay visible */
  function flyTo(e) {
    const a = anchor[e]; if (!a) return; const ar = area[e] || 0;
    if (globe) { let d = -a[0] - rot[0]; d = ((d + 540) % 360) - 180; animRot([rot[0] + d, Math.max(-60, Math.min(60, -a[1] * 0.6))], ar > 260 ? 1 : 1.8, 800); return; }
    const p = proj(a);
    if (ar > 260) { svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity); return; }
    const k = ar > 60 ? 2.2 : 3.4;
    svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2).scale(k).translate(-p[0], -p[1]));
  }
  /* frame a set of economies (a region): zoom the flat map to their anchors, or turn the globe towards them */
  function fitEcos(list) {
    const pts = list.map(e => anchor[e]).filter(Boolean); if (!pts.length) return;
    if (globe) { const c = d3.geoCentroid({ type: "MultiPoint", coordinates: pts }); let d = -c[0] - rot[0]; d = ((d + 540) % 360) - 180; animRot([rot[0] + d, Math.max(-60, Math.min(60, -c[1] * 0.7))], 1.25, 800); return; }
    const xy = pts.map(p => proj(p)), x0 = d3.min(xy, p => p[0]), x1 = d3.max(xy, p => p[0]), y0 = d3.min(xy, p => p[1]), y1 = d3.max(xy, p => p[1]);
    const k = Math.max(1, Math.min(5, 0.78 / Math.max((x1 - x0) / W, (y1 - y0) / (H - 60))));
    svg.transition().duration(700).call(zoom.transform, d3.zoomIdentity.translate(W / 2, H / 2 + 18).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2));
  }
  function zoomBy(f) { if (globe) animRot(rot, Math.max(0.7, Math.min(8, gk * f)), 250); else svg.transition().duration(250).call(zoom.scaleBy, f); }
  function resetZoom() { if (globe) animRot([0, -18], 1, 500); else svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity); }
  function setGlobe(g) {
    g = !!g; if (g === globe) return; globe = g;
    T = d3.zoomIdentity; svg.call(zoom.transform, d3.zoomIdentity); gz.attr("transform", null);
    wrap.classList.toggle("globe", globe);
    buildProj(); redrawGeo();
  }

  /* QA helper: is every symbol anchor inside (or right next to) the shape of the same economy? */
  function anchorCheck() {
    const out = { shapes: 0, inside: 0, far: [], noAnchor: [] };
    for (const f of feats) { if (f.eco == null) continue; out.shapes++; const a = anchor[f.eco]; if (!a) { out.noAnchor.push(f.properties.code); continue; }
      if (d3.geoContains(f, a)) { out.inside++; continue; }
      const deg = d3.geoDistance(d3.geoCentroid(f), a) * 180 / Math.PI; if (deg > 12) out.far.push([f.properties.code, NP.eco[f.eco].n, +deg.toFixed(1)]); }
    return out;
  }
  new ResizeObserver(() => { clearTimeout(resize._t); resize._t = setTimeout(() => { resize(); if (on.resized) on.resized(); }, 80); }).observe(wrap);
  resize();
  return { anchorCheck, fitEcos, setCompared, setFill, setSelected, setSpikes, setDots, setFlows, flyTo, zoomBy, resetZoom, setGlobe, isGlobe: () => globe, hasShape: e => !!featOf[e], hasAnchor: e => !!anchor[e], size: () => [W, H], reduced };
};
})();
