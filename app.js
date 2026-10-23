/* =========================================================
   IEC COMUNICACIONES · app.js (landing)
   1. Modo noche corporativo (localStorage + prefers-color-scheme)
   2. Header sticky que se reduce al hacer scroll
   3. Menú responsivo + dropdowns (acordeón en móvil)
   4. Pestañas de planes (Residencial / Fibra / Empresarial / Dedicado)
   5. Scroll reveal + animaciones del hero
   6. Formulario de cotización y mapa de cobertura
   ========================================================= */
(function () {
  "use strict";

  const root = document.documentElement;

  /* ---------- 0. UTILIDADES DE SEGURIDAD (XSS / inyección) ----------
     Defensa en profundidad en cliente; el backend en /api también re-valida. */
  var XSS_PATTERNS = [
    /<script[\s>]/i,
    /<\/script>/i,
    /javascript\s*:/i,
    /vbscript\s*:/i,
    /data\s*:\s*text\/html/i,
    /on\w+\s*=/i,
    /<\s*\/?\s*(iframe|object|embed|link|meta|svg|form|base|style)\b/i,
    /expression\s*\(/i
  ];
  var ALLOWED_SERVICES = ["residencial", "fibra", "empresarial", "dedicado", "sip", "cctv", "web"];
  var FIELD_LIMITS = { name: 120, phone: 20, email: 254 };

  function escapeHTML(str) {
    return String(str).replace(/[&<>"'`]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" }[c];
    });
  }

  function stripControlChars(value) {
    return String(value).replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  }

  function sanitizeInput(value, maxLen) {
    var s = stripControlChars(value)
      .replace(/<[^>]*>/g, "")
      .replace(/[<>"'`\\]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function sanitizePhone(value) {
    return sanitizeInput(value, FIELD_LIMITS.phone).replace(/[^\d+\s().-]/g, "");
  }

  function containsMaliciousPayload(value) {
    if (!value) return false;
    var raw = stripControlChars(value);
    var compact = raw.replace(/\s+/g, "").toLowerCase();
    return XSS_PATTERNS.some(function (re) {
      return re.test(raw) || re.test(compact);
    });
  }

  function isValidEmail(email) {
    if (!email) return true;
    if (email.length > FIELD_LIMITS.email) return false;
    if (containsMaliciousPayload(email)) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function validateContactPayload(payload) {
    if (payload.honeypot) {
      return { ok: false, message: "No se pudo enviar la solicitud." };
    }
    if (containsMaliciousPayload(payload.name) || containsMaliciousPayload(payload.phone) || containsMaliciousPayload(payload.email)) {
      return { ok: false, message: "Se detectaron caracteres no permitidos. Revisa nombre, teléfono y correo." };
    }
    if (payload.name.length < 2) {
      return { ok: false, message: "Ingresa tu nombre o empresa (mínimo 2 caracteres)." };
    }
    var digits = (payload.phone.match(/\d/g) || []).length;
    if (digits < 7 || digits > 15) {
      return { ok: false, message: "Ingresa un teléfono válido (7 a 15 dígitos)." };
    }
    if (!isValidEmail(payload.email)) {
      return { ok: false, message: "El correo electrónico no es válido." };
    }
    if (ALLOWED_SERVICES.indexOf(payload.service) === -1) {
      return { ok: false, message: "Selecciona un servicio válido." };
    }
    return { ok: true };
  }

  function hardenExternalLinks() {
    document.querySelectorAll('a[href^="http"]').forEach(function (link) {
      if (link.target !== "_blank") return;
      var rel = (link.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
      if (rel.indexOf("noopener") === -1) rel.push("noopener");
      if (rel.indexOf("noreferrer") === -1) rel.push("noreferrer");
      link.setAttribute("rel", rel.join(" "));
    });
  }
  hardenExternalLinks();

  if (!document.body.classList.contains("admin-body") && !document.body.classList.contains("portal-body")) {

  /* ---------- 1. MODO NOCHE ---------- */
  const THEME_KEY = "iec-theme";
  const themeToggle = document.getElementById("themeToggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#060e1f" : "#0a1b3d");
    if (themeToggle) {
      themeToggle.setAttribute("aria-label", theme === "dark" ? "Activar modo claro" : "Activar modo noche");
    }
  }

  const saved = localStorage.getItem(THEME_KEY);
  if (saved) applyTheme(saved);
  else applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
    });
  }

  /* ---------- 2. HEADER STICKY (shrink) ---------- */
  const header = document.getElementById("siteHeader");
  if (header) {
    let last = false;
    const onScroll = function () {
      const shrink = window.scrollY > 60;
      if (shrink !== last) { header.classList.toggle("shrink", shrink); last = shrink; }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 3. MENÚ RESPONSIVO + DROPDOWNS ---------- */
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  const mq = window.matchMedia("(max-width: 860px)");

  function closeMenu() {
    if (!navToggle || !navMenu) return;
    navToggle.classList.remove("active");
    navMenu.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Abrir menú");
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      const open = navMenu.classList.toggle("open");
      navToggle.classList.toggle("active", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });
    navMenu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
    window.addEventListener("resize", function () { if (!mq.matches) closeMenu(); });
  }

  document.querySelectorAll(".nav-item--has-dropdown > .nav-link").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (!mq.matches) return;
      e.preventDefault();
      const item = btn.parentElement;
      const dropdown = item.querySelector(".dropdown");
      const willOpen = !dropdown.classList.contains("open");
      document.querySelectorAll(".nav-item--has-dropdown").forEach(function (other) {
        other.classList.remove("open");
        const d = other.querySelector(".dropdown");
        if (d) d.classList.remove("open");
        other.querySelector(".nav-link").setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        item.classList.add("open");
        dropdown.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  /* ---------- 4. PESTAÑAS (multinivel, por grupo) ----------
     Cada [role="tablist"] gestiona SOLO sus propias pestañas, por lo que el
     sistema soporta pestañas anidadas (categoría → región/tipo). */
  document.querySelectorAll('[role="tablist"]').forEach(function (list) {
    const tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));

    function activate(tab) {
      tabs.forEach(function (t) {
        const selected = t === tab;
        t.classList.toggle("is-active", selected);
        t.setAttribute("aria-selected", String(selected));
        t.setAttribute("tabindex", selected ? "0" : "-1");
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) { panel.classList.toggle("is-active", selected); panel.hidden = !selected; }
      });
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { activate(tab); });
      tab.addEventListener("keydown", function (e) {
        let target = null;
        if (e.key === "ArrowRight") target = tabs[(index + 1) % tabs.length];
        else if (e.key === "ArrowLeft") target = tabs[(index - 1 + tabs.length) % tabs.length];
        if (target) { e.preventDefault(); activate(target); target.focus(); }
      });
    });
  });

  /* ---------- 5. FORMULARIO DE COTIZACIÓN ---------- */
  const form = document.getElementById("contactForm");
  const formMsg = document.getElementById("formMsg");
  const submitBtn = document.getElementById("submitBtn");

  if (form) {
    [form.elements["name"], form.elements["phone"], form.elements["email"]].forEach(function (input) {
      if (!input) return;
      input.addEventListener("input", function () {
        var limit = FIELD_LIMITS[input.name] || 120;
        var cleaned = input.name === "phone" ? sanitizePhone(input.value) : sanitizeInput(input.value, limit);
        if (input.value !== cleaned) input.value = cleaned;
      });
      input.addEventListener("blur", function () {
        var limit = FIELD_LIMITS[input.name] || 120;
        input.value = input.name === "phone" ? sanitizePhone(input.value) : sanitizeInput(input.value, limit);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameEl = form.elements["name"];
      var phoneEl = form.elements["phone"];
      var emailEl = form.elements["email"];
      var serviceEl = form.elements["service"];
      var hpEl = form.elements["website"];

      var payload = {
        name: sanitizeInput(nameEl.value, FIELD_LIMITS.name),
        phone: sanitizePhone(phoneEl.value),
        email: sanitizeInput(emailEl.value, FIELD_LIMITS.email),
        service: serviceEl ? String(serviceEl.value) : "",
        honeypot: hpEl ? sanitizeInput(hpEl.value, 0) : ""
      };

      nameEl.value = payload.name;
      phoneEl.value = payload.phone;
      emailEl.value = payload.email;

      [nameEl, phoneEl, emailEl].forEach(function (el) { el.classList.remove("invalid"); });

      var check = validateContactPayload(payload);
      if (!check.ok) {
        if (payload.name.length < 2) nameEl.classList.add("invalid");
        var digits = (payload.phone.match(/\d/g) || []).length;
        if (digits < 7 || digits > 15) phoneEl.classList.add("invalid");
        if (payload.email && !isValidEmail(payload.email)) emailEl.classList.add("invalid");
        formMsg.textContent = check.message;
        formMsg.className = "form-msg err";
        return;
      }

      sendForm(payload);
    });
  }

  function sendForm(payload) {
    var original = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Enviando…"; }
    formMsg.textContent = "";
    formMsg.className = "form-msg";

    var body = new FormData();
    body.append("name", payload.name);
    body.append("phone", payload.phone);
    body.append("email", payload.email);
    body.append("service", payload.service);
    body.append("website", "");

    fetch(form.action, {
      method: "POST",
      body: body,
      headers: { "X-Requested-With": "fetch", "Accept": "application/json" }
    })
      .then(function (res) {
        var ct = res.headers.get("content-type") || "";
        if (ct.indexOf("application/json") !== -1) {
          return res.json();
        }
        if (!res.ok) {
          return { ok: false, message: "No se pudo enviar la solicitud." };
        }
        return { ok: false, message: "El servidor no procesó el formulario. Ejecuta servidor.ps1 con PHP instalado o contáctanos por teléfono." };
      })
      .then(function (data) {
        var msg = typeof data.message === "string" ? data.message : (data.ok ? "Solicitud recibida." : "Ocurrió un error.");
        formMsg.textContent = msg;
        formMsg.className = "form-msg " + (data.ok ? "ok" : "err");
        if (data.ok) form.reset();
      })
      .catch(function () {
        formMsg.textContent = "No pudimos conectar con el servidor. Llámanos al NOC 24/7.";
        formMsg.className = "form-msg err";
      })
      .finally(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = original; }
      });
  }

  (function () {
    if (!formMsg) return;
    const result = new URLSearchParams(window.location.search).get("contacto");
    if (result === "ok") { formMsg.textContent = "Solicitud recibida. Te contactaremos pronto."; formMsg.className = "form-msg ok"; }
    else if (result === "error") { formMsg.textContent = "Revisa tus datos e inténtalo de nuevo."; formMsg.className = "form-msg err"; }
  })();

  /* ---------- 6. GOOGLE MAPS · COBERTURA ----------
     Coordenadas aproximadas de la región central de México donde operan las
     torres / radio bases de IEC COMUNICACIONES. En producción, las 221 radio bases pueden
     cargarse desde un GeoJSON/endpoint propio y dibujarse como marcadores.

     Para ACTIVAR el mapa real:
       1. Obtén una API key de Google Maps (Maps JavaScript API).
       2. En index.html descomenta:
          <script src="https://maps.googleapis.com/maps/api/js?key=TU_API_KEY&callback=initMap" async defer></script>
       3. Google llamará automáticamente a window.initMap cuando cargue. */
  // Nodo central (NOC) + torres principales representativas de las 221 radiobases.
  const IEC_NOC = { lat: 19.6925, lng: -98.8589, title: "NOC Central · Teotihuacán", hub: true };
  const IEC_TOWERS = [
    IEC_NOC,
    { lat: 19.4978, lng: -99.1269, title: "Nodo Ciudad / Edo. de México" },
    { lat: 19.2826, lng: -99.6557, title: "Nodo Toluca (Edo. de México)" },
    { lat: 19.5740, lng: -99.0480, title: "Nodo Ecatepec (Edo. de México)" },
    { lat: 20.1011, lng: -98.7591, title: "Nodo Pachuca (Hidalgo)" },
    { lat: 20.4823, lng: -99.2160, title: "Nodo Hidalgo (poniente)" },
    { lat: 19.3139, lng: -98.2404, title: "Nodo Tlaxcala" },
    { lat: 19.4400, lng: -98.1200, title: "Nodo Apizaco (Tlaxcala)" },
    { lat: 19.0414, lng: -98.2063, title: "Nodo Puebla" },
    { lat: 19.2000, lng: -97.9500, title: "Nodo Puebla (norte)" }
  ];

  window.initMap = function () {
    const el = document.getElementById("map");
    if (!el || !(window.google && window.google.maps)) return;
    const map = new google.maps.Map(el, {
      center: { lat: 19.65, lng: -98.7 },
      zoom: 8,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    // Marcadores con el azul corporativo de la marca (SVG Symbol).
    // Para las 221 radiobases: recorre tu dataset/GeoJSON y crea un Marker por coordenada.
    IEC_TOWERS.forEach(function (t) {
      const marker = new google.maps.Marker({
        position: { lat: t.lat, lng: t.lng },
        map: map,
        title: t.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: t.hub ? 9 : 6,
          fillColor: "#1b6fe0",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: t.hub ? 3 : 2
        }
      });
      const info = new google.maps.InfoWindow({ content: document.createTextNode(t.title).textContent });
      marker.addListener("click", function () { info.open(map, marker); });
    });
  };

  // Placeholder corporativo mientras no se haya configurado la API key (no rompe el layout).
  (function renderMapPlaceholder() {
    const el = document.getElementById("map");
    if (!el) return;
    if (window.google && window.google.maps) { window.initMap(); return; }
    const ph = document.createElement("div");
    ph.className = "map-embed__placeholder";
    ph.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>' +
      '<strong>Mapa de cobertura · 221 radio bases</strong>' +
      'Teotihuacán · Edo. de México · Hidalgo · Tlaxcala · Puebla<br>' +
      'Activa Google Maps añadiendo tu <code>API key</code> en index.html.';
    el.appendChild(ph);
  })();

  /* ---------- 7. LOGO E IMÁGENES ----------
     Prioridad: assets/img/logo.png → ruta legacy → isotipo+texto.
     Muestra fallback hasta confirmar carga real del PNG. */
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

  document.querySelectorAll("img[data-fallback]").forEach(function (img) {
    let triedFallback = false;
    function handle() {
      if (!triedFallback) {
        triedFallback = true;
        const fb = img.getAttribute("data-fallback");
        if (fb && img.src !== fb) { img.src = fb; return; }
      }
      // Ni la ruta local ni el fallback cargaron: placeholder limpio (sin alt crudo).
      const fig = img.closest(".feature-media");
      if (fig) fig.classList.add("is-broken");
    }
    img.addEventListener("error", handle);
    if (img.complete && img.naturalWidth === 0) handle();
  });

  /* ---------- 8. ANIMACIONES (hero, scroll, contadores) ---------- */
  const motionOk = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Hero: entrada escalonada + barras del panel NOC */
  const hero = document.querySelector("[data-hero]");
  if (hero && motionOk) {
    requestAnimationFrame(function () { hero.classList.add("is-ready"); });
    hero.querySelectorAll(".bar__fill[data-fill]").forEach(function (bar, i) {
      var pct = parseFloat(bar.getAttribute("data-fill")) || 0;
      bar.style.setProperty("--fill-w", pct + "%");
      setTimeout(function () { bar.classList.add("is-filled"); }, 720 + i * 120);
    });
  } else if (hero) {
    hero.classList.add("is-ready");
    hero.querySelectorAll(".bar__fill[data-fill]").forEach(function (bar) {
      var pct = parseFloat(bar.getAttribute("data-fill")) || 0;
      bar.style.setProperty("--fill-w", pct + "%");
      bar.classList.add("is-filled");
    });
  }

  function animateCountEl(el) {
    if (el.dataset.done) return;
    el.dataset.done = "1";
    var target = parseFloat(el.getAttribute("data-count")) || 0;
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var dec = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var start = performance.now(), dur = 1200;
    function fmt(n) {
      var s = dec ? n.toFixed(dec) : Math.round(n).toString();
      if (!dec) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return prefix + s + suffix;
    }
    if (!motionOk) { el.textContent = fmt(target); return; }
    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(target);
    }
    requestAnimationFrame(tick);
  }

  function activateReveal(el) {
    el.classList.add("is-visible");
    el.querySelectorAll(".reveal-stagger").forEach(function (st) { st.classList.add("is-visible"); });
    el.querySelectorAll("[data-count]").forEach(animateCountEl);
  }

  const revealTargets = document.querySelectorAll(".reveal, .reveal-stagger");
  if ("IntersectionObserver" in window && revealTargets.length) {
    const io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          activateReveal(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(activateReveal);
  }

  /* ---------- 9. ACORDEÓN FAQ ---------- */
  (function initFaqAccordion() {
    var faqItems = document.querySelectorAll(".faq-item");
    if (!faqItems.length) return;

    function closeItem(item) {
      var trigger = item.querySelector(".faq-item__trigger");
      var panel = item.querySelector(".faq-item__panel");
      item.classList.remove("is-open");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    }

    function openItem(item) {
      var trigger = item.querySelector(".faq-item__trigger");
      var panel = item.querySelector(".faq-item__panel");
      item.classList.add("is-open");
      if (trigger) trigger.setAttribute("aria-expanded", "true");
      if (panel) panel.hidden = false;
    }

    faqItems.forEach(function (item) {
      var trigger = item.querySelector(".faq-item__trigger");
      if (!trigger) return;
      trigger.addEventListener("click", function () {
        var isOpen = item.classList.contains("is-open");
        if (isOpen) {
          closeItem(item);
        } else {
          faqItems.forEach(function (other) {
            if (other !== item) closeItem(other);
          });
          openItem(item);
        }
      });
    });
  })();

  /* ---------- 10. FLUJO DE PAGO → PORTAL ---------- */
  document.querySelectorAll('a[data-intent="pago"]').forEach(function (link) {
    link.addEventListener("click", function () {
      try { sessionStorage.setItem("iec-portal-payment-intent", "1"); } catch (e) { /* noop */ }
    });
  });

  /* ---------- 11. AÑO DEL FOOTER ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  } /* fin landing (no admin-body) */

  /* ---------- 11. ADMIN · Generación de llaves de personal IEC ---------- */
  window.IEC = window.IEC || {};

  window.IEC.buildInvoicePDF = function (folio, periodo, monto, cliente) {
    var esc = function (s) { return String(s).replace(/([\\()])/g, "\\$1"); };
    var clientName = cliente || "Cliente IEC";
    var lines = [
      { t: "IEC COMUNICACIONES", size: 20, y: 770 },
      { t: "Comprobante de servicio", size: 12, y: 748 },
      { t: "Folio: " + folio, size: 12, y: 700 },
      { t: "Periodo: " + periodo, size: 12, y: 680 },
      { t: "Cliente: " + clientName, size: 12, y: 660 },
      { t: "Monto total: " + monto, size: 14, y: 620 },
      { t: "Estado: Comprobante de demostracion", size: 10, y: 580 },
      { t: "Generado por el Panel Administrativo IEC", size: 10, y: 80 }
    ];
    var content = "";
    lines.forEach(function (l) {
      content += "BT /F1 " + l.size + " Tf 72 " + l.y + " Td (" + esc(l.t) + ") Tj ET\n";
    });
    var objects = [];
    objects.push("<</Type/Catalog/Pages 2 0 R>>");
    objects.push("<</Type/Pages/Kids[3 0 R]/Count 1>>");
    objects.push("<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>");
    objects.push("<</Length " + content.length + ">>\nstream\n" + content + "endstream");
    objects.push("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>");
    var pdf = "%PDF-1.4\n";
    var offsets = [];
    objects.forEach(function (obj, i) {
      offsets.push(pdf.length);
      pdf += (i + 1) + " 0 obj\n" + obj + "\nendobj\n";
    });
    var xrefPos = pdf.length;
    pdf += "xref\n0 " + (objects.length + 1) + "\n";
    pdf += "0000000000 65535 f \n";
    offsets.forEach(function (off) {
      pdf += ("0000000000" + off).slice(-10) + " 00000 n \n";
    });
    pdf += "trailer\n<</Size " + (objects.length + 1) + "/Root 1 0 R>>\nstartxref\n" + xrefPos + "\n%%EOF";
    return new Blob([pdf], { type: "application/pdf" });
  };
  window.IEC.generateStaffToken = function () {
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var suffix = "";
    for (var i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    return "IEC-TR-" + String(1000 + Math.floor(Math.random() * 9000)) + suffix;
  };

  (function initAdminStaffPanel() {
    var staffBody = document.getElementById("staffBody");
    if (!staffBody || staffBody.dataset.bound) return;
    staffBody.dataset.bound = "1";

    var STAFF = window.IEC._staffData || [
      { id: "EMP-001", nombre: "Ing. Carlos Mendoza", puesto: "Soporte NOC", estado: "activo", token: "IEC-TR-8492X" },
      { id: "EMP-002", nombre: "Tec. Luis Juárez", puesto: "Instalador de Fibra Óptica", estado: "en-ruta", token: "IEC-TR-7310K" },
      { id: "EMP-003", nombre: "Lic. Ana Torres", puesto: "Ejecutivo B2B", estado: "activo", token: "IEC-TR-5581M" },
      { id: "EMP-004", nombre: "Tec. Roberto Sánchez", puesto: "Instalador de Fibra Óptica", estado: "fuera", token: "IEC-TR-9024P" },
      { id: "EMP-005", nombre: "Ing. Patricia Ruiz", puesto: "Ingeniería de Red", estado: "activo", token: "IEC-TR-6643H" }
    ];
    window.IEC._staffData = STAFF;

    var STAFF_STATUS = {
      activo: { label: "Activo", cls: "tag--staff-active" },
      "en-ruta": { label: "En ruta", cls: "tag--staff-route" },
      fuera: { label: "Fuera de servicio", cls: "tag--staff-off" }
    };

    function escStaff(str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function staffStatusTag(estado) {
      var meta = STAFF_STATUS[estado] || STAFF_STATUS.activo;
      return '<span class="tag staff-status ' + meta.cls + '"><span class="staff-status__dot" aria-hidden="true"></span>' + meta.label + "</span>";
    }

    function updateStaffKPIs() {
      var activos = STAFF.filter(function (s) { return s.estado === "activo"; }).length;
      var enRuta = STAFF.filter(function (s) { return s.estado === "en-ruta"; }).length;
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      set("staffKpiActive", activos);
      set("staffKpiRoute", enRuta);
      set("staffKpiTotal", STAFF.length);
    }

    function sanitizeStaffRole(value) {
      return String(value).replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
    }

    function syncStaffRolesFromDOM() {
      staffBody.querySelectorAll(".staff-role-input").forEach(function (input) {
        var id = input.getAttribute("data-id");
        var member = STAFF.filter(function (s) { return s.id === id; })[0];
        if (member) {
          var val = sanitizeStaffRole(input.value);
          if (val) member.puesto = val;
        }
      });
    }

    function saveStaffRole(id, btn) {
      var input = staffBody.querySelector('.staff-role-input[data-id="' + id + '"]');
      var member = STAFF.filter(function (s) { return s.id === id; })[0];
      if (!input || !member) return false;
      var puesto = sanitizeStaffRole(input.value);
      if (puesto.length < 2) {
        input.classList.add("is-invalid");
        return false;
      }
      member.puesto = puesto;
      input.value = puesto;
      input.classList.remove("is-invalid");
      input.classList.add("is-saved");
      console.log("[IEC Admin · Personal]", {
        accion: "guardar-puesto",
        id: member.id,
        nombre: member.nombre,
        puesto: puesto
      });
      if (btn) {
        var original = btn.innerHTML;
        btn.classList.add("is-saved-btn");
        btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Guardado';
        window.setTimeout(function () {
          btn.classList.remove("is-saved-btn");
          btn.innerHTML = original;
          input.classList.remove("is-saved");
        }, 1800);
      } else {
        window.setTimeout(function () { input.classList.remove("is-saved"); }, 1200);
      }
      return true;
    }

    window.IECAdminStaff = {
      renderStaff: function (filter) {
        syncStaffRolesFromDOM();
        var q = (filter || "").toLowerCase();
        staffBody.innerHTML = "";
        STAFF.filter(function (s) {
          return !q || (s.nombre + " " + s.puesto + " " + s.token + " " + s.id).toLowerCase().indexOf(q) !== -1;
        }).forEach(function (s) {
          var tr = document.createElement("tr");
          tr.setAttribute("data-staff-id", s.id);
          tr.innerHTML =
            "<td><strong>" + escStaff(s.nombre) + "</strong></td>" +
            '<td class="staff-role-cell">' +
              '<input type="text" class="staff-role-input" data-id="' + escStaff(s.id) + '" value="' + escStaff(s.puesto) + '" maxlength="120" ' +
              'aria-label="Puesto o rol de ' + escStaff(s.nombre) + '" placeholder="Describe el puesto o función…" />' +
            "</td>" +
            "<td>" + staffStatusTag(s.estado) + "</td>" +
            '<td><code class="staff-token" id="token-' + escStaff(s.id) + '">' + escStaff(s.token) + "</code></td>" +
            '<td class="ta-right"><span class="row-actions">' +
              '<button type="button" class="icon-btn" data-action="edit-role" data-id="' + escStaff(s.id) + '" title="Editar puesto"><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar</button>' +
              '<button type="button" class="icon-btn staff-save-btn" data-action="save-role" data-id="' + escStaff(s.id) + '" title="Guardar puesto"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Guardar</button>' +
              '<button type="button" class="icon-btn staff-key-btn" data-action="genkey" data-id="' + escStaff(s.id) + '"><i class="fa-solid fa-key" aria-hidden="true"></i> Generar llave</button>' +
              '<button type="button" class="icon-btn" data-action="copystaff" data-id="' + escStaff(s.id) + '"><i class="fa-solid fa-copy" aria-hidden="true"></i> Copiar</button>' +
            "</span></td>";
          staffBody.appendChild(tr);
        });
        updateStaffKPIs();
      },
      saveStaffRole: saveStaffRole
    };

    staffBody.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var member = STAFF.filter(function (s) { return s.id === id; })[0];
      if (!member) return;
      var action = btn.getAttribute("data-action");
      if (action === "edit-role") {
        var input = staffBody.querySelector('.staff-role-input[data-id="' + id + '"]');
        if (input) {
          input.focus();
          input.select();
          input.classList.add("is-editing");
        }
      } else if (action === "save-role") {
        saveStaffRole(id, btn);
      } else if (action === "genkey") {
        syncStaffRolesFromDOM();
        member.token = window.IEC.generateStaffToken();
        window.IECAdminStaff.renderStaff(document.getElementById("staffSearch") ? document.getElementById("staffSearch").value : "");
        var tokenEl = document.getElementById("token-" + id);
        if (tokenEl) {
          tokenEl.classList.add("is-flash");
          window.setTimeout(function () { tokenEl.classList.remove("is-flash"); }, 1200);
        }
      } else if (action === "copystaff" && navigator.clipboard) {
        navigator.clipboard.writeText(member.token).catch(function () {});
      }
    });

    staffBody.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" || !e.target.classList.contains("staff-role-input")) return;
      e.preventDefault();
      saveStaffRole(e.target.getAttribute("data-id"), null);
    });

    staffBody.addEventListener("focusout", function (e) {
      if (e.target.classList && e.target.classList.contains("staff-role-input")) {
        e.target.classList.remove("is-editing");
      }
    });

    var staffSearch = document.getElementById("staffSearch");
    if (staffSearch) staffSearch.addEventListener("input", function () { window.IECAdminStaff.renderStaff(staffSearch.value); });

    var staffAddForm = document.getElementById("staffAddForm");
    var staffAddMsg = document.getElementById("staffAddMsg");
    if (staffAddForm) {
      staffAddForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var nombre = String(staffAddForm.elements["nombre"].value).replace(/[<>]/g, "").trim();
        var puesto = sanitizeStaffRole(staffAddForm.elements["puesto"].value);
        var estado = staffAddForm.elements["estado"].value;
        if (nombre.length < 3) {
          staffAddMsg.textContent = "Ingresa un nombre válido (mínimo 3 caracteres).";
          staffAddMsg.className = "form-msg err";
          return;
        }
        if (puesto.length < 2) {
          staffAddMsg.textContent = "Describe el puesto o rol (mínimo 2 caracteres).";
          staffAddMsg.className = "form-msg err";
          return;
        }
        var token = window.IEC.generateStaffToken();
        var max = 0;
        STAFF.forEach(function (s) {
          var n = parseInt(String(s.id).replace(/\D/g, ""), 10);
          if (n > max) max = n;
        });
        STAFF.unshift({ id: "EMP-" + String(max + 1).padStart(3, "0"), nombre: nombre, puesto: puesto, estado: estado, token: token });
        staffAddForm.reset();
        window.IECAdminStaff.renderStaff("");
        staffAddMsg.textContent = "Personal registrado. Llave asignada: " + token;
        staffAddMsg.className = "form-msg ok";
      });
    }

    window.IECAdminStaff.renderStaff("");
  })();

  /* ---------- 12. ADMIN · Gestión de clientes (alta + tabla dinámica) ---------- */
  (function initAdminClientsPanel() {
    var usersBody = document.getElementById("usersBody");
    if (!usersBody || usersBody.dataset.bound) return;
    usersBody.dataset.bound = "1";

    var CLIENT_PLANS = {
      residencial: "Residencial",
      fibra: "Cambio a FO",
      empresarial: "Empresarial",
      "dedicado-10g": "Dedicado de 10Gb"
    };

    var CLIENTS = window.IEC._clientsData || [
      { id: "IEZ-018245", nombre: "María Hernández", email: "maria@mail.com", telefono: "(55) 1111 2222", plan: "Fibra 60 Mbps", planKey: "fibra", nodo: "Teotihuacán", estado: "activo" },
      { id: "IEZ-018102", nombre: "Distribuidora del Valle SA", email: "contacto@delvalle.mx", telefono: "(55) 3333 4444", plan: "Empresarial 50 Mbps", planKey: "empresarial", nodo: "Ecatepec", estado: "activo" },
      { id: "IEZ-017980", nombre: "Hotel Teotihuacán", email: "admin@hotelteo.mx", telefono: "(594) 555 0101", plan: "Dedicado 100 Mbps", planKey: "dedicado-10g", nodo: "Teotihuacán", estado: "activo" },
      { id: "IEZ-017743", nombre: "Carlos Ramírez", email: "carlos.r@mail.com", telefono: "(771) 222 3344", plan: "Antena 8 Mbps", planKey: "residencial", nodo: "Pachuca", estado: "suspendido" },
      { id: "IEZ-017501", nombre: "Corporativo Pachuca", email: "noc@corp-pach.mx", telefono: "(771) 888 9900", plan: "Dedicado 300 Mbps", planKey: "dedicado-10g", nodo: "Pachuca", estado: "activo" },
      { id: "IEZ-017388", nombre: "Escuela Tlaxcala", email: "sistemas@esc-tlx.edu.mx", telefono: "(246) 123 4567", plan: "Empresarial 10 Mbps", planKey: "empresarial", nodo: "Tlaxcala", estado: "activo" },
      { id: "IEZ-017255", nombre: "Laura Méndez", email: "laura.m@mail.com", telefono: "(222) 555 6677", plan: "Fibra 200 Mbps", planKey: "fibra", nodo: "Puebla", estado: "suspendido" },
      { id: "IEZ-017120", nombre: "Refaccionaria Norte", email: "ventas@refnorte.mx", telefono: "(771) 404 5050", plan: "Antena 15 Mbps", planKey: "residencial", nodo: "Hidalgo", estado: "activo" }
    ];
    window.IEC._clientsData = CLIENTS;

    var modal = document.getElementById("clientAddModal");
    var openBtn = document.getElementById("openClientAddModal");
    var closeBtn = document.getElementById("closeClientAddModal");
    var form = document.getElementById("clientAddForm");
    var formMsg = document.getElementById("clientAddMsg");
    var modalTitle = document.getElementById("clientAddModalTitle");
    var submitBtn = document.getElementById("clientAddSubmitBtn");
    var editingId = null;

    function escClient(str) {
      return String(str).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function sanitizeClientText(value, maxLen) {
      var s = String(value).replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
      if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
      return s;
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
    }

    function isValidPhone(value) {
      var digits = String(value).replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15;
    }

    function generateClientId() {
      var max = 180000;
      CLIENTS.forEach(function (c) {
        var n = parseInt(String(c.id).replace(/\D/g, ""), 10);
        if (n > max) max = n;
      });
      return "IEZ-" + String(max + 1);
    }

    function planLabel(planKey) {
      return CLIENT_PLANS[planKey] || planKey;
    }

    function updateClientKPIs() {
      var activos = CLIENTS.filter(function (u) { return u.estado === "activo"; }).length;
      var susp = CLIENTS.length - activos;
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      set("kpiActivos", activos);
      set("kpiSusp", susp);
      set("kpiTotal", CLIENTS.length);
    }

    function renderUsers(filter) {
      var q = (filter || "").toLowerCase();
      usersBody.innerHTML = "";
      CLIENTS.filter(function (u) {
        var haystack = (u.nombre + " " + u.plan + " " + u.nodo + " " + u.id + " " + (u.email || "")).toLowerCase();
        return !q || haystack.indexOf(q) !== -1;
      }).forEach(function (u) {
        var tr = document.createElement("tr");
        var isActive = u.estado === "activo";
        tr.innerHTML =
          "<td>" + escClient(u.id) + "</td>" +
          "<td>" + escClient(u.nombre) + "</td>" +
          "<td>" + escClient(u.plan) + "</td>" +
          "<td>" + escClient(u.nodo) + "</td>" +
          '<td><span class="tag ' + (isActive ? "tag--activo" : "tag--susp") + '">' + (isActive ? "Activo" : "Suspendido") + "</span></td>" +
          '<td class="ta-right"><span class="row-actions">' +
            '<button type="button" class="icon-btn" data-action="edit" data-id="' + escClient(u.id) + '"><i class="fa-solid fa-pen" aria-hidden="true"></i> Editar</button>' +
            '<button type="button" class="icon-btn icon-btn--danger" data-action="toggle" data-id="' + escClient(u.id) + '">' +
              (isActive ? '<i class="fa-solid fa-ban" aria-hidden="true"></i> Suspender' : '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Activar') +
            "</button>" +
          "</span></td>";
        usersBody.appendChild(tr);
      });
      updateClientKPIs();
    }

    function openClientModal(mode, user) {
      editingId = mode === "edit" && user ? user.id : null;
      if (modalTitle) modalTitle.textContent = editingId ? "Editar cliente" : "Agregar cliente";
      if (submitBtn) submitBtn.textContent = editingId ? "Guardar cambios" : "Guardar cliente";
      if (form) {
        if (editingId && user) {
          form.elements["nombre"].value = user.nombre;
          form.elements["email"].value = user.email || "";
          form.elements["telefono"].value = user.telefono || "";
          form.elements["plan"].value = user.planKey || "";
          if (form.elements["nodo"]) form.elements["nodo"].value = user.nodo || "Teotihuacán";
          if (form.elements["clientId"]) form.elements["clientId"].value = user.id;
        } else {
          form.reset();
          if (form.elements["clientId"]) form.elements["clientId"].value = "";
        }
      }
      if (!modal) return;
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("admin-modal-open");
      if (formMsg) { formMsg.textContent = ""; formMsg.className = "form-msg"; }
      var first = form && form.elements["nombre"];
      if (first) first.focus();
    }

    function closeClientModal() {
      editingId = null;
      if (modalTitle) modalTitle.textContent = "Agregar cliente";
      if (submitBtn) submitBtn.textContent = "Guardar cliente";
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("admin-modal-open");
      if (form) form.reset();
      if (formMsg) { formMsg.textContent = ""; formMsg.className = "form-msg"; }
    }

    window.IECAdminClients = {
      renderUsers: renderUsers,
      getClients: function () { return CLIENTS.slice(); }
    };

    usersBody.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var id = btn.getAttribute("data-id");
      var user = CLIENTS.filter(function (u) { return u.id === id; })[0];
      if (!user) return;
      if (btn.getAttribute("data-action") === "toggle") {
        user.estado = user.estado === "activo" ? "suspendido" : "activo";
        renderUsers(document.getElementById("userSearch") ? document.getElementById("userSearch").value : "");
      } else if (btn.getAttribute("data-action") === "edit") {
        openClientModal("edit", user);
      }
    });

    if (openBtn) openBtn.addEventListener("click", function () { openClientModal("add"); });
    if (closeBtn) closeBtn.addEventListener("click", closeClientModal);
    document.querySelectorAll("[data-close-client-modal]").forEach(function (el) {
      el.addEventListener("click", closeClientModal);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && !modal.hidden) closeClientModal();
    });

    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var nombre = sanitizeClientText(form.elements["nombre"].value, 120);
        var email = sanitizeClientText(form.elements["email"].value, 254).toLowerCase();
        var telefono = sanitizeClientText(form.elements["telefono"].value, 20);
        var planKey = form.elements["plan"].value;

        form.querySelectorAll("input, select").forEach(function (el) { el.classList.remove("invalid"); });

        if (nombre.length < 3) {
          form.elements["nombre"].classList.add("invalid");
          formMsg.textContent = "Ingresa un nombre completo válido (mínimo 3 caracteres).";
          formMsg.className = "form-msg err";
          return;
        }
        if (!isValidEmail(email)) {
          form.elements["email"].classList.add("invalid");
          formMsg.textContent = "Ingresa un correo electrónico con formato válido.";
          formMsg.className = "form-msg err";
          return;
        }
        if (!isValidPhone(telefono)) {
          form.elements["telefono"].classList.add("invalid");
          formMsg.textContent = "Ingresa un teléfono válido (mínimo 10 dígitos).";
          formMsg.className = "form-msg err";
          return;
        }
        if (!planKey || !CLIENT_PLANS[planKey]) {
          form.elements["plan"].classList.add("invalid");
          formMsg.textContent = "Selecciona un plan de Internet.";
          formMsg.className = "form-msg err";
          return;
        }

        var nodo = form.elements["nodo"] ? form.elements["nodo"].value : "Teotihuacán";
        var searchVal = document.getElementById("userSearch") ? document.getElementById("userSearch").value : "";

        if (editingId) {
          var existing = CLIENTS.filter(function (c) { return c.id === editingId; })[0];
          if (!existing) {
            formMsg.textContent = "No se encontró el cliente a editar.";
            formMsg.className = "form-msg err";
            return;
          }
          existing.nombre = nombre;
          existing.email = email;
          existing.telefono = telefono;
          existing.planKey = planKey;
          existing.plan = planLabel(planKey);
          existing.nodo = nodo;
          renderUsers(searchVal);
          formMsg.textContent = "Cliente " + existing.id + " actualizado correctamente.";
          formMsg.className = "form-msg ok";
          window.setTimeout(function () { closeClientModal(); }, 900);
          return;
        }

        var nuevo = {
          id: generateClientId(),
          nombre: nombre,
          email: email,
          telefono: telefono,
          planKey: planKey,
          plan: planLabel(planKey),
          nodo: nodo,
          estado: "activo"
        };
        CLIENTS.unshift(nuevo);
        renderUsers(searchVal);
        formMsg.textContent = "Cliente " + nuevo.id + " registrado correctamente.";
        formMsg.className = "form-msg ok";
        window.setTimeout(function () {
          closeClientModal();
        }, 900);
      });
    }

    renderUsers("");
  })();

  (function initAdminInvoices() {
    var panel = document.getElementById("view-facturacion");
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound = "1";
    panel.querySelectorAll("[data-admin-invoice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var folio = btn.getAttribute("data-admin-invoice");
        var periodo = btn.getAttribute("data-periodo") || "";
        var monto = btn.getAttribute("data-amount") || "";
        var cliente = btn.getAttribute("data-client") || "Cliente IEC";
        if (!folio || !window.IEC.buildInvoicePDF) return;
        var blob = window.IEC.buildInvoicePDF(folio, periodo, monto, cliente);
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "IEC-" + folio + ".pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      });
    });
  })();
})();
