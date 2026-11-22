/*!
 * Fundación CEDINE · Consentimiento de cookies (Ley 1581 de 2012 + Google Consent Mode v2)
 * ----------------------------------------------------------------------------------------
 * - Google Analytics 4 NO se carga hasta que el visitante acepta "Estadísticas".
 * - "Marketing" controla las señales de anuncios (Google Ads / Ad Grants).
 * - La decisión se guarda 6 meses; luego se vuelve a preguntar.
 * - Cualquier enlace o botón con  data-cookie-settings  abre el panel de preferencias.
 *
 * CONFIGURACIÓN: etiquetaGoogle es el ID de la etiqueta de Google (GTM-..., GT-... o G-...).
 * NO pegues el fragmento de Google en el <head> de las páginas: este archivo lo carga
 * solo después de que el visitante acepta, como exige la Ley 1581.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Si pones aquí el ID de medición de Analytics (G-...), se usa directo y se ignora etiquetaGoogle.
    ga4Id: 'G-K0JZ9HKN6R',                    // <-- Analytics → Administrar → Flujos de datos → Web → ID de medición
    etiquetaGoogle: 'GTM-NQVXZXPK', // contenedor de Google Tag Manager (solo se usa si ga4Id está vacío)
    googleAdsId: '',                // opcional, p. ej. 'AW-123456789' (conversiones de Ad Grants)
    clave: 'cedine_consent',
    version: 1,                     // súbelo si cambias las categorías: se vuelve a preguntar
    duracionDias: 180,
    urlPolitica: '/politica-de-cookies'
  };

  var usarGa4Directo = /^G-[A-Z0-9]{6,}$/.test(CONFIG.ga4Id);
  var gaConfigurado = usarGa4Directo || /^(G|GT|GTM|AW)-[A-Z0-9]{6,}$/.test(CONFIG.etiquetaGoogle);

  // -------------------------------------------------------------------------
  // 1. Consent Mode v2: todo denegado por defecto (antes de cargar cualquier etiqueta de Google)
  // -------------------------------------------------------------------------
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',   // idioma y preferencias del sitio
    security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);

  // -------------------------------------------------------------------------
  // 2. Guardar / leer la decisión
  // -------------------------------------------------------------------------
  function leer() {
    try {
      var d = JSON.parse(localStorage.getItem(CONFIG.clave) || 'null');
      if (!d || d.v !== CONFIG.version) return null;
      if (Date.now() - d.ts > CONFIG.duracionDias * 864e5) return null;
      return d;
    } catch (e) { return null; }
  }

  function guardar(estadisticas, marketing) {
    var d = { v: CONFIG.version, ts: Date.now(), estadisticas: !!estadisticas, marketing: !!marketing };
    try { localStorage.setItem(CONFIG.clave, JSON.stringify(d)); } catch (e) { /* modo privado */ }
    return d;
  }

  // -------------------------------------------------------------------------
  // 3. Aplicar la decisión
  // -------------------------------------------------------------------------
  var gaCargado = false;

  function cargarGoogle() {
    if (gaCargado || !gaConfigurado) return;
    gaCargado = true;
    var s = document.createElement('script');
    s.async = true;
    var etiqueta = usarGa4Directo ? CONFIG.ga4Id : CONFIG.etiquetaGoogle;
    var id = encodeURIComponent(etiqueta);
    // gtm.js para contenedores de Tag Manager (GTM-); gtag/js para Analytics/Ads (G-, GT-, AW-)
    s.src = /^GTM-/.test(etiqueta)
      ? 'https://www.googletagmanager.com/gtm.js?id=' + id
      : 'https://www.googletagmanager.com/gtag/js?id=' + id;
    gtag('js', new Date());
    document.head.appendChild(s);
    if (!/^GTM-/.test(etiqueta)) gtag('config', etiqueta);
    if (CONFIG.googleAdsId) gtag('config', CONFIG.googleAdsId);
  }

  function borrarCookiesGoogle() {
    var dominios = [location.hostname, '.' + location.hostname.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (c) {
      var nombre = c.split('=')[0].trim();
      if (/^(_ga|_gid|_gat|_gcl_)/.test(nombre)) {
        dominios.forEach(function (dom) {
          document.cookie = nombre + '=; Max-Age=0; path=/; domain=' + dom;
        });
        document.cookie = nombre + '=; Max-Age=0; path=/';
      }
    });
  }

  function aplicar(d) {
    var e = d.estadisticas ? 'granted' : 'denied';
    var m = d.marketing ? 'granted' : 'denied';
    gtag('consent', 'update', {
      analytics_storage: e,
      ad_storage: m,
      ad_user_data: m,
      ad_personalization: m
    });
    if (d.estadisticas || d.marketing) {
      cargarGoogle();
    } else {
      borrarCookiesGoogle();
    }
  }

  // -------------------------------------------------------------------------
  // 4. Interfaz (estilos propios: no depende de Tailwind)
  // -------------------------------------------------------------------------
  var CSS = '' +
    '#cc-banner,#cc-modal{font-family:Inter,Helvetica,Arial,sans-serif;color:#1e293b;z-index:2147483000}' +
    '#cc-banner{position:fixed;left:16px;right:16px;bottom:16px;max-width:760px;margin:0 auto;background:#fff;border-radius:22px;' +
    'box-shadow:0 18px 50px rgba(28,75,124,.28);border-top:6px solid #1C4B7C;padding:20px 22px;animation:ccIn .35s ease-out}' +
    '#cc-banner h2,#cc-modal h2{font-family:Fredoka,Inter,sans-serif;color:#1C4B7C;font-size:1.15rem;font-weight:700;margin:0 0 6px}' +
    '#cc-banner p,#cc-modal p{font-size:.9rem;line-height:1.5;margin:0}' +
    '#cc-banner a,#cc-modal a{color:#1C4B7C;font-weight:600;text-decoration:underline}' +
    '.cc-acciones{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}' +
    '.cc-btn{font:600 .9rem Fredoka,Inter,sans-serif;border-radius:999px;padding:11px 20px;cursor:pointer;border:2px solid #1C4B7C;transition:filter .15s}' +
    '.cc-btn:hover{filter:brightness(1.12)}.cc-btn:focus-visible{outline:3px solid #B85400;outline-offset:2px}' +
    '.cc-primario{background:#1C4B7C;color:#fff}.cc-secundario{background:#fff;color:#1C4B7C}' +
    '.cc-link{background:none;border:none;color:#1C4B7C;text-decoration:underline;padding:11px 6px}' +
    '#cc-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '#cc-modal .cc-caja{background:#fff;border-radius:22px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:24px;border-top:6px solid #1C4B7C}' +
    '.cc-cat{border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;margin-top:12px;display:flex;gap:14px;align-items:flex-start;justify-content:space-between}' +
    '.cc-cat strong{display:block;color:#1C4B7C;margin-bottom:2px}.cc-cat p{font-size:.82rem;color:#475569}' +
    '.cc-sw{position:relative;flex:0 0 46px;height:26px}.cc-sw input{opacity:0;width:100%;height:100%;margin:0;position:absolute;cursor:pointer;z-index:1}' +
    '.cc-sw span{position:absolute;inset:0;background:#cbd5e1;border-radius:999px;transition:.2s}' +
    '.cc-sw span:before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}' +
    '.cc-sw input:checked+span{background:#3D6B1E}.cc-sw input:checked+span:before{transform:translateX(20px)}' +
    '.cc-sw input:disabled+span{background:#94a3b8;cursor:not-allowed}' +
    '.cc-sw input:focus-visible+span{outline:3px solid #B85400;outline-offset:2px}' +
    '@keyframes ccIn{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){#cc-banner{animation:none}}' +
    '@media (max-width:520px){.cc-acciones .cc-btn{flex:1 1 100%}}';

  function insertarEstilos() {
    if (document.getElementById('cc-estilos')) return;
    var st = document.createElement('style');
    st.id = 'cc-estilos';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  function cerrarBanner() {
    var b = document.getElementById('cc-banner');
    if (b) b.remove();
  }

  function mostrarBanner() {
    if (document.getElementById('cc-banner')) return;
    insertarEstilos();
    var b = document.createElement('section');
    b.id = 'cc-banner';
    b.setAttribute('role', 'region');
    b.setAttribute('aria-label', 'Aviso de cookies');
    b.innerHTML =
      '<h2>Tu privacidad es importante 🍪</h2>' +
      '<p>Usamos cookies de estadísticas para saber cómo se usa el sitio y llegar a más familias con nuestras jornadas. ' +
      'Solo se activan si las aceptas. Más información en nuestra <a href="' + CONFIG.urlPolitica + '">Política de Cookies</a>.</p>' +
      '<div class="cc-acciones">' +
      '<button type="button" class="cc-btn cc-primario" data-cc="aceptar">Aceptar todas</button>' +
      '<button type="button" class="cc-btn cc-secundario" data-cc="rechazar">Rechazar</button>' +
      '<button type="button" class="cc-btn cc-link" data-cc="configurar">Configurar</button>' +
      '</div>';
    document.body.appendChild(b);
  }

  var focoPrevio = null;

  function cerrarModal() {
    var m = document.getElementById('cc-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', teclaModal);
    if (focoPrevio && focoPrevio.focus) focoPrevio.focus();
  }

  function teclaModal(ev) {
    if (ev.key === 'Escape') cerrarModal();
  }

  function abrirPreferencias() {
    insertarEstilos();
    cerrarModal();
    focoPrevio = document.activeElement;
    var d = leer() || { estadisticas: false, marketing: false };
    var m = document.createElement('div');
    m.id = 'cc-modal';
    m.innerHTML =
      '<div class="cc-caja" role="dialog" aria-modal="true" aria-labelledby="cc-titulo">' +
      '<h2 id="cc-titulo">Preferencias de cookies</h2>' +
      '<p>Elige qué cookies permites. Puedes cambiar tu decisión cuando quieras desde el pie de página.</p>' +
      categoria('necesarias', 'Necesarias', 'Seguridad del sitio y recordar tu idioma y esta decisión. Siempre activas.', true, true) +
      categoria('estadisticas', 'Estadísticas', 'Google Analytics: visitas y páginas más vistas, de forma agregada. Nos ayuda a mejorar y a medir el impacto de nuestras campañas.', d.estadisticas, false) +
      categoria('marketing', 'Marketing', 'Medición de anuncios de Google (Google Ad Grants) para saber qué campañas traen donantes y voluntarios.', d.marketing, false) +
      '<div class="cc-acciones">' +
      '<button type="button" class="cc-btn cc-primario" data-cc="guardar">Guardar preferencias</button>' +
      '<button type="button" class="cc-btn cc-secundario" data-cc="aceptar">Aceptar todas</button>' +
      '<button type="button" class="cc-btn cc-link" data-cc="rechazar">Rechazar todas</button>' +
      '</div></div>';
    m.addEventListener('click', function (ev) { if (ev.target === m) cerrarModal(); });
    document.body.appendChild(m);
    document.addEventListener('keydown', teclaModal);
    var primero = m.querySelector('#cc-estadisticas');
    if (primero) primero.focus();
  }

  function categoria(id, titulo, texto, activo, bloqueado) {
    return '<div class="cc-cat"><div><strong id="cc-l-' + id + '">' + titulo + '</strong><p>' + texto + '</p></div>' +
      '<label class="cc-sw"><input type="checkbox" id="cc-' + id + '" aria-labelledby="cc-l-' + id + '"' +
      (activo ? ' checked' : '') + (bloqueado ? ' disabled' : '') + '><span></span></label></div>';
  }

  function decidir(estadisticas, marketing) {
    aplicar(guardar(estadisticas, marketing));
    cerrarBanner();
    cerrarModal();
  }

  document.addEventListener('click', function (ev) {
    var abrir = ev.target.closest && ev.target.closest('[data-cookie-settings]');
    if (abrir) { ev.preventDefault(); abrirPreferencias(); return; }
    var btn = ev.target.closest && ev.target.closest('[data-cc]');
    if (!btn) return;
    var accion = btn.getAttribute('data-cc');
    if (accion === 'aceptar') decidir(true, true);
    else if (accion === 'rechazar') decidir(false, false);
    else if (accion === 'configurar') abrirPreferencias();
    else if (accion === 'guardar') {
      decidir(document.getElementById('cc-estadisticas').checked, document.getElementById('cc-marketing').checked);
    }
  });

  // -------------------------------------------------------------------------
  // 5. Inicio
  // -------------------------------------------------------------------------
  function iniciar() {
    var d = leer();
    if (d) aplicar(d);
    else mostrarBanner();
  }

  // ---------------------------------------------------------------------------
  // Conversiones (Google Ad Grants): clics en Donar, WhatsApp, teléfono y correo.
  // Solo se envían a Google si el visitante aceptó las cookies (Consent Mode).
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var evento = null;
    if (/wa\.me\//.test(href)) evento = 'contacto_whatsapp';
    else if (/^\/donar\/?$|fundacioncedine\.org\/donar/.test(href)) evento = 'clic_donar';
    else if (/^tel:/.test(href)) evento = 'contacto_telefono';
    else if (/^mailto:/.test(href)) evento = 'contacto_correo';
    if (evento) gtag('event', evento, { ubicacion: location.pathname, texto: (a.textContent || '').trim().slice(0, 60) });
  }, true);

  window.CedineCookies = { abrir: abrirPreferencias, estado: leer };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
