/* ============================================================
   APEX GYM — authentication + role-based access control
   ============================================================ */
(function () {
  "use strict";

  var ROLE_LABEL = {
    admin: "Administrator",
    manager: "Manager",
    reception: "Receptionist",
    trainer: "Trainer",
    accountant: "Accountant",
    member: "Member"
  };

  /* which views each role may open */
  var ROLE_VIEWS = {
    admin: ["dash", "members", "plans", "payments", "attendance", "trainers", "workouts", "diet", "progress", "equipment", "expenses", "store", "classes", "reports", "activity", "settings", "profile"],
    manager: ["dash", "members", "plans", "payments", "attendance", "trainers", "workouts", "diet", "progress", "equipment", "expenses", "store", "classes", "reports", "settings", "profile"],
    reception: ["dash", "members", "plans", "payments", "attendance", "classes", "profile"],
    trainer: ["dash", "members", "attendance", "workouts", "diet", "progress", "classes", "profile"],
    accountant: ["dash", "members", "payments", "expenses", "reports", "store", "profile"],
    member: ["profile", "attendance", "workouts", "diet", "progress", "classes"]
  };

  function session() { return DB.get("session_uid", null); }

  function login(username, password) {
    var user = DB.find("users", function (u) {
      return u.username.trim().toLowerCase() === String(username || "").trim().toLowerCase();
    });
    if (!user) return { error: "No account found with that username." };
    if (!user.active) return { error: "This account is deactivated." };
    if (user.password !== password) return { error: "Incorrect password. Try again." };
    DB.set("session_uid", user.id);
    DB.update("users", user.id, { lastLogin: Date.now() });
    log(user, "Login", "Signed in", "info");
    return { user: user };
  }

  function current() {
    var id = session();
    if (!id) return null;
    return DB.find("users", function (u) { return u.id === id; });
  }

  function logout() {
    var u = current();
    if (u) log(u, "Logout", "Signed out", "info");
    DB.set("session_uid", null);
  }

  function can(user, viewId) {
    if (!user) return false;
    var list = ROLE_VIEWS[user.role];
    return list && list.indexOf(viewId) >= 0;
  }

  function defaultView(user) {
    var order = ["dash", "members", "payments", "reports", "workouts", "profile"];
    if (!user) return "dash";
    var list = ROLE_VIEWS[user.role] || [];
    for (var i = 0; i < order.length; i++) {
      if (list.indexOf(order[i]) >= 0) return order[i];
    }
    return list[0] || "profile";
  }

  function log(user, action, detail, type) {
    DB.insert("logs", {
      time: Date.now(),
      user: user ? user.name || user.username : "system",
      role: user ? user.role : "",
      action: action,
      detail: detail || "",
      type: type || "info"
    });
  }

  function allowedViews(user) {
    return (ROLE_VIEWS[user && user.role] || []).slice();
  }

  window.Auth = {
    ROLE_LABEL: ROLE_LABEL,
    ROLE_VIEWS: ROLE_VIEWS,
    login: login,
    current: current,
    logout: logout,
    can: can,
    defaultView: defaultView,
    log: log,
    allowedViews: allowedViews
  };
})();