/* ============================================================
   APEX GYM — app bootstrap: login flow, router, shell UI
   (runs last: depends on db.js, utils.js, charts.js, auth.js,
    views.js, views2.js)
   ============================================================ */
(function () {
  "use strict";

  var U = window.U, DB = window.DB, Auth = window.Auth, V = window.V;

  var GROUP_ORDER = ["Overview", "Management", "Finance", "Operations", "Staff", "Training", "System", "Account"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var currentView = null;

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  /* ============================================================
     BRANDING
     ============================================================ */
  function mark() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5 17.5 17.5"/><path d="M21 21 17.5 17.5"/><path d="M3 3 6.5 6.5"/><path d="M21 14 17 10"/><path d="M7 10 3 14"/></svg>';
  }

  window.renderBranding = function () {
    var s = DB.settings();
    var ll = document.getElementById("login-logo");
    var sl = document.getElementById("sidebar-logo");
    if (ll) ll.innerHTML = mark();
    if (sl) sl.innerHTML = mark();
    var lgn = document.getElementById("login-brand-name");
    var sbn = document.getElementById("sidebar-brand-name");
    if (lgn) lgn.textContent = s.gymName;
    if (sbn) sbn.textContent = s.gymName;
    document.title = s.gymName + " — Gym Management System";
  };

  /* ============================================================
     LOGIN
     ============================================================ */
  var DEMO = [
    { u: "admin", p: "admin123", label: "Administrator" },
    { u: "manager", p: "manager123", label: "Manager" },
    { u: "reception", p: "reception123", label: "Receptionist" },
    { u: "trainer", p: "trainer123", label: "Trainer" },
    { u: "accountant", p: "acc123", label: "Accountant" },
    { u: "member", p: "member123", label: "Member" }
  ];

  function buildDemoUsers() {
    var root = document.getElementById("demo-users");
    if (!root) return;
    root.innerHTML = DEMO.map(function (d) {
      return '<div class="demo-user" data-demo="' + d.u + '"><span class="du-name">' + d.label + '</span><span class="du-role">' + d.u + '</span><span class="du-pw">' + d.p + '</span></div>';
    }).join("");
    root.querySelectorAll("[data-demo]").forEach(function (el) {
      el.addEventListener("click", function () {
        var d = null;
        for (var i = 0; i < DEMO.length; i++) if (DEMO[i].u === el.getAttribute("data-demo")) d = DEMO[i];
        if (!d) return;
        var usr = document.getElementById("login-user");
        var pwd = document.getElementById("login-pass");
        var err = document.getElementById("login-error");
        usr.value = d.u; pwd.value = d.p;
        if (err) err.textContent = "";
        pwd.focus();
      });
    });
  }

  function wireLogin() {
    var usr = document.getElementById("login-user");
    var pwd = document.getElementById("login-pass");
    var btn = document.getElementById("login-btn");
    function submit(e) {
      if (e && e.key && e.key !== "Enter") return;
      var u = usr.value.trim(), p = pwd.value;
      var err = document.getElementById("login-error");
      if (!u || !p) { err.textContent = "Please enter username and password."; return; }
      var res = Auth.login(u, p);
      if (res.error) { err.textContent = res.error; return; }
      err.textContent = "";
      enterApp(res.user, false);
    }
    if (btn) btn.addEventListener("click", submit);
    if (usr) usr.addEventListener("keydown", submit);
    if (pwd) pwd.addEventListener("keydown", submit);
  }

  function showLogin() {
    document.getElementById("shell").hidden = true;
    document.getElementById("login-screen").hidden = false;
    location.hash = "";
    var usr = document.getElementById("login-user");
    if (usr) usr.focus();
  }

  /* ============================================================
     SHELL / NAV
     ============================================================ */
  function buildSidebarUser(user) {
    var box = document.getElementById("sidebar-user");
    var sub = document.querySelector(".st-sub");
    if (sub) sub.textContent = Auth.ROLE_LABEL[user.role] || user.role;
    if (!box) return;
    box.innerHTML =
      '<span class="avatar">' + U.initials(user.name) + '</span>' +
      '<div><div class="su-name">' + U.escape(user.name) + '</div><div class="su-role">' + U.escape(Auth.ROLE_LABEL[user.role] || user.role) + '</div></div>' +
      '<div class="su-logout" title="Sign out" id="su-logout">' + U.icon("logout", 18) + '</div>';
    var lo = box.querySelector("#su-logout");
    if (lo) lo.addEventListener("click", function () {
      Auth.logout();
      location.hash = "";
      window.location.reload();
    });
  }

  function navBadge(id) {
    var n = 0;
    switch (id) {
      case "members":
      case "plans":
        n = DB.all("members").filter(function (m) { return DB.memberStatus(m) === "expiring"; }).length;
        break;
      case "payments":
        n = DB.all("payments").filter(function (p) { return p.status !== "paid"; }).length;
        break;
      case "attendance":
        n = DB.all("attendance").filter(function (a) { return a.date === DB.todayISO() && !a.checkOut; }).length;
        break;
      case "store":
        n = DB.all("products").filter(function (p) { return p.quantity <= DB.settings().lowStockThreshold; }).length;
        break;
      case "equipment":
        n = DB.all("equipment").filter(function (e) { return e.status === "maintenance"; }).length;
        break;
    }
    return n;
  }

  function buildNav() {
    var nav = document.getElementById("sidebar-nav");
    if (!nav) return;
    var user = Auth.current();
    if (!user) return;
    var views = V.list().filter(function (v) { return Auth.can(user, v.id); });
    var groups = {};
    views.forEach(function (v) { (groups[v.group] = groups[v.group] || []).push(v); });

    var html = "";
    GROUP_ORDER.forEach(function (g) {
      if (!groups[g] || !groups[g].length) return;
      html += '<div class="nav-group"><div class="nav-group-title">' + g + '</div>';
      groups[g].forEach(function (v) {
        var b = navBadge(v.id);
        html += '<a class="nav-item" data-view="' + v.id + '" href="#/' + v.id + '">' +
          U.icon(v.icon, 18) + '<span>' + U.escape(v.label) + '</span>' +
          (b > 0 ? '<span class="nav-badge">' + b + '</span>' : '') + '</a>';
      });
      html += '</div>';
    });
    nav.innerHTML = html;

    nav.querySelectorAll(".nav-item").forEach(function (n) {
      n.addEventListener("click", closeSidebar);
    });
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  function navigate(id) {
    var user = Auth.current();
    if (!user) { showLogin(); return; }
    if (!V.get(id) || !Auth.can(user, id)) {
      location.hash = "#/" + Auth.defaultView(user);
      return;
    }
    currentView = id;
    var want = "#/" + id;
    if (location.hash !== want) location.hash = want;
    var root = document.getElementById("view-root");
    root.classList.remove("view-enter");
    void root.offsetWidth;
    root.classList.add("view-enter");
    try {
      V.get(id).render(root);
    } catch (e) {
      root.innerHTML = '<div class="card"><div class="card-title">' + U.icon("alert", 18) + 'Something went wrong</div>' +
        '<p class="small muted" style="white-space:pre-wrap">' + U.escape(e && e.message ? e.message : String(e)) + '</p></div>';
      if (window.console) console.error(e);
    }
    markActiveNav(id);
    updateTopbar();
  }

  function onHash() {
    if (!Auth.current()) return;
    var id = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (!id || !V.get(id)) id = Auth.defaultView(Auth.current());
    if (id === currentView) { markActiveNav(id); return; }
    navigate(id);
  }

  function markActiveNav(id) {
    document.querySelectorAll(".nav-item").forEach(function (n) {
      n.classList.toggle("active", n.getAttribute("data-view") === id);
    });
  }

  function enterApp(user, isRestore) {
    document.getElementById("login-screen").hidden = true;
    document.getElementById("shell").hidden = false;
    renderBranding();
    buildSidebarUser(user);
    buildNav();
    tickClock();
    updateTopbar();
    if (!isRestore) U.toast("Welcome back, " + (user.name || "there"));
    var id = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (!id || !Auth.can(user, id)) id = Auth.defaultView(user);
    location.hash = "#/" + id;
    navigate(id);
    var first = document.querySelector(".topbar [data-focus]") || document.getElementById("global-search");
    if (first) first.focus();
  }

  /* ============================================================
     TOPBAR: clock, bell, global search, hamburger
     ============================================================ */
  function tickClock() {
    var el = document.getElementById("clock");
    if (!el) return;
    var d = new Date();
    el.innerHTML = '<span class="cl-dot"></span>' + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds()) +
      '<span style="opacity:.55;display:block">' + MONTHS[d.getMonth()] + " " + d.getDate() + " " + d.getFullYear() + "</span>";
  }

  function updateTopbar() {
    tickClock();
    updateBell();
  }

  var bellWired = false;
  function updateBell() {
    var wrap = document.getElementById("bell-wrap");
    var btn = document.getElementById("bell-btn");
    var dot = document.getElementById("bell-dot");
    var panel = document.getElementById("bell-panel");
    if (!wrap || !btn || !dot || !panel) return;
    if (!btn.innerHTML) btn.innerHTML = U.icon("bell", 18);

    var alerts = DB.deriveAlerts();
    dot.hidden = alerts.length === 0;

    if (!bellWired) {
      bellWired = true;
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var show = panel.hidden;
        panel.hidden = !show;
        if (show) renderBell(panel, DB.deriveAlerts());
      });
      document.addEventListener("click", function (e) {
        if (!panel.hidden && e.target !== btn && !panel.contains(e.target)) panel.hidden = true;
      });
    }
  }

  function renderBell(panel, alerts) {
    var html = "<h4>Notifications</h4>";
    if (!alerts.length) html += '<div class="bell-empty">All clear — nothing needs attention.</div>';
    else {
      html += alerts.slice(0, 12).map(function (a) {
        var col = a.sev === "danger" ? "var(--danger)" : a.sev === "warn" ? "var(--warn)" : "var(--info)";
        return '<div class="bell-item"><span class="bi-dot" style="background:' + col + '"></span><span><div class="bi-text">' +
          U.escape(a.text) + '</div><div class="bi-time">' + U.escape(a.when || "") + "</div></span></div>";
      }).join("");
    }
    panel.innerHTML = html;
  }

  function wireGlobalSearch() {
    var input = document.getElementById("global-search");
    if (!input) return;
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      var q = input.value.trim();
      if (!q) return;
      var user = Auth.current();
      if (!user) return;
      if (Auth.can(user, "members")) {
        navigate("members");
        var mi = document.querySelector("#view-root #m-search");
        if (mi) {
          mi.value = q;
          mi.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } else {
        U.toast("Member search is only available to staff accounts", "warn");
      }
      input.value = "";
    });
  }

  var overEl = null;
  function closeSidebar() {
    var sb = document.getElementById("sidebar");
    if (sb) sb.classList.remove("open");
    if (overEl) { overEl.remove(); overEl = null; }
  }
  function wireHamburger() {
    var hb = document.getElementById("hamburger");
    if (!hb) return;
    hb.addEventListener("click", function () {
      var sb = document.getElementById("sidebar");
      var open = sb.classList.toggle("open");
      if (open && window.matchMedia && window.matchMedia("(max-width:600px)").matches) {
        overEl = document.createElement("div");
        overEl.className = "sidebar-open-overlay";
        document.body.appendChild(overEl);
        overEl.addEventListener("click", closeSidebar);
      } else if (open && window.innerWidth <= 960) {
        /* half-open drawer, no overlay needed */
      }
    });
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function boot() {
    DB.seed();
    renderBranding();
    buildDemoUsers();
    wireLogin();
    wireHamburger();
    wireGlobalSearch();
    window.addEventListener("hashchange", onHash);
    window.setInterval(tickClock, 1000);
    if (Auth.current()) enterApp(Auth.current(), true);
    else showLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();