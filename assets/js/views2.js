/* ============================================================
   APEX GYM — operations & admin views
   (attendance, trainers, workouts, diet, progress, equipment,
    expenses, store, classes, reports, activity, settings, profile)
   ============================================================ */
(function () {
  "use strict";

  var VUI = window.VUI;
  var U = window.U;
  var DB = window.DB;
  var Auth = window.Auth;

  function VUIcan(roles) { return VUI.can(roles); }

  /* ============================================================
     ATTENDANCE
     ============================================================ */
  var attState = { dateFrom: DB.addDaysISO(DB.todayISO(), -13), dateTo: DB.todayISO(), q: "" };
  V.register({
    id: "attendance",
    label: "Attendance",
    icon: "scan",
    group: "Operations",
    render: function (container) {
      var canCheck = VUIcan(["admin", "manager", "reception"]);
      var today = DB.todayISO();
      var todays = DB.all("attendance").filter(function (a) { return a.date === today; });
      var inNow = todays.filter(function (a) { return !a.checkOut; });

      var html = VUI.ph("Attendance", "Check-ins, check-outs and member tracking");

      if (canCheck) {
        html += '<div class="card" style="margin-bottom:18px;background:linear-gradient(135deg,rgba(34,211,238,0.08),rgba(167,139,250,0.08));">' +
          '<div class="card-title">' + U.icon("qr", 18) + 'Member Check-in / Check-out</div>' +
          '<div class="row" style="gap:10px;align-items:center">' +
          '<input id="att-code" class="" style="flex:1;height:42px;padding:0 14px;background:var(--bg-1);border:1px solid var(--border);border-radius:10px;color:var(--text-1);font-size:14px;outline:none" placeholder="Enter member code (e.g. M-001) or scan QR value, then Enter" />' +
          '<button class="btn btn-primary" id="att-in">' + U.icon("log-in", 16) + 'Check In</button>' +
          '<button class="btn btn-ghost" id="att-out">' + U.icon("logout", 16) + 'Check Out</button>' +
          '</div>' +
          '<div class="small muted" style="margin-top:8px">Tip: on the member card the QR encodes their code — paste any scanned value here.</div>' +
          '</div>';
      }

      html += '<div class="kpi-row">' +
        VUI.kpi("scan", "c1", "Check-ins Today", todays.length, U.fmtDate(today)) +
        VUI.kpi("activity", "c3", "In Gym Now", inNow.length, "checked in, not checked out") +
        VUI.kpi("users", "c2", "Last 7 Days", countLastNDays(7), "total check-ins") +
        VUI.kpi("trend", "c6", "Avg / Day (7d)", Math.round(countLastNDays(7) / 7), "rolling average") +
        '</div>';

      /* live board */
      html += '<div class="card" style="margin-bottom:18px"><div class="card-title">' + U.icon("flame", 18) + 'Who is in the gym right now</div>';
      if (!inNow.length) html += VUI.empty("scan", "Gym is empty", "No one checked in right now.");
      else {
        html += '<div class="wrap">' + inNow.map(function (a) {
          var m = DB.memberOf(a.memberId);
          return '<div style="padding:10px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface);display:flex;align-items:center;gap:10px"><span class="avatar">' + U.initials(m ? m.name : "?") + '</span><div><div style="font-weight:600">' + U.escape(m ? m.name : "—") + '</div><div class="small muted mono">' + U.escape(m ? m.code : "") + ' &middot; in since ' + a.checkIn + '</div></div></div>';
        }).join('') + '</div>';
      }
      html += '</div>';

      /* history */
      html += '<div class="card"><div class="card-title">' + U.icon("clock", 18) + 'Attendance History</div>' +
        '<div class="toolbar">' +
        '<div class="filters"><input type="date" id="att-from" value="' + attState.dateFrom + '" /><input type="date" id="att-to" value="' + attState.dateTo + '" /></div>' +
        '<div class="search-box">' + U.icon("search", 17) + '<input id="att-q" type="text" placeholder="Filter member…" value="' + U.escape(attState.q) + '" /></div>' +
        '<button class="btn btn-ghost btn-sm" id="att-export">' + U.icon("download", 14) + 'Export CSV</button>' +
        '</div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Member</th><th>Check-in</th><th>Check-out</th><th>Source</th></tr></thead><tbody id="att-body"></tbody></table></div>' +
        '<div class="chart-box sm" style="margin-top:18px"><canvas class="chart" id="att-chart"></canvas></div>' +
        '</div>';

      container.innerHTML = html;

      function resolveMember(val) {
        var v = String(val || "").trim();
        var code = v;
        var m = /APEX:([A-Za-z0-9\-]+)/i.exec(v);
        if (m) code = m[1];
        return DB.find("members", function (x) { return x.code.toLowerCase() === code.toLowerCase(); });
      }

      function doCheckIn() {
        var input = container.querySelector("#att-code");
        var val = input.value;
        var m = resolveMember(val);
        if (!m) { U.toast("Member not found — check the code", "err"); return; }
        var today = DB.todayISO();
        var rec = DB.find("attendance", function (a) { return a.memberId === m.id && a.date === today; });
        if (rec) {
          if (!rec.checkOut) { U.toast(m.name + " already checked in at " + rec.checkIn, "warn"); return; }
        }
        if (!rec) DB.insert("attendance", { memberId: m.id, date: today, checkIn: DB.nowTime(), checkOut: null, source: "frontdesk" });
        Auth.log(Auth.current(), "Attendance", m.name + " checked in", "info");
        U.toast(m.name + " checked in ✓", "ok");
        input.value = "";
        V.get("attendance").render(container);
      }

      function doCheckOut() {
        var input = container.querySelector("#att-code");
        var val = input.value;
        var m = resolveMember(val);
        if (!m) { U.toast("Member not found — check the code", "err"); return; }
        var today = DB.todayISO();
        var rec = DB.find("attendance", function (a) { return a.memberId === m.id && a.date === today && !a.checkOut; });
        if (!rec) { U.toast(m.name + " has no open check-in today", "warn"); return; }
        DB.update("attendance", rec.id, { checkOut: DB.nowTime() });
        Auth.log(Auth.current(), "Attendance", m.name + " checked out", "info");
        U.toast(m.name + " checked out", "ok");
        input.value = "";
        drawHistory(container);
        V.get("attendance").render(container);
      }

      if (canCheck) {
        var codeInput = container.querySelector("#att-code");
        container.querySelector("#att-in").addEventListener("click", doCheckIn);
        container.querySelector("#att-out").addEventListener("click", doCheckOut);
        codeInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            var v = codeInput.value;
            var m = resolveMember(v);
            var open = m && DB.find("attendance", function (a) { return a.memberId === m.id && a.date === DB.todayISO() && !a.checkOut; });
            var act = document.activeElement === container.querySelector("#att-out") ? doCheckOut : (open ? doCheckOut : doCheckIn);
            act();
          }
        });
      }

      container.querySelector("#att-from").addEventListener("change", function (e) { attState.dateFrom = e.target.value; drawHistory(container); });
      container.querySelector("#att-to").addEventListener("change", function (e) { attState.dateTo = e.target.value; drawHistory(container); });
      container.querySelector("#att-q").addEventListener("input", function (e) { attState.q = e.target.value.trim().toLowerCase(); drawHistory(container); });
      container.querySelector("#att-export").addEventListener("click", function () {
        exportAttendance(container);
      });

      drawHistory(container);
    }
  });

  function countLastNDays(n) {
    var from = DB.addDaysISO(DB.todayISO(), -(n - 1));
    return DB.all("attendance").filter(function (a) { return a.date >= from && a.date <= DB.todayISO(); }).length;
  }

  function drawHistory(container) {
    var from = attState.dateFrom, to = attState.dateTo;
    var list = DB.all("attendance").filter(function (a) { return a.date >= from && a.date <= to; });
    if (attState.q) {
      list = list.filter(function (a) {
        var m = DB.memberOf(a.memberId);
        return m && (m.name.toLowerCase().indexOf(attState.q) >= 0 || m.code.toLowerCase().indexOf(attState.q) >= 0);
      });
    }
    list.sort(function (a, b) { return (b.date + " " + (b.checkIn || "")).localeCompare(a.date + " " + (a.checkIn || "")); });

    var body = container.querySelector("#att-body");
    if (!list.length) body.innerHTML = '<tr><td colspan="5">' + VUI.empty("scan", "No attendance in this range") + '</td></tr>';
    else {
      body.innerHTML = list.slice(0, 60).map(function (a) {
        var m = DB.memberOf(a.memberId);
        return '<tr><td>' + U.fmtDate(a.date) + '</td><td>' + (m ? VUI.memberCell(m) : '<span class="muted">deleted</span>') + '</td>' +
          '<td>' + U.escape(a.checkIn || "—") + '</td><td>' + U.escape(a.checkOut || '<span class="badge ok"><span class="b-dot"></span>In gym</span>') + '</td>' +
          '<td>' + U.escape(a.source || "—") + '</td></tr>';
      }).join('');
    }

    /* chart of this range */
    var byDay = {};
    list.forEach(function (a) { byDay[a.date] = (byDay[a.date] || 0) + 1; });
    var days = [];
    var d = new Date(from + "T00:00:00");
    var end = new Date(to + "T00:00:00");
    while (d <= end) {
      var iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      days.push({ label: iso.slice(5), count: byDay[iso] || 0 });
      d.setDate(d.getDate() + 1);
    }
    Charts.bar(document.getElementById("att-chart"), {
      labels: days.map(function (x) { return x.label; }),
      values: days.map(function (x) { return x.count; })
    });
  }

  function exportAttendance(container) {
    var from = attState.dateFrom, to = attState.dateTo;
    var list = DB.all("attendance").filter(function (a) { return a.date >= from && a.date <= to; });
    var rows = list.map(function (a) {
      var m = DB.memberOf(a.memberId);
      return [a.date, m ? m.code : "", m ? m.name : "", a.checkIn || "", a.checkOut || "", a.source || ""];
    });
    U.downloadCSV("attendance_" + from + "_" + to + ".csv", ["Date", "Code", "Member", "Check-in", "Check-out", "Source"], rows);
    U.toast("Attendance exported", "ok");
  }

  /* ============================================================
     TRAINERS
     ============================================================ */
  V.register({
    id: "trainers",
    label: "Trainers",
    icon: "dumbbell",
    group: "Staff",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager"]);
      var trainers = DB.all("trainers");
      var html = VUI.ph("Trainers", "Coaching staff, their schedules and assigned members") +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("Add Trainer", "plus", "btn-primary", 'id="tr-add"') + '</div>' : '') +
        '<div class="grid grid-3" id="tr-grid">';

      if (!trainers.length) html += '<div class="card" style="grid-column:1/-1">' + VUI.empty("dumbbell", "No trainers yet", "Add your coaching staff.") + '</div>';
      trainers.forEach(function (t) {
        var assigned = DB.all("members").filter(function (m) { return m.trainerId === t.id; }).length;
        html += '<div class="card"><div class="row"><div class="avatar" style="width:46px;height:46px;font-size:17px">' + U.initials(t.name) + '</div>' +
          '<div class="grow"><div style="font-weight:700">' + U.escape(t.name) + '</div><div class="small muted">' + U.escape(t.specialization || "") + ' &middot; ' + (t.experience || 0) + ' yrs</div></div></div>' +
          '<div class="divider"></div><div class="quick-stats" style="margin-top:0">' +
          '<div class="qs"><div class="qs-v">' + assigned + '</div><div class="qs-l">Members</div></div>' +
          '<div class="qs"><div class="qs-v">' + U.fmtMoney(t.salary || 0) + '</div><div class="qs-l">Salary</div></div>' +
          '<div class="qs"><div class="qs-v">' + (t.active ? '<span style="color:var(--ok)">Active</span>' : '<span style="color:var(--danger)">Inactive</span>') + '</div><div class="qs-l">Status</div></div>' +
          '</div>' +
          '<div class="small muted" style="margin-top:12px"><b>Schedule:</b> ' + U.escape(t.schedule || "—") + '</div>' +
          (canManage ? '<div class="row" style="margin-top:12px;gap:8px"><button class="btn btn-ghost btn-sm" data-edit="' + t.id + '">' + U.icon("edit", 13) + 'Edit</button>' +
            '<button class="btn btn-danger btn-sm" data-del="' + t.id + '">' + U.icon("trash", 13) + '</button></div>' : '') +
          '</div>';
      });

      html += '</div>';
      container.innerHTML = html;

      if (canManage) container.querySelector("#tr-add").addEventListener("click", function () { openTrainerModal(null); });
      wireAll(container, "[data-edit]", function (b) { openTrainerModal(b.getAttribute("data-edit")); });
      wireAll(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete trainer", message: "Remove this trainer?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("trainers", b.getAttribute("data-del"));
          U.toast("Trainer removed", "ok");
          V.get("trainers").render(container);
        });
      });
    }
  });

  function openTrainerModal(id) {
    var t = id ? DB.trainerOf(id) : null;
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Full name</label><input id="tr-name" value="' + U.escape(t ? t.name : "") + '" /></div>' +
      '<div class="field"><label>Email</label><input id="tr-email" value="' + U.escape(t ? t.email || "" : "") + '" /></div>' +
      '<div class="field"><label>Phone</label><input id="tr-phone" value="' + U.escape(t ? t.phone || "" : "") + '" /></div>' +
      '<div class="field"><label>Specialization</label><input id="tr-spec" value="' + U.escape(t ? t.specialization || "" : "") + '" /></div>' +
      '<div class="field"><label>Experience (years)</label><input id="tr-exp" type="number" min="0" value="' + (t ? t.experience || 0 : 0) + '" /></div>' +
      '<div class="field"><label>Salary</label><input id="tr-salary" type="number" min="0" step="0.01" value="' + (t ? t.salary || 0 : 1000) + '" /></div>' +
      '<div class="field"><label>Availability / schedule</label><input id="tr-schedule" value="' + U.escape(t ? t.schedule || "" : "") + '" placeholder="e.g. Mon, Wed, Fri" /></div>' +
      '<div class="field"><label>Status</label><select id="tr-active"><option value="1">Active</option><option value="0">Inactive</option></select></div>' +
      '</div>';
    var close = U.modal({ title: t ? "Edit Trainer" : "Add Trainer", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>' });
    if (t && t.active === false) {
      var so = containerOf(close, "#tr-active");
      if (so) so.value = "0";
    }
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var name = containerOf(close, "#tr-name").value.trim();
      if (!name) { U.toast("Name required", "err"); return; }
      var data = {
        name: name, email: containerOf(close, "#tr-email").value.trim(), phone: containerOf(close, "#tr-phone").value.trim(),
        specialization: containerOf(close, "#tr-spec").value.trim(), experience: +containerOf(close, "#tr-exp").value || 0,
        salary: +containerOf(close, "#tr-salary").value || 0, schedule: containerOf(close, "#tr-schedule").value.trim(),
        active: containerOf(close, "#tr-active").value === "1"
      };
      if (t) { DB.update("trainers", t.id, data); U.toast("Trainer updated", "ok"); }
      else { DB.insert("trainers", Object.assign({ code: DB.nextCode("TR", "trainers"), joinDate: DB.todayISO() }, data)); U.toast("Trainer added", "ok"); }
      Auth.log(Auth.current(), "Trainer", (t ? "Edited " : "Added ") + name, "info");
      close(); refreshView();
    });
  }

  /* ============================================================
     WORKOUTS
     ============================================================ */
  V.register({
    id: "workouts",
    label: "Workout Plans",
    icon: "dumbbell",
    group: "Training",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager", "trainer"]);
      var who = "";
      if (Auth.current().role === "trainer") {
        var t = DB.find("trainers", function (x) { return x.name === Auth.current().name; });
        var t2 = DB.find("trainers", function (x) { return x.email === Auth.current().email; });
        var myId = (t || t2 || {}).id;
        who = myId;
      }
      var list = DB.all("workouts");
      if (who) list = list.filter(function (w) { return w.trainerId === who; });
      var html = VUI.ph("Workout Plans", "Training programs assigned to members") +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("New Workout Plan", "plus", "btn-primary", 'id="wo-add"') + '</div>' : '') +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Plan</th><th>Member</th><th>Trainer</th><th>Days</th><th>Sessions</th><th style="width:90px"></th></tr></thead><tbody>';

      if (!list.length) html += '<tr><td colspan="6">' + VUI.empty("dumbbell", "No workout plans yet", "Create a plan and assign it to a member.") + '</td></tr>';
      list.forEach(function (w) {
        var m = DB.memberOf(w.memberId);
        var tr = DB.trainerOf(w.trainerId);
        var exCount = (w.days || []).reduce(function (s, d) { return s + (d.exercises ? d.exercises.length : 0); }, 0);
        html += '<tr><td style="font-weight:600">' + U.escape(w.title || "Workout") + '</td>' +
          '<td>' + (m ? VUI.memberCell(m) : '<span class="muted">—</span>') + '</td>' +
          '<td>' + (tr ? VUI.trainerCell(tr) : '<span class="muted">—</span>') + '</td>' +
          '<td>' + (w.days || []).map(function (d) { return '<span class="badge violet" style="margin-right:3px">' + U.escape(d.day) + '</span>'; }).join("") + '</td>' +
          '<td>' + exCount + '</td>' +
          '<td><div class="tbl-actions">' +
          '<button class="icon-btn info" data-view="' + w.id + '" title="View">' + U.icon("eye", 15) + '</button>' +
          (canManage ? '<button class="icon-btn" data-edit="' + w.id + '" title="Edit">' + U.icon("edit", 15) + '</button>' : '') +
          '<button class="icon-btn danger" data-del="' + w.id + '" title="Delete">' + U.icon("trash", 15) + '</button>' +
          '</div></td></tr>';
      });
      html += '</tbody></table></div>';

      container.innerHTML = html;

      if (canManage) container.querySelector("#wo-add").addEventListener("click", function () { openWorkoutModal(null, who); });
      wireAll(container, "[data-view]", function (b) { viewWorkout(b.getAttribute("data-view")); });
      wireAll(container, "[data-edit]", function (b) { openWorkoutModal(b.getAttribute("data-edit"), who); });
      wireAll(container, "[data-del]", function (b) {
        var id = b.getAttribute("data-del");
        U.confirmDialog({ title: "Delete plan", message: "Delete this workout plan?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("workouts", id);
          U.toast("Workout plan deleted", "ok");
          V.get("workouts").render(container);
        });
      });
    }
  });

  function openWorkoutModal(id, forceTrainerId) {
    var w = id ? DB.find("workouts", function (x) { return x.id === id; }) : null;
    var members = DB.all("members");
    var trainers = DB.all("trainers");
    var cur = window.Auth.current();

    var dayPicker = '';
    var daysHtml = '';
    function rowHtml(d) {
      d = d || { day: "Monday", exercises: [] };
      var exercises = d.exercises || [];
      var exRows = exercises.map(function (e, i) {
        return '<div class="row" style="gap:8px;margin-bottom:6px;align-items:center" data-exrow>' +
          '<input data-ex="name" placeholder="Exercise" value="' + U.escape(e.name || "") + '" style="flex:2;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
          '<input data-ex="sets" placeholder="Sets" value="' + U.escape(e.sets || "") + '" style="width:60px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
          '<input data-ex="reps" placeholder="Reps" value="' + U.escape(e.reps || "") + '" style="width:60px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
          '<input data-ex="rest" placeholder="Rest" value="' + U.escape(e.rest || "") + '" style="width:60px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
          '<button class="icon-btn danger" data-ex-remove title="Remove">' + U.icon("x", 14) + '</button></div>';
      }).join("") || '<div class="small muted" style="padding:6px 0">No exercises yet.</div>';
      return '<div class="wo-day card" style="padding:12px;margin-bottom:10px">' +
        '<div class="row" style="gap:8px;align-items:center;margin-bottom:8px">' +
        '<select data-day="day" style="height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px">' +
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(function (day) {
          return '<option' + (d.day === day ? " selected" : "") + '>' + day + '</option>';
        }).join('') + '</select>' +
        '<button class="btn btn-ghost btn-sm" data-ex-add>' + U.icon("plus", 13) + 'Exercise</button>' +
        '<button class="btn btn-danger btn-sm" data-day-remove style="margin-left:auto">' + U.icon("trash", 13) + 'Day</button>' +
        '</div>' + exRows + '</div>';
    }

    var body = '<div class="section-label">Plan details</div><div class="form-grid">' +
      '<div class="field"><label class="req">Title</label><input id="wo-title" value="' + U.escape(w ? w.title : "") + '" /></div>' +
      '<div class="field"><label>Member</label><select id="wo-member">' + members.map(function (m) { return '<option value="' + m.id + '"' + (w && w.memberId === m.id ? " selected" : "") + '>' + U.escape(m.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Trainer</label><select id="wo-trainer">' + trainers.map(function (t) { return '<option value="' + t.id + '"' + ((w && w.trainerId === t.id) || (forceTrainerId && forceTrainerId === t.id) ? " selected" : "") + '>' + U.escape(t.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field field-range"><label>Notes</label><input id="wo-notes" value="' + U.escape(w ? w.notes || "" : "") + '" placeholder="Coach guidance" /></div>' +
      '</div>' +
      '<div class="section-label" style="margin-top:18px">Weekly schedule</div>' +
      '<div class="row" style="gap:8px;align-items:center;margin-bottom:10px"><input type="date" id="wo-day-add"></div>' +
      '<div class="wo-days"></div>';

    var close = U.modal({ title: w ? "Edit Workout Plan" : "New Workout Plan", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save Plan</button>' });

    var daysContainer = containerOf(close, ".wo-days");
    function addDay(d) { var node = U.el(rowHtml(d)); daysContainer.appendChild(node); bindDay(node); }
    function bindDay(node) {
      node.querySelector("[data-ex-add]").addEventListener("click", function () { addExercise(node); });
      node.querySelector("[data-day-remove]").addEventListener("click", function () { node.remove(); });
      var rem = node.querySelector("[data-ex-remove]");
      if (rem) rem.addEventListener("click", function () { node.remove(); });
      node.querySelectorAll("[data-ex-remove]").forEach(function (b) {
        b.addEventListener("click", function () { var row = b.closest("[data-exrow]"); if (row) row.remove(); });
      });
    }
    function addExercise(node) {
      var row = U.el('<div class="row" style="gap:8px;margin-bottom:6px;align-items:center" data-exrow>' +
        '<input data-ex="name" placeholder="Exercise" style="flex:2;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-ex="sets" placeholder="Sets" style="width:60px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-ex="reps" placeholder="Reps" style="width:60px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-ex="rest" placeholder="Rest" style="width:60px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<button class="icon-btn danger" data-ex-remove title="Remove">' + U.icon("x", 14) + '</button></div>');
      node.insertBefore(row, null);
      row.querySelector("[data-ex-remove]").addEventListener("click", function () { row.remove(); });
    }
    /* initial days */
    (w && w.days ? w.days : [
      { day: "Monday", exercises: [] }, { day: "Wednesday", exercises: [] }
    ]).forEach(function (d) { addDay(d); });

    function collect() {
      var days = [];
      daysContainer.querySelectorAll(".wo-day").forEach(function (node) {
        var day = node.querySelector("[data-day]").value;
        var exercises = [];
        node.querySelectorAll("[data-exrow]").forEach(function (r) {
          var name = r.querySelector('[data-ex="name"]').value.trim();
          if (!name) return;
          exercises.push({
            name: name,
            sets: r.querySelector('[data-ex="sets"]').value.trim(),
            reps: r.querySelector('[data-ex="reps"]').value.trim(),
            rest: r.querySelector('[data-ex="rest"]').value.trim()
          });
        });
        if (day) days.push({ day: day, exercises: exercises });
      });
      return days;
    }

    containerOf(close, "[data-save]").addEventListener("click", function () {
      var title = containerOf(close, "#wo-title").value.trim();
      if (!title) { U.toast("Title required", "err"); return; }
      var days = collect();
      if (!days.length) { U.toast("Add at least one workout day", "err"); return; }
      var data = {
        title: title, memberId: containerOf(close, "#wo-member").value,
        trainerId: containerOf(close, "#wo-trainer").value, days: days,
        notes: containerOf(close, "#wo-notes").value.trim()
      };
      if (w) { DB.update("workouts", w.id, data); U.toast("Workout plan updated", "ok"); }
      else { DB.insert("workouts", data); U.toast("Workout plan created", "ok"); }
      Auth.log(Auth.current(), "Workout", (w ? "Edited " : "Created ") + title, "info");
      close(); refreshView();
    });
  }

  function viewWorkout(id) {
    var w = DB.find("workouts", function (x) { return x.id === id; });
    if (!w) return;
    var m = DB.memberOf(w.memberId);
    var tr = DB.trainerOf(w.trainerId);
    var body = '<div class="section-label">' + U.escape(w.title || "Workout") + '</div>' +
      '<p class="small muted">' + (m ? "Member: <b>" + U.escape(m.name) + '</b>' : "") + (tr ? " &middot; Trainer: <b>" + U.escape(tr.name) + "</b>" : "") + '</p>' +
      (w.notes ? '<p class="small muted" style="margin-top:6px">' + U.escape(w.notes) + '</p>' : '');
    (w.days || []).forEach(function (d) {
      body += '<div class="card" style="padding:14px;margin-top:12px"><div class="card-title" style="margin-bottom:10px">' + U.escape(d.day) + '</div>' +
        '<table class="data-table" style="min-width:0"><thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead><tbody>' +
        (d.exercises && d.exercises.length ? d.exercises.map(function (e) {
          return '<tr><td>' + U.escape(e.name) + '</td><td>' + U.escape(e.sets || "—") + '</td><td>' + U.escape(e.reps || "—") + '</td><td>' + U.escape(e.rest || "—") + '</td></tr>';
        }).join("") : '<tr><td colspan="4"><span class="muted">No exercises</span></td></tr>') +
        '</tbody></table></div>';
    });
    U.modal({ title: "Workout Plan", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Close</button>' });
  }

  /* ============================================================
     DIET
     ============================================================ */
  V.register({
    id: "diet",
    label: "Diet & Nutrition",
    icon: "apple",
    group: "Training",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager", "trainer"]);
      var list = DB.all("diets");
      var html = VUI.ph("Diet & Nutrition", "Meal plans assigned to members") +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("New Diet Plan", "plus", "btn-primary", 'id="di-add"') + '</div>' : '') +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Plan</th><th>Member</th><th>Meals</th><th>Calories</th><th>Water</th><th style="width:90px"></th></tr></thead><tbody>';

      if (!list.length) html += '<tr><td colspan="6">' + VUI.empty("apple", "No diet plans yet", "Create a nutrition plan.") + '</td></tr>';
      list.forEach(function (d) {
        var m = DB.memberOf(d.memberId);
        var kcal = (d.meals || []).reduce(function (s, x) { return s + (+x.calories || 0); }, 0);
        var protein = (d.meals || []).reduce(function (s, x) { return s + (+x.protein || 0); }, 0);
        html += '<tr><td style="font-weight:600">' + U.escape(d.title || "Diet Plan") + '</td>' +
          '<td>' + (m ? VUI.memberCell(m) : '<span class="muted">—</span>') + '</td>' +
          '<td>' + (d.meals || []).length + '</td>' +
          '<td>' + kcal + ' kcal</td>' +
          '<td>' + (d.waterTarget || 0) + ' L</td>' +
          '<td><div class="tbl-actions">' +
          '<button class="icon-btn info" data-view="' + d.id + '">' + U.icon("eye", 15) + '</button>' +
          (canManage ? '<button class="icon-btn" data-edit="' + d.id + '">' + U.icon("edit", 15) + '</button>' : '') +
          '<button class="icon-btn danger" data-del="' + d.id + '">' + U.icon("trash", 15) + '</button>' +
          '</div></td></tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;

      if (canManage) container.querySelector("#di-add").addEventListener("click", function () { openDietModal(null); });
      wireAll(container, "[data-view]", function (b) { viewDiet(b.getAttribute("data-view")); });
      wireAll(container, "[data-edit]", function (b) { openDietModal(b.getAttribute("data-edit")); });
      wireAll(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete diet plan", message: "Delete this nutrition plan?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("diets", b.getAttribute("data-del"));
          U.toast("Diet plan deleted", "ok");
          V.get("diet").render(container);
        });
      });
    }
  });

  function openDietModal(id) {
    var d = id ? DB.find("diets", function (x) { return x.id === id; }) : null;
    var members = DB.all("members");
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Title</label><input id="di-title" value="' + U.escape(d ? d.title : "") + '" /></div>' +
      '<div class="field"><label>Member</label><select id="di-member">' + members.map(function (m) { return '<option value="' + m.id + '"' + (d && d.memberId === m.id ? " selected" : "") + '>' + U.escape(m.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Water target (L/day)</label><input id="di-water" type="number" step="0.1" min="0" value="' + (d ? d.waterTarget || 0 : 2.5) + '" /></div>' +
      '<div class="field field-range"><label>Notes</label><input id="di-notes" value="' + U.escape(d ? d.notes || "" : "") + '" /></div>' +
      '</div>' +
      '<div class="section-label" style="margin-top:18px">Meals</div>' +
      '<div class="di-meals"></div>';

    var close = U.modal({ title: d ? "Edit Diet Plan" : "New Diet Plan", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save Plan</button>' });

    var mealsBox = containerOf(close, ".di-meals");
    var mealPrototype = { meal: "Meal", food: "", calories: 0, protein: 0, carbs: 0, fats: 0 };
    function addMeal(mm) {
      mm = mm || mealPrototype;
      var node = U.el('<div class="row" style="gap:8px;margin-bottom:8px;align-items:center" data-meal>' +
        '<input data-m="meal" placeholder="Meal (Breakfast/Lunch…)" value="' + U.escape(mm.meal || "") + '" style="flex:1.2;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-m="food" placeholder="Food" value="' + U.escape(mm.food || "") + '" style="flex:2;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-m="calories" type="number" placeholder="kcal" value="' + (mm.calories || 0) + '" style="width:70px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-m="protein" type="number" placeholder="P" value="' + (mm.protein || 0) + '" style="width:54px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-m="carbs" type="number" placeholder="C" value="' + (mm.carbs || 0) + '" style="width:54px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<input data-m="fats" type="number" placeholder="F" value="' + (mm.fats || 0) + '" style="width:54px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<button class="icon-btn danger" data-m-remove title="Remove">' + U.icon("x", 14) + '</button></div>');
      mealsBox.appendChild(node);
      node.querySelector("[data-m-remove]").addEventListener("click", function () { node.remove(); });
    }
    (d && d.meals ? d.meals : []).forEach(function (mm) { addMeal(mm); });
    var addRow = U.el('<div style="margin-bottom:8px"><button class="btn btn-ghost btn-sm" id="di-add-meal">' + U.icon("plus", 13) + 'Add Meal</button></div>');
    mealsBox.appendChild(addRow);
    addRow.querySelector("#di-add-meal").addEventListener("click", function () { addMeal(); });

    containerOf(close, "[data-save]").addEventListener("click", function () {
      var title = containerOf(close, "#di-title").value.trim();
      if (!title) { U.toast("Title required", "err"); return; }
      var meals = [];
      mealsBox.querySelectorAll("[data-meal]").forEach(function (r) {
        var meal = r.querySelector('[data-m="meal"]').value.trim();
        if (!meal) return;
        meals.push({
          meal: meal, food: r.querySelector('[data-m="food"]').value.trim(),
          calories: +r.querySelector('[data-m="calories"]').value || 0,
          protein: +r.querySelector('[data-m="protein"]').value || 0,
          carbs: +r.querySelector('[data-m="carbs"]').value || 0,
          fats: +r.querySelector('[data-m="fats"]').value || 0
        });
      });
      if (!meals.length) { U.toast("Add at least one meal", "err"); return; }
      var data = {
        title: title, memberId: containerOf(close, "#di-member").value,
        waterTarget: +containerOf(close, "#di-water").value || 0, meals: meals,
        notes: containerOf(close, "#di-notes").value.trim()
      };
      if (d) { DB.update("diets", d.id, data); U.toast("Diet plan updated", "ok"); }
      else { DB.insert("diets", data); U.toast("Diet plan created", "ok"); }
      Auth.log(Auth.current(), "Diet", (d ? "Edited " : "Created ") + title, "info");
      close(); refreshView();
    });
  }

  function viewDiet(id) {
    var d = DB.find("diets", function (x) { return x.id === id; });
    if (!d) return;
    var m = DB.memberOf(d.memberId);
    var kcal = (d.meals || []).reduce(function (s, x) { return s + (+x.calories || 0); }, 0);
    var body = '<div class="section-label">' + U.escape(d.title) + '</div>' +
      (m ? '<p class="small muted">Member: <b>' + U.escape(m.name) + '</b> &middot; Total: <b>' + kcal + ' kcal</b> &middot; Water: <b>' + (d.waterTarget || 0) + ' L</b></p>' : '') +
      (d.notes ? '<p class="small muted" style="margin-top:6px">' + U.escape(d.notes) + '</p>' : '') +
      '<div class="table-wrap" style="margin-top:12px"><table class="data-table" style="min-width:0"><thead><tr><th>Meal</th><th>Food</th><th>kcal</th><th>Protein</th><th>Carbs</th><th>Fats</th></tr></thead><tbody>' +
      (d.meals || []).map(function (x) {
        return '<tr><td>' + U.escape(x.meal) + '</td><td>' + U.escape(x.food || "—") + '</td><td>' + (x.calories || 0) + '</td><td>' + (x.protein || 0) + 'g</td><td>' + (x.carbs || 0) + 'g</td><td>' + (x.fats || 0) + 'g</td></tr>';
      }).join("") + '</tbody></table></div>';
    U.modal({ title: "Diet Plan", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Close</button>' });
  }

  /* ============================================================
     PROGRESS
     ============================================================ */
  var progState = { memberId: null };
  V.register({
    id: "progress",
    label: "Member Progress",
    icon: "trend",
    group: "Training",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager", "trainer"]);
      var members = DB.all("members");
      if (!progState.memberId && members.length) progState.memberId = members[0].id;

      var html = VUI.ph("Member Progress", "Weight, BMI and body measurements over time") +
        '<div class="toolbar"><div class="filters">' +
        '<select id="pr-member" style="min-width:220px">' + members.map(function (m) { return '<option value="' + m.id + '"' + (progState.memberId === m.id ? " selected" : "") + '>' + U.escape(m.name) + '</option>'; }).join("") + '</select></div>' +
        (canManage ? '<div class="toolbar-spacer"></div>' + VUI.btn("Add Measurement", "plus", "btn-primary", 'id="pr-add"') : '') + '</div>';

      if (!members.length) {
        html += VUI.empty("trend", "No members yet", "Add members first.");
        container.innerHTML = html;
        return;
      }

      var m = DB.memberOf(progState.memberId);
      var logs = DB.all("progress").filter(function (p) { return p.memberId === progState.memberId; })
        .sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });

      html += '<div class="grid grid-2" style="margin-bottom:16px">' +
        '<div class="card"><div class="card-title">' + U.icon("trend", 18) + 'Weight trend — ' + U.escape(m ? m.name : "") + '</div><div class="chart-box"><canvas class="chart" id="pr-chart"></canvas></div></div>' +
        '<div class="card"><div class="card-title">' + U.icon("activity", 18) + 'Latest body stats</div><div class="quick-stats">';
      var latest = logs.length ? logs[logs.length - 1] : null;
      html += '<div class="qs"><div class="qs-v">' + (latest ? latest.weight : "—") + ' kg</div><div class="qs-l">Weight</div></div>' +
        '<div class="qs"><div class="qs-v">' + (latest ? latest.bmi : "—") + '</div><div class="qs-l">BMI</div></div>' +
        '<div class="qs"><div class="qs-v">' + (latest && latest.bodyFat ? latest.bodyFat + "%" : "—") + '</div><div class="qs-l">Body Fat</div></div>' +
        '<div class="qs"><div class="qs-v">' + (latest && latest.chest ? latest.chest + " cm" : "—") + '</div><div class="qs-l">Chest</div></div>' +
        '<div class="qs"><div class="qs-v">' + (latest && latest.waist ? latest.waist + " cm" : "—") + '</div><div class="qs-l">Waist</div></div>' +
        '<div class="qs"><div class="qs-v">' + logs.length + ' logs</div><div class="qs-l">Measurements</div></div>' +
        '</div>' + (latest ? '<p class="small muted" style="margin-top:10px">Recorded ' + U.fmtDate(latest.date) + '</p>' : '<p class="small muted" style="margin-top:10px">No measurements yet.</p>') + '</div></div>';

      html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Weight</th><th>Height</th><th>BMI</th><th>Body Fat</th><th>Chest</th><th>Waist</th><th>Arms</th><th>Notes</th><th style="width:70px"></th></tr></thead><tbody>';
      if (!logs.length) html += '<tr><td colspan="10">' + VUI.empty("trend", "No progress records", 'Log the first measurement for this member.') + '</td></tr>';
      logs.slice().reverse().forEach(function (p) {
        html += '<tr><td>' + U.fmtDate(p.date) + '</td><td>' + (p.weight || "—") + ' kg</td><td>' + (p.height || "—") + ' cm</td><td>' + (p.bmi || "—") + '</td><td>' + (p.bodyFat || "—") + '%</td><td>' + (p.chest || "—") + '</td><td>' + (p.waist || "—") + '</td><td>' + (p.arms || "—") + '</td><td class="small muted">' + U.escape(p.notes || "") + '</td><td><div class="tbl-actions">' +
          (canManage ? '<button class="icon-btn danger" data-del="' + p.id + '">' + U.icon("trash", 15) + '</button>' : '') + '</div></td></tr>';
      });
      html += '</tbody></table></div>';

      container.innerHTML = html;

      requestAnimationFrame(function () {
        Charts.line(document.getElementById("pr-chart"), {
          labels: logs.map(function (p) { return p.date.slice(5); }),
          values: logs.map(function (p) { return p.weight || 0; })
        });
      });

      container.querySelector("#pr-member").addEventListener("change", function (e) {
        progState.memberId = e.target.value;
        V.get("progress").render(container);
      });
      var addBtn = container.querySelector("#pr-add");
      if (addBtn) addBtn.addEventListener("click", function () { openProgressModal(progState.memberId); });
      wireAll(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete record", message: "Delete this progress record?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("progress", b.getAttribute("data-del"));
          U.toast("Record deleted", "ok");
          V.get("progress").render(container);
        });
      });
    }
  });

  window.openProgressModal = function openProgressModal(memberId) {
    var m = DB.memberOf(memberId);
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Date</label><input type="date" id="pg-date" value="' + DB.todayISO() + '" /></div>' +
      '<div class="field"><label>Weight (kg)</label><input id="pg-weight" type="number" step="0.1" min="0" /></div>' +
      '<div class="field"><label>Height (cm)</label><input id="pg-height" type="number" step="0.1" min="0" /></div>' +
      '<div class="field"><label>BMI</label><input id="pg-bmi" type="number" step="0.1" min="0" disabled /></div>' +
      '<div class="field"><label>Body fat (%)</label><input id="pg-fat" type="number" step="0.1" min="0" /></div>' +
      '<div class="field"><label>Chest (cm)</label><input id="pg-chest" type="number" step="0.1" min="0" /></div>' +
      '<div class="field"><label>Waist (cm)</label><input id="pg-waist" type="number" step="0.1" min="0" /></div>' +
      '<div class="field"><label>Arms (cm)</label><input id="pg-arms" type="number" step="0.1" min="0" /></div>' +
      '<div class="field field-range"><label>Notes</label><input id="pg-notes" /></div>' +
      '</div>';
    var close = U.modal({
      title: "Add Measurement — " + (m ? U.escape(m.name) : ""), body: body, wide: true,
      foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>' + U.icon("check", 15) + 'Save</button>'
    });
    function calcBmi() {
      var w = +containerOf(close, "#pg-weight").value || 0;
      var h = +containerOf(close, "#pg-height").value || 0;
      var bmi = containerOf(close, "#pg-bmi");
      if (w && h) bmi.value = Math.round((w / ((h / 100) * (h / 100))) * 10) / 10;
      else bmi.value = "";
    }
    containerOf(close, "#pg-weight").addEventListener("input", calcBmi);
    containerOf(close, "#pg-height").addEventListener("input", calcBmi);
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var date = containerOf(close, "#pg-date").value;
      if (!date) { U.toast("Date required", "err"); return; }
      DB.insert("progress", {
        memberId: memberId, date: date,
        weight: +containerOf(close, "#pg-weight").value || null,
        height: +containerOf(close, "#pg-height").value || null,
        bmi: +containerOf(close, "#pg-bmi").value || null,
        bodyFat: +containerOf(close, "#pg-fat").value || null,
        chest: +containerOf(close, "#pg-chest").value || null,
        waist: +containerOf(close, "#pg-waist").value || null,
        arms: +containerOf(close, "#pg-arms").value || null,
        notes: containerOf(close, "#pg-notes").value.trim()
      });
      Auth.log(Auth.current(), "Progress", "Logged measurements for " + (m ? m.name : ""), "info");
      U.toast("Measurement saved", "ok");
      close();
      refreshView();
    });
  };

  /* ============================================================
     EQUIPMENT
     ============================================================ */
  V.register({
    id: "equipment",
    label: "Equipment",
    icon: "wrench",
    group: "Operations",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager"]);
      var eq = DB.all("equipment");
      var html = VUI.ph("Equipment", "Machines, condition and maintenance") +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("Add Equipment", "plus", "btn-primary", 'id="eq-add"') + '</div>' : '') +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Equipment</th><th>Category</th><th>Qty</th><th>Condition</th><th>Status</th><th>Next service</th><th style="width:120px"></th></tr></thead><tbody>';

      if (!eq.length) html += '<tr><td colspan="7">' + VUI.empty("wrench", "No equipment yet", "Add your gym equipment.") + '</td></tr>';
      eq.forEach(function (e) {
        var st = e.status === "operational" ? '<span class="badge ok"><span class="b-dot"></span>Operational</span>' :
          e.status === "maintenance" ? '<span class="badge warn"><span class="b-dot"></span>Maintenance</span>' :
            '<span class="badge danger"><span class="b-dot"></span>Broken</span>';
        var cond = e.condition === "Excellent" ? "ok" : e.condition === "Good" ? "info" : "warn";
        html += '<tr><td><div class="cell-user"><span class="avatar" style="background:var(--surface-2);color:var(--accent-1)">' + U.icon("dumbbell", 16) + '</span><div><div class="cu-name">' + U.escape(e.name) + '</div><div class="cu-sub mono">' + U.escape(e.code || "") + '</div></div></div></td>' +
          '<td>' + U.escape(e.category || "—") + '</td><td>' + e.quantity + '</td>' +
          '<td><span class="badge ' + cond + '"><span class="b-dot"></span>' + U.escape(e.condition || "—") + '</span></td>' +
          '<td>' + st + '</td>' +
          '<td>' + (e.nextService ? U.fmtDate(e.nextService) + ' <span class="small muted">(' + U.humanDays(e.nextService) + ')</span>' : '—') + '</td>' +
          '<td><div class="tbl-actions">' +
          (canManage ? '<button class="icon-btn" data-edit="' + e.id + '">' + U.icon("edit", 15) + '</button><button class="icon-btn danger" data-del="' + e.id + '">' + U.icon("trash", 15) + '</button>' : '') +
          '</div></td></tr>';
      });
      html += '</tbody></table></div>';
      container.innerHTML = html;

      if (canManage) container.querySelector("#eq-add").addEventListener("click", function () { openEquipmentModal(null); });
      if (canManage) {
        wireAll(container, "[data-edit]", function (b) { openEquipmentModal(b.getAttribute("data-edit")); });
        wireAll(container, "[data-del]", function (b) {
          U.confirmDialog({ title: "Delete equipment", message: "Remove this item?", danger: true, okLabel: "Delete" }).then(function (ok) {
            if (!ok) return;
            DB.remove("equipment", b.getAttribute("data-del"));
            U.toast("Equipment removed", "ok");
            V.get("equipment").render(container);
          });
        });
      }
    }
  });

  function openEquipmentModal(id) {
    var e = id ? DB.find("equipment", function (x) { return x.id === id; }) : null;
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Name</label><input id="eq-name" value="' + U.escape(e ? e.name : "") + '" /></div>' +
      '<div class="field"><label>Category</label><input id="eq-cat" value="' + U.escape(e ? e.category || "" : "") + '" placeholder="Strength / Cardio /…" /></div>' +
      '<div class="field"><label>Quantity</label><input id="eq-qty" type="number" min="1" value="' + (e ? e.quantity : 1) + '" /></div>' +
      '<div class="field"><label>Purchase price</label><input id="eq-price" type="number" step="0.01" min="0" value="' + (e ? e.price || 0 : 0) + '" /></div>' +
      '<div class="field"><label>Purchase date</label><input type="date" id="eq-pdate" value="' + U.escape(e ? e.purchaseDate || "" : "") + '" /></div>' +
      '<div class="field"><label>Condition</label><select id="eq-cond"><option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option></select></div>' +
      '<div class="field"><label>Location</label><input id="eq-loc" value="' + U.escape(e ? e.location || "" : "") + '" /></div>' +
      '<div class="field"><label>Warranty till</label><input type="date" id="eq-warr" value="' + U.escape(e ? e.warrantyTill || "" : "") + '" /></div>' +
      '<div class="field"><label>Next service</label><input type="date" id="eq-next" value="' + U.escape(e ? e.nextService || "" : "") + '" /></div>' +
      '<div class="field"><label>Status</label><select id="eq-status"><option value="operational">Operational</option><option value="maintenance">Maintenance</option><option value="broken">Broken</option></select></div>' +
      '</div>';
    var close = U.modal({ title: e ? "Edit Equipment" : "Add Equipment", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>' });
    if (e) {
      var c = containerOf(close, "#eq-cond"); if (e.condition) c.value = e.condition;
      var s = containerOf(close, "#eq-status"); if (e.status) s.value = e.status;
    }
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var name = containerOf(close, "#eq-name").value.trim();
      if (!name) { U.toast("Name required", "err"); return; }
      var data = {
        name: name, category: containerOf(close, "#eq-cat").value.trim(),
        quantity: +containerOf(close, "#eq-qty").value || 1,
        price: +containerOf(close, "#eq-price").value || 0,
        purchaseDate: containerOf(close, "#eq-pdate").value,
        condition: containerOf(close, "#eq-cond").value,
        location: containerOf(close, "#eq-loc").value.trim(),
        warrantyTill: containerOf(close, "#eq-warr").value,
        nextService: containerOf(close, "#eq-next").value,
        status: containerOf(close, "#eq-status").value
      };
      if (e) { DB.update("equipment", e.id, data); U.toast("Equipment updated", "ok"); }
      else { DB.insert("equipment", Object.assign({ code: DB.nextCode("EQ", "equipment") }, data)); U.toast("Equipment added", "ok"); }
      Auth.log(Auth.current(), "Equipment", (e ? "Edited " : "Added ") + name, "info");
      close(); refreshView();
    });
  }

  /* ============================================================
     EXPENSES
     ============================================================ */
  V.register({
    id: "expenses",
    label: "Expenses",
    icon: "receipt",
    group: "Finance",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager", "accountant"]);
      var ex = DB.all("expenses");
      var month = DB.todayISO().slice(0, 7);
      var monthSum = ex.filter(function (x) { return x.date && x.date.indexOf(month) === 0; }).reduce(function (s, x) { return s + (+x.amount || 0); }, 0);
      var total6 = DB.expensesByMonth(6).reduce(function (s, m) { return s + m.total; }, 0);
      var byCat = {};
      ex.forEach(function (x) { byCat[x.category] = (byCat[x.category] || 0) + (+x.amount || 0); });
      var topCat = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; })[0] || "—";

      var html = VUI.ph("Expenses", "Running costs and spending") +
        '<div class="kpi-row">' +
        VUI.kpi("receipt", "c1", "This Month", U.fmtMoney(monthSum), month) +
        VUI.kpi("receipt", "c2", "Last 6 Months", U.fmtMoney(total6), "") +
        VUI.kpi("wallet", "c3", "Top Category", U.escape(topCat), (byCat[topCat] ? U.fmtMoney(byCat[topCat]) : "")) +
        VUI.kpi("database", "c4", "Records", ex.length, "") +
        '</div>' +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("Add Expense", "plus", "btn-primary", 'id="ex-add"') + '</div>' : '') +
        '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">' + U.icon("chart", 18) + 'By category</div><div class="chart-box sm"><canvas class="chart" id="ex-chart"></canvas></div></div>' +
        '<div class="card"><div class="card-title">' + U.icon("receipt", 18) + 'Monthly spend</div><div class="chart-box sm"><canvas class="chart" id="ex-chart2"></canvas></div></div>' +
        '</div>' +
        '<div class="table-wrap" style="margin-top:16px"><table class="data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Payee</th><th style="text-align:right">Amount</th><th style="width:70px"></th></tr></thead><tbody>';

      if (!ex.length) html += '<tr><td colspan="6">' + VUI.empty("receipt", "No expenses recorded") + '</td></tr>';
      ex.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).forEach(function (e) {
        html += '<tr><td>' + U.fmtDate(e.date) + '</td><td><span class="badge violet">' + U.escape(e.category || "—") + '</span></td><td>' + U.escape(e.description || "—") + '</td><td>' + U.escape(e.payee || "—") + '</td><td style="text-align:right;font-weight:700">' + U.fmtMoney(e.amount) + '</td>' +
          '<td><div class="tbl-actions">' +
          (canManage ? '<button class="icon-btn" data-edit="' + e.id + '">' + U.icon("edit", 15) + '</button><button class="icon-btn danger" data-del="' + e.id + '">' + U.icon("trash", 15) + '</button>' : '') +
          '</div></td></tr>';
      });
      html += '</tbody></table></div>';

      container.innerHTML = html;
      container.querySelectorAll("tbody").forEach(function () {});

      /* charts */
      requestAnimationFrame(function () {
        var cats = Object.keys(byCat);
        var palette = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f472b6", "#94a3b8"];
        Charts.bar(document.getElementById("ex-chart"), {
          labels: cats.slice(0, 8),
          values: cats.slice(0, 8).map(function (c) { return byCat[c]; }),
          colors: cats.slice(0, 8).map(function (_, i) { return palette[i % palette.length]; })
        });
        var m6 = DB.expensesByMonth(6);
        Charts.line(document.getElementById("ex-chart2"), {
          labels: m6.map(function (x) { return x.label; }),
          values: m6.map(function (x) { return x.total; })
        });
      });

      if (canManage) container.querySelector("#ex-add").addEventListener("click", function () { openExpenseModal(null); });
      if (canManage) {
        wireAll(container, "[data-edit]", function (b) { openExpenseModal(b.getAttribute("data-edit")); });
        wireAll(container, "[data-del]", function (b) {
          U.confirmDialog({ title: "Delete expense", message: "Delete this expense record?", danger: true, okLabel: "Delete" }).then(function (ok) {
            if (!ok) return;
            DB.remove("expenses", b.getAttribute("data-del"));
            U.toast("Expense deleted", "ok");
            V.get("expenses").render(container);
          });
        });
      }
    }
  });

  function openExpenseModal(id) {
    var e = id ? DB.find("expenses", function (x) { return x.id === id; }) : null;
    var cats = ["Rent", "Electricity", "Salaries", "Equipment", "Maintenance", "Cleaning", "Internet", "Marketing", "Other"];
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Category</label><select id="ex-cat">' + cats.map(function (c) { return '<option' + (!e || e.category === c ? " selected" : "") + '>' + c + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Date</label><input type="date" id="ex-date" value="' + (e ? e.date : DB.todayISO()) + '" /></div>' +
      '<div class="field"><label class="req">Amount</label><input id="ex-amount" type="number" step="0.01" min="0" value="' + (e ? e.amount : 100) + '" /></div>' +
      '<div class="field"><label>Payee</label><input id="ex-payee" value="' + U.escape(e ? e.payee || "" : "") + '" /></div>' +
      '<div class="field field-range"><label>Description</label><input id="ex-desc" value="' + U.escape(e ? e.description || "" : "") + '" /></div>' +
      '</div>';
    var close = U.modal({ title: e ? "Edit Expense" : "Add Expense", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>' });
    if (e) {
      var c = containerOf(close, "#ex-cat");
      var opt = Array.prototype.find.call(c.options, function (o) { return o.value === e.category; });
      if (opt) c.value = e.category;
    }
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var amount = +containerOf(close, "#ex-amount").value;
      if (!amount || amount <= 0) { U.toast("Enter a valid amount", "err"); return; }
      var data = {
        category: containerOf(close, "#ex-cat").value,
        date: containerOf(close, "#ex-date").value || DB.todayISO(),
        amount: amount, payee: containerOf(close, "#ex-payee").value.trim(),
        description: containerOf(close, "#ex-desc").value.trim()
      };
      if (e) { DB.update("expenses", e.id, data); U.toast("Expense updated", "ok"); }
      else { DB.insert("expenses", data); U.toast("Expense added", "ok"); }
      Auth.log(Auth.current(), "Expense", (e ? "Edited " : "Added ") + data.category + " " + U.fmtMoney(amount), "warn");
      close(); refreshView();
    });
  }

  /* ============================================================
     STORE / POS
     ============================================================ */
  var storeTab = "products";
  V.register({
    id: "store",
    label: "Gym Store",
    icon: "bag",
    group: "Finance",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager", "reception", "accountant"]);
      var tabs = '<div class="tabs"><div class="tab' + (storeTab === "products" ? " active" : "") + '" data-st="products">Products</div>' +
        '<div class="tab' + (storeTab === "sales" ? " active" : "") + '" data-st="sales">Sales History</div></div>';
      container.innerHTML = VUI.ph("Gym Store", "Supplements and accessories retail") + tabs +
        '<div id="st-body"></div>';

      container.querySelectorAll("[data-st]").forEach(function (t) {
        t.addEventListener("click", function () { storeTab = t.getAttribute("data-st"); V.get("store").render(container); });
      });

      var body = container.querySelector("#st-body");
      if (storeTab === "products") renderProducts(body, canManage);
      else renderSales(body, canManage);
    }
  });

  function renderProducts(container, canManage) {
    var prods = DB.all("products");
    var low = DB.settings().lowStockThreshold;
    var html = (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("Add Product", "plus", "btn-primary", 'id="prd-add"') + '</div>' : '') +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Buy</th><th>Sell</th><th>Margin</th><th>Supplier</th><th style="width:100px"></th></tr></thead><tbody>';
    if (!prods.length) html += '<tr><td colspan="8">' + VUI.empty("bag", "No products yet", "Add products to your store.") + '</td></tr>';
    prods.forEach(function (p) {
      var lowStock = +p.quantity <= low;
      html += '<tr><td><div class="cell-user"><span class="avatar" style="background:var(--surface-2);color:var(--accent-2)">' + U.icon("bag", 16) + '</span><div><div class="cu-name">' + U.escape(p.name) + '</div><div class="cu-sub mono">' + U.escape(p.code || "") + '</div></div></div></td>' +
        '<td>' + U.escape(p.category || "—") + '</td>' +
        '<td>' + (lowStock ? '<span class="badge danger"><span class="b-dot"></span>Low: ' + p.quantity + '</span>' : '<span class="badge ok"><span class="b-dot"></span>' + p.quantity + '</span>') + '</td>' +
        '<td>' + U.fmtMoney(p.purchasePrice) + '</td><td style="font-weight:700">' + U.fmtMoney(p.sellPrice) + '</td>' +
        '<td class="small muted">' + Math.round(((+p.sellPrice - +p.purchasePrice) / +p.sellPrice) * 100) + '%</td>' +
        '<td>' + U.escape(p.supplier || "—") + '</td>' +
        (canManage ? '<td><div class="tbl-actions"><button class="icon-btn" data-edit="' + p.id + '">' + U.icon("edit", 15) + '</button><button class="icon-btn danger" data-del="' + p.id + '">' + U.icon("trash", 15) + '</button></div></td>' : '<td></td>') +
        '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    if (canManage) {
      container.querySelector("#prd-add").addEventListener("click", function () { openProductModal(null); });
      wireAll(container, "[data-edit]", function (b) { openProductModal(b.getAttribute("data-edit")); });
      wireAll(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete product", message: "Remove this product?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("products", b.getAttribute("data-del"));
          U.toast("Product removed", "ok");
          renderProducts(container, canManage);
        });
      });
    }
  }

  function openProductModal(id) {
    var p = id ? DB.find("products", function (x) { return x.id === id; }) : null;
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Name</label><input id="pd-name" value="' + U.escape(p ? p.name : "") + '" /></div>' +
      '<div class="field"><label>Category</label><select id="pd-cat"><option>Supplements</option><option>Accessories</option><option>Apparel</option><option>Other</option></select></div>' +
      '<div class="field"><label>Quantity</label><input id="pd-qty" type="number" min="0" value="' + (p ? p.quantity : 10) + '" /></div>' +
      '<div class="field"><label>Purchase price</label><input id="pd-buy" type="number" step="0.01" min="0" value="' + (p ? p.purchasePrice : 10) + '" /></div>' +
      '<div class="field"><label>Selling price</label><input id="pd-sell" type="number" step="0.01" min="0" value="' + (p ? p.sellPrice : 15) + '" /></div>' +
      '<div class="field"><label>Supplier</label><input id="pd-supplier" value="' + U.escape(p ? p.supplier || "" : "") + '" /></div>' +
      '</div>';
    var close = U.modal({ title: p ? "Edit Product" : "Add Product", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>' });
    if (p) {
      var c = containerOf(close, "#pd-cat");
      var opt = Array.prototype.find.call(c.options, function (o) { return o.value === p.category; });
      if (opt) c.value = p.category;
    }
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var name = containerOf(close, "#pd-name").value.trim();
      if (!name) { U.toast("Name required", "err"); return; }
      var data = {
        name: name, category: containerOf(close, "#pd-cat").value,
        quantity: +containerOf(close, "#pd-qty").value || 0,
        purchasePrice: +containerOf(close, "#pd-buy").value || 0,
        sellPrice: +containerOf(close, "#pd-sell").value || 0,
        supplier: containerOf(close, "#pd-supplier").value.trim()
      };
      if (p) { DB.update("products", p.id, data); U.toast("Product updated", "ok"); }
      else { DB.insert("products", Object.assign({ code: DB.nextCode("P", "products") }, data)); U.toast("Product added", "ok"); }
      Auth.log(Auth.current(), "Store", (p ? "Edited " : "Added ") + name, "info");
      close(); refreshView();
    });
  }

  function renderSales(container, canManage) {
    var sales = DB.all("sales").sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var total = sales.reduce(function (s, x) { return s + (+x.total || 0); }, 0);
    var html = (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("New Sale", "bag", "btn-primary", 'id="sale-new"') + '</div>' : '') +
      '<div class="card" style="margin-bottom:16px;padding:14px 18px"><div class="row"><div class="grow small muted">Total sales recorded</div><div style="font-weight:800;font-size:18px">' + U.fmtMoney(total) + ' <span class="small muted">( ' + sales.length + ' invoices )</span></div></div></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Invoice</th><th>Date</th><th>Items</th><th style="text-align:right">Total</th><th>Method</th><th>Member</th><th style="width:100px"></th></tr></thead><tbody>';
    if (!sales.length) html += '<tr><td colspan="7">' + VUI.empty("bag", "No sales yet") + '</td></tr>';
    sales.forEach(function (s) {
      html += '<tr><td class="mono">' + U.escape(s.invoiceNo || "") + '</td><td>' + U.fmtDate(s.date) + '</td>' +
        '<td class="small">' + (s.items || []).map(function (i) { return U.escape(i.name) + " ×" + i.qty; }).join(", ") + '</td>' +
        '<td style="text-align:right;font-weight:700">' + U.fmtMoney(s.total) + '</td><td>' + U.escape(s.method || "—") + '</td>' +
        '<td>' + (s.memberId ? (function () { var m = DB.memberOf(s.memberId); return m ? U.escape(m.name) : "—"; })() : '<span class="muted">Walk-in</span>') + '</td>' +
        (canManage ? '<td><div class="tbl-actions"><button class="icon-btn danger" data-del="' + s.id + '">' + U.icon("trash", 15) + '</button></div></td>' : '<td></td>') +
        '</tr>';
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;

    if (canManage) {
      container.querySelector("#sale-new").addEventListener("click", function () { openPOS(); });
      wireAll(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete sale", message: "Delete this sale record?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("sales", b.getAttribute("data-del"));
          U.toast("Sale deleted", "ok");
          renderSales(container, canManage);
        });
      });
    }
  }

  function openPOS() {
    var prods = DB.all("products").filter(function (p) { return +p.quantity > 0; });
    var members = DB.all("members");
    var body = '<div class="section-label">Cart</div><div id="pos-items"></div>' +
      '<div class="form-grid" style="margin-top:14px">' +
      '<div class="field"><label>Member (optional)</label><select id="pos-member"><option value="">Walk-in / Guest</option>' + members.map(function (m) { return '<option value="' + m.id + '">' + U.escape(m.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Payment method</label><select id="pos-method"><option>cash</option><option>card</option><option>online</option></select></div>' +
      '</div>' +
      '<div class="row" style="margin-top:16px;align-items:center"><div class="grow small muted">Tax: ' + DB.settings().taxRate + '%</div>' +
      '<div style="font-size:20px;font-weight:800" id="pos-total">—</div></div>';

    var close = U.modal({ title: "New Sale", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-complete>' + U.icon("check", 15) + 'Complete Sale</button>' });

    var itemsBox = containerOf(close, "#pos-items");
    var cart = [];
    function addRow() {
      var row = U.el('<div class="row" style="gap:8px;margin-bottom:8px;align-items:center" data-posrow>' +
        '<select class="pos-prod" style="flex:2;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px">' +
        prods.map(function (p) { return '<option value="' + p.id + '">' + U.escape(p.name) + ' (' + p.quantity + ' left)</option>'; }).join("") + '</select>' +
        '<input class="pos-qty" type="number" min="1" value="1" style="width:70px;height:34px;padding:0 8px;background:var(--bg-1);border:1px solid var(--border);border-radius:8px;color:var(--text-1);font-size:12.5px"/>' +
        '<div class="pos-line small muted" style="min-width:60px;text-align:right"></div>' +
        '<button class="icon-btn danger" data-pos-remove>' + U.icon("x", 14) + '</button></div>');
      itemsBox.appendChild(row);
      row.querySelector("[data-pos-remove]").addEventListener("click", function () { row.remove(); updateTotal(); });
      row.querySelector(".pos-prod").addEventListener("change", updateTotal);
      row.querySelector(".pos-qty").addEventListener("input", updateTotal);
    }
    function updateTotal() {
      var total = 0;
      itemsBox.querySelectorAll("[data-posrow]").forEach(function (r) {
        var pid = r.querySelector(".pos-prod").value;
        var qty = +r.querySelector(".pos-qty").value || 0;
        var prod = DB.find("products", function (x) { return x.id === pid; });
        var line = qty * (prod ? prod.sellPrice : 0);
        r.querySelector(".pos-line").textContent = prod ? U.fmtMoney(line) : "";
        total += line;
      });
      var tax = total * (DB.settings().taxRate / 100);
      containerOf(close, "#pos-total").textContent = U.fmtMoney(total + tax) + (tax ? " incl. tax " + U.fmtMoney(tax) : "");
    }
    addRow();
    updateTotal();

    containerOf(close, "[data-complete]").addEventListener("click", function () {
      var items = [];
      var ok = true;
      itemsBox.querySelectorAll("[data-posrow]").forEach(function (r) {
        var pid = r.querySelector(".pos-prod").value;
        var qty = +r.querySelector(".pos-qty").value || 0;
        if (!pid || qty <= 0) return;
        var prod = DB.find("products", function (x) { return x.id === pid; });
        if (qty > +prod.quantity) { U.toast(prod.name + " only has " + prod.quantity + " in stock", "err"); ok = false; return; }
        DB.update("products", prod.id, { quantity: Math.max(0, +prod.quantity - qty) });
        items.push({ productId: prod.id, name: prod.name, qty: qty, price: prod.sellPrice });
      });
      if (!ok) return;
      if (!items.length) { U.toast("Cart is empty", "err"); return; }
      var sub = items.reduce(function (s, i) { return s + i.qty * i.price; }, 0);
      var tax = sub * (DB.settings().taxRate / 100);
      var invNo = DB.nextInvoice("SL");
      var memberId = containerOf(close, "#pos-member").value || null;
      var sale = DB.insert("sales", {
        invoiceNo: invNo, date: DB.todayISO(), items: items,
        total: Math.round((sub + tax) * 100) / 100, memberId: memberId,
        method: containerOf(close, "#pos-method").value
      });
      if (memberId) {
        DB.insert("payments", {
          invoiceNo: invNo, memberId: memberId, type: "store", amount: sale.total, paid: 1,
          method: sale.method, date: DB.todayISO(), status: "paid", notes: "Store purchase"
        });
      }
      Auth.log(Auth.current(), "Sale", invNo + " for " + U.fmtMoney(sale.total), "info");
      U.toast("Sale completed — " + invNo, "ok");
      close();
      refreshView();
    });
  }

  /* ============================================================
     CLASSES
     ============================================================ */
  V.register({
    id: "classes",
    label: "Classes & Booking",
    icon: "calendar",
    group: "Operations",
    render: function (container) {
      var canManage = VUIcan(["admin", "manager", "reception"]);
      var isMember = Auth.current().role === "member";
      var classes = DB.all("classes");
      var html = VUI.ph("Classes & Booking", "Weekly class schedule with capacity management") +
        (canManage ? '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("Add Class", "plus", "btn-primary", 'id="cl-add"') + '</div>' : '') +
        '<div class="grid grid-3" id="cl-grid">';

      if (!classes.length) html += '<div class="card" style="grid-column:1/-1">' + VUI.empty("calendar", "No classes scheduled", "Create your first group class.") + '</div>';
      var ordered = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      classes.sort(function (a, b) { return ordered.indexOf(a.dayOfWeek) - ordered.indexOf(b.dayOfWeek) || a.time.localeCompare(b.time); });
      var me = null;
      if (isMember) me = resolveMemberForUser();

      classes.forEach(function (c) {
        var tr = DB.trainerOf(c.trainerId);
        var booked = DB.all("bookings").filter(function (b) { return b.classId === c.id && b.status === "booked"; }).length;
        var full = booked >= c.capacity;
        var pct = Math.min(100, Math.round((booked / c.capacity) * 100));
        var myBooking = me && DB.find("bookings", function (b) { return b.classId === c.id && b.memberId === me.id && b.status === "booked"; });
        html += '<div class="card" style="border-top:3px solid ' + c.color + '">' +
          '<div class="row" style="align-items:center"><div><div style="font-weight:700;font-size:15px">' + U.escape(c.name) + '</div>' +
          '<div class="small muted">' + U.escape(c.dayOfWeek) + ' &middot; ' + U.escape(c.time) + ' &middot; ' + c.durationMin + ' min</div></div>' +
          '<div class="grow"></div>' +
          '<span class="badge violet">' + U.escape(c.room || "Gym") + '</span></div>' +
          '<div class="row" style="margin-top:10px;align-items:center"><div class="grow small muted">' + (tr ? "Trainer: <b>" + U.escape(tr.name) + '</b>' : '') + '</div>' +
          '<div style="font-weight:700">' + booked + '/' + c.capacity + (full ? ' <span class="badge danger"><span class="b-dot"></span>Full</span>' : '') + '</div></div>' +
          '<div class="stat-bar"><div class="sb-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="row" style="margin-top:12px;gap:8px">' +
          (isMember ? (myBooking ?
            '<button class="btn btn-ghost btn-sm" data-cancel="' + c.id + '">' + U.icon("x", 13) + 'Cancel My Booking</button>' :
            '<button class="btn btn-primary btn-sm" data-book="' + c.id + '"' + (full ? " disabled" : "") + '>' + U.icon("check", 13) + 'Book Seat</button>') :
            '<button class="btn btn-ghost btn-sm" data-view="' + c.id + '">' + U.icon("users", 13) + 'Bookings</button>') +
          (canManage ? '<span class="grow"></span><button class="icon-btn" data-edit="' + c.id + '">' + U.icon("edit", 15) + '</button>' +
            '<button class="icon-btn danger" data-del="' + c.id + '">' + U.icon("trash", 15) + '</button>' : '') +
          '</div></div>';
      });
      html += '</div>';
      container.innerHTML = html;

      if (canManage) container.querySelector("#cl-add").addEventListener("click", function () { openClassModal(null); });
      wireAll(container, "[data-view]", function (b) { viewClassBookings(b.getAttribute("data-view")); });
      wireAll(container, "[data-book]", function (b) { bookClass(b.getAttribute("data-book"), me); });
      wireAll(container, "[data-cancel]", function (b) { cancelBooking(b.getAttribute("data-cancel"), me); });
      wireAll(container, "[data-edit]", function (b) { openClassModal(b.getAttribute("data-edit")); });
      wireAll(container, "[data-del]", function (b) {
        U.confirmDialog({ title: "Delete class", message: "Remove this class from the schedule?", danger: true, okLabel: "Delete" }).then(function (ok) {
          if (!ok) return;
          DB.remove("classes", b.getAttribute("data-del"));
          DB.removeWhere("bookings", function (x) { return x.classId === b.getAttribute("data-del"); });
          U.toast("Class deleted", "ok");
          V.get("classes").render(container);
        });
      });
    }
  });

  function resolveMemberForUser() {
    var u = Auth.current();
    if (u.memberId) return DB.memberOf(u.memberId);
    return DB.find("members", function (m) { return m.name.toLowerCase() === (u.name || "").toLowerCase(); });
  }

  function bookClass(classId, member) {
    if (!member) { U.toast("No linked member account found for your profile", "err"); return; }
    var cls = DB.find("classes", function (x) { return x.id === classId; });
    if (!cls) return;
    var booked = DB.all("bookings").filter(function (b) { return b.classId === classId && b.status === "booked"; }).length;
    if (booked >= cls.capacity) { U.toast("Class is full", "err"); return; }
    var dup = DB.find("bookings", function (b) { return b.classId === classId && b.memberId === member.id && b.status === "booked"; });
    if (dup) { U.toast("You already booked this class", "warn"); return; }
    DB.insert("bookings", { classId: classId, memberId: member.id, date: DB.todayISO(), status: "booked" });
    Auth.log(Auth.current(), "Booking", member.name + " booked " + cls.name, "info");
    U.toast("Booked: " + cls.name, "ok");
    refreshView();
  }
  function cancelBooking(classId, member) {
    if (!member) return;
    DB.removeWhere("bookings", function (b) { return b.classId === classId && b.memberId === member.id; });
    var cls = DB.find("classes", function (x) { return x.id === classId; });
    U.toast("Booking cancelled", "ok");
    refreshView();
  }

  function viewClassBookings(classId) {
    var cls = DB.find("classes", function (x) { return x.id === classId; });
    if (!cls) return;
    var bookings = DB.all("bookings").filter(function (b) { return b.classId === classId && b.status === "booked"; });
    var body = '<div class="section-label">' + U.escape(cls.name) + ' — ' + bookings.length + '/' + cls.capacity + ' booked</div>' +
      '<div class="stat-bar"><div class="sb-fill" style="width:' + Math.min(100, (bookings.length / cls.capacity) * 100) + '%"></div></div>' +
      '<div class="table-wrap" style="margin-top:14px"><table class="data-table" style="min-width:0"><thead><tr><th>Member</th><th>Booked</th><th></th></tr></thead><tbody>' +
      (bookings.length ? bookings.map(function (b) {
        var m = DB.memberOf(b.memberId);
        return '<tr><td>' + (m ? VUI.memberCell(m) : '<span class="muted">—</span>') + '</td><td>' + U.fmtDate(b.date) + '</td>' +
          '<td><button class="icon-btn danger btn-sm" data-remove="' + b.id + '">' + U.icon("x", 14) + '</button></td></tr>';
      }).join("") : '<tr><td colspan="3">' + VUI.empty("users", "No bookings yet") + '</td></tr>') +
      '</tbody></table></div><div style="margin-top:12px">';
    var close = U.modal({
      title: "Class Bookings", body: body, wide: false,
      foot: '<button class="btn btn-primary" id="cb-add">' + U.icon("plus", 14) + 'Book Member</button><button class="btn btn-ghost" data-close>Close</button>'
    });
    var root = document.querySelector(".modal-backdrop .modal");
    root.querySelectorAll("[data-remove]").forEach(function (b) {
      b.addEventListener("click", function () {
        DB.remove("bookings", b.getAttribute("data-remove"));
        U.toast("Booking removed", "ok");
        viewClassBookings(classId); close();
      });
    });
    root.querySelector("#cb-add").addEventListener("click", function () {
      var members = DB.all("members");
      if (!members.length) { U.toast("No members", "err"); return; }
      var opts = members.map(function (m) { return '<option value="' + m.id + '">' + U.escape(m.name) + '</option>'; }).join("");
      var m2 = U.modal({
        title: "Book member — " + U.escape(cls.name), body: '<div class="field"><label>Member</label><select id="cb-member">' + opts + '</select></div>', narrow: true,
        foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Book</button>'
      });
      Array.from(m2 ? [0] : []).forEach(function () {});
      document.querySelector(".modal-backdrop .modal [data-save]").addEventListener("click", function () {
        var mid = document.querySelector(".modal-backdrop .modal #cb-member").value;
        var booked = DB.all("bookings").filter(function (b) { return b.classId === classId && b.status === "booked"; }).length;
        if (booked >= cls.capacity) { U.toast("Class is full", "err"); return; }
        DB.insert("bookings", { classId: classId, memberId: mid, date: DB.todayISO(), status: "booked" });
        Auth.log(Auth.current(), "Booking", "Booked " + cls.name, "info");
        U.toast("Member booked", "ok");
        close(); viewClassBookings(classId);
      });
    });
  }

  function openClassModal(id) {
    var c = id ? DB.find("classes", function (x) { return x.id === id; }) : null;
    var trainers = DB.all("trainers");
    var days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    var colors = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f472b6"];
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Class name</label><input id="cl-name" value="' + U.escape(c ? c.name : "") + '" /></div>' +
      '<div class="field"><label>Trainer</label><select id="cl-trainer">' + trainers.map(function (t) { return '<option value="' + t.id + '"' + (c && c.trainerId === t.id ? " selected" : "") + '>' + U.escape(t.name) + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Day</label><select id="cl-day">' + days.map(function (d) { return '<option' + (c && c.dayOfWeek === d ? " selected" : "") + '>' + d + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Time</label><input type="time" id="cl-time" value="' + (c ? c.time : "18:00") + '" /></div>' +
      '<div class="field"><label>Duration (min)</label><input id="cl-dur" type="number" min="10" value="' + (c ? c.durationMin : 60) + '" /></div>' +
      '<div class="field"><label>Capacity</label><input id="cl-cap" type="number" min="1" value="' + (c ? c.capacity : 15) + '" /></div>' +
      '<div class="field"><label>Room</label><input id="cl-room" value="' + U.escape(c ? c.room || "" : "") + '" /></div>' +
      '<div class="field"><label>Color</label><input type="color" id="cl-color" value="' + (c ? c.color : "#22d3ee") + '" /></div>' +
      '</div>';
    var close = U.modal({ title: c ? "Edit Class" : "Add Class", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>' });
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var name = containerOf(close, "#cl-name").value.trim();
      if (!name) { U.toast("Name required", "err"); return; }
      var data = {
        name: name, trainerId: containerOf(close, "#cl-trainer").value,
        dayOfWeek: containerOf(close, "#cl-day").value, time: containerOf(close, "#cl-time").value,
        durationMin: +containerOf(close, "#cl-dur").value || 60, capacity: +containerOf(close, "#cl-cap").value || 15,
        room: containerOf(close, "#cl-room").value.trim(), color: containerOf(close, "#cl-color").value,
        active: true
      };
      if (c) { DB.update("classes", c.id, data); U.toast("Class updated", "ok"); }
      else { DB.insert("classes", data); U.toast("Class added", "ok"); }
      Auth.log(Auth.current(), "Class", (c ? "Edited " : "Added ") + name, "info");
      close(); refreshView();
    });
  }

  /* ============================================================
     REPORTS
     ============================================================ */
  V.register({
    id: "reports",
    label: "Reports & Analytics",
    icon: "chart",
    group: "Finance",
    render: function (container) {
      var revenue = DB.revenueByMonth(6);
      var expenses = DB.expensesByMonth(6);
      var revTotal = revenue.reduce(function (s, x) { return s + x.total; }, 0);
      var expTotal = expenses.reduce(function (s, x) { return s + x.total; }, 0);
      var members = DB.all("members");
      var breakdown = {};
      members.forEach(function (m) {
        var k = DB.memberStatus(m);
        breakdown[k] = (breakdown[k] || 0) + 1;
      });
      var planSplit = {};
      members.forEach(function (m) {
        if (m.planId) {
          var p = DB.planById(m.planId);
          planSplit[p ? p.name : "Other"] = (planSplit[p ? p.name : "Other"] || 0) + 1;
        }
      });
      var totalPlans = Object.keys(planSplit).reduce(function (s, k) { return s + planSplit[k]; }, 0);

      var html = VUI.ph("Reports & Analytics", "Business performance, membership and money insights") +
        '<div class="kpi-row">' +
        VUI.kpi("dollar", "c1", "Revenue (6 mo)", U.fmtMoney(revTotal), "from invoices") +
        VUI.kpi("receipt", "c5", "Expenses (6 mo)", U.fmtMoney(expTotal), "running costs") +
        VUI.kpi("trend", "c3", "Net Profit", U.fmtMoney(revTotal - expTotal), Math.round((revTotal || 0) >= expTotal ? 0 : 0) + "") +
        VUI.kpi("users", "c2", "Members", members.length, DB.activeCount() + " active") +
        '</div>';

      html += '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">' + U.icon("trend", 18) + 'Revenue vs Expenses</div><div class="chart-box"><canvas class="chart" id="rp-rev"></canvas></div></div>' +
        '<div class="card"><div class="card-title">' + U.icon("tiers", 18) + 'Membership split</div><div class="chart-box"><canvas class="chart" id="rp-donut"></canvas></div></div>' +
        '<div class="card"><div class="card-title">' + U.icon("alert", 18) + 'Member status breakdown</div>' +
        '<table class="data-table" style="min-width:0"><tbody>' +
        renderBreakdownRow("Active", breakdown.active || 0, members.length) +
        renderBreakdownRow("Expiring soon", breakdown.expiring || 0, members.length) +
        renderBreakdownRow("Expired", breakdown.expired || 0, members.length) +
        renderBreakdownRow("Frozen", breakdown.frozen || 0, members.length) +
        renderBreakdownRow("No plan", breakdown.pending || 0, members.length) +
        '</tbody></table></div>' +
        '<div class="card"><div class="card-title">' + U.icon("download", 18) + 'Export data</div>' +
        '<p class="small muted" style="margin-bottom:12px">Download full CSV exports for your records.</p>' +
        '<div class="wrap">' +
        '<button class="btn btn-ghost btn-sm" data-export="members">' + U.icon("users", 14) + ' Members</button>' +
        '<button class="btn btn-ghost btn-sm" data-export="payments">' + U.icon("dollar", 14) + ' Payments</button>' +
        '<button class="btn btn-ghost btn-sm" data-export="attendance">' + U.icon("scan", 14) + ' Attendance</button>' +
        '<button class="btn btn-ghost btn-sm" data-export="expenses">' + U.icon("receipt", 14) + ' Expenses</button>' +
        '<button class="btn btn-ghost btn-sm" data-export="sales">' + U.icon("bag", 14) + ' Sales</button>' +
        '</div><div class="divider"></div>' +
        '<p class="small muted" style="margin-bottom:12px">Full backup of the entire system as JSON.</p>' +
        '<button class="btn btn-ghost btn-sm" data-export="backup">' + U.icon("database", 14) + ' Backup (JSON)</button>' +
        '</div></div>';

      container.innerHTML = html;

      requestAnimationFrame(function () {
        var months = revenue.map(function (x) { return x.label; });
        Charts.line(document.getElementById("rp-rev"), {
          labels: months,
          values: revenue.map(function (x) { return x.total; })
        });
        Charts.donut(document.getElementById("rp-donut"), {
          data: Object.keys(planSplit).map(function (k) { return { label: k, value: planSplit[k] }; }),
          centerTop: "Members",
          centerValue: String(totalPlans)
        });
      });

      wireAll(container, "[data-export]", function (b) { exportData(b.getAttribute("data-export")); });
    }
  });

  function renderBreakdownRow(label, count, total) {
    var pct = total ? Math.round((count / total) * 100) : 0;
    return '<tr><td>' + label + '</td><td style="width:60%"><div class="stat-bar"><div class="sb-fill" style="width:' + pct + '%"></div></div></td><td style="text-align:right;width:80px"><b>' + count + '</b></td></tr>';
  }

  function exportData(kind) {
    if (kind === "backup") {
      var data = {
        exported: new Date().toISOString(),
        gym: DB.settings(),
        users: DB.all("users"), members: DB.all("members"), plans: DB.all("plans"),
        payments: DB.all("payments"), attendance: DB.all("attendance"), trainers: DB.all("trainers"),
        workouts: DB.all("workouts"), diets: DB.all("diets"), progress: DB.all("progress"),
        equipment: DB.all("equipment"), expenses: DB.all("expenses"), products: DB.all("products"),
        sales: DB.all("sales"), classes: DB.all("classes"), bookings: DB.all("bookings"), logs: DB.all("logs")
      };
      U.downloadJSON("apexgym-backup-" + DB.todayISO() + ".json", data);
      U.toast("Backup downloaded", "ok");
      return;
    }
    var rows = [], headers = [];
    if (kind === "members") {
      headers = ["Code", "Name", "Email", "Phone", "Gender", "Plan", "Status", "Joined", "Expiry", "Trainer"];
      rows = DB.all("members").map(function (m) {
        var p = DB.planById(m.planId);
        var t = DB.trainerOf(m.trainerId);
        return [m.code, m.name, m.email, m.phone, m.gender, p ? p.name : "", DB.memberStatus(m), m.joinDate, m.planExpiry || "", t ? t.name : ""];
      });
    } else if (kind === "payments") {
      headers = ["Invoice", "Member", "Type", "Amount", "Method", "Status", "Date", "Notes"];
      rows = DB.all("payments").map(function (p) {
        var m = DB.memberOf(p.memberId);
        return [p.invoiceNo, m ? m.name : "", p.type, p.amount, p.method, p.status, p.date, p.notes];
      });
    } else if (kind === "attendance") {
      headers = ["Date", "Member", "Check-in", "Check-out", "Source"];
      rows = DB.all("attendance").map(function (a) {
        var m = DB.memberOf(a.memberId);
        return [a.date, m ? m.name : "", a.checkIn, a.checkOut || "", a.source];
      });
    } else if (kind === "expenses") {
      headers = ["Date", "Category", "Amount", "Payee", "Description"];
      rows = DB.all("expenses").map(function (e) { return [e.date, e.category, e.amount, e.payee, e.description]; });
    } else if (kind === "sales") {
      headers = ["Invoice", "Date", "Items", "Total", "Method"];
      rows = DB.all("sales").map(function (s) { return [s.invoiceNo, s.date, (s.items || []).map(function (i) { return i.name + " x" + i.qty; }).join("; "), s.total, s.method]; });
    }
    U.downloadCSV(kind + "_" + DB.todayISO() + ".csv", headers, rows);
    U.toast(kind.charAt(0).toUpperCase() + kind.slice(1) + " exported", "ok");
  }

  /* ============================================================
     ACTIVITY LOG
     ============================================================ */
  var actState = { q: "", page: 1 };
  V.register({
    id: "activity",
    label: "Activity Log",
    icon: "activity",
    group: "System",
    render: function (container) {
      var isAdmin = Auth.current().role === "admin";
      var toolbar = '<div class="toolbar"><div class="search-box">' + U.icon("search", 17) +
        '<input id="act-q" type="text" placeholder="Search user or action…" value="' + U.escape(actState.q) + '" /></div>' +
        '<div class="toolbar-spacer"></div>' +
        (isAdmin ? VUI.btn("Clear Logs", "trash", "btn-danger btn-sm", 'id="act-clear"') : '') + '</div>';
      container.innerHTML = VUI.ph("Activity Log", "Every important action, recorded") + toolbar +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Detail</th></tr></thead><tbody id="act-body"></tbody></table></div>' +
        '<div id="act-pager"></div>';

      var q = container.querySelector("#act-q");
      q.addEventListener("input", function () { actState.q = q.value.trim().toLowerCase(); actState.page = 1; drawAct(container); });
      if (isAdmin) container.querySelector("#act-clear").addEventListener("click", function () {
        U.confirmDialog({ title: "Clear activity log", message: "Remove all log entries?", danger: true, okLabel: "Clear" }).then(function (ok) {
          if (!ok) return;
          DB.removeWhere("logs", function () { return true; });
          U.toast("Log cleared", "ok");
          drawAct(container);
        });
      });
      drawAct(container);
    }
  });

  function drawAct(container) {
    var list = DB.all("logs");
    if (actState.q) list = list.filter(function (l) {
      return (l.user || "").toLowerCase().indexOf(actState.q) >= 0 || (l.action || "").toLowerCase().indexOf(actState.q) >= 0 || (l.detail || "").toLowerCase().indexOf(actState.q) >= 0;
    });
    list.sort(function (a, b) { return (b.time || 0) - (a.time || 0); });
    var per = 25, pages = Math.max(1, Math.ceil(list.length / per));
    if (actState.page > pages) actState.page = pages;
    var page = list.slice((actState.page - 1) * per, actState.page * per);
    var body = container.querySelector("#act-body");
    if (!page.length) body.innerHTML = '<tr><td colspan="5">' + VUI.empty("activity", "No activity recorded") + '</td></tr>';
    else {
      var badgeMap = { success: "ok", danger: "danger", warn: "warn", info: "info" };
      body.innerHTML = page.map(function (l) {
        return '<tr><td class="mono small">' + U.fmtDateTime(l.time) + '</td><td>' + U.escape(l.user || "system") + '</td>' +
          '<td><span class="badge gray">' + U.escape(l.role || "—") + '</span></td>' +
          '<td><span class="badge ' + (badgeMap[l.type] || "gray") + '"><span class="b-dot"></span>' + U.escape(l.action) + '</span></td>' +
          '<td class="small muted">' + U.escape(l.detail || "") + '</td></tr>';
      }).join('');
    }
    container.querySelector("#act-pager").innerHTML = U.pagerHtml(actState.page, pages);
    U.bindPager(container.querySelector("#act-pager"), function (p) { actState.page = p; drawAct(container); });
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  V.register({
    id: "settings",
    label: "Settings",
    icon: "settings",
    group: "System",
    render: function (container) {
      var s = DB.settings();
      var isAdmin = Auth.current().role === "admin";
      var users = DB.all("users");

      var html = VUI.ph("Settings", "Gym profile, system configuration and data management") +
        '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">' + U.icon("settings", 18) + 'Gym profile & business settings</div>' +
        '<div class="form-grid">' +
        '<div class="field"><label>Gym name</label><input id="st-gymname" value="' + U.escape(s.gymName) + '" /></div>' +
        '<div class="field"><label>Brand code (receipts)</label><input id="st-brand" value="' + U.escape(s.brand) + '" /></div>' +
        '<div class="field"><label>Currency symbol</label><input id="st-symbol" value="' + U.escape(s.symbol) + '" /></div>' +
        '<div class="field"><label>Tax rate (%)</label><input id="st-tax" type="number" step="0.1" min="0" value="' + s.taxRate + '" /></div>' +
        '<div class="field"><label>Opening hour</label><input type="time" id="st-open" value="' + s.openingHour + '" /></div>' +
        '<div class="field"><label>Closing hour</label><input type="time" id="st-close" value="' + s.closingHour + '" /></div>' +
        '<div class="field"><label>Low stock alert (units)</label><input id="st-low" type="number" min="0" value="' + s.lowStockThreshold + '" /></div>' +
        '<div class="field"><label>Membership expiry alert (days)</label><input id="st-expiry" type="number" min="1" value="' + s.expiryAlertDays + '" /></div>' +
        '<div class="field field-range"><label>Receipt footer</label><input id="st-footer" value="' + U.escape(s.receiptFooter || "") + '" /></div>' +
        '</div><div style="margin-top:14px"><button class="btn btn-primary" id="st-save">' + U.icon("check", 15) + 'Save Settings</button></div>' +
        '</div>' +

        '<div class="card"><div class="card-title">' + U.icon("shield", 18) + 'Data management</div>' +
        '<p class="small muted" style="margin-bottom:12px">The system persists to your browser\'s local storage. You can back it up or reset whenever you like.</p>' +
        '<div class="row" style="gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost" id="st-backup">' + U.icon("download", 15) + ' Backup Data</button>' +
        '<button class="btn btn-ghost" id="st-import">' + U.icon("file", 15) + ' Restore Backup</button>' +
        '<input type="file" id="st-import-file" accept="application/json" hidden />' +
        '</div>' +
        '<div class="divider"></div>' +
        '<p class="small muted" style="margin-bottom:10px;color:var(--danger)">Danger zone — this wipes all data and re-seeds demo data.</p>' +
        '<button class="btn btn-danger" id="st-reset">' + U.icon("refresh", 15) + ' Reset to Demo Data</button>' +
        '</div>' +
        '</div>';

      /* users (admin only) */
      if (isAdmin) {
        html += '<div class="card" style="margin-top:16px"><div class="card-title">' + U.icon("shield", 18) + 'System users & roles</div>' +
          '<div class="toolbar"><div class="toolbar-spacer"></div>' + VUI.btn("Add User", "plus", "btn-primary", 'id="st-user-add"') + '</div>' +
          '<div class="table-wrap"><table class="data-table"><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Status</th><th>Last login</th><th style="width:90px"></th></tr></thead><tbody>' +
          users.map(function (u) {
            return '<tr><td><div class="cell-user"><span class="avatar">' + U.initials(u.name) + '</span><div><div class="cu-name">' + U.escape(u.name) + '</div><div class="cu-sub">' + U.escape(u.email || "") + '</div></div></div></td>' +
              '<td class="mono">' + U.escape(u.username) + '</td>' +
              '<td><span class="badge violet">' + U.escape(u.role) + '</span></td>' +
              '<td>' + (u.active ? '<span class="badge ok"><span class="b-dot"></span>Active</span>' : '<span class="badge danger"><span class="b-dot"></span>Deactivated</span>') + '</td>' +
              '<td class="small muted">' + (u.lastLogin ? U.fmtDateTime(u.lastLogin) : "never") + '</td>' +
              '<td><div class="tbl-actions">' +
              (u.username !== "admin" ? '<button class="icon-btn" data-edituser="' + u.id + '">' + U.icon("edit", 15) + '</button>' +
                '<button class="icon-btn ' + (u.active ? "" : "ok") + '" data-toggle="' + u.id + '">' + U.icon(u.active ? "lock" : "check", 15) + '</button>' : '') +
              '</div></td></tr>';
          }).join("") +
          '</tbody></table></div></div>';
      }

      container.innerHTML = html;

      container.querySelector("#st-save").addEventListener("click", function () {
        DB.saveSettings({
          gymName: fv("#st-gymname").trim(), brand: fv("#st-brand").trim().toUpperCase(),
          symbol: fv("#st-symbol").trim() || "$", taxRate: +fv("#st-tax") || 0,
          openingHour: fv("#st-open"), closingHour: fv("#st-close"),
          lowStockThreshold: +fv("#st-low") || 0, expiryAlertDays: +fv("#st-expiry") || 7,
          receiptFooter: fv("#st-footer")
        });
        Auth.log(Auth.current(), "Settings", "Updated gym settings", "info");
        U.toast("Settings saved", "ok");
        renderBranding();
      });
      container.querySelector("#st-backup").addEventListener("click", function () { exportData("backup"); });
      container.querySelector("#st-import").addEventListener("click", function () { container.querySelector("#st-import-file").click(); });
      var fileInput = container.querySelector("#st-import-file");
      fileInput.addEventListener("change", function () {
        var file = fileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var data = JSON.parse(reader.result);
            if (!data.gym || !data.members) throw new Error("bad format");
            var map = { settings: "gym", plans: "plans", members: "members", payments: "payments", attendance: "attendance", trainers: "trainers", workouts: "workouts", diets: "diets", progress: "progress", equipment: "equipment", expenses: "expenses", products: "products", sales: "sales", classes: "classes", bookings: "bookings", logs: "logs", users: "users" };
            Object.keys(map).forEach(function (key) { DB.set(key, data[map[key]] || []); });
            DB.saveSettings(Object.assign({}, DB.settings(), data.gym));
            U.toast("Backup restored", "ok");
            setTimeout(function () { location.reload(); }, 600);
          } catch (e) { U.toast("Invalid backup file", "err"); }
        };
        reader.readAsText(file);
      });
      container.querySelector("#st-reset").addEventListener("click", function () {
        U.confirmDialog({ title: "Reset all data", message: "This wipes every record and re-seeds the demo dataset. Continue?", danger: true, okLabel: "Reset" }).then(function (ok) {
          if (!ok) return;
          DB.resetAll();
          DB.seed();
          Auth.logout();
          U.toast("Demo data restored", "info");
          location.reload();
        });
      });

      if (isAdmin) {
        container.querySelector("#st-user-add").addEventListener("click", function () { openUserModal(null); });
        wireAll(container, "[data-edituser]", function (b) { openUserModal(b.getAttribute("data-edituser")); });
        wireAll(container, "[data-toggle]", function (b) {
          var id = b.getAttribute("data-toggle");
          var u = DB.find("users", function (x) { return x.id === id; });
          if (!u) return;
          DB.update("users", id, { active: !u.active });
          Auth.log(Auth.current(), "User", (u.active ? "Deactivated " : "Activated ") + u.name, "warn");
          U.toast((u.active ? "Deactivated" : "Activated") + " " + u.name, "info");
          V.get("settings").render(container);
        });
      }
    }
  });

  function fv(sel) {
    var root = document.querySelector(".modal") || document.getElementById("view-root");
    var el = root.querySelector(sel);
    return el ? el.value : "";
  }

  function openUserModal(id) {
    var u = id ? DB.find("users", function (x) { return x.id === id; }) : null;
    var roles = ["admin", "manager", "reception", "trainer", "accountant", "member"];
    var body = '<div class="form-grid">' +
      '<div class="field"><label class="req">Full name</label><input id="us-name" value="' + U.escape(u ? u.name : "") + '" /></div>' +
      '<div class="field"><label class="req">Username</label><input id="us-user" value="' + U.escape(u ? u.username : "") + '"' + (u ? " disabled" : "") + ' /></div>' +
      '<div class="field"><label class="req">Password</label><input id="us-pass" value="' + U.escape(u ? u.password : "") + '" placeholder="' + (u ? "" : "set a password") + '" /></div>' +
      '<div class="field"><label>Email</label><input id="us-email" value="' + U.escape(u ? u.email || "" : "") + '" /></div>' +
      '<div class="field"><label>Role</label><select id="us-role">' + roles.map(function (r) { return '<option value="' + r + '"' + (u && u.role === r ? " selected" : "") + '>' + r + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label>Status</label><select id="us-active"><option value="1">Active</option><option value="0">Deactivated</option></select></div>' +
      '</div>';
    var close = U.modal({ title: u ? "Edit User" : "Add User", body: body, wide: true, foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Save</button>' });
    if (u) {
      var a = containerOf(close, "#us-active");
      a.value = u.active ? "1" : "0";
    }
    containerOf(close, "[data-save]").addEventListener("click", function () {
      var name = containerOf(close, "#us-name").value.trim();
      var username = containerOf(close, "#us-user").value.trim();
      var pass = containerOf(close, "#us-pass").value;
      if (!name || !username) { U.toast("Name and username required", "err"); return; }
      if (!u && !pass) { U.toast("Password required for new user", "err"); return; }
      var data = {
        name: name, username: username, password: pass || (u ? u.password : ""),
        email: containerOf(close, "#us-email").value.trim(),
        role: containerOf(close, "#us-role").value, active: containerOf(close, "#us-active").value === "1"
      };
      if (u) {
        if (data.username === "" || data.password === "") { U.toast("Cannot empty username/password", "err"); return; }
        DB.update("users", u.id, data);
        U.toast("User updated", "ok");
      } else {
        var dup = DB.find("users", function (x) { return x.username.toLowerCase() === username.toLowerCase(); });
        if (dup) { U.toast("Username already exists", "err"); return; }
        DB.insert("users", Object.assign({}, data, { lastLogin: null }));
        U.toast("User created", "ok");
      }
      Auth.log(Auth.current(), "User", (u ? "Edited " : "Created ") + name, "info");
      close(); refreshView();
    });
  }

  /* ============================================================
     PROFILE
     ============================================================ */
  V.register({
    id: "profile",
    label: "My Profile",
    icon: "user",
    group: "Account",
    render: function (container) {
      var u = Auth.current();
      var s = DB.settings();
      /* linked member (for member accounts) */
      var me = null;
      if (u.role === "member") me = resolveMemberForUser();

      var html = VUI.ph("My Profile", (U.escape(u.name) + " &middot; " + U.escape(Auth.ROLE_LABEL[u.role] || u.role)));

      if (me) {
        var plan = DB.planById(me.planId);
        var qr = U.qrCanvas("APEX:" + me.code, 110);
        var today = DB.todayISO();
        var todayAtt = DB.find("attendance", function (a) { return a.memberId === me.id && a.date === today; });

        html += '<div class="profile-hero">' +
          (qr ? '<div class="mc-qr" style="padding:8px;background:#fff;border-radius:12px">' + qr.outerHTML + '</div>' : '<span class="avatar" style="width:90px;height:90px;font-size:34px">' + U.initials(me.name) + '</span>') +
          '<div class="ph-info"><h3>' + U.escape(me.name) + '</h3><div class="ph-sub mono">' + U.escape(me.code || "") + ' — show or scan this QR at the front desk to check in</div>' +
          '<div class="ph-stats">' +
          '<div class="ph-stat"><div class="p-value">' + VUI.badge(me) + '</div><div class="p-label">Membership</div></div>' +
          '<div class="ph-stat"><div class="p-value">' + (plan ? U.fmtMoney(plan.price) : "—") + '</div><div class="p-label">' + (plan ? U.escape(plan.name) : "No plan") + '</div></div>' +
          '<div class="ph-stat"><div class="p-value">' + (todayAtt ? todayAtt.checkIn : "Not yet") + '</div><div class="p-label">Check-in today</div></div>' +
          '<div class="ph-stat"><div class="p-value">' + U.fmtDate(me.planExpiry) + '</div><div class="p-label">Membership till</div></div>' +
          '</div></div>' +
          '</div>';
      } else {
        html += '<div class="profile-hero"><span class="avatar" style="width:74px;height:74px;font-size:30px">' + U.initials(u.name) + '</span>' +
          '<div class="ph-info"><h3>' + U.escape(u.name) + '</h3><div class="ph-sub">' + U.escape(u.email || "") + '</div></div></div>';
      }

      html += '<div class="grid grid-2">' +
        '<div class="card"><div class="card-title">' + U.icon("shield", 18) + 'Account</div>' +
        '<div class="quick-stats">' +
        '<div class="qs"><div class="qs-v">' + U.escape(u.username) + '</div><div class="qs-l">Username</div></div>' +
        '<div class="qs"><div class="qs-v">' + U.escape(u.role) + '</div><div class="qs-l">Role</div></div>' +
        '<div class="qs"><div class="qs-v">' + (u.lastLogin ? U.fmtDateTime(u.lastLogin) : "—") + '</div><div class="qs-l">Last login</div></div>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<button class="btn btn-ghost btn-sm" id="pf-pass">' + U.icon("lock", 14) + 'Change password</button>' +
        '</div>' +
        '<div class="card"><div class="card-title">' + U.icon("info", 18) + 'About ' + U.escape(s.gymName) + '</div>' +
        '<div class="quick-stats">' +
        '<div class="qs"><div class="qs-v">' + DB.activeCount() + '</div><div class="qs-l">Active members</div></div>' +
        '<div class="qs"><div class="qs-v">' + U.escape(s.openingHour + " – " + s.closingHour) + '</div><div class="qs-l">Hours</div></div>' +
        '<div class="qs"><div class="qs-v">' + U.escape(s.currency) + '</div><div class="qs-l">Currency</div></div>' +
        '</div></div>';

      /* member-only: their plans */
      if (me) {
        html += '<div class="card"><div class="card-title">' + U.icon("dumbbell", 18) + 'My workout plans</div>';
        var wos = DB.all("workouts").filter(function (w) { return w.memberId === me.id; });
        if (!wos.length) html += VUI.empty("dumbbell", "No workout plans", "Ask your trainer for a program.");
        else {
          html += '<div>' + wos.map(function (w) {
            var ex = (w.days || []).reduce(function (s, d) { return s + (d.exercises || []).length; }, 0);
            return '<div class="list-item"><div class="li-main"><div class="li-title">' + U.escape(w.title) + '</div><div class="li-sub">' + (w.days || []).length + ' day plan &middot; ' + ex + ' exercises</div></div><button class="btn btn-ghost btn-sm" data-woview="' + w.id + '">' + U.icon("eye", 13) + '</button></div>';
          }).join("") + '</div>';
        }
        html += '</div>';

        html += '<div class="card"><div class="card-title">' + U.icon("apple", 18) + 'My diet plan</div>';
        var ds = DB.all("diets").filter(function (d) { return d.memberId === me.id; });
        if (!ds.length) html += VUI.empty("apple", "No diet plan", "Nutrition guidance coming soon.");
        else {
          html += '<div>' + ds.map(function (d) {
            var kcal = (d.meals || []).reduce(function (s, x) { return s + (+x.calories || 0); }, 0);
            return '<div class="list-item"><div class="li-main"><div class="li-title">' + U.escape(d.title) + '</div><div class="li-sub">' + (d.meals || []).length + ' meals &middot; ' + kcal + ' kcal &middot; ' + (d.waterTarget || 0) + ' L water</div></div><button class="btn btn-ghost btn-sm" data-diview="' + d.id + '">' + U.icon("eye", 13) + '</button></div>';
          }).join("") + '</div>';
        }
        html += '</div>';
      }

      html += '</div>';

      container.innerHTML = html;

      container.querySelector("#pf-pass").addEventListener("click", function () {
        var close = U.modal({
          title: "Change password", narrow: true,
          body: '<div class="field"><label>Current password</label><input id="pw-cur" type="password" /></div><div style="height:10px"></div><div class="field"><label>New password</label><input id="pw-new" type="password" /></div>',
          foot: '<button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" data-save>Update</button>'
        });
        containerOf(close, "[data-save]").addEventListener("click", function () {
          var cur = containerOf(close, "#pw-cur").value;
          var nw = containerOf(close, "#pw-new").value;
          if (cur !== u.password) { U.toast("Current password is incorrect", "err"); return; }
          if (!nw || nw.length < 6) { U.toast("New password must be at least 6 characters", "err"); return; }
          DB.update("users", u.id, { password: nw });
          Auth.log(u, "Security", "Changed own password", "info");
          U.toast("Password updated", "ok");
          close();
        });
      });
      wireAll(container, "[data-woview]", function (b) { viewWorkout(b.getAttribute("data-woview")); });
      wireAll(container, "[data-diview]", function (b) { viewDiet(b.getAttribute("data-diview")); });
    }
  });

  /* ---------- tiny shared helpers ---------- */
  function wireAll(container, sel, cb) {
    container.querySelectorAll(sel).forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        cb(el);
      });
    });
  }
  function containerOf(close, sel) {
    var root = document.querySelector(".modal-backdrop .modal");
    return root ? root.querySelector(sel) : null;
  }
  function refreshView() {
    var hash = location.hash.replace(/^#\/?/, "").split("/")[0];
    var v = V.get(hash);
    if (v) v.render(document.getElementById("view-root"));
  }
})();