/* =========================================================
   IEC COMUNICACIONES · admin.js
   1. Modo claro/oscuro
   2. Login simulado + RBAC (Admin/Jefe vs Técnico)
   3. Navegación de vistas filtrada por rol
   4. Tabla de usuarios (render, búsqueda, suspender/activar)
   5. Sesión (sessionStorage) y cierre de sesión
   ========================================================= */
(function () {
  "use strict";

  const root = document.documentElement;

  /* ---------- Logo: assets/img/logo.png con fallback legacy e isotipo ---------- */
  (function initBrandLogos() {
    var LOGO_PATHS = ["assets/img/logo.png", "assets/logo_ieczal.png/logo.png"];
    document.querySelectorAll(".brand").forEach(function (brand) {
      var img = brand.querySelector(".brand__logo");
      if (!img) return;
      var fallback = brand.querySelector(".brand__fallback");
      brand.classList.add("is-fallback");
      if (fallback) fallback.removeAttribute("aria-hidden");
      var pathIdx = 0;
      function showLogo() {
        if (img.naturalWidth > 0) {
          brand.classList.remove("is-fallback");
          if (fallback) fallback.setAttribute("aria-hidden", "true");
        }
      }
      function tryNext() {
        pathIdx += 1;
        if (pathIdx < LOGO_PATHS.length) img.src = LOGO_PATHS[pathIdx];
        else {
          brand.classList.add("is-fallback");
          if (fallback) fallback.removeAttribute("aria-hidden");
        }
      }
      img.addEventListener("load", showLogo);
      img.addEventListener("error", tryNext);
      if (img.complete) {
        if (img.naturalWidth > 0) showLogo();
        else tryNext();
      }
    });
  })();

  /* ---------- 0. Seguridad: sanitización para inserciones en el DOM ---------- */
  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 1. TEMA ---------- */
  const THEME_KEY = "iec-theme";
  const themeToggle = document.getElementById("themeToggle");
  function applyTheme(t) {
    root.setAttribute("data-theme", t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#001021" : "#f8fafc");
  }
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  if (themeToggle) themeToggle.addEventListener("click", function () {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next); localStorage.setItem(THEME_KEY, next);
  });

  /* ---------- 2. LOGIN + RBAC ---------- */
  const ACCOUNTS = {
    "jefe@iec.com":    { pass: "admin123",   name: "Dirección IEC", role: "admin",   roleLabel: "Admin / Jefe" },
    "tecnico@iec.com": { pass: "tecnico123", name: "Soporte Técnico", role: "tecnico", roleLabel: "Técnico" }
  };
  const SESSION_KEY = "iec-admin-session";

  const loginView = document.getElementById("adminLogin");
  const appView = document.getElementById("adminApp");
  const loginForm = document.getElementById("adminLoginForm");
  const loginMsg = document.getElementById("adminLoginMsg");

  const navItems = Array.prototype.slice.call(document.querySelectorAll(".adminside__item[data-view]"));
  const views = Array.prototype.slice.call(document.querySelectorAll(".adminview"));
  const titleEl = document.getElementById("adminTitle");
  const TITLES = { dashboard: "Dashboard General", usuarios: "Gestión de Usuarios", personal: "Personal IEC", noc: "Estado de Red (NOC)", facturacion: "Facturación", tickets: "Tickets de Soporte" };

  function applyRBAC(role) {
    // Muestra solo los ítems permitidos para el rol y activa el primero visible.
    let firstAllowed = null;
    navItems.forEach(function (item) {
      const roles = (item.getAttribute("data-roles") || "").split(",");
      const allowed = roles.indexOf(role) !== -1;
      item.hidden = !allowed;
      if (allowed && !firstAllowed) firstAllowed = item;
    });
    if (firstAllowed) activateView(firstAllowed.getAttribute("data-view"));

    // Sello visual del rol
    const acct = currentAccount();
    const badge = document.getElementById("roleBadge");
    if (badge && acct) { badge.textContent = acct.roleLabel; badge.classList.toggle("is-tech", role === "tecnico"); }
    document.getElementById("userName").textContent = acct ? acct.name : "—";
    document.getElementById("userRole").textContent = acct ? acct.roleLabel : "—";
    document.getElementById("userAvatar").textContent = role === "tecnico" ? "TC" : "DI";
  }

  function activateView(view) {
    // Refuerzo RBAC: no permitir activar una vista cuyo ítem está oculto.
    const item = navItems.filter(function (n) { return n.getAttribute("data-view") === view; })[0];
    if (!item || item.hidden) return;
    navItems.forEach(function (n) { n.classList.toggle("is-active", n === item); });
    views.forEach(function (v) {
      const match = v.id === "view-" + view;
      v.classList.toggle("is-active", match);
      v.hidden = !match;
    });
    if (titleEl && TITLES[view]) titleEl.textContent = TITLES[view];
    if (view === "dashboard") animateCounters();
    if (view === "personal" && window.IECAdminStaff) {
      window.IECAdminStaff.renderStaff(document.getElementById("staffSearch") ? document.getElementById("staffSearch").value : "");
    }
    if (view === "usuarios" && window.IECAdminClients) {
      window.IECAdminClients.renderUsers(document.getElementById("userSearch") ? document.getElementById("userSearch").value : "");
    }
    closeSidebar();
  }

  /* Contadores dinámicos (count-up) de las métricas del dashboard */
  function animateCounters() {
    document.querySelectorAll("#view-dashboard [data-count]").forEach(function (el) {
      if (el.dataset.done) return;
      el.dataset.done = "1";
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var suffix = el.getAttribute("data-suffix") || "";
      var start = performance.now(), dur = 1400;
      function fmt(n) {
        var s = dec ? n.toFixed(dec) : Math.round(n).toString();
        if (!dec) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return s + suffix;
      }
      function tick(now) {
        var p = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * eased);
        if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target);
      }
      requestAnimationFrame(tick);
    });
  }

  function currentAccount() {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { const s = JSON.parse(raw); return ACCOUNTS[s.user] ? Object.assign({ user: s.user }, ACCOUNTS[s.user]) : null; }
    catch (e) { return null; }
  }

  function showApp() { loginView.hidden = true; appView.hidden = false; }
  function showLogin() { appView.hidden = true; loginView.hidden = false; }

  // Sesión activa
  const acct0 = currentAccount();
  if (acct0) { showApp(); applyRBAC(acct0.role); }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const user = loginForm.elements["user"].value.trim().toLowerCase();
      const pass = loginForm.elements["password"].value;
      const acct = ACCOUNTS[user];
      if (!acct || acct.pass !== pass) {
        loginMsg.textContent = "Credenciales incorrectas. Revisa los accesos demo.";
        loginMsg.className = "form-msg err";
        return;
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, ts: Date.now() }));
      loginMsg.textContent = ""; loginMsg.className = "form-msg";
      showApp();
      applyRBAC(acct.role);
    });
  }

  const logoutBtn = document.getElementById("adminLogout");
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    sessionStorage.removeItem(SESSION_KEY);
    if (loginForm) loginForm.reset();
    showLogin();
  });

  navItems.forEach(function (item) {
    item.addEventListener("click", function () { activateView(item.getAttribute("data-view")); });
  });

  // Sidebar móvil
  const side = document.getElementById("adminSide");
  const menuBtn = document.getElementById("adminMenuBtn");
  function closeSidebar() { if (side) side.classList.remove("open"); }
  if (menuBtn && side) menuBtn.addEventListener("click", function () { side.classList.toggle("open"); });

  /* ---------- 4. TABLA DE USUARIOS (delegada a app.js · IECAdminClients) ---------- */
  if (window.IECAdminClients) {
    window.IECAdminClients.renderUsers("");
    var userSearch = document.getElementById("userSearch");
    if (userSearch) {
      userSearch.addEventListener("input", function () {
        window.IECAdminClients.renderUsers(userSearch.value);
      });
    }
  }
})();
