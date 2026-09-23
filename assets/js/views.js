/* ============================================================
   APEX GYM — view registry + core views
   (dashboard, members, memberships, payments)
   ============================================================ */
(function () {
  "use strict";

  /* ---------- registry ---------- */
  window.V = {
    _views: {},
    _order: [],
    register: function (def) {
      if (!this._views[def.id]) this._order.push(def.id);
      this._views[def.id] = def;
    },
    get: function (id) { return this._views[id]; },
    list: function () { var self = this; return this._order.map(function (id) { return self._views[id]; }); }
  };

  /* ---------- shared UI helpers ---------- */
  var VUI = {
    can: function (roles) {
      var u = Auth.current();
      if (!u) return false;
      return roles.indexOf(u.role) >= 0;
    },
    ph: function (title, sub, actions) {
      return '<div class="page-head"><div><h2>' + U.escape(title) + '</h2>' +
        (sub ? '<div class="ph-sub">' + sub + '</div>' : '') + '</div>' +
        (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
    },
    btn: function (label, iconName, cls, attrs) {
      return '<button class="btn ' + (cls || "btn-primary") + '" ' + (attrs || "") + '>' +
        (iconName ? U.icon(iconName, 16) : "") + U.escape(label) + '</button>';
    },
    badge: function (member) {
      var b = DB.statusBadgeInfo(DB.memberStatus(member));
      return '<span class="badge ' + b.cls + '"><span class="b-dot"></span>' + b.label + '</span>';
    },
    stBadge: function (key, map) {
      var b = map[key] || map.default || { cls: "gray", label: key };
      return '<span class="badge ' + b.cls + '"><span class="b-dot"></span>' + U.escape(b.label) + '</span>';
    },
    empty: function (iconName, title, sub) {
      return '<div class="empty">' + U.icon(iconName, 44) + '<h4>' + U.escape(title) + '</h4>' +
        (sub ? '<p>' + U.escape(sub) + '</p>' : '') + '</div>';
    },
    memberCell: function (m) {
      if (!m) return '<span class="muted">—</span>';
      return '<div class="cell-user"><span class="avatar">' + U.initials(m.name) + '</span>' +
        '<div><div class="cu-name">' + U.escape(m.name) + '</div>' +
        '<div class="cu-sub mono">' + U.escape(m.code || "") + '</div></div></div>';
    },
    trainerCell: function (t) {
      if (!t) return '<span class="muted">—</span>';
      return '<div class="cell-user"><span class="avatar">' + U.initials(t.name) + '</span>' +
        '<div><div class="cu-name">' + U.escape(t.name) + '</div>' +
        '<div class="cu-sub">' + U.escape(t.specialization || "") + '</div></div></div>';
    },
    kpi: function (iconName, color, label, value, sub, delta) {
      return '<div class="kpi-card"><div class="kpi-top"><div class="kpi-label">' + U.escape(label) + '</div>' +
        '<div class="kpi-icon ' + (color || "c1") + '">' + U.icon(iconName, 21) + '</div></div>' +
        '<div class="kpi-value">' + value + '</div>' +
        (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') +
        (delta ? delta : '') + '</div>';
    },
    emptyState: "empty",
    head: function (id, container) {
      /* nothing */
    }
  };
  window.VUI = VUI;

  /* ---------- tiny table refill helper (used to re-render a tbody) ---------- */
  function wireTableAction(container, sel, cb) {
    var els = container.querySelectorAll(sel);
    els.forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        cb(el);
      });
    });
  }

  /* ============================================================
     DASHBOARD
     ============================================================ */
  V.register({
    id: "dash",
    label: "Dashboard",
    icon: "dashboard",
    group: "Overview",
    render: function (container) {
      var u = Auth.current();
      var today = DB.todayISO();
      var members = DB.all("members");
      var payments = DB.all("payments");
      var paidToday = payments.filter(function (p) { return p.status === "paid" && p.date === today; })
        .reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
      var attToday = DB.all("attendance").filter(function (a) { return a.date === today && !a.checkOut; }).length;
      var attAll = DB.all("attendance").filter(function (a) { return a.date === today; }).length;
      var revenue = DB.revenueByMonth(6);
      var revenueTotal = revenue.reduce(function (s, m) { return s + m.total; }, 0);
      var expensesM = DB.expensesByMonth(1)[0];
      var pending = DB.pendingAmount();
      var active = DB.activeCount();

      var expiringSoon = members
        .filter(function (m) { return DB.memberStatus(m) === "expiring"; })
        .slice(0, 5);

      var alerts = DB.deriveAlerts().slice(0, 6);

      var html = VUI.ph("Dashboard", "Welcome back, " + U.escape(u.name) + ". Here's what's happening at " + U.escape(DB.settings().gymName) + " today.", "");

      html += '<div class="kpi-row">' +
        VUI.kpi("users", "c1", "Total Members", members.length, active + " active", '<span class="kpi-delta up">' + (active + " active") + "</span>") +
        VUI.kpi("users", "c2", "Expiring / Expired", expiringSoon.length + " expiring", "renewals due") +
        VUI.kpi("dollar", "c3", "Revenue (6 mo)", U.fmtMoney(revenueTotal), U.fmtMoney(paidToday) + " today", '<span class="kpi-delta up">This month: ' + U.fmtMoney(revenue[revenue.length - 1].total) + "</span>") +
        VUI.kpi("receipt", "c5", "Expenses (mo)", U.fmtMoney(expensesM ? expensesM.total : 0), "pending: " + U.fmtMoney(pending), '<span class="kpi-delta flat">Net: ' + U.fmtMoney((revenue[revenue.length - 1].total || 0) - (expensesM ? expensesM.total : 0)) + "</span>") +
        '</div>';

      html += '<div class="kpi-row">' +
        VUI.kpi("scan", "c4", "Check-ins Today", attAll, attToday + " currently in gym") +
        VUI.kpi("dollar", "c6", "Pending Payments", U.fmtMoney(pending), payments.filter(function (p) { return p.status !== "paid"; }).length + " unpaid invoices") +
        '</div>';

      html += '<div class="grid grid-2">';
      /* revenue chart */
      html += '<div class="card"><div class="card-title">' + U.icon("trend", 18) + 'Revenue — last 6 months</div><div class="chart-box"><canvas class="chart" id="dash-rev"></canvas></div></div>';
      /* attendance */
      html += '<div class="card"><div class="card-title">' + U.icon("activity", 18) + 'Attendance — last 14 days</div><div class="chart-box"><canvas class="chart" id="dash-att"></canvas></div></div>';
      html += '</div>';

      html += '<div class="grid grid-2" style="margin-top:16px">';
      /* expiring */
      html += '<div class="card"><div class="card-title">' + U.icon("alert", 18) + 'Renewals Due Soon</div>';
      if (!expiringSoon.length) html += VUI.empty("check", "All good", "No memberships expiring in the next " + DB.settings().expiryAlertDays + " days.");
      else {
        html += '<div>' + expiringSoon.map(function (m) {
          return '<div class="list-item"><div>' + VUI.memberCell(m) + '</div><div>' + U.escape(m.planExpiry) + ' (' + U.humanDays(m.planExpiry) + ')</div><button class="btn btn-ok btn-sm" data-renew="' + m.id + '">' + U.icon("refresh", 14) + 'Renew</button></div>';
        }).join('') + '</div>';
      }
      html += '</div>';

      /* alerts */
      html += '<div class="card"><div class="card-title">' + U.icon("bell", 18) + 'Alerts & Notifications</div>';
      if (!alerts.length) html += VUI.empty("check", "No alerts", "Everything is running smoothly.");
      else {
        html += '<div>' + alerts.map(function (a) {
          var cls = a.sev === "danger" ? "danger" : a.sev === "warn" ? "warn" : "info";
          var ic = a.sev === "danger" ? "alert" : a.sev === "warn" ? "alert" : "info";
          return '<div class="list-item"><div class="badge ' + cls + '" style="width:78px;justify-content:center">' + U.icon(ic, 12) + (cls === "danger" ? "Urgent" : cls === "warn" ? "Action" : "Info") + '</div><div class="li-main"><div class="li-sub">' + U.escape(a.text) + '</div></div></div>';
        }).join('') + '</div>';
      }
      html += '</div>';
      html += '</div>';

      container.innerHTML = html;

      requestAnimationFrame(function () {
        Charts.line(document.getElementById("dash-rev"), {
          labels: revenue.map(function (m) { return m.label; }),
          values: revenue.map(function (m) { return m.total; })
        });
        Charts.bar(document.getElementById("dash-att"), {
          labels: DB.groupedAttendance(14).map(function (d) { return d.label; }),
          values: DB.groupedAttendance(14).map(function (d) { return d.count; })
        });
      });

      wireTableAction(container, "[data-renew]", function (btn) {
        openMemberModal(btn.getAttribute("data-renew"), "membership");
      });
    }
  });

  /* ============================================================
     MEMBERS
     ============================================================ */
  var membersState = { page: 1, per: 10, q: "", status: "all", plan: "all" };

  V.register({
    id: "members",
    label: "Members",
    icon: "users",
    group: "Management",
    render: function (container) {
      var canManage = VUI.can(["admin", "manager", "reception"]);
      var plans = DB.all("plans");
      var filters = '<div class="filters">' +
        '<select data-f="status"><option value="all">All statuses</option><option value="active">Active</option><option value="expiring">Expiring</option><option value="expired">Expired</option><option value="frozen">Frozen</option><option value="pending">No plan</option></select>' +
        '<select data-f="plan"><option value="all">All plans</option>' + plans.map(function (p) { return '<option value="' + p.id + '">' + U.escape(p.name) + '</option>'; }).join("") + '</select>' +
        '</div>';

      var toolbar = '<div class="toolbar"><div class="search-box">' +
        U.icon("search", 17) +
        '<input id="m-search" type="text" placeholder="Search name, email or ID…" value="' + U.escape(membersState.q) + '" /></div>' +
        filters +
        '<div class="toolbar-spacer"></div>' +
        (canManage ? VUI.btn("Add Member", "plus", "btn-primary", 'id="m-add"') : '') +
        '</div>';

      var html = VUI.ph("Members", "All gym members and their membership status") + toolbar +
        '<div class="table-wrap"><table class="data-table" id="m-table"><thead><tr>' +
        '<th>Member</th><th>Plan</th><th>Status</th><th>Trainer</th><th>Joined</th><th>Expiry</th><th style="width:120px"></th>' +
        '</tr></thead><tbody id="m-body"></tbody></table></div><div id="m-pager"></div>';

      container.innerHTML = html;

      var search = container.querySelector("#m-search");
      search.addEventListener("input", function () { membersState.q = search.value.trim().toLowerCase(); membersState.page = 1; drawMembers(container); });
      container.querySelectorAll("[data-f]").forEach(function (sel) {
        sel.addEventListener("change", function () { membersState[sel.getAttribute("data-f")] = sel.value; membersState.page = 1; drawMembers(container); });
      });
      if (canManage) container.querySelector("#m-add").addEventListener("click", function () { openMemberEdit(null); });

      drawMembers(container);
    }
  });

  function drawMembers(container) {
    var list = DB.all("members");
    if (membersState.q) {
      list = list.filter(function (m) {
        return (m.name || "").toLowerCase().indexOf(membersState.q) >= 0 ||
          (m.email || "").toLowerCase().indexOf(membersState.q) >= 0 ||
          (m.code || "").toLowerCase().indexOf(membersState.q) >= 0 ||
          (m.phone || "").indexOf(membersState.q) >= 0;
      });
    }
    if (membersState.status !== "all") list = list.filter(function (m) { return DB.memberStatus(m) === membersState.status; });
    if (membersState.plan !== "all") list = list.filter(function (m) { return m.planId === membersState.plan; });

    list.sort(function (a, b) { return (b.joinDate || "").localeCompare(a.joinDate || ""); });

    var pages = Math.max(1, Math.ceil(list.length / membersState.per));
    if (membersState.page > pages) membersState.page = pages;
    var page = list.slice((membersState.page - 1) * membersState.per, membersState.page * membersState.per);

    var body = container.querySelector("#m-body");
    var pager = container.querySelector("#m-pager");

    if (!page.length) {
      body.innerHTML = '<tr><td colspan="7">' + VUI.empty("users", "No members found", "Try adjusting your search or filters.") + "</td></tr>";
      pager.innerHTML = "";
      return;
    }

    body.innerHTML = page.map(function (m) {
      var plan = DB.planById(m.planId);
      return '<tr class="row-click" data-open="' + m.id + '">' +
        '<td>' + VUI.memberCell(m) + '</td>' +
        '<td>' + (plan ? '<span class="badge violet">' + U.escape(plan.name) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td>' + VUI.badge(m) + '</td>' +
        '<td>' + VUI.trainerCell(DB.trainerOf(m.trainerId)) + '</td>' +
        '<td>' + U.fmtDate(m.joinDate) + '</td>' +
        '<td>' + (m.planExpiry ? U.fmtDate(m.planExpiry) : '<span class="muted">—</span>') + '</td>' +
        '<td><div class="tbl-actions">' +
        '<button class="icon-btn info" data-view="' + m.id + '" title="Open">' + U.icon("eye", 15) + '</button>' +
        (VUI.can(["admin", "manager", "reception"]) ? '<button class="icon-btn" data-edit="' + m.id + '" title="Edit">' + U.icon("edit", 15) + '</button>' : '') +
        (VUI.can(["admin", "manager"]) ? '<button class="icon-btn danger" data-del="' + m.id + '" title="Delete">' + U.icon("trash", 15) + '</button>' : '') +
        '</div></td></tr>';
    }).join('');

    pager.innerHTML = U.pagerHtml(membersState.page, pages);
    U.bindPager(pager, function (p) { membersState.page = p; drawMembers(container); });

    wireTableAction(body, "[data-view]", function (b) { openMemberModal(b.getAttribute("data-view"), "overview"); });
    wireTableAction(body, "[data-edit]", function (b) { openMemberEdit(b.getAttribute("data-edit")); });
    wireTableAction(body, "[data-del]", function (b) {
      U.confirmDialog({ title: "Delete member", message: "Delete this member and all their records? This cannot be undone.", danger: true, okLabel: "Delete" }).then(function (ok) {
        if (!ok) return;
        var id = b.getAttribute("data-del");
        DB.remove("members", id);
        DB.removeWhere("payments", function (p) { return p.memberId === id; });
        DB.removeWhere("attendance", function (p) { return p.memberId === id; });
        DB.removeWhere("progress", function (p) { return p.memberId === id; });
        DB.removeWhere("workouts", function (p) { return p.memberId === id; });
        DB.removeWhere("diets", function (p) { return p.memberId === id; });
        DB.removeWhere("bookings", function (p) { return p.memberId === id; });
        Auth.log(Auth.current(), "Member", "Deleted member record", "danger");
        U.toast("Member deleted", "ok");
        drawMembers(container);
      });
    });
    body.querySelectorAll("tr.row-click").forEach(function (tr) {
      tr.addEventListener("click", function () {
        var id = tr.getAttribute("data-open");
        if (id) openMemberModal(id, "overview");
      });
    });
  }

  /* ---------- member add / edit form ---------- */
  function openMemberEdit(id) {
    var existing = id ? DB.find("members", function (m) { return m.id === id; }) : null;
    var plans = DB.all("plans");
    var trainers = DB.all("trainers");
    var assign = id ? "" : '<div class="section-label" style="margin-top:18px">Membership (optional)</div><div class="form-grid">' +
      '<div class="field"><label>Assign plan</label><select id="mm-plan"><option value="">— no plan —</option>' + plans.map(function (p) { return '<option value="' + p.id + '">' + U.escape(p.name) + " (" + U.fmtMoney(p.price) + ")</option>"; }).join("") + '</select></div>' +
      '<div class="field"><label>Start date</label><input type="date" id="mm-start" value="' + DB.todayISO() + '" /></div></div>';

    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Full name</label><input id="m-name" value="' + U.escape(existing ? existing.name : "") + '" required /></div>' +
      '<div class="field"><label>Email</label><input id="m-email" type="email" value="' + U.escape(existing ? existing.email || "" : "") + '" /></div>' +
      '<div class="field"><label>Phone</label><input id="m-phone" value="' + U.escape(existing ? existing.phone || "" : "") + '" /></div>' +
      '<div class="field"><label>Gender</label><select id="m-gender"><option>Male</option><option>Female</option><option>Other</option></select></div>' +
      '<div class="field"><label>Date of birth</label><input type="date" id="m-dob" value="' + U.escape(existing ? existing.dob || "" : "") + '" /></div>' +
      '<div class="field"><label>Blood group</label><select id="m-blood"><option value="">—</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select></div>' +
      '<div class="field"><label>Emergency contact</label><input id="m-emergency" value="' + U.escape(existing ? existing.emergencyContact || "" : "") + '" /></div>' +
      '<div class="field"><label>Trainer</label><select id="m-trainer"><option value="">— none —</option>' + trainers.map(function (t) { return '<option value="' + t.id + '"' + (existing && existing.trainerId === t.id ? " selected" : "") + '>' + U.escape(t.name) + "</option>"; }).join("") + '</select></div>' +
      '<div class="field"><label>Address</label><input id="m-address" value="' + U.escape(existing ? existing.address || "" : "") + '" /></div>' +
      '<div class="field field-range"><label>Medical notes</label><input id="m-medical" value="' + U.escape(existing ? existing.medicalNotes || "" : "") + '" placeholder="Allergies, conditions…" /></div>' +
      '</div>' + assign;

    var close = U.modal({
      title: id ? "Edit Member" : "Add Member",
      body: body,
      wide: true,
      foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save Member</button>'
    });

    var genderSel = containerOf(close, "#m-gender");
    if (existing && existing.gender) genderSel.value = existing.gender;
    var bloodSel = containerOf(close, "#m-blood");
    if (existing && existing.bloodGroup) bloodSel.value = existing.bloodGroup;

    var saveBtn = containerOf(close, "[data-save]");
    saveBtn.addEventListener("click", function () {
      var name = containerOf(close, "#m-name").value.trim();
      if (!name) { U.toast("Name is required", "err"); return; }
      var patch = {
        name: name,
        email: containerOf(close, "#m-email").value.trim(),
        phone: containerOf(close, "#m-phone").value.trim(),
        gender: genderSel.value,
        dob: containerOf(close, "#m-dob").value,
        bloodGroup: bloodSel.value,
        emergencyContact: containerOf(close, "#m-emergency").value.trim(),
        trainerId: containerOf(close, "#m-trainer").value,
        address: containerOf(close, "#m-address").value.trim(),
        medicalNotes: containerOf(close, "#m-medical").value.trim()
      };
      if (id) {
        DB.update("members", id, patch);
        Auth.log(Auth.current(), "Member", "Updated " + name, "info");
        U.toast("Member updated", "ok");
      } else {
        var rec = DB.insert("members", Object.assign({ code: DB.nextCode("M", "members"), joinDate: DB.todayISO(), planId: null, planStart: null, planExpiry: null, planStatus: "active", trainerId: patch.trainerId }, patch));
        Auth.log(Auth.current(), "Member", "Added " + name + " (" + rec.code + ")", "success");
        /* optional membership assignment */
        var planSel = containerOf(close, "#mm-plan");
        if (planSel && planSel.value) {
          var plan = DB.planById(planSel.value);
          var start = containerOf(close, "#mm-start").value || DB.todayISO();
          var expiry = DB.addDaysISO(start, plan.durationDays);
          DB.update("members", rec.id, { planId: plan.id, planStart: start, planExpiry: expiry });
          DB.insert("payments", {
            invoiceNo: DB.nextInvoice("INV"), memberId: rec.id, type: "membership",
            amount: plan.price, paid: plan.price, method: "cash", date: start, status: "paid", notes: plan.name
          });
          U.toast("Membership " + plan.name + " assigned", "ok");
        }
        U.toast("Member added", "ok");
      }
      close();
      refreshCurrentView();
    });
  }

  function containerOf(close, sel) {
    var root = document.querySelector(".modal-backdrop .modal");
    return root ? root.querySelector(sel) : null;
  }

  function refreshCurrentView() {
    var hash = location.hash.replace(/^#\/?/, "").split("/")[0];
    var v = V.get(hash);
    if (v) v.render(document.getElementById("view-root"));
  }

  /* ---------- member profile modal ---------- */
  function openMemberModal(id, tab) {
    var m = DB.find("members", function (x) { return x.id === id; });
    if (!m) { U.toast("Member not found", "err"); return; }
    var plan = DB.planById(m.planId);
    var tabs = [
      ["overview", "Overview", "eye"],
      ["membership", "Membership", "card"],
      ["payments", "Payments", "dollar"],
      ["attendance", "Attendance", "scan"],
      ["progress", "Progress", "trend"]
    ];
    var act = tab || "overview";

    var canManage = VUI.can(["admin", "manager", "reception"]);
    var canPay = VUI.can(["admin", "manager", "reception", "accountant"]);

    var headTabs = '<div class="tabs">' + tabs.map(function (t) {
      return '<div class="tab' + (t[0] === act ? " active" : "") + '" data-tab="' + t[0] + '">' + U.icon(t[2], 13) + " " + t[1] + "</div>";
    }).join("") + '</div>';

    var bodyEl = document.createElement("div");

    var close = U.modal({
      title: "Member Profile",
      body: bodyEl,
      wide: true,
      noBackdropClose: true
    });

    function renderTab(tabName) {
      var inner = "";
      if (tabName === "overview") {
        var st = DB.statusBadgeInfo(DB.memberStatus(m));
        inner = '<div class="form-grid" style="margin-bottom:16px">' +
          '<div><div class="small muted">Member</div><div style="font-size:17px;font-weight:700">' + U.escape(m.name) + '</div><div class="mono small muted">' + U.escape(m.code || "") + '</div></div>' +
          '<div><div class="small muted">Membership</div><div>' + (plan ? '<span class="badge violet">' + U.escape(plan.name) + '</span>' : '<span class="badge gray">No plan</span>') + '</div></div>' +
          '<div><div class="small muted">Status</div><div><span class="badge ' + st.cls + '"><span class="b-dot"></span>' + st.label + '</span></div></div>' +
          '<div><div class="small muted">Paid total</div><div style="font-weight:700">' + U.fmtMoney(DB.memberPaid(m.id)) + '</div></div>' +
          '</div>';
        if (plan) {
          inner += '<div class="card" style="padding:14px"><div class="row"><div class="grow"><div class="small muted">Valid from</div><b>' + U.fmtDate(m.planStart) + '</b></div>' +
            '<div class="grow"><div class="small muted">Expires</div><b>' + U.fmtDate(m.planExpiry) + '</b></div>' +
            '<div class="grow"><div class="small muted">Remaining</div><b>' + (DB.memberStatus(m) === "pending" ? "—" : U.humanDays(m.planExpiry)) + '</b></div>' +
            '<div class="grow"><div class="small muted">Days total</div><b>' + plan.durationDays + ' days</b></div></div></div>';
        }
        inner += '<div class="form-grid" style="margin-top:16px">' +
          '<div class="small muted">Email — <b>' + U.escape(m.email || "—") + '</b></div>' +
          '<div class="small muted">Phone — <b>' + U.escape(m.phone || "—") + '</b></div>' +
          '<div class="small muted">Gender — <b>' + U.escape(m.gender || "—") + '</b></div>' +
          '<div class="small muted">Blood — <b>' + U.escape(m.bloodGroup || "—") + '</b></div>' +
          '<div class="small muted">Joined — <b>' + U.fmtDate(m.joinDate) + '</b></div>' +
          '<div class="small muted">Emergency — <b>' + U.escape(m.emergencyContact || "—") + '</b></div>' +
          '</div>';
      } else if (tabName === "membership") {
        inner = '<div class="section-label">Current membership</div>';
        if (plan) {
          inner += '<div class="card" style="padding:14px">' +
            '<div class="row"><div class="grow"><b>' + U.escape(plan.name) + '</b><div class="small muted">' + U.escape(plan.features || "") + '</div></div>' +
            '<div>' + U.fmtMoney(plan.price) + '</div></div>' +
            '<div class="row" style="margin-top:12px">' +
            '<div class="grow small muted">Start — ' + U.fmtDate(m.planStart) + '</div>' +
            '<div class="grow small muted">Expiry — ' + U.fmtDate(m.planExpiry) + '</div></div></div>';
        } else inner += VUI.empty("card", "No membership plan", "Assign a plan to this member.");
        inner += '<div class="section-label" style="margin-top:18px">Assign / change plan</div><div class="form-grid">' +
          '<div class="field"><label>Plan</label><select id="mm-new-plan"><option value="">— choose plan —</option>' + DB.all("plans").map(function (p) { return '<option value="' + p.id + '">' + U.escape(p.name) + " — " + U.fmtMoney(p.price) + "</option>"; }).join("") + '</select></div>' +
          '<div class="field"><label>Start date</label><input type="date" id="mm-new-start" value="' + DB.todayISO() + '" /></div>' +
          '<div class="field"><label>Action</label><select id="mm-new-mode"><option value="new">Assign new</option><option value="renew">Renew from expiry</option><option value="upgrade">Upgrade / change</option></select></div></div>';
        if (canManage) inner += '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">' +
          '<button class="btn btn-primary btn-sm" id="mm-apply">' + U.icon("check", 14) + 'Apply</button>' +
          (m.planStatus === "frozen" ? '<button class="btn btn-ok btn-sm" id="mm-unfreeze">' + U.icon("refresh", 14) + 'Unfreeze</button>' : '<button class="btn btn-ghost btn-sm" id="mm-freeze">' + U.icon("lock", 14) + 'Freeze</button>') +
          (m.planId ? '<button class="btn btn-danger btn-sm" id="mm-cancel">' + U.icon("trash", 14) + 'Cancel plan</button>' : '') +
          '</div>';
      } else if (tabName === "payments") {
        var pays = DB.all("payments").filter(function (p) { return p.memberId === m.id; }).sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
        inner = '<div class="section-label">Payment history — total paid ' + U.fmtMoney(DB.memberPaid(m.id)) + '</div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Invoice</th><th>Type</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
          (pays.length ? pays.map(function (p) {
            return '<tr><td class="mono">' + U.escape(p.invoiceNo) + '</td><td>' + U.escape(p.type || "-") + '</td><td>' + U.fmtMoney(p.amount) + '</td><td>' + U.escape(p.method || "-") + '</td><td>' + (p.status === "paid" ? '<span class="badge ok"><span class="b-dot"></span>Paid</span>' : '<span class="badge warn"><span class="b-dot"></span>Pending</span>') + '</td><td>' + U.fmtDate(p.date) + '</td></tr>';
          }).join("") : '<tr><td colspan="6">' + VUI.empty("receipt", "No payments yet") + '</td></tr>') +
          '</tbody></table></div>';
        if (canPay) inner += '<div style="margin-top:12px"><button class="btn btn-primary btn-sm" id="mp-record">' + U.icon("dollar", 14) + 'Record Payment</button></div>';
      } else if (tabName === "attendance") {
        var atts = DB.all("attendance").filter(function (a) { return a.memberId === m.id; }).sort(function (a, b) { return (b.date + " " + b.checkIn).localeCompare(a.date + " " + a.checkIn); }).slice(0, 15);
        inner = '<div class="section-label">Recent check-ins</div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Source</th></tr></thead><tbody>' +
          (atts.length ? atts.map(function (a) {
            return '<tr><td>' + U.fmtDate(a.date) + '</td><td>' + U.escape(a.checkIn) + '</td><td>' + U.escape(a.checkOut || "—") + '</td><td>' + U.escape(a.source || "frontdesk") + '</td></tr>';
          }).join("") : '<tr><td colspan="4">' + VUI.empty("scan", "No check-ins yet") + '</td></tr>') +
          '</tbody></table></div>';
      } else if (tabName === "progress") {
        var logs = DB.all("progress").filter(function (p) { return p.memberId === m.id; }).sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
        inner = '<div class="section-label">Body progress</div>' +
          '<div class="chart-box sm"><canvas class="chart" id="mp-chart"></canvas></div>' +
          '<div class="table-wrap" style="margin-top:12px"><table class="data-table"><thead><tr><th>Date</th><th>Weight</th><th>Height</th><th>BMI</th><th>Body fat</th><th>Chest</th><th>Waist</th></tr></thead><tbody>' +
          (logs.length ? logs.slice().reverse().map(function (p) {
            return '<tr><td>' + U.fmtDate(p.date) + '</td><td>' + (p.weight || "—") + ' kg</td><td>' + (p.height || "—") + ' cm</td><td>' + (p.bmi || "—") + '</td><td>' + (p.bodyFat || "—") + '%</td><td>' + (p.chest || "—") + ' cm</td><td>' + (p.waist || "—") + ' cm</td></tr>';
          }).join("") : '<tr><td colspan="7">' + VUI.empty("trend", "No progress logs") + '</td></tr>') +
          '</tbody></table></div>';
        if (VUI.can(["admin", "manager", "trainer"])) inner += '<div style="margin-top:12px"><button class="btn btn-primary btn-sm" id="mp-add">' + U.icon("plus", 14) + 'Add Measurement</button></div>';
        requestAnimationFrame(function () {
          Charts.line(document.getElementById("mp-chart"), {
            labels: logs.map(function (p) { return p.date.slice(5); }),
            values: logs.map(function (p) { return p.weight || 0; })
          });
        });
      }

      bodyEl.innerHTML = headTabs + inner;

      /* tab clicks */
      bodyEl.querySelectorAll("[data-tab]").forEach(function (t) {
        t.addEventListener("click", function () { renderTab(t.getAttribute("data-tab")); });
      });

      /* membership actions */
      var applyBtn = bodyEl.querySelector("#mm-apply");
      if (applyBtn) applyBtn.addEventListener("click", function () {
        var pid = bodyEl.querySelector("#mm-new-plan").value;
        var start = bodyEl.querySelector("#mm-new-start").value || DB.todayISO();
        var mode = bodyEl.querySelector("#mm-new-mode").value;
        if (!pid) { U.toast("Choose a plan", "err"); return; }
        var plan = DB.planById(pid);
        var expiry;
        if (mode === "renew" && m.planExpiry && m.planExpiry > DB.todayISO()) expiry = DB.addDaysISO(m.planExpiry, plan.durationDays);
        else if (mode === "upgrade" && m.planStart) { start = m.planStart; expiry = m.planExpiry; }
        else expiry = DB.addDaysISO(start, plan.durationDays);
        DB.update("members", m.id, { planId: plan.id, planStart: start, planExpiry: expiry, planStatus: "active" });
        DB.insert("payments", {
          invoiceNo: DB.nextInvoice("INV"), memberId: m.id, type: "membership",
          amount: plan.price, paid: 0, method: "", date: DB.todayISO(), status: "pending", notes: plan.name + " (record payment to activate)"
        });
        Auth.log(Auth.current(), "Membership", mode + " for " + m.name + " → " + plan.name, "info");
        U.toast("Plan " + mode + " applied", "ok");
        renderTab("membership");
      });
      var freezeBtn = bodyEl.querySelector("#mm-freeze");
      if (freezeBtn) freezeBtn.addEventListener("click", function () {
        DB.update("members", m.id, { planStatus: "frozen" });
        Auth.log(Auth.current(), "Membership", "Froze " + m.name, "warn");
        U.toast("Membership frozen", "info");
        renderTab("membership");
      });
      var unfreezeBtn = bodyEl.querySelector("#mm-unfreeze");
      if (unfreezeBtn) unfreezeBtn.addEventListener("click", function () {
        DB.update("members", m.id, { planStatus: "active" });
        U.toast("Membership unfrozen", "ok");
        renderTab("membership");
      });
      var cancelBtn = bodyEl.querySelector("#mm-cancel");
      if (cancelBtn) cancelBtn.addEventListener("click", function () {
        U.confirmDialog({ title: "Cancel plan", message: "Remove membership from " + m.name + "?", danger: true, okLabel: "Cancel plan" }).then(function (ok) {
          if (!ok) return;
          DB.update("members", m.id, { planId: null, planStart: null, planExpiry: null, planStatus: "active" });
          Auth.log(Auth.current(), "Membership", "Cancelled plan for " + m.name, "warn");
          U.toast("Plan removed", "ok");
          renderTab("membership");
        });
      });

      /* record payment */
      var recBtn = bodyEl.querySelector("#mp-record");
      if (recBtn) recBtn.addEventListener("click", function () { openRecordPaymentModal(m.id); });

      /* add progress */
      var addP = bodyEl.querySelector("#mp-add");
      if (addP) addP.addEventListener("click", function () { openProgressModal(m.id); });
    }

    renderTab(act);
  }

  /* ============================================================
     PLANS / MEMBERSHIPS
     ============================================================ */
  var plansState = { page: 1 };
  V.register({
    id: "plans",
    label: "Memberships",
    icon: "card",
    group: "Management",
    render: function (container) {
      var canManage = VUI.can(["admin", "manager"]);
      var today = DB.todayISO();
      var expSoon = DB.all("members").filter(function (m) { return DB.memberStatus(m) === "expiring"; });
      var expired = DB.all("members").filter(function (m) { return DB.memberStatus(m) === "expired"; });

      var html = VUI.ph("Membership Plans", "Plans, pricing, and renewal tracking") +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("New Plan", "plus", "btn-primary", 'id="plan-add"') + '</div>' : '');

      /* plans table */
      var plans = DB.all("plans");
      html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Plan</th><th>Type</th><th>Duration</th><th>Price</th><th>Features</th><th>Members</th><th style="width:90px"></th></tr></thead><tbody>';
      if (!plans.length) {
        html += '<tr><td colspan="7">' + VUI.empty("card", "No plans yet", "Create your first membership plan.") + '</td></tr>';
      } else {
        plans.forEach(function (p) {
          var cnt = DB.all("members").filter(function (m) { return m.planId === p.id; }).length;
          html += '<tr><td><div class="cell-user"><span class="avatar" style="background:linear-gradient(135deg,' + p.color + ',' + p.color + '88)">' + U.initials(p.name) + '</span><div><div class="cu-name">' + U.escape(p.name) + '</div></div></div></td>' +
            '<td>' + U.escape(p.type || "Custom") + '</td>' +
            '<td>' + p.durationDays + ' days</td>' +
            '<td style="font-weight:700">' + U.fmtMoney(p.price) + '</td>' +
            '<td class="small muted">' + U.escape(p.features || "") + '</td>' +
            '<td>' + cnt + '</td>' +
            '<td><div class="tbl-actions">' +
            (canManage ? '<button class="icon-btn" data-edit="' + p.id + '" title="Edit">' + U.icon("edit", 15) + '</button><button class="icon-btn danger" data-del="' + p.id + '" title="Delete">' + U.icon("trash", 15) + '</button>' : '') +
            '</div></td></tr>';
        });
      }
      html += '</tbody></table></div>';

      /* renewal queue */
      html += '<div style="height:16px"></div><div class="grid grid-2">';
      html += '<div class="card"><div class="card-title">' + U.icon("alert", 18) + 'Expiring within ' + DB.settings().expiryAlertDays + ' days (' + expSoon.length + ')</div>';
      if (!expSoon.length) html += VUI.empty("check", "Nothing expiring", "No memberships expiring soon.");
      else html += '<div>' + expSoon.map(function (m) {
        return '<div class="list-item">' + VUI.memberCell(m) + '<div><small class="muted">expires ' + U.fmtDate(m.planExpiry) + '</small></div>' +
          '<button class="btn btn-ok btn-sm" data-renew="' + m.id + '">' + U.icon("refresh", 14) + 'Renew</button></div>';
      }).join("") + '</div>';
      html += '</div>';

      html += '<div class="card"><div class="card-title">' + U.icon("alert", 18) + 'Expired memberships (' + expired.length + ')</div>';
      if (!expired.length) html += VUI.empty("check", "None expired", "Great — no expired memberships.");
      else html += '<div>' + expired.slice(0, 8).map(function (m) {
        return '<div class="list-item">' + VUI.memberCell(m) + '<div><small class="muted">expired ' + U.fmtDate(m.planExpiry) + '</small></div>' +
          '<button class="btn btn-ghost btn-sm" data-renew="' + m.id + '">' + U.icon("refresh", 14) + 'Reactivate</button></div>';
      }).join("") + '</div>';
      html += '</div>';
      html += '</div>';

      container.innerHTML = html;

      if (canManage) container.querySelector("#plan-add").addEventListener("click", function () { openPlanModal(null); });
      wireTableAction(container, "[data-edit]", function (b) { openPlanModal(b.getAttribute("data-edit")); });
      wireTableAction(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete plan", message: "Delete this plan?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("plans", b.getAttribute("data-del"));
          U.toast("Plan deleted", "ok");
          V.get("plans").render(container);
        });
      });
      wireTableAction(container, "[data-renew]", function (b) { openMemberModal(b.getAttribute("data-renew"), "membership"); });
    }
  });

  function openPlanModal(id) {
    var p = id ? DB.planById(id) : null;
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Plan name</label><input id="pl-name" value="' + U.escape(p ? p.name : "") + '" /></div>' +
      '<div class="field"><label>Type</label><select id="pl-type"><option>Monthly</option><option>3-Month</option><option>6-Month</option><option>Yearly</option><option>Custom</option></select></div>' +
      '<div class="field"><label class="req">Duration (days)</label><input id="pl-days" type="number" min="1" value="' + (p ? p.durationDays : 30) + '" /></div>' +
      '<div class="field"><label class="req">Price</label><input id="pl-price" type="number" step="0.01" min="0" value="' + (p ? p.price : 50) + '" /></div>' +
      '<div class="field"><label>Accent color</label><input id="pl-color" type="color" value="' + (p ? p.color : "#22d3ee") + '" /></div>' +
      '<div class="field field-range"><label>Features (comma separated)</label><input id="pl-features" value="' + U.escape(p ? p.features || "" : "") + '" /></div>' +
      '</div>';
    var close = U.modal({
      title: p ? "Edit Plan" : "New Plan", body: body, wide: true,
      foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>'
    });
    if (p) {
      var t = containerOf(close, "#pl-type");
      t.value = p.type || "Custom";
    }
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var name = containerOf(close, "#pl-name").value.trim();
      var days = +containerOf(close, "#pl-days").value;
      var price = +containerOf(close, "#pl-price").value;
      if (!name || !days || days < 1) { U.toast("Name and valid duration required", "err"); return; }
      var data = {
        name: name, type: containerOf(close, "#pl-type").value,
        durationDays: days, price: price,
        color: containerOf(close, "#pl-color").value,
        features: containerOf(close, "#pl-features").value.trim()
      };
      if (p) { DB.update("plans", p.id, data); U.toast("Plan updated", "ok"); }
      else { DB.insert("plans", data); U.toast("Plan created", "ok"); }
      Auth.log(Auth.current(), "Plan", (p ? "Edited " : "Created ") + name, "info");
      close();
      refreshCurrentView();
    });
  }

  /* ============================================================
     PAYMENTS
     ============================================================ */
  var payState = { page: 1, q: "", status: "all" };
  V.register({
    id: "payments",
    label: "Payments",
    icon: "dollar",
    group: "Finance",
    render: function (container) {
      var canPay = VUI.can(["admin", "manager", "reception", "accountant"]);
      var toolbar = '<div class="toolbar"><div class="search-box">' + U.icon("search", 17) +
        '<input id="p-search" type="text" placeholder="Search invoice, member…" value="' + U.escape(payState.q) + '" /></div>' +
        '<div class="filters"><select id="p-status"><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option></select></div>' +
        '<div class="toolbar-spacer"></div>' +
        (canPay ? VUI.btn("Record Payment", "dollar", "btn-primary", 'id="p-add"') : '') + '</div>';

      var html = VUI.ph("Payments & Invoices", "All money in — memberships, training, store") + toolbar +
        '<div class="table-wrap"><table class="data-table"><thead><tr>' +
        '<th>Invoice</th><th>Member</th><th>Type</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th style="width:150px"></th>' +
        '</tr></thead><tbody id="p-body"></tbody></table></div><div id="p-pager"></div>';

      container.innerHTML = html;

      container.querySelector("#p-search").addEventListener("input", function (e) {
        payState.q = e.target.value.trim().toLowerCase(); payState.page = 1; drawPayments(container);
      });
      container.querySelector("#p-status").addEventListener("change", function (e) {
        payState.status = e.target.value; payState.page = 1; drawPayments(container);
      });
      if (canPay) container.querySelector("#p-add").addEventListener("click", function () { openRecordPaymentModal(null); });

      drawPayments(container);
    }
  });

  function drawPayments(container) {
    var list = DB.all("payments");
    if (payState.q) {
      list = list.filter(function (p) {
        var m = DB.memberOf(p.memberId);
        return (p.invoiceNo || "").toLowerCase().indexOf(payState.q) >= 0 ||
          (m && (m.name.toLowerCase().indexOf(payState.q) >= 0 || m.code.toLowerCase().indexOf(payState.q) >= 0));
      });
    }
    if (payState.status !== "all") list = list.filter(function (p) { return p.status === payState.status; });
    list.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });

    var pages = Math.max(1, Math.ceil(list.length / 10));
    if (payState.page > pages) payState.page = pages;
    var page = list.slice((payState.page - 1) * 10, payState.page * 10);

    var body = container.querySelector("#p-body");
    var canPay = VUI.can(["admin", "manager", "reception", "accountant"]);
    if (!page.length) {
      body.innerHTML = '<tr><td colspan="8">' + VUI.empty("receipt", "No payments found") + "</td></tr>";
      container.querySelector("#p-pager").innerHTML = "";
      return;
    }
    body.innerHTML = page.map(function (p) {
      var m = DB.memberOf(p.memberId);
      return '<tr>' +
        '<td class="mono">' + U.escape(p.invoiceNo || "") + '</td>' +
        '<td>' + (m ? VUI.memberCell(m) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U.escape(p.type || "—") + '</td>' +
        '<td style="font-weight:700">' + U.fmtMoney(p.amount) + '</td>' +
        '<td>' + (p.method ? U.escape(p.method) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + (p.status === "paid" ? '<span class="badge ok"><span class="b-dot"></span>Paid</span>' : '<span class="badge warn"><span class="b-dot"></span>Pending</span>') + '</td>' +
        '<td>' + U.fmtDate(p.date) + '</td>' +
        '<td><div class="tbl-actions">' +
        '<button class="icon-btn info" data-receipt="' + p.id + '" title="Receipt">' + U.icon("print", 15) + '</button>' +
        (p.status !== "paid" && canPay ? '<button class="icon-btn ok" data-paid="' + p.id + '" title="Mark paid">' + U.icon("check", 15) + '</button>' : '') +
        (VUI.can(["admin", "manager"]) ? '<button class="icon-btn danger" data-del="' + p.id + '" title="Delete">' + U.icon("trash", 15) + '</button>' : '') +
        '</div></td></tr>';
    }).join('');

    container.querySelector("#p-pager").innerHTML = U.pagerHtml(payState.page, pages);
    U.bindPager(container.querySelector("#p-pager"), function (pg) { payState.page = pg; drawPayments(container); });

    wireTableAction(body, "[data-receipt]", function (b) { showReceipt(b.getAttribute("data-receipt")); });
    wireTableAction(body, "[data-paid]", function (b) {
      DB.update("payments", b.getAttribute("data-paid"), { status: "paid", paid: 1, date: DB.todayISO() });
      U.toast("Marked as paid", "ok");
      drawPayments(container);
    });
    wireTableAction(body, "[data-del]", function (b) {
      U.confirmDialog({ title: "Delete payment", message: "Delete this invoice?", danger: true, okLabel: "Delete" }).then(function (ok) {
        if (!ok) return;
        DB.remove("payments", b.getAttribute("data-del"));
        U.toast("Invoice deleted", "ok");
        drawPayments(container);
      });
    });
  }

  /* ---------- record payment modal ---------- */
  function openRecordPaymentModal(memberId) {
    var members = DB.all("members");
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Member</label><select id="rp-member">' +
      (memberId ? "" : '<option value="">— select member —</option>') +
      members.map(function (m) { return '<option value="' + m.id + '"' + (memberId && m.id === memberId ? " selected" : "") + '>' + U.escape(m.name) + " (" + U.escape(m.code) + ")</option>"; }).join("") +
      '</select></div>' +
      '<div class="field"><label>Type</label><select id="rp-type"><option>membership</option><option>registration</option><option>trainer</option><option>store</option><option>other</option></select></div>' +
      '<div class="field"><label class="req">Amount</label><input id="rp-amount" type="number" step="0.01" min="0" value="50" /></div>' +
      '<div class="field"><label>Method</label><select id="rp-method"><option>cash</option><option>card</option><option>bank</option><option>online</option></select></div>' +
      '<div class="field"><label>Status</label><select id="rp-status"><option value="paid">Paid</option><option value="pending">Pending</option></select></div>' +
      '<div class="field"><label>Date</label><input type="date" id="rp-date" value="' + DB.todayISO() + '" /></div>' +
      '<div class="field field-range"><label>Notes</label><input id="rp-notes" placeholder="e.g. Annual renewal" /></div>' +
      '</div>';

    var close = U.modal({
      title: "Record Payment", body: body, wide: true,
      foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>' + U.icon("check", 15) + 'Save Invoice</button>'
    });

    containerOf(close, "[data-save]").addEventListener("click", function () {
      var memberSel = containerOf(close, "#rp-member");
      if (!memberSel.value) { U.toast("Choose a member", "err"); return; }
      var amount = +containerOf(close, "#rp-amount").value;
      if (!amount || amount <= 0) { U.toast("Enter a valid amount", "err"); return; }
      var status = containerOf(close, "#rp-status").value;
      var rec = DB.insert("payments", {
        invoiceNo: DB.nextInvoice("INV"),
        memberId: memberSel.value,
        type: containerOf(close, "#rp-type").value,
        amount: amount,
        paid: status === "paid" ? 1 : 0,
        method: containerOf(close, "#rp-method").value,
        date: containerOf(close, "#rp-date").value || DB.todayISO(),
        status: status,
        notes: containerOf(close, "#rp-notes").value.trim()
      });
      var m = DB.memberOf(rec.memberId);
      Auth.log(Auth.current(), "Payment", rec.invoiceNo + " " + rec.type + " " + U.fmtMoney(amount) + (m ? " — " + m.name : ""), status === "paid" ? "info" : "warn");
      U.toast("Invoice " + rec.invoiceNo + " recorded", "ok");
      close();
      refreshCurrentView();
      showReceipt(rec.id);
    });
  }

  /* ---------- receipt ---------- */
  function showReceipt(payId) {
    var p = DB.find("payments", function (x) { return x.id === payId; });
    if (!p) { U.toast("Invoice not found", "err"); return; }
    var m = DB.memberOf(p.memberId);
    var s = DB.settings();
    var body = '<div class="receipt">' +
      '<div class="rc-head"><div class="rc-brand">' + U.escape(s.brand) + '</div>' +
      '<div class="rc-meta">' + U.escape(s.gymName) + '<br/>' + (m ? U.escape(m.name) + " &middot; " + U.escape(m.code || "") : "") + '<br/><span class="rc-no">' + U.escape(p.invoiceNo || "") + '</span></div></div>' +
      '<div class="rc-rows">' +
      '<div class="rc-row"><span class="rc-k">Date</span><span>' + U.fmtDate(p.date) + '</span></div>' +
      '<div class="rc-row"><span class="rc-k">Member</span><span>' + (m ? U.escape(m.name) : "—") + '</span></div>' +
      '<div class="rc-row"><span class="rc-k">Item</span><span>' + U.escape(p.type || "payment") + '</span></div>' +
      (p.notes ? '<div class="rc-row"><span class="rc-k">Notes</span><span>' + U.escape(p.notes) + '</span></div>' : '') +
      '<div class="rc-row"><span class="rc-k">Method</span><span>' + U.escape(p.method || "—") + '</span></div>' +
      (s.taxRate > 0 ? '<div class="rc-row"><span class="rc-k">Tax (' + s.taxRate + '%)</span><span>' + U.fmtMoney((+p.amount * s.taxRate) / 100) + '</span></div>' : '') +
      '<div class="rc-row"><span class="rc-k">Status</span><span>' + (p.status === "paid" ? "Paid" : "Pending") + '</span></div>' +
      '</div>' +
      '<div class="rc-total"><span>Total</span><span>' + U.fmtMoney(p.amount) + '</span></div>' +
      '<div class="rc-foot">' + U.escape(s.receiptFooter || "") + '</div></div>' +
      '<div class="print-actions"><button class="btn btn-primary" id="rc-print">' + U.icon("print", 15) + 'Print / Save PDF</button><button class="btn btn-ghost" data-close>Close</button></div>';

    var close = U.modal({ title: "Invoice / Receipt", body: body, wide: true });
    containerOf(close, "#rc-print").addEventListener("click", function () {
      U.printSheet(document.querySelector(".modal .receipt").outerHTML);
    });
  }

  /* export helpers used by reports too */
  window.__paymentsForExport = function () { return DB.all("payments"); };

  /* expose cross-file functions */
  window.openMemberModal = openMemberModal;
  window.openRecordPaymentModal = openRecordPaymentModal;
})();