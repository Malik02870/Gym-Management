/* ============================================================
   APEX GYM — data layer
   Persistence: localStorage (browser) or injected shim (tests)
   ============================================================ */
(function () {
  "use strict";

  var PREFIX = "apexgym_";

  function storage() {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
    return {
      _data: {},
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
      setItem: function (k, v) { this._data[k] = String(v); },
      removeItem: function (k) { delete this._data[k]; }
    };
  }
  var LS = storage();

  /* ---------- core helpers ---------- */
  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function get(key, def) {
    try {
      var raw = LS.getItem(PREFIX + key);
      if (raw === null || raw === undefined) return def;
      return JSON.parse(raw);
    } catch (e) {
      return def;
    }
  }

  function set(key, val) {
    try { LS.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) { /* storage full / private mode */ }
  }

  /* ---------- date helpers (local timezone) ---------- */
  function pad(n, len) {
    len = len || 2;
    n = String(n);
    while (n.length < len) n = "0" + n;
    return n;
  }
  function todayISO(offsetDays) {
    var d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function addDaysISO(iso, days) {
    var p = iso.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function daysBetween(aISO, bISO) {
    var pa = aISO.split("-"), pb = bISO.split("-");
    var da = new Date(+pa[0], +pa[1] - 1, +pa[2]);
    var db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function monthKey(iso) { return iso.slice(0, 7); }
  function monthLabel(key) {
    var p = key.split("-");
    var names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return names[+p[1] - 1] + " " + p[0].slice(2);
  }
  function nowTime() {
    var d = new Date();
    return pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  /* ---------- collection API ---------- */
  function all(name) { return get(name, []); }
  function save(name, arr) { set(name, arr); }
  function list(name) { return all(name).slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }); }
  function insert(name, obj) {
    var arr = all(name);
    var rec = Object.assign({ id: uid(), createdAt: Date.now() }, obj);
    arr.push(rec);
    save(name, arr);
    return rec;
  }
  function find(name, pred) { return all(name).find(pred) || null; }
  function update(name, id, patch) {
    var arr = all(name);
    var idx = arr.findIndex(function (r) { return r.id === id; });
    if (idx < 0) return null;
    arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: Date.now() });
    save(name, arr);
    return arr[idx];
  }
  function remove(name, id) {
    var arr = all(name).filter(function (r) { return r.id !== id; });
    save(name, arr);
  }
  function removeWhere(name, pred) {
    var arr = all(name).filter(function (r) { return !pred(r); });
    save(name, arr);
  }
  function nextCode(prefix, collection) {
    var arr = all(collection);
    var max = 0;
    arr.forEach(function (r) {
      var m = String(r.code || "").match(/-(\d+)$/);
      if (m) max = Math.max(max, +m[1]);
    });
    return prefix + "-" + pad(max + 1, 3);
  }

  /* ============================================================
     DOMAIN HELPERS
     ============================================================ */
  function settings() {
    return Object.assign({
      gymName: "ApexGym",
      brand: "APEX",
      currency: "USD",
      symbol: "$",
      taxRate: 0,
      receiptFooter: "Thank you for training with us!",
      openingHour: "06:00",
      closingHour: "23:00",
      lowStockThreshold: 5,
      expiryAlertDays: 7
    }, get("settings", {}));
  }
  function saveSettings(patch) {
    var s = Object.assign(settings(), patch);
    set("settings", s);
    return s;
  }

  function planById(id) {
    return find("plans", function (p) { return p.id === id; });
  }

  /* member membership status: active | expiring | expired | frozen | pending */
  function memberStatus(member) {
    if (!member || !member.planId) return "pending";
    if (member.planStatus === "frozen") return "frozen";
    var expiry = member.planExpiry || "";
    var today = todayISO();
    if (!expiry) return "pending";
    if (expiry < today) return "expired";
    if (daysBetween(today, expiry) <= settings().expiryAlertDays) return "expiring";
    return "active";
  }

  function statusBadgeInfo(status) {
    var map = {
      active: { cls: "ok", label: "Active" },
      expiring: { cls: "warn", label: "Expiring" },
      expired: { cls: "danger", label: "Expired" },
      frozen: { cls: "info", label: "Frozen" },
      pending: { cls: "gray", label: "No Plan" }
    };
    return map[status] || map.pending;
  }

  function memberOf(id) { return find("members", function (m) { return m.id === id; }); }
  function trainerOf(id) { return find("trainers", function (t) { return t.id === id; }); }

  /* total amount member has paid (all payments) */
  function memberPaid(memberId) {
    return all("payments")
      .filter(function (p) { return p.memberId === memberId && p.status === "paid"; })
      .reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
  }

  /* revenue grouped by month, for the last N months */
  function revenueByMonth(nMonths) {
    var months = [];
    var today = todayISO();
    for (var i = nMonths - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      var key = d.getFullYear() + "-" + pad(d.getMonth() + 1);
      months.push({ key: key, label: monthLabel(key), total: 0 });
    }
    all("payments").forEach(function (p) {
      if (p.status !== "paid" || !p.date) return;
      var mk = monthKey(p.date);
      var m = months.find(function (x) { return x.key === mk; });
      if (m) m.total += +p.amount || 0;
    });
    return months;
  }

  /* pending money owed (payments recorded as pending/unpaid) */
  function pendingAmount() {
    return all("payments")
      .filter(function (p) { return p.status !== "paid"; })
      .reduce(function (s, p) { return s + (+p.amount || 0); }, 0);
  }

  function expensesByMonth(nMonths) {
    var months = [];
    var today = todayISO();
    for (var i = nMonths - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      var key = d.getFullYear() + "-" + pad(d.getMonth() + 1);
      months.push({ key: key, label: monthLabel(key), total: 0 });
    }
    all("expenses").forEach(function (e) {
      var mk = monthKey(e.date);
      var m = months.find(function (x) { return x.key === mk; });
      if (m) m.total += +e.amount || 0;
    });
    return months;
  }

  /* next invoice number from payments + sales */
  function nextInvoice(prefix) {
    var arr = all("payments").concat(all("sales"));
    var max = 0;
    arr.forEach(function (r) {
      var m = String(r.invoiceNo || "").match(/(\d+)$/);
      if (m) max = Math.max(max, +m[1]);
    });
    return prefix + "-" + String(max + 1).padStart(4, "0");
  }

  function groupedAttendance(nDays) {
    var days = [];
    for (var i = nDays - 1; i >= 0; i--) {
      var iso = todayISO(-i);
      var count = all("attendance").filter(function (a) { return a.date === iso; }).length;
      days.push({ label: iso.slice(5), date: iso, count: count });
    }
    return days;
  }

  /* notifications / alerts derived from data */
  function deriveAlerts() {
    var out = [];
    var cfg = settings();
    var today = todayISO();

    all("members").forEach(function (m) {
      var st = memberStatus(m);
      if (st === "expired") out.push({ sev: "danger", text: m.name + "'s membership expired", when: m.planExpiry });
      else if (st === "expiring") out.push({ sev: "warn", text: "Renewal due for " + m.name, when: m.planExpiry });
    });

    all("payments").forEach(function (p) {
      if (p.status !== "paid") out.push({ sev: "warn", text: "Unpaid " + (p.type || "payment") + " of " + money(p.amount) + " — " + (memberOf(p.memberId) || {}).name || "member", when: p.date });
    });

    all("products").forEach(function (p) {
      if (+p.quantity <= +(cfg.lowStockThreshold || 5)) out.push({ sev: "warn", text: "Low stock: " + p.name + " (" + p.quantity + " left)", when: "" });
    });

    all("equipment").forEach(function (e) {
      if (e.status === "broken") out.push({ sev: "danger", text: e.name + " is out of order", when: "" });
      else if (e.nextService && e.nextService <= today) out.push({ sev: "info", text: "Maintenance due: " + e.name, when: e.nextService });
    });

    out.sort(function (a, b) { return (a.when || "9999").localeCompare(b.when || "9999"); });
    return out;
  }

  function money(n) { return (settings().symbol || "$") + (+n || 0).toFixed(2); }

  /* current active member count */
  function activeCount() {
    return all("members").filter(function (m) { var s = memberStatus(m); return s === "active" || s === "expiring"; }).length;
  }

  /* ============================================================
     SEEDING
     ============================================================ */
  function seededFlag() {
    try { return LS.getItem(PREFIX + "seeded_v1"); } catch (e) { return null; }
  }
  function markSeeded() {
    try { LS.setItem(PREFIX + "seeded_v1", "1"); } catch (e) {}
  }

  function seed() {
    if (seededFlag() === "1") return;

    var NAMES_M = ["James Carter", "Liam Bennett", "Noah Foster", "Ethan Reid", "Oliver Grant", "Lucas Hayes", "Mason Cole", "Henry Brooks", "Owen Pierce", "Leo Marsh", "Asher Quinn", "Jack Dawson", "Ryan Stone", "Aiden Fox"];
    var NAMES_F = ["Emma Sullivan", "Olivia Reyes", "Ava Morgan", "Mia Torres", "Sophia Lane", "Isabella Reed", "Charlotte Hayes", "Amelia Ward", "Harper Cole", "Ella Brooks", "Grace Adams", "Nora Price", "Zoe Miller", "Ruby Clark"];
    var LAST = ["Carter", "Bennett", "Foster", "Reid", "Grant", "Hayes", "Cole", "Brooks", "Pierce", "Marsh", "Quinn", "Dawson", "Stone", "Fox", "Sullivan", "Reyes", "Morgan", "Torres", "Lane", "Reed", "Ward", "Adams", "Price", "Miller", "Clark"];
    function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function timeAm() { return pad(rnd(6, 11)) + ":" + pad(rnd(0, 59)); }
    function dateISO(offset) { return todayISO(-offset); }

    /* settings */
    saveSettings({
      gymName: "ApexGym", brand: "APEX", currency: "USD", symbol: "$",
      taxRate: 5, receiptFooter: "Thank you for training with us! Stay strong.",
      openingHour: "06:00", closingHour: "23:00", lowStockThreshold: 5, expiryAlertDays: 7
    });

    /* users */
    var users = [
      { username: "admin", password: "admin123", name: "Alex Morgan", role: "admin", email: "admin@apexgym.com", active: true },
      { username: "manager", password: "manager123", name: "Jordan Lee", role: "manager", email: "manager@apexgym.com", active: true },
      { username: "reception", password: "reception123", name: "Priya Sharma", role: "reception", email: "front@apexgym.com", active: true },
      { username: "trainer", password: "trainer123", name: "Marcus Reed", role: "trainer", email: "marcus@apexgym.com", active: true },
      { username: "accountant", password: "acc123", name: "Dana White", role: "accountant", email: "finance@apexgym.com", active: true },
      { username: "member", password: "member123", name: "Sam Carter", role: "member", email: "sam@mail.com", active: true }
    ];
    users.forEach(function (u) { insert("users", u); });

    /* plans */
    var plans = [
      { name: "Monthly Basic", type: "Monthly", durationDays: 30, price: 39, color: "#22d3ee", features: "Gym floor, locker access" },
      { name: "Monthly Premium", type: "Monthly", durationDays: 30, price: 69, color: "#a78bfa", features: "Gym floor, group classes, sauna" },
      { name: "Quarterly", type: "3-Month", durationDays: 90, price: 169, color: "#34d399", features: "All Premium + 1 PT session" },
      { name: "Semi-Annual", type: "6-Month", durationDays: 180, price: 299, color: "#60a5fa", features: "All Premium + 4 PT sessions" },
      { name: "Yearly VIP", type: "Yearly", durationDays: 365, price: 540, color: "#fbbf24", features: "Everything + unlimited PT" }
    ];
    plans.forEach(function (p) { insert("plans", p); });

    /* trainers */
    var specs = [
      ["Strength & Conditioning", 6, "Tue, Wed, Fri"],
      ["Muscle Building / Bodybuilding", 8, "Mon, Wed, Sat"],
      ["CrossFit & HIIT", 4, "Mon, Tue, Thu, Sat"],
      ["Yoga & Mobility", 5, "Mon, Wed, Fri, Sun"],
      ["Weight Loss / Cardio", 3, "Tue, Thu, Sat"]
    ];
    var tNames = ["Marcus Reed", "Diana Brooks", "Kenji Sato", "Lina Grant", "Carlos Velez"];
    ["Marcus Reed", "Diana Brooks", "Kenji Sato", "Lina Grant", "Carlos Velez"].forEach(function (n, i) {
      insert("trainers", {
        name: n, code: "TR-" + String(i + 1).padStart(3, "0"),
        email: n.toLowerCase().replace(/ /g, ".") + "@apexgym.com",
        phone: "555-010" + (10 + i),
        specialization: specs[i % specs.length][0],
        experience: specs[i % specs.length][1],
        schedule: specs[i % specs.length][2],
        salary: 900 + rnd(0, 60) * 10,
        joinDate: dateISO(300 + i * 30),
        active: true
      });
    });
    var trainerIds = all("trainers").map(function (t) { return t.id; });

    /* members */
    for (var i = 0; i < 24; i++) {
      var mName = i % 2 === 0 ? NAMES_M[i % NAMES_M.length] : NAMES_F[i % NAMES_F.length];
      var nick = mName.split(" ")[0];
      if (nick.length > 8) nick = nick.slice(0, 8);
      var joinOffset = rnd(20, 500);
      var plan = plans[rnd(0, plans.length - 1)];
      var start = dateISO(joinOffset - plan.durationDays);
      var addDays = addDaysISO(start, plan.durationDays - rnd(0, 40));
      var member = {
        code: "M-" + String(i + 1).padStart(3, "0"),
        name: mName,
        email: nick.toLowerCase() + "@mail.com",
        phone: "555-01" + rnd(100, 999),
        gender: i % 2 === 0 ? "Male" : "Female",
        dob: (2026 - rnd(20, 55)) + "-" + pad(rnd(1, 12)) + "-" + pad(rnd(1, 28)),
        joinDate: start,
        address: "City Center " + (i + 1) + ", Main Street",
        emergencyContact: "555-99" + rnd(100, 999) + " (" + pick(LAST) + ")",
        bloodGroup: pick(["A+", "A-", "B+", "O+", "AB+", "O-"]),
        medicalNotes: i % 5 === 0 ? "Minor knee sensitivity" : "",
        planId: plan.id,
        planStart: start,
        planExpiry: addDays < start ? addDaysISO(start, plan.durationDays) : addDays,
        planStatus: i % 11 === 4 ? "frozen" : "active",
        trainerId: trainerIds[i % trainerIds.length]
      };
      insert("members", member);

      /* registration payment */
      var regAmt = rnd(10, 25);
      var regDate = dateISO(joinOffset - plan.durationDays);
      insert("payments", {
        invoiceNo: "INV-" + String(200 + i * 3).padStart(4, "0"),
        memberId: member.id, type: "registration", amount: regAmt, paid: regAmt,
        method: pick(["cash", "card", "bank"]), date: regDate, nwtx: true,
        status: "paid", notes: "Registration"
      });
      /* membership payment */
      insert("payments", {
        invoiceNo: "INV-" + String(200 + i * 3 + 1).padStart(4, "0"),
        memberId: member.id, type: "membership", amount: plan.price, paid: plan.price,
        method: pick(["cash", "card", "bank"]), date: dateISO(joinOffset - plan.durationDays),
        status: "paid", notes: plan.name
      });
      /* a progress log for a subset */
      if (i % 3 === 0) {
        var w = rnd(58, 95) + i % 7;
        var h = rnd(165, 190);
        insert("progress", {
          memberId: member.id, date: dateISO(rnd(0, joinOffset)),
          weight: w, height: h,
          bmi: Math.round((w / ((h / 100) * (h / 100))) * 10) / 10,
          bodyFat: rnd(12, 30), chest: rnd(88, 118), waist: rnd(70, 105), arms: rnd(28, 44),
          notes: ""
        });
        insert("progress", {
          memberId: member.id, date: dateISO(rnd(0, joinOffset) + 14 > joinOffset ? 14 : 1),
          weight: w + 2, height: h,
          bmi: Math.round(((w + 2) / ((h / 100) * (h / 100))) * 10) / 10,
          bodyFat: rnd(12, 30), chest: rnd(90, 120), waist: rnd(70, 105), arms: rnd(28, 44),
          notes: ""
        });
      }
    }

    var memberIds = all("members").map(function (m) { return m.id; });
    /* link the demo "member" account to a real member so its profile resolves */
    var demomem = find("users", function (x) { return x.username === "member"; });
    if (demomem && memberIds.length) DB.update("users", demomem.id, { memberId: memberIds[0] });
    /* extra "paid" payments across past 6 months for revenue + some pending */
    var types3 = ["membership", "trainer", "store"];
    for (var k = 0; k < 48; k++) {
      var pid = memberIds[rnd(0, memberIds.length - 1)];
      var daysAgo = rnd(2, 170);
      var isPending = k % 9 === 0;
      var amt = pick([20, 25, 30, 40, 50, 60, 69, 79, 100]);
      insert("payments", {
        invoiceNo: "INV-" + String(600 + k).padStart(4, "0"),
        memberId: pid, type: types3[k % 3], amount: amt, paid: isPending ? 0 : amt,
        method: pick(["cash", "card", "bank"]), date: dateISO(daysAgo),
        status: isPending ? "pending" : "paid", notes: isPending ? "Awaiting settlement" : "Renewal / PT session"
      });
    }

    /* attendance: last 14 days */
    for (var d = 1; d <= 14; d++) {
      var nToday = rnd(7, 16);
      var used = {};
      for (var c = 0; c < nToday; c++) {
        var midx = rnd(0, memberIds.length - 1);
        if (used[midx]) continue;
        used[midx] = 1;
        var cin = timeAm();
        var checkout = pad(+cin.slice(0, 2) + rnd(0, 2)) + ":" + pad(rnd(10, 59));
        insert("attendance", {
          memberId: memberIds[midx], date: dateISO(d),
          checkIn: cin, checkOut: checkout, source: "frontdesk"
        });
      }
    }

    /* workouts */
    var exercises = [
      ["Barbell Bench Press", "3", "10", "90s"], ["Incline Dumbbell Press", "3", "12", "60s"],
      ["Squats", "4", "10", "120s"], ["Deadlift", "4", "6", "150s"],
      ["Shoulder Press", "3", "12", "60s"], ["Pull-ups", "4", "8", "90s"],
      ["Bicep Curls", "3", "12", "45s"], ["Plank", "3", "60s hold", "45s"],
      ["Leg Press", "4", "12", "90s"], ["Lunges", "3", "15", "60s"],
      ["Lat Pulldown", "3", "12", "60s"], ["Treadmill Intervals", "1", "20 min", "0s"]
    ];
    function planDay(i) { return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i % 6]; }
    var wo = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [1, 2, 6], [4, 9, 7]
    ];
    for (var wi = 0; wi < 5; wi++) {
      var midx2 = memberIds[rnd(0, memberIds.length - 1)];
      var days = [];
      for (var wi2 = 0; wi2 < 3; wi2++) {
        var set = wo[(wi + wi2) % wo.length].map(function (ei) {
          return { name: exercises[ei][0], sets: exercises[ei][1], reps: exercises[ei][2], rest: exercises[ei][3] };
        });
        days.push({ day: planDay(wi + wi2), exercises: set });
      }
      insert("workouts", {
        memberId: midx2, trainerId: trainerIds[wi % trainerIds.length],
        title: pick(["Push / Pull Split", "Full Body", "Upper Body Power", "Leg Day Focus", "Hypertrophy"]),
        days: days, notes: "Focus on form. Warm up 10 min first."
      });
    }

    /* diets */
    var diets = [
      { title: "Muscle Gain 3200 kcal", meals: [
        { meal: "Breakfast", food: "Oats + whey + banana", calories: 600, protein: 40, carbs: 80, fats: 12 },
        { meal: "Lunch", food: "Chicken, rice, broccoli", calories: 750, protein: 55, carbs: 90, fats: 15 },
        { meal: "Pre-Workout", food: "Rice cakes + peanut butter", calories: 320, protein: 8, carbs: 45, fats: 10 },
        { meal: "Dinner", food: "Salmon, sweet potato, salad", calories: 700, protein: 48, carbs: 70, fats: 22 }
      ], waterTarget: 3, notes: "Add olive oil to meals." },
      { title: "Weight Loss 1900 kcal", meals: [
        { meal: "Breakfast", food: "Egg whites + avocado toast", calories: 380, protein: 28, carbs: 30, fats: 12 },
        { meal: "Lunch", food: "Grilled chicken salad", calories: 450, protein: 42, carbs: 25, fats: 16 },
        { meal: "Snack", food: "Greek yogurt + berries", calories: 220, protein: 18, carbs: 22, fats: 4 },
        { meal: "Dinner", food: "Lean steak + vegetables", calories: 520, protein: 46, carbs: 20, fats: 18 }
      ], waterTarget: 3.5, notes: "No sugar drinks." }
    ];
    for (var di = 0; di < 4; di++) {
      var dm = memberIds[rnd(0, memberIds.length - 1)];
      var dt = di % 2 === 0 ? diets[0] : diets[1];
      insert("diets", { memberId: dm, title: dt.title, meals: dt.meals, waterTarget: dt.waterTarget, notes: dt.notes });
    }

    /* equipment */
    var eq = [
      ["Barbell Set (Olympic)", "Strength", 6, 420], ["Treadmill", "Cardio", 8, 1800],
      ["Dumbbell Rack (2–50kg)", "Strength", 2, 2400], ["Leg Press Machine", "Strength", 2, 2600],
      ["Stationary Bike", "Cardio", 6, 950], ["Elliptical", "Cardio", 4, 1400],
      ["Smith Machine", "Strength", 2, 3200], ["Battle Ropes", "Conditioning", 4, 120],
      ["Rowing Machine", "Cardio", 3, 1200], ["Cable Crossover", "Strength", 2, 2800]
    ];
    eq.forEach(function (e, i) {
      insert("equipment", {
        code: "EQ-" + String(i + 1).padStart(3, "0"), name: e[0], category: e[1], quantity: e[2],
        purchaseDate: dateISO(rnd(180, 800)), price: e[3], condition: pick(["Excellent", "Good", "Fair"]),
        location: pick(["Main Floor", "Cardio Zone", "Strength Zone", "Studio"]),
        warrantyTill: dateISO(-rnd(60, 500)), nextService: i % 3 === 0 ? dateISO(-2) : dateISO(rnd(10, 60)),
        status: i === 2 ? "maintenance" : "operational"
      });
    });

    /* expenses */
    var cats = ["Rent", "Electricity", "Salaries", "Equipment", "Maintenance", "Cleaning", "Internet", "Marketing"];
    for (var ex = 0; ex < 30; ex++) {
      insert("expenses", {
        category: cats[rnd(0, cats.length - 1)], date: dateISO(rnd(2, 170)),
        amount: pick([250, 400, 600, 800, 1200, 1500, 2200]), description: "",
        payee: pick(["City Power Co", "Maintenance Ltd", "AdWorks", "Staff Payroll", "CleaningCo", "ISP Plus"])
      });
    }

    /* products + sales */
    var prods = [
      ["Whey Protein 1kg", "Supplements", 14, 28, 45, "NutraSupply"],
      ["Pre-Workout 250g", "Supplements", 9, 22, 35, "NutraSupply"],
      ["Creatine 300g", "Supplements", 11, 18, 29, "NutraSupply"],
      ["Gym Gloves", "Accessories", 8, 8, 15, "FitGear"],
      ["Shaker Bottle", "Accessories", 20, 6, 12, "FitGear"],
      ["Resistance Bands", "Accessories", 6, 10, 19, "ProForce"],
      ["BCAA 200g", "Supplements", 4, 15, 26, "NutraSupply"],
      ["Gym Towel", "Accessories", 15, 4, 9, "FitGear"]
    ];
    var prodIds = [];
    prods.forEach(function (pr, i) {
      var prod = insert("products", {
        code: "P-" + String(i + 1).padStart(3, "0"), name: pr[0], category: pr[1],
        quantity: pr[2], purchasePrice: pr[3], sellPrice: pr[4], supplier: pr[5]
      });
      prodIds.push(prod.id);
    });
    for (var s = 0; s < 12; s++) {
      var item = prodIds[rnd(0, prodIds.length - 1)];
      var prod = find("products", function (x) { return x.id === item; });
      var qty = rnd(1, 3);
      var total = qty * prod.sellPrice * (1 + rnd(0, 1));
      insert("sales", {
        invoiceNo: "SL-" + String(300 + s * 2).padStart(4, "0"),
        date: dateISO(rnd(1, 120)), items: [{ productId: prod.id, name: prod.name, qty: qty, price: prod.sellPrice }],
        total: Math.round(total * 10) / 10, memberId: memberIds[rnd(0, memberIds.length - 1)], method: pick(["cash", "card"])
      });
    }

    /* classes */
    var classDefs = [
      ["Yoga Flow", 3, "Monday", "08:00", 60, 15, "Studio A"],
      ["Zumba", 1, "Tuesday", "18:30", 50, 20, "Studio B"],
      ["CrossFit WOD", 2, "Wednesday", "07:00", 60, 12, "Main Floor"],
      ["HIIT Burn", 2, "Thursday", "19:00", 45, 16, "Studio A"],
      ["Cardio Boxing", 4, "Friday", "17:30", 55, 14, "Studio B"],
      ["Strength Basics", 0, "Saturday", "10:00", 60, 18, "Main Floor"],
      ["Morning Stretch", 3, "Sunday", "09:00", 40, 20, "Studio A"]
    ];
    var classIds = [];
    classDefs.forEach(function (cd, i) {
      var c = insert("classes", {
        name: cd[0], trainerId: trainerIds[cd[1] % trainerIds.length],
        dayOfWeek: cd[2], time: cd[3], durationMin: cd[4], capacity: cd[5],
        room: cd[6], active: true, color: ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f472b6"][i % 7]
      });
      classIds.push(c.id);
    });
    for (var bk = 0; bk < 18; bk++) {
      var cid = classIds[rnd(0, classIds.length - 1)];
      var bid = memberIds[rnd(0, memberIds.length - 1)];
      var cls = find("classes", function (x) { return x.id === cid; });
      insert("bookings", { classId: cid, memberId: bid, date: dateISO(rnd(0, 60)), status: "booked" });
    }

    /* activity log */
    insert("logs", { time: Date.now(), user: "admin", action: "System", detail: "Demo data seeded", type: "info" });

    markSeeded();
  }

  function resetAll() {
    var keys = [];
    for (var i = 0; i < LS.length; i++) {
      var k = LS.key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k);
    }
    keys.forEach(function (k) { LS.removeItem(k); });
  }

  /* public API */
  window.DB = {
    uid: uid,
    get: get, set: set,
    all: all,
    list: list,
    insert: insert,
    find: find,
    update: update,
    remove: remove,
    removeWhere: removeWhere,
    nextCode: nextCode,
    /* date */
    todayISO: todayISO,
    addDaysISO: addDaysISO,
    daysBetween: daysBetween,
    monthKey: monthKey,
    monthLabel: monthLabel,
    nowTime: nowTime,
    /* domain */
    settings: settings,
    saveSettings: saveSettings,
    planById: planById,
    memberStatus: memberStatus,
    statusBadgeInfo: statusBadgeInfo,
    memberOf: memberOf,
    trainerOf: trainerOf,
    memberPaid: memberPaid,
    revenueByMonth: revenueByMonth,
    expensesByMonth: expensesByMonth,
    pendingAmount: pendingAmount,
    nextInvoice: nextInvoice,
    groupedAttendance: groupedAttendance,
    deriveAlerts: deriveAlerts,
    money: money,
    activeCount: activeCount,
    seed: seed,
    resetAll: resetAll
  };
})();