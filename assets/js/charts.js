/* ============================================================
   APEX GYM — lightweight canvas chart engine
   line, bar, donut. No external dependencies.
   ============================================================ */
(function () {
  "use strict";

  var ACCENT1 = "#ff6a3d";
  var ACCENT2 = "#e8283f";
  var GRID = "rgba(255,255,255,0.07)";
  var TEXT = "#8b97b5";
  var AXIS = "rgba(255,255,255,0.16)";

  function setup(canvas) {
    if (!canvas) return null;
    var ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return null;
    var dpr = (window.devicePixelRatio || 1);
    var rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: canvas.clientWidth, height: canvas.clientHeight };
    var w = Math.max(rect.width, 60);
    var h = Math.max(rect.height, 60);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function niceMax(v) {
    if (v <= 0) return 10;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / p;
    if (m <= 1) return p;
    if (m <= 2) return 2 * p;
    if (m <= 5) return 5 * p;
    return 10 * p;
  }

  var tipEl = null;
  function tooltip(html, x, y, parentEl) {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.style.cssText = "position:absolute;pointer-events:none;background:#0f1a33;border:1px solid rgba(255,255,255,0.18);border-radius:8px;padding:7px 10px;font-size:11.5px;color:#eef2ff;box-shadow:0 6px 20px rgba(0,0,0,0.5);z-index:40;white-space:nowrap;transform:translate(-50%,-120%);";
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = html;
    tipEl.style.left = x + "px";
    tipEl.style.top = y + "px";
    tipEl.style.display = "block";
  }
  function hideTooltip() { if (tipEl) tipEl.style.display = "none"; }

  /* ---------------- LINE ---------------- */
  function line(canvas, opts) {
    var s = setup(canvas);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var labels = opts.labels || [], values = opts.values || [];
    if (!values.length) { emptyText(ctx, w, h); return; }

    var padL = 46, padR = 12, padT = 12, padB = 30;
    var iw = w - padL - padR, ih = h - padT - padB;
    var maxV = niceMax(Math.max.apply(null, values));
    var minV = 0;
    var range = (maxV - minV) || 1;

    /* grid + y labels */
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var y = padT + ih - (i / ticks) * ih;
      var val = minV + (i / ticks) * range;
      ctx.strokeStyle = GRID;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = TEXT;
      ctx.fillText(fmt(val), padL - 8, y);
    }
    /* x labels */
    ctx.textAlign = "center";
    var step = Math.max(1, Math.ceil(labels.length / Math.max(6, (w / 90))));
    labels.forEach(function (lb, idx) {
      if (idx % step !== 0 && idx !== labels.length - 1) return;
      var x = padL + (idx / (Math.max(labels.length - 1, 1))) * iw;
      ctx.fillStyle = TEXT;
      ctx.fillText(lb, x, h - 10);
    });

    /* line */
    var pts = values.map(function (v, idx) {
      var x = padL + (idx / (Math.max(labels.length - 1, 1))) * iw;
      var y = padT + ih - ((v - minV) / range) * ih;
      return { x: x, y: y };
    });

    /* area fill */
    var grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
    grad.addColorStop(0, "rgba(255,106,61,0.25)");
    grad.addColorStop(1, "rgba(255,106,61,0)");
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + ih);
    pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
    ctx.lineTo(pts[pts.length - 1].x, padT + ih);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    /* stroke */
    var lg = ctx.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, ACCENT1);
    lg.addColorStop(1, ACCENT2);
    ctx.beginPath();
    pts.forEach(function (p, idx) { if (idx === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.strokeStyle = lg;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    /* dots */
    ctx.fillStyle = "#0b1220";
    pts.forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ACCENT1;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    if (opts.tooltip !== false && window.addEventListener) {
      canvas.addEventListener("mousemove", function (e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var best = 0, bd = 1e9;
        pts.forEach(function (p, idx) { var d = Math.abs(p.x - mx); if (d < bd) { bd = d; best = idx; } });
        if (bd < iw / Math.max(labels.length, 1) + 20) {
          tooltip("<b>" + escapeHtml(labels[best]) + "</b><br/>" + fmt(values[best]), pts[best].x + rect.left, pts[best].y + rect.top, canvas.parentElement);
        } else hideTooltip();
      });
      canvas.addEventListener("mouseleave", hideTooltip);
    }
  }

  /* ---------------- BAR ---------------- */
  function bar(canvas, opts) {
    var s = setup(canvas);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var labels = opts.labels || [], values = opts.values || [];
    if (!values.length) { emptyText(ctx, w, h); return; }
    var colors = opts.colors || [];

    var padL = 40, padR = 10, padT = 14, padB = 28;
    var iw = w - padL - padR, ih = h - padT - padB;
    var maxV = niceMax(Math.max.apply(null, values));
    var range = maxV || 1;

    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (var i = 0; i <= 4; i++) {
      var y = padT + ih - (i / 4) * ih;
      ctx.strokeStyle = GRID;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = TEXT;
      ctx.fillText(fmt((i / 4) * range), padL - 8, y);
    }
    ctx.textAlign = "center";

    var bw = Math.min(46, (iw / Math.max(values.length, 1)) * 0.55);
    var slot = iw / Math.max(values.length, 1);
    values.forEach(function (v, idx) {
      var bh = Math.max(2, (v / range) * ih);
      var x = padL + slot * idx + (slot - bw) / 2;
      var y = padT + ih - bh;
      var c = colors[idx] || ACCENT1;
      var g = ctx.createLinearGradient(0, y, 0, padT + ih);
      g.addColorStop(0, c);
      g.addColorStop(1, c + "55");
      ctx.fillStyle = g;
      roundRect(ctx, x, y, bw, bh, 5);
      ctx.fill();
      /* label */
      ctx.fillStyle = TEXT;
      var lab = labels[idx];
      if (lab.length > 8) lab = lab.slice(0, 7) + "…";
      ctx.fillText(lab, padL + slot * idx + slot / 2, h - 10);
    });
  }

  /* ---------------- DONUT ---------------- */
  function donut(canvas, opts) {
    var s = setup(canvas);
    if (!s) return;
    var ctx = s.ctx, w = s.w, h = s.h;
    var data = opts.data || [];
    var total = data.reduce(function (a, d) { return a + d.value; }, 0);
    if (!total) { emptyText(ctx, w, h); return; }
    var cx = w / 2, cy = h / 2;
    var R = Math.min(w, h) / 2 - 8;
    var r = R * 0.62;
    var start = -Math.PI / 2;

    var palette = ["#ff6a3d", "#e8283f", "#34d399", "#fbbf24", "#60a5fa", "#a78bfa", "#f472b6", "#94a3b8"];
    data.forEach(function (d, idx) {
      var frac = d.value / total;
      var end = start + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, end);
      ctx.arc(cx, cy, r, end, start, true);
      ctx.closePath();
      ctx.fillStyle = d.color || palette[idx % palette.length];
      ctx.fill();
      start = end;
    });
    ctx.fillStyle = TEXT;
    ctx.font = "700 11px Space Grotesk, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.centerTop || "", cx, cy - 12);
    ctx.fillStyle = "#eef2ff";
    ctx.font = "700 20px Space Grotesk, sans-serif";
    ctx.fillText(opts.centerValue || "", cx, cy + 8);

    if (opts.tooltip !== false && window.addEventListener) {
      canvas.addEventListener("mousemove", function (e) {
        var rect = canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left - cx, my = e.clientY - rect.top - cy;
        var dist = Math.sqrt(mx * mx + my * my);
        var angle = Math.atan2(my, mx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        var a0 = -Math.PI / 2;
        var hit = null;
        data.forEach(function (d, idx) {
          var f = d.value / total;
          var a1 = a0 + f * Math.PI * 2;
          if (angle >= a0 && angle < a1 && dist >= r && dist <= R) hit = d;
          a0 = a1;
        });
        if (hit) {
          tooltip("<b>" + escapeHtml(hit.label || "") + "</b><br/>" + Math.round(hit.value) + " (" + Math.round((hit.value / total) * 100) + "%)", e.clientX, e.clientY, canvas.parentElement);
        } else hideTooltip();
      });
      canvas.addEventListener("mouseleave", hideTooltip);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fmt(v) {
    if (v >= 1000) return (v / 1000).toFixed(1) + "k";
    return Math.round(v).toString();
  }
  function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function emptyText(ctx, w, h) {
    ctx.fillStyle = "rgba(139,151,181,0.5)";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No data yet", w / 2, h / 2);
  }

  window.Charts = { line: line, bar: bar, donut: donut };
})();