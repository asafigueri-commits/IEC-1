/* =========================================================
   IECZA · portal.js
   1. Modo noche corporativo (compartido)
   2. Login simulado + sesión (sessionStorage / localStorage)
   3. Mostrar/ocultar contraseña
   4. Navegación de vistas del dashboard + menú móvil
   5. Prueba de velocidad simulada
   6. Descarga de factura en PDF (generado en cliente)
   7. Tickets de soporte (envío + alta en lista)
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

  // Credenciales de demostración
  const DEMO_USER = "cliente@iec.com";
  const DEMO_PASS = "cliente123";
  const SESSION_KEY = "iec-portal-token";
  const PAYMENT_INTENT_KEY = "iec-portal-payment-intent";
  const PAYMENT_INTENT_PARAM = "pago";

  (function migrateStorageKeys() {
    var oldTheme = localStorage.getItem("iecza-theme");
    if (oldTheme && !localStorage.getItem("iec-theme")) {
      localStorage.setItem("iec-theme", oldTheme);
      localStorage.removeItem("iecza-theme");
    }
    var oldToken = sessionStorage.getItem("iecza-portal-token") || localStorage.getItem("iecza-portal-token");
    if (oldToken && !sessionStorage.getItem(SESSION_KEY) && !localStorage.getItem(SESSION_KEY)) {
      if (localStorage.getItem("iecza-portal-token")) localStorage.setItem(SESSION_KEY, oldToken);
      else sessionStorage.setItem(SESSION_KEY, oldToken);
      sessionStorage.removeItem("iecza-portal-token");
      localStorage.removeItem("iecza-portal-token");
    }
  })();

  /* ---------- UTILIDADES DE SEGURIDAD ----------
     sanitizeInput: limpia entradas (anti-inyección HTML/XSS).
     Tokens de sesión: aquí se SIMULAN en el cliente. En producción, el token
     debe emitirlo el backend en una cookie con banderas:
        Set-Cookie: sid=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600
     HttpOnly impide acceso por JS (mitiga robo por XSS), Secure exige HTTPS y
     SameSite=Strict mitiga CSRF. Como demo, ofuscamos el token en Base64 y le
     adjuntamos banderas virtuales + expiración. */
  function sanitizeInput(value) {
    return String(value).replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
  }

  function createSecureToken(user) {
    const payload = {
      sub: user,
      name: "Cliente IEC",
      iat: Date.now(),
      exp: Date.now() + 3600 * 1000,            // expira en 1 hora
      flags: { HttpOnly: true, Secure: true, SameSite: "Strict" }, // banderas virtuales
      nonce: Math.random().toString(36).slice(2)
    };
    // Ofuscación Base64 (UTF-8 safe). NO es cifrado real: el cifrado/firma va en el servidor.
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  function readSecureToken() {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(decodeURIComponent(escape(atob(raw))));
      if (!data || !data.exp || Date.now() > data.exp) {  // token expirado
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return data;
    } catch (e) { return null; }
  }

  /* ---------- 1. MODO NOCHE ---------- */
  const THEME_KEY = "iec-theme";
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#060e1f" : "#0a1b3d");
  }
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  /* ---------- 2. LOGIN / SESIÓN ---------- */
  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("loginForm");
  const loginMsg = document.getElementById("loginMsg");
  const paymentModal = document.getElementById("paymentModal");
  const paymentLoading = document.getElementById("paymentLoading");
  const paymentForm = document.getElementById("paymentForm");
  const paymentMsg = document.getElementById("paymentMsg");
  const closePaymentModal = document.getElementById("closePaymentModal");
  const openPaymentBtn = document.getElementById("openPaymentBtn");
  const payPendingBtn = document.getElementById("payPendingBtn");

  function capturePaymentIntentFromUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("intent") === PAYMENT_INTENT_PARAM || params.get("action") === "pagar") {
      sessionStorage.setItem(PAYMENT_INTENT_KEY, "1");
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }
    }
  }

  function hasPaymentIntent() {
    return sessionStorage.getItem(PAYMENT_INTENT_KEY) === "1";
  }

  function clearPaymentIntent() {
    sessionStorage.removeItem(PAYMENT_INTENT_KEY);
  }

  function showDashboard(name) {
    loginView.hidden = true;
    dashboardView.hidden = false;
    var nameEl = document.getElementById("dashUserName");
    if (nameEl && name) nameEl.textContent = name;
    document.body.style.background = "var(--surface-2)";
  }

  function showLogin() {
    dashboardView.hidden = true;
    loginView.hidden = false;
    closePaymentModalFn();
  }

  function switchDashView(view) {
    var navItems = document.querySelectorAll(".dash__nav-item[data-view]");
    var panels = document.querySelectorAll(".dash__panel");
    var dashTitle = document.getElementById("dashTitle");
    var titles = {
      resumen: "Resumen",
      servicio: "Mi servicio",
      facturacion: "Facturación",
      pago: "Pago en línea",
      tickets: "Tickets de soporte"
    };
    navItems.forEach(function (item) {
      var match = item.getAttribute("data-view") === view;
      item.classList.toggle("is-active", match);
    });
    panels.forEach(function (p) {
      var match = p.id === "view-" + view;
      p.classList.toggle("is-active", match);
      p.hidden = !match;
    });
    if (dashTitle && titles[view]) dashTitle.textContent = titles[view];
    if (typeof closeSidebar === "function") closeSidebar();
  }

  function closePaymentModalFn() {
    if (!paymentModal) return;
    paymentModal.hidden = true;
    document.body.classList.remove("pay-modal-open");
    if (paymentForm) {
      paymentForm.hidden = true;
      paymentForm.reset();
    }
    if (paymentLoading) paymentLoading.hidden = false;
    if (paymentMsg) { paymentMsg.textContent = ""; paymentMsg.className = "form-msg"; }
  }

  function openPaymentModal() {
    if (!paymentModal || !paymentLoading || !paymentForm) return;
    paymentModal.hidden = false;
    document.body.classList.add("pay-modal-open");
    paymentLoading.hidden = false;
    paymentForm.hidden = true;
    if (paymentMsg) { paymentMsg.textContent = ""; paymentMsg.className = "form-msg"; }
    window.setTimeout(function () {
      paymentLoading.hidden = true;
      paymentForm.hidden = false;
      var first = paymentForm.querySelector("#cardName");
      if (first) first.focus();
    }, 900);
  }

  function markInvoicePaid(folio) {
    document.querySelectorAll('[data-invoice="' + folio + '"]').forEach(function (btn) {
      var row = btn.closest("tr");
      if (!row) return;
      var tag = row.querySelector(".tag");
      if (tag) {
        tag.textContent = "Pagada";
        tag.className = "tag tag--paid";
      }
    });
    var payIntro = document.querySelector(".pay-panel__intro");
    if (payIntro && folio === "F-2026-06") {
      payIntro.innerHTML = 'Factura <strong>F-2026-06</strong> · Junio 2026 · <strong>$2,320.00 MXN</strong> · <span class="tag tag--paid">Pagada</span>';
    }
    if (payPendingBtn) payPendingBtn.hidden = true;
  }

  function openPaymentFlow() {
    switchDashView("pago");
    openPaymentModal();
  }

  function runPostLoginPaymentFlow() {
    if (!hasPaymentIntent()) return;
    clearPaymentIntent();
    openPaymentFlow();
  }

  capturePaymentIntentFromUrl();

  // ¿Sesión activa? (token válido y no expirado)
  var activeToken = readSecureToken();
  if (activeToken) {
    showDashboard(activeToken.name);
    runPostLoginPaymentFlow();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var user = sanitizeInput(loginForm.elements["user"].value);
      loginForm.elements["user"].value = user;
      var pass = loginForm.elements["password"].value;
      var remember = loginForm.elements["remember"].checked;

      if (!user || !pass) {
        loginMsg.textContent = "Ingresa tu usuario y contraseña.";
        loginMsg.className = "form-msg err";
        return;
      }

      if (user.toLowerCase() === DEMO_USER && pass === DEMO_PASS) {
        var token = createSecureToken(user);
        (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, token);
        if (hasPaymentIntent()) {
          loginMsg.textContent = "Sesión iniciada. Cargando pasarela de pago segura…";
        } else {
          loginMsg.textContent = "Sesión iniciada correctamente.";
        }
        loginMsg.className = "form-msg ok";
        window.setTimeout(function () {
          loginMsg.textContent = "";
          loginMsg.className = "form-msg";
          showDashboard("Cliente IEC");
          runPostLoginPaymentFlow();
        }, hasPaymentIntent() ? 650 : 400);
      } else {
        loginMsg.textContent = "Credenciales incorrectas. Verifica tus datos (ver demo abajo).";
        loginMsg.className = "form-msg err";
      }
    });
  }

  if (closePaymentModal) closePaymentModal.addEventListener("click", closePaymentModalFn);
  document.querySelectorAll("[data-close-payment]").forEach(function (el) {
    el.addEventListener("click", closePaymentModalFn);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && paymentModal && !paymentModal.hidden) closePaymentModalFn();
  });
  if (openPaymentBtn) openPaymentBtn.addEventListener("click", openPaymentModal);
  if (payPendingBtn) payPendingBtn.addEventListener("click", openPaymentFlow);

  if (paymentForm) {
    paymentForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var cardName = sanitizeInput(paymentForm.elements["cardName"].value);
      var cardNumber = sanitizeInput(paymentForm.elements["cardNumber"].value).replace(/\D/g, "");
      var cardExpiry = sanitizeInput(paymentForm.elements["cardExpiry"].value);
      var cardCvv = sanitizeInput(paymentForm.elements["cardCvv"].value).replace(/\D/g, "");

      paymentForm.elements["cardName"].value = cardName;
      paymentForm.elements["cardNumber"].value = cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
      paymentForm.elements["cardExpiry"].value = cardExpiry;
      paymentForm.elements["cardCvv"].value = cardCvv;

      if (cardName.length < 2 || cardNumber.length < 15 || !/^\d{2}\/\d{2}$/.test(cardExpiry) || cardCvv.length < 3) {
        paymentMsg.textContent = "Revisa los datos de la tarjeta e inténtalo de nuevo.";
        paymentMsg.className = "form-msg err";
        return;
      }

      var submitBtn = document.getElementById("paymentSubmitBtn");
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Procesando…"; }
      paymentMsg.textContent = "";
      paymentMsg.className = "form-msg";

      window.setTimeout(function () {
        markInvoicePaid("F-2026-06");
        paymentMsg.textContent = "Pago simulado exitoso. Tu factura F-2026-06 quedó registrada como pagada.";
        paymentMsg.className = "form-msg ok";
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Confirmar pago"; }
        window.setTimeout(closePaymentModalFn, 2200);
      }, 1400);
    });
  }

  // Todos los botones de cierre de sesión (barra lateral y barra superior).
  document.querySelectorAll("[data-logout]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      clearPaymentIntent();
      if (loginForm) loginForm.reset();
      showLogin();
      window.scrollTo(0, 0);
    });
  });

  /* ---------- 3. MOSTRAR / OCULTAR CONTRASEÑA ---------- */
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
      togglePassword.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  }

  /* ---------- 4. NAVEGACIÓN DE VISTAS ---------- */
  const navItems = document.querySelectorAll(".dash__nav-item[data-view]");
  const panels = document.querySelectorAll(".dash__panel");
  const dashTitle = document.getElementById("dashTitle");
  const titles = { resumen: "Resumen", servicio: "Mi servicio", facturacion: "Facturación", pago: "Pago en línea", tickets: "Tickets de soporte" };

  navItems.forEach(function (item) {
    item.addEventListener("click", function () {
      switchDashView(item.getAttribute("data-view"));
    });
  });

  // Menú lateral en móvil
  const sidebar = document.getElementById("dashSidebar");
  const menuBtn = document.getElementById("dashMenuBtn");
  function closeSidebar() { if (sidebar) sidebar.classList.remove("open"); }
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", function () { sidebar.classList.toggle("open"); });
  }

  /* ---------- 5. PRUEBA DE VELOCIDAD SIMULADA ---------- */
  const runSpeedtest = document.getElementById("runSpeedtest");
  const speedValue = document.getElementById("speedValue");
  if (runSpeedtest && speedValue) {
    runSpeedtest.addEventListener("click", function () {
      runSpeedtest.disabled = true;
      const target = 188 + Math.floor(Math.random() * 14); // ~188-201 Mbps
      const duration = 1800;
      const start = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        // pequeña fluctuación para realismo
        const jitter = p < 1 ? (Math.random() * 12 - 6) : 0;
        speedValue.textContent = Math.max(0, Math.round(target * eased + jitter));
        if (p < 1) requestAnimationFrame(tick);
        else { speedValue.textContent = target; runSpeedtest.disabled = false; }
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- 6. DESCARGA DE FACTURA (PDF en cliente) ---------- */
  function buildInvoicePDF(folio, periodo, monto) {
    const esc = function (s) { return String(s).replace(/([\\()])/g, "\\$1"); };
    const lines = [
      { t: "IEC COMUNICACIONES", size: 20, y: 770 },
      { t: "Comprobante de servicio", size: 12, y: 748 },
      { t: "Folio: " + folio, size: 12, y: 700 },
      { t: "Periodo: " + periodo, size: 12, y: 680 },
      { t: "Cliente: Cliente IEC  (#IEZ-018245)", size: 12, y: 660 },
      { t: "Servicio: Internet Dedicado Empresarial 200 Mbps", size: 12, y: 640 },
      { t: "Monto total: " + monto, size: 14, y: 600 },
      { t: "Estado: Comprobante de demostracion", size: 10, y: 560 },
      { t: "Generado por el Portal de Clientes IEC COMUNICACIONES", size: 10, y: 80 }
    ];

    let content = "";
    lines.forEach(function (l) {
      content += "BT /F1 " + l.size + " Tf 72 " + l.y + " Td (" + esc(l.t) + ") Tj ET\n";
    });

    const objects = [];
    objects.push("<</Type/Catalog/Pages 2 0 R>>");
    objects.push("<</Type/Pages/Kids[3 0 R]/Count 1>>");
    objects.push("<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>");
    objects.push("<</Length " + content.length + ">>\nstream\n" + content + "endstream");
    objects.push("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>");

    let pdf = "%PDF-1.4\n";
    const offsets = [];
    objects.forEach(function (obj, i) {
      offsets.push(pdf.length);
      pdf += (i + 1) + " 0 obj\n" + obj + "\nendobj\n";
    });
    const xrefPos = pdf.length;
    pdf += "xref\n0 " + (objects.length + 1) + "\n";
    pdf += "0000000000 65535 f \n";
    offsets.forEach(function (off) {
      pdf += ("0000000000" + off).slice(-10) + " 00000 n \n";
    });
    pdf += "trailer\n<</Size " + (objects.length + 1) + "/Root 1 0 R>>\nstartxref\n" + xrefPos + "\n%%EOF";

    return new Blob([pdf], { type: "application/pdf" });
  }

  document.querySelectorAll("[data-invoice]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const row = btn.closest("tr");
      const folio = btn.getAttribute("data-invoice");
      const periodo = row ? row.children[1].textContent : "";
      const monto = row ? row.children[2].textContent : "";
      const blob = buildInvoicePDF(folio, periodo, monto);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "IEC-" + folio + ".pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    });
  });

  /* ---------- 7. TICKETS DE SOPORTE ---------- */
  const ticketForm = document.getElementById("ticketForm");
  const ticketMsg = document.getElementById("ticketMsg");
  const ticketBtn = document.getElementById("ticketBtn");
  const ticketList = document.getElementById("ticketList");

  function prependTicket(subject, priority) {
    if (!ticketList) return;
    const id = "#TK-" + (3400 + Math.floor(Math.random() * 600));
    const li = document.createElement("li");
    li.className = "ticket-item";
    const date = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
    li.innerHTML =
      '<div class="ticket-item__head"><span class="ticket-item__id">' + id + '</span>' +
      '<span class="tag tag--pending">Abierto</span></div>' +
      '<p class="ticket-item__subject"></p>' +
      '<span class="ticket-item__meta">Prioridad ' + priority + ' \u00b7 ' + date + '</span>';
    li.querySelector(".ticket-item__subject").textContent = subject;
    ticketList.insertBefore(li, ticketList.firstChild);
  }

  if (ticketForm) {
    ticketForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const subject = ticketForm.elements["subject"];
      const body = ticketForm.elements["body"];
      const priority = ticketForm.elements["priority"].value;
      let valid = true;
      [subject, body].forEach(function (input) {
        input.classList.remove("invalid");
        if (!input.value.trim()) { input.classList.add("invalid"); valid = false; }
      });
      if (!valid) {
        ticketMsg.textContent = "Completa el asunto y la descripción.";
        ticketMsg.className = "form-msg err";
        return;
      }

      const original = ticketBtn.textContent;
      ticketBtn.disabled = true; ticketBtn.textContent = "Enviando…";
      ticketMsg.textContent = ""; ticketMsg.className = "form-msg";
      // Sanitización antes de mostrar el asunto en la lista (anti-XSS).
      const subjectVal = sanitizeInput(subject.value);

      fetch(ticketForm.action, {
        method: "POST",
        body: new FormData(ticketForm),
        headers: { "X-Requested-With": "fetch", "Accept": "application/json" }
      })
        .then(function (res) {
          var ct = res.headers.get("content-type") || "";
          if (ct.indexOf("application/json") !== -1) {
            return res.json();
          }
          if (!res.ok) {
            return { ok: false, message: "No se pudo registrar el ticket." };
          }
          return { ok: false, offline: true, message: "Ticket registrado en la interfaz. Para persistencia en servidor, usa PHP (servidor.ps1)." };
        })
        .then(function (data) {
          if (data && data.ok) {
            prependTicket(subjectVal, priority);
            ticketMsg.textContent = data.message || "Ticket registrado. Nuestro NOC le dará seguimiento.";
            ticketMsg.className = "form-msg ok";
            ticketForm.reset();
          } else if (data && data.offline) {
            prependTicket(subjectVal, priority);
            ticketMsg.textContent = data.message;
            ticketMsg.className = "form-msg ok";
            ticketForm.reset();
          } else {
            ticketMsg.textContent = (data && data.message) || "No se pudo registrar el ticket. Intenta de nuevo o llama al NOC.";
            ticketMsg.className = "form-msg err";
          }
        })
        .catch(function () {
          prependTicket(subjectVal, priority);
          ticketMsg.textContent = "Ticket registrado localmente (sin conexión al servidor).";
          ticketMsg.className = "form-msg ok";
          ticketForm.reset();
        })
        .finally(function () {
          ticketBtn.disabled = false; ticketBtn.textContent = original;
        });
    });
  }
})();
