/* ============================================================
   APEX GYM — UI utilities: icons, toasts, modals, formatting
   ============================================================ */
(function () {
  "use strict";

  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    dollar: '<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="3" y1="12" x2="21" y2="12"/>',
    dumbbell: '<path d="M6.5 6.5 17.5 17.5"/><path d="M21 21 17.5 17.5"/><path d="M3 3 6.5 6.5"/><path d="M21 14 17 10"/><path d="M7 10 3 14"/>',
    apple: '<path d="M12 20.94c1.5 0 2 .75 3.75.75s2.5-1 2.5-2.75 2-2.5 2-5.5-2.5-4-2.5-4-1-2.5-3-2.5-1.5 1-3 1-1.5-1-3-1-3.5 2-3.5 2S3 10.94 3 14s1.5 4 3 4 3 .25 3.5.75"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    edit: '<path d="M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM21 14h.01M21 21h.01M14 21h.01M17 17h4"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    tiers: '<path d="M12 15v-2a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v2"/><path d="M12 11V9a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v6"/><circle cx="2" cy="20" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="22" cy="20" r="2"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'
  };

  function icon(name, size, cls) {
    var s = size || 18;
    var body = ICONS[name] || ICONS.info;
    return '<svg class="' + (cls || "") + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  function escape(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function el(html) {
    var t = document.createElement("div");
    t.innerHTML = html.trim();
    return t.firstChild;
  }

  /* ---------- formatting ---------- */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtMoney(n) { return DB.money(n); }
  function fmtDate(iso) {
    if (!iso) return "—";
    var p = iso.split("-");
    if (p.length !== 3) return iso;
    return MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0];
  }
  function fmtTime(iso) { return iso || "—"; }
  function fmtDateTime(ts) {
    if (!ts) return "—";
    var d = new Date(ts);
    return MONTHS[d.getMonth()] + " " + d.getDate() + " " + d.getFullYear() + ", " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function initials(name) {
    if (!name) return "?";
    return name.split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase();
  }
  function humanDays(iso) {
    var d = DB.daysBetween(DB.todayISO(), iso);
    if (d < 0) return Math.abs(d) + "d overdue";
    if (d === 0) return "today";
    if (d === 1) return "tomorrow";
    return "in " + d + "d";
  }

  /* ---------- toast ---------- */
  function toast(msg, type) {
    type = type || "ok";
    var root = document.getElementById("toast-root");
    if (!root) return;
    var ic = type === "ok" ? "check" : type === "err" ? "alert" : type === "warn" ? "alert" : "info";
    var t = el('<div class="toast t-' + type + '"><div class="toast-icon">' + icon(ic, 16) + '</div><div class="toast-msg">' + escape(msg) + '</div></div>');
    root.appendChild(t);
    var timer = setTimeout(function () { dismiss(); }, 3600);
    t.addEventListener("click", function () { clearTimeout(timer); dismiss(); });
    function dismiss() {
      if (!t.parentNode) return;
      t.classList.add("hide");
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }
  }

  /* ---------- modal ---------- */
  var _lastClose = null;
  function modal(opts) {
    closeModal();
    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    var wide = opts.wide ? " wide" : opts.narrow ? " narrow" : "";
    var foot = opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : "";
    var body = (typeof opts.body === "string") ? opts.body : "";
    var closeBtn = '<button class="modal-close" data-mc>' + icon("x", 18) + '</button>';
    var title = opts.title ? '<div class="modal-head"><h3>' + escape(opts.title) + '</h3>' + closeBtn + '</div>' : "";
    backdrop.innerHTML = '<div class="modal' + wide + '">' + title + '<div class="modal-body">' + body + '</div>' + foot + '</div>';

    var contentNode = backdrop.querySelector(".modal-body");
    if (opts.body && typeof opts.body !== "string") contentNode.appendChild(opts.body);

    document.getElementById("modal-root").appendChild(backdrop);

    if (opts.onOpen) opts.onOpen(contentNode);

    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener("keydown", esc);
      if (_lastClose === close) _lastClose = null;
      if (opts.onClose) opts.onClose();
    }
    _lastClose = close;

    function esc(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", esc);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop && !opts.noBackdropClose) close(); });
    var mc = backdrop.querySelector("[data-mc]");
    if (mc) mc.addEventListener("click", close);

    // wire foot buttons
    backdrop.querySelectorAll("[data-close]").forEach(function (b) { b.addEventListener("click", close); });
    return close;
  }
  function closeModal() { if (_lastClose) { var c = _lastClose; _lastClose = null; c(); } }

  /* ---------- confirm dialog ---------- */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var body = '<div class="section-label">' + (opts.kind || "") + '</div><p style="font-size:14px;color:var(--text-2)">' + escape(opts.message) + '</p>';
      var foot = '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn ' + (opts.danger ? "btn-danger" : "btn-primary") + '" data-ok="1">' + escape(opts.okLabel || "Confirm") + "</button>";
      var close = modal({ title: opts.title || "Please confirm", body: body, foot: foot, narrow: true });
      var root = document.getElementById("modal-root");
      var did = false;
      root.querySelector("[data-ok]").addEventListener("click", function () {
        close(); resolve(true);
      });
      // cancel handled by data-close
      var cw = setInterval(function () {
        if (!document.querySelector(".modal-backdrop")) { clearInterval(cw); if (!did) { did = true; resolve(false); } }
      }, 300);
    });
  }

  /* ---------- QR ---------- */
  function qrCanvas(value, size, dark) {
    if (typeof qrcode === "undefined") return null;
    var q;
    try { q = qrcode(0, "M"); q.addData(String(value || "")); q.make(); } catch (e) { return null; }
    if (q.getModuleCount && q.getModuleCount() > 0) {
      var mod = q.getModuleCount();
      var px = Math.max(2, Math.floor((size || 128) / (mod + 4)));
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = (mod + 4) * px;
      var ctx = canvas.getContext && canvas.getContext("2d");
      if (!ctx) return canvas;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = dark || "#0b1220";
      for (var r = 0; r < mod; r++) {
        for (var c = 0; c < mod; c++) {
          if (q.isDark(r, c)) ctx.fillRect((c + 2) * px, (r + 2) * px, px, px);
        }
      }
      return canvas;
    }
    return null;
  }

  /* ---------- CSV download ---------- */
  function downloadCSV(filename, headers, rows) {
    var esc = function (v) {
      v = String(v === null || v === undefined ? "" : v);
      if (v.indexOf(",") >= 0 || v.indexOf('"') >= 0 || v.indexOf("\n") >= 0) return '"' + v.replace(/"/g, '""') + '"';
      return v;
    };
    var lines = [headers.map(esc).join(",")];
    rows.forEach(function (r) { lines.push(r.map(esc).join(",")); });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function downloadJSON(filename, obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* ---------- print ---------- */
  function printSheet(html) {
    var sheet = document.querySelector(".print-sheet");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.className = "print-sheet";
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = html;
    setTimeout(function () { window.print(); }, 80);
  }

  /* ---------- pagination ---------- */
  function pagerHtml(page, pages) {
    if (pages <= 1) return "";
    var prev = '<button class="btn btn-ghost btn-sm" data-pg="' + (page - 1) + '"' + (page <= 1 ? " disabled" : "") + ">" + icon("arrowLeft", 14) + "Prev</button>";
    var next = '<button class="btn btn-ghost btn-sm" data-pg="' + (page + 1) + '"' + (page >= pages ? " disabled" : "") + ">Next" + icon("arrowRight", 14) + "</button>";
    return '<div class="pager">' + prev + '<span class="pg-place">Page ' + page + " of " + pages + "</span>" + next + "</div>";
  }
  function bindPager(container, cb) {
    if (!container) return;
    container.querySelectorAll("[data-pg]").forEach(function (b) {
      b.addEventListener("click", function () { if (b.disabled) return; cb(+b.getAttribute("data-pg")); });
    });
  }

  /* ---------- misc ---------- */
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function sortBy(arr, key, dir) {
    dir = dir || "asc";
    return arr.slice().sort(function (a, b) {
      var va = a[key], vb = b[key];
      if (typeof va === "string") { return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va); }
      return dir === "asc" ? (va - vb) : (vb - va);
    });
  }
  function todayDateValue() { return DB.todayISO(); }
  function monthAgoDateValue() { return DB.addDaysISO(DB.todayISO(), -30); }

  window.U = {
    ICONS: ICONS, icon: icon, escape: escape, el: el,
    fmtMoney: fmtMoney, fmtDate: fmtDate, fmtTime: fmtTime, fmtDateTime: fmtDateTime,
    initials: initials, humanDays: humanDays,
    toast: toast, modal: modal, closeModal: closeModal, confirmDialog: confirmDialog,
    qrCanvas: qrCanvas, downloadCSV: downloadCSV, downloadJSON: downloadJSON, printSheet: printSheet,
    pagerHtml: pagerHtml, bindPager: bindPager, num: num, sortBy: sortBy,
    todayDateValue: todayDateValue, monthAgoDateValue: monthAgoDateValue
  };
})();