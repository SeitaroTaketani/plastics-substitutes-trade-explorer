/* PNG snapshot of the current view (pizza + map or scatter + headline numbers), with source and UN map disclaimer,
   so that a chart taken out of the explorer still says what it shows and where it comes from. */
(function () {
"use strict";
const NP = window.NP;
const PROPS = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "font-size", "font-weight", "text-anchor", "dominant-baseline", "paint-order", "letter-spacing", "text-transform", "display", "visibility"];
/* rasterise a live <svg>: clone it, copy the computed presentation styles inline (the clone has no stylesheet), draw it as an image */
function svgImage(svg) {
  return new Promise((resolve, reject) => {
    const r = svg.getBoundingClientRect(), clone = svg.cloneNode(true);
    const src = svg.querySelectorAll("*"), dst = clone.querySelectorAll("*");
    for (let i = 0; i < src.length; i++) {
      const el = src[i], tag = el.tagName.toLowerCase(); if (tag === "defs" || el.closest("defs")) continue;
      const cs = getComputedStyle(el); let st = "";
      for (const p of PROPS) { const v = cs.getPropertyValue(p); if (v) st += `${p}:${v};`; }
      dst[i].setAttribute("style", st + "font-family:Helvetica,Arial,sans-serif;");
      if (cs.display === "none") dst[i].setAttribute("display", "none");
      const f = el.getAttribute("fill"); if (f && f.startsWith("var(")) dst[i].setAttribute("fill", cs.fill);      // resolve CSS variables
    }
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("width", r.width); clone.setAttribute("height", r.height);
    if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${r.width} ${r.height}`);
    const img = new Image(); img.onload = () => resolve({ img, w: r.width, h: r.height }); img.onerror = () => reject(new Error("could not rasterise the chart"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  });
}
function wrap(ctx, text, x, y, maxW, lh) {
  let line = "";
  for (const w of text.split(/\s+/)) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
const LENS = { exp: "exporters (height of each spike = export value)", dst: "importers (height of each spike = import value; hollow = as reported by exporters)", net: "net exporters and net importers",
  rca: "specialisation (revealed comparative advantage)", mix: "substitutes as a share of each economy’s plastics + substitutes exports", flows: "trade flows (dots move from exporter to destination)" };

NP.snapshot = async function (opt) {
  const st = NP.app.state, S = 2, PW = 1500, pad = 28, F = "Inter, Helvetica, Arial, sans-serif";
  const scatter = st.view === "scatter";
  const pizza = await svgImage(document.getElementById("pizza"));
  const main = scatter ? [await svgImage(document.getElementById("sc-svg"))] : [await svgImage(document.getElementById("map")), null, await svgImage(document.getElementById("mapover"))];
  /* crop the map to the globe outline (plus room for spikes and labels above it) so the image has no empty bands */
  let cy0 = 0, cy1 = main[0].h;
  if (!scatter) { const sv = document.getElementById("map").getBoundingClientRect(), sp = document.querySelector("#map .sphere").getBoundingClientRect();
    cy0 = Math.max(0, Math.min(sp.top - sv.top - 96, main[0].h - 40)); cy1 = Math.min(main[0].h, Math.max(cy0 + 40, sp.bottom - sv.top + 10)); }
  const cropH = cy1 - cy0;
  /* key numbers and rankings are read from the panel on screen (the same, QA-checked values), so the image doubles as a one-page profile */
  const facts = [...document.querySelectorAll("#panel .fact")].slice(0, 12).map(f => ({ v: f.querySelector(".v").textContent.replace(/\s+/g, " ").trim(), l: f.querySelector(".l").textContent.replace(/\s+/g, " ").trim() }));
  const lists = []; document.querySelectorAll("#panel .group-h").forEach(h => { const rows = []; let el = h.nextElementSibling;
    while (el && el.classList.contains("row")) { const nm = el.querySelector(".nm"), vl = el.querySelector(".vl"); if (nm && vl) rows.push([nm.textContent.trim(), vl.textContent.replace(/\s+/g, " ").trim()]); el = el.nextElementSibling; }
    if (rows.length) lists.push({ t: h.textContent.replace(/\s+/g, " ").trim(), rows: rows.slice(0, 6) }); });
  const L3 = lists.slice(0, 3), factRows = Math.ceil(facts.length / 4), bandH = facts.length || L3.length ? 34 + factRows * 42 + (L3.length ? 30 + 6 * 17 : 0) + 22 : 0;
  const leftW = 330, mainW = PW - pad * 3 - leftW, mainH = Math.round(mainW * cropH / main[0].w), top = 132, bodyH = Math.max(mainH, 430), H = top + bodyH + (scatter ? 112 : 82) + bandH + 78;
  const cv = document.createElement("canvas"); cv.width = PW * S; cv.height = H * S; const c = cv.getContext("2d"); c.scale(S, S);
  c.fillStyle = "#fff"; c.fillRect(0, 0, PW, H);
  c.fillStyle = "#009edb"; c.fillRect(0, 0, PW, 6);
  /* title block */
  const n = NP.node[st.node], who = st.eco != null ? NP.scopeName(st.eco) : "World";
  c.fillStyle = "#000"; c.font = `700 26px ${F}`; c.textBaseline = "alphabetic";
  c.fillText(`${n.name} · ${who} · ${st.year}`, pad, 46);
  c.fillStyle = "#6e6259"; c.font = `400 14px ${F}`;
  const lgT = document.querySelector("#legend b");
  const SC = scatter && NP.Scatter.info ? NP.Scatter.info() : null;
  c.fillText(scatter ? (SC ? SC.title : "") : (st.eco != null && lgT ? "Map: " + lgT.textContent : "Map shows " + LENS[st.lens]) + (st.year > NP.LAST_FULL_YEAR ? ` — ${st.year} is provisional` : ""), pad, 70);
  /* headline numbers = the KPI bar */
  let x = pad; c.textBaseline = "alphabetic";
  document.querySelectorAll("#kpis .kpi-item").forEach(k => { const v = k.querySelector(".kpi-value").textContent, l = k.querySelector(".kpi-label").textContent;
    c.font = `700 18px ${F}`; c.fillStyle = "#231f20"; c.fillText(v, x, 104); const w1 = c.measureText(v).width; c.font = `500 11.5px ${F}`; c.fillStyle = "#6e6259"; c.fillText(l, x, 120);
    x += Math.max(w1, c.measureText(l).width) + 26; });
  /* pizza on the left, chart on the right */
  const ps = leftW / pizza.w; c.drawImage(pizza.img, pad, top + 6, leftW, pizza.h * ps);
  c.font = `500 12px ${F}`; c.fillStyle = "#6e6259"; let y = top + pizza.h * ps + 30;
  y = wrap(c, document.getElementById("pizza-note").textContent.replace(/Click.*$/, "Slices are proportional to export value. Blue = plastics, green = substitutes."), pad, y, leftW, 16);
  const mx = pad * 2 + leftW;
  c.fillStyle = "#f3f8fd"; c.fillRect(mx, top, mainW, mainH);
  const iw = main[0].img.naturalWidth || main[0].w, k = iw / main[0].w;                 // image pixels per CSS pixel
  c.drawImage(main[0].img, 0, cy0 * k, iw, cropH * k, mx, top, mainW, mainH);
  if (!scatter) { const fc = document.getElementById("flowcanvas"), fk = fc.width / main[0].w; if (fc.width) c.drawImage(fc, 0, cy0 * fk, fc.width, cropH * fk, mx, top, mainW, mainH);
    const ow = main[2].img.naturalWidth || main[2].w, ok = ow / main[2].w; c.drawImage(main[2].img, 0, cy0 * ok, ow, cropH * ok, mx, top, mainW, mainH); }
  /* legend as text */
  const lg = document.getElementById("legend");
  if (!scatter && lg && !lg.classList.contains("hidden")) {
    const title = lg.querySelector("b") ? lg.querySelector("b").textContent : "", sw = [...lg.querySelectorAll(".sw-row i")].map(i => i.style.background), ticks = [...lg.querySelectorAll(".ticks span")].map(s => s.textContent);
    const notes = [...lg.querySelectorAll(".li")].map(l => l.textContent.trim().replace(/\s+/g, " ")).filter(Boolean);
    c.font = `600 12px ${F}`; c.fillStyle = "#231f20"; let ly = top + bodyH + 22; c.fillText(title, mx, ly); ly += 8;
    if (sw.length) {                                         // colour classes with their break values
      const cw = 58; sw.forEach((col, i) => { c.fillStyle = col; c.fillRect(mx + i * cw, ly, cw, 11); });
      c.strokeStyle = "#ded9d5"; c.strokeRect(mx + 0.5, ly + 0.5, cw * sw.length - 1, 10); c.font = `400 10.5px ${F}`; c.fillStyle = "#6e6259";
      if (ticks.length === sw.length + 1 || ticks.filter(Boolean).length > 3) ticks.forEach((t, i) => { if (t) { c.textAlign = i === 0 ? "left" : i === ticks.length - 1 && ticks.length === sw.length + 1 ? "right" : "center"; c.fillText(t, mx + Math.min(i, sw.length) * cw, ly + 24); } });
      else { c.textAlign = "left"; c.fillText(ticks[0] || "", mx, ly + 24); c.textAlign = "center"; c.fillText(ticks[1] || "", mx + cw * sw.length / 2, ly + 24); c.textAlign = "right"; c.fillText(ticks[2] || "", mx + cw * sw.length, ly + 24); }
      c.textAlign = "left"; ly += 30;
    }
    c.font = `400 11.5px ${F}`; c.fillStyle = "#6e6259"; ly += 12; wrap(c, notes.join("  ·  "), mx + (sw.length ? 58 * sw.length + 18 : 0), sw.length ? ly - 34 : ly, mainW - (sw.length ? 58 * sw.length + 18 : 0), 15); }
  if (scatter) {                                             // colour key of the bubbles + what the axes are
    let lx = mx, ly = top + bodyH + 24; c.font = `500 12px ${F}`;
    document.querySelectorAll("#sc-leg > span").forEach(sp => { const dot = sp.querySelector(".sc-dot"), t = sp.textContent.trim(); if (!dot) return; const hol = dot.classList.contains("hol"), col = dot.style.background || dot.style.borderColor || "#6e6259";
      c.beginPath(); c.arc(lx + 5, ly - 4, 5, 0, 6.2832); if (hol) { c.strokeStyle = col; c.lineWidth = 1.5; c.stroke(); } else { c.fillStyle = col; c.fill(); }
      c.fillStyle = "#231f20"; c.fillText(t, lx + 15, ly); lx += c.measureText(t).width + 34; });
    c.fillStyle = "#6e6259"; c.font = `400 11.5px ${F}`;
    if (SC) { const sz = document.querySelector("#sc-leg .sz"); let yy = wrap(c, `↑ ${SC.yLabel}   ·   → ${SC.xLabel}${sz ? "   ·   " + sz.textContent.trim() : ""}`, mx, ly + 20, mainW, 15);
      c.fillStyle = "#231f20"; wrap(c, SC.finding, mx, yy + 2, mainW, 15); }
  }
  /* key numbers band */
  if (bandH) {
    let by = top + bodyH + (scatter ? 112 : 82); c.strokeStyle = "#ded9d5"; c.beginPath(); c.moveTo(pad, by); c.lineTo(PW - pad, by); c.stroke(); by += 24;
    c.font = `700 12px ${F}`; c.fillStyle = "#004990"; c.fillText((document.querySelector("#panel h2") ? document.querySelector("#panel h2").textContent : "Key numbers").toUpperCase() + " · KEY NUMBERS", pad, by); by += 10;
    const fw = (PW - pad * 2) / 4, fit = (t, w) => { if (c.measureText(t).width <= w) return t; while (t.length > 4 && c.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; };
    facts.forEach((f, i) => { const fx = pad + (i % 4) * fw, fy2 = by + Math.floor(i / 4) * 42; c.font = `700 16px ${F}`; c.fillStyle = "#231f20"; c.fillText(fit(f.v, fw - 14), fx, fy2 + 18); c.font = `400 11px ${F}`; c.fillStyle = "#6e6259"; c.fillText(fit(f.l, fw - 14), fx, fy2 + 33); });
    by += factRows * 42 + 22;
    const lw = (PW - pad * 2 - 2 * 40) / 3;
    L3.forEach((L, k) => { const lx = pad + k * (lw + 40); c.font = `700 11.5px ${F}`; c.fillStyle = "#231f20"; c.fillText(fit(L.t, lw), lx, by);
      L.rows.forEach((r, i) => { const ry = by + 18 + i * 17; c.font = `400 11.5px ${F}`; c.fillStyle = "#6e6259"; c.textAlign = "right"; c.fillText(r[1], lx + lw, ry); const vw = c.measureText(r[1]).width; c.textAlign = "left"; c.fillStyle = "#231f20"; c.fillText(fit(`${i + 1}  ${r[0]}`, lw - vw - 12), lx, ry); }); });
  }
  /* source and disclaimer */
  c.font = `400 11px ${F}`; c.fillStyle = "#6e6259"; let fy = H - 62;
  fy = wrap(c, "Source: UNCTAD calculations based on UNCTADstat “Plastics trade by partner” and “Trade in non-plastic substitutes” (experimental groupings, HS 2022; UN Comtrade). Value in current US$ as each economy reports it: exports by the exporter, imports by the importer (†: as reported by the exporters); “World” is the sum of reporting economies." + (scatter ? " GDP, population, total merchandise trade and UNCTAD indices: UNCTADstat." : ""), pad, fy, PW - pad * 2, 15);
  if (!scatter) fy = wrap(c, "The boundaries and names shown and the designations used on this map do not imply official endorsement or acceptance by the United Nations. Dotted and dashed lines represent approximate borders for which the final status has not yet been agreed.", pad, fy, PW - pad * 2, 15);
  c.fillStyle = "#aea29a"; c.fillText("UNCTAD · Plastics and their substitutes: global trade explorer", pad, H - 12);
  if (opt && opt.dataUrl) return cv.toDataURL("image/png");
  await new Promise(res => cv.toBlob(b => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `plastics_substitutes_${st.node}_${st.eco != null ? NP.eco[st.eco].iso || NP.eco[st.eco].c : "world"}_${st.year}.png`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); res(); }, 400); }, "image/png"));
};
})();
