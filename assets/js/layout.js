(function renderGlobalLayout() {
  const rawPath = window.location.pathname.replace(/\/$/, '').split('/').pop() || '';
  const currentPage = rawPath.replace('.html', '');

  // Íconos (trazos simples, heredan el color del texto)
  const ico = (d, cls = 'w-5 h-5') => `<svg aria-hidden="true" class="${cls}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">${d}</svg>`;
  const I = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
    puzzle: '<path d="M9 4h3a2 2 0 114 0h3v5a2 2 0 110 4v6h-5a2 2 0 10-4 0H5v-6a2 2 0 100-4V4h4z"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/>',
    check: '<path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
    arrow: '<path d="M9 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>'
  };

  const navItems = [
    { href: '/', slug: '', key: 'nav_home', label: 'Inicio', icon: I.home },
    { href: '/nosotros', slug: 'nosotros', key: 'nav_about', label: 'Nuestra Labor', icon: I.heart },
    { href: '/programas', slug: 'programas', key: 'nav_programs', label: 'Terapias e Inclusión', icon: I.puzzle },
    { href: '/casos-de-exito', slug: 'casos-de-exito', key: 'nav_cases', label: 'Casos de Éxito', icon: I.star },
    { href: '/galeria', slug: 'galeria', key: 'nav_gallery', label: 'Jornadas', icon: I.camera }
  ];
  const subMenuItems = [
    { href: '/formacion', slug: 'formacion', key: 'nav_sub_formacion', label: 'Formación para el Trabajo', desc: 'Cursos certificados para el empleo', descKey: 'nav_sub_formacion_desc', icon: I.book },
    { href: '/verificacion', slug: 'verificacion', key: 'nav_sub_verif', label: 'Mis Certificados', desc: 'Descarga los certificados de tus cursos', descKey: 'nav_sub_verif_desc', icon: I.check },
    { href: '/contacto', slug: 'contacto', key: 'nav_contact', label: 'Contáctenos', desc: 'Voluntariado, alianzas y donaciones', descKey: 'nav_contact_desc', icon: I.chat }
  ];
  const isSubActive = subMenuItems.some(s => s.slug === currentPage);

  const desktopLinks = navItems.map(item => {
    const active = currentPage === item.slug;
    return `<a href="${item.href}" ${active ? 'aria-current="page"' : ''} class="nav-pill ${active ? 'is-active' : ''}" data-i18n="${item.key}">${item.label}</a>`;
  }).join('');

  const dropdownDesktop = `
    <div class="relative" id="nav-mas">
      <button type="button" id="nav-mas-btn" aria-haspopup="true" aria-expanded="false" aria-controls="nav-mas-panel" class="nav-pill ${isSubActive ? 'is-active' : ''} inline-flex items-center gap-1">
        <span data-i18n="nav_more">Más sobre CEDINE</span>${ico(I.chevron, 'w-4 h-4 transition-transform duration-200 nav-mas-chevron')}
      </button>
      <div id="nav-mas-panel" class="nav-mas-panel absolute right-0 top-full pt-3 w-[22rem] z-50" role="menu">
        <div class="bg-white rounded-3xl shadow-2xl ring-1 ring-slate-200 p-2 overflow-hidden">
          ${subMenuItems.map(sub => `
            <a href="${sub.href}" role="menuitem" class="group flex items-start gap-3 rounded-2xl p-3 hover:bg-cedine-cream transition-colors ${currentPage === sub.slug ? 'bg-cedine-cream' : ''}">
              <span class="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-[#1C4B7C]/10 text-cedine-blue group-hover:bg-[#B85400] group-hover:text-white transition-colors">${ico(sub.icon)}</span>
              <span><span class="block font-display font-semibold text-cedine-blue group-hover:text-[#B85400]" data-i18n="${sub.key}">${sub.label}</span>
              <span class="block text-xs text-slate-600" data-i18n="${sub.descKey}">${sub.desc}</span></span>
            </a>`).join('')}
        </div>
      </div>
    </div>`;

  const mobileLinks = navItems.concat(subMenuItems).map(item => {
    const active = currentPage === item.slug;
    return `<a href="${item.href}" ${active ? 'aria-current="page"' : ''} class="flex items-center gap-3 rounded-2xl px-3 py-3 font-display font-semibold ${active ? 'bg-[#B85400]/10 text-[#B85400]' : 'text-cedine-blue hover:bg-cedine-cream'}">
      <span class="grid place-items-center w-9 h-9 rounded-xl ${active ? 'bg-[#B85400] text-white' : 'bg-[#1C4B7C]/10 text-cedine-blue'}">${ico(item.icon)}</span>
      <span class="flex-1" data-i18n="${item.key}">${item.label}</span>${ico(I.arrow, 'w-4 h-4 opacity-50')}</a>`;
  }).join('');

  const headerContainer = document.getElementById('global-header');
  if (headerContainer) {
    headerContainer.innerHTML = `
      <a href="#contenido" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] bg-white text-cedine-blue font-semibold px-4 py-2 rounded-xl shadow">Saltar al contenido</a>
      <header id="navbar" class="cedine-header fixed top-0 left-0 w-full z-50">
        <!-- Barra superior -->
        <div class="topbar hidden lg:block bg-cedine-blue text-blue-50 text-[13px]">
          <div class="max-w-7xl mx-auto px-6 lg:px-10 h-10 flex items-center justify-between">
            <div class="flex items-center gap-6">
              <a href="tel:+576019087403" class="flex items-center gap-1.5 hover:text-white">${ico(I.phone, 'w-4 h-4 text-cedine-orange')} (601) 908 7403</a>
              <a href="mailto:administracion@fundacioncedine.org" class="flex items-center gap-1.5 hover:text-white">${ico(I.mail, 'w-4 h-4 text-cedine-orange')} administracion@fundacioncedine.org</a>
            </div>
            <div class="flex items-center gap-2">
              <a href="/verificacion" class="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10">${ico(I.check, 'w-4 h-4')} <span data-i18n="nav_verify_short">Mis certificados</span></a>
              <button id="lang-toggle" type="button" aria-label="Cambiar idioma entre Español e Inglés" class="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10 font-semibold">${ico(I.globe, 'w-4 h-4')}<span id="current-lang">ES</span></button>
              <a href="/admin/" rel="nofollow" class="flex items-center gap-1.5 ml-1 px-3.5 py-1 rounded-full bg-white/10 hover:bg-white hover:text-cedine-blue font-semibold transition-colors">${ico(I.user, 'w-4 h-4')} <span data-i18n="nav_login">Ingresar</span></a>
            </div>
          </div>
        </div>
        <!-- Barra principal -->
        <div class="mainbar bg-white border-b border-slate-200/80">
          <div class="max-w-7xl mx-auto px-5 lg:px-10 flex items-center justify-between gap-4 mainbar-inner">
            <a href="/" class="shrink-0" aria-label="Inicio Fundación CEDINE">
              <img src="/assets/img/imagotipo-horizontal-cedine.svg" alt="Fundación CEDINE" class="logo-cedine h-12 sm:h-14 w-auto object-contain" />
            </a>
            <nav aria-label="Navegación principal" class="hidden xl:flex items-center gap-0.5 xl:gap-1 text-[15px]">
              ${desktopLinks}
              ${dropdownDesktop}
            </nav>
            <div class="hidden xl:flex items-center gap-2">
              <a href="/donar" class="btn-apoyar ${currentPage === 'donar' ? 'ring-4 ring-[#B85400]/25' : ''}">${ico(I.heart, 'w-5 h-5')}<span data-i18n="nav_donate">Apoyar Ahora</span></a>
            </div>
            <div class="flex items-center gap-2 xl:hidden">
              <a href="/donar" class="btn-apoyar !px-4 !py-2 text-sm" data-i18n="nav_donate">Apoyar Ahora</a>
              <button id="menu-movil-btn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu-movil" class="grid place-items-center w-11 h-11 rounded-2xl text-cedine-blue bg-[#1C4B7C]/10 hover:bg-[#1C4B7C]/15">${ico(I.menu, 'w-6 h-6')}</button>
            </div>
          </div>
        </div>
      </header>

      <!-- Menú móvil (panel lateral) -->
      <div id="menu-movil" class="menu-movil xl:hidden fixed inset-0 z-[60]" aria-hidden="true">
        <div class="menu-movil-fondo absolute inset-0 bg-slate-900/50 backdrop-blur-sm" data-cerrar-menu></div>
        <aside class="menu-movil-panel absolute right-0 top-0 h-full w-[88%] max-w-sm bg-white shadow-2xl flex flex-col" role="dialog" aria-modal="true" aria-label="Menú">
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <img src="/assets/img/imagotipo-horizontal-cedine.svg" alt="Fundación CEDINE" class="h-10 w-auto" />
            <button type="button" id="menu-movil-cerrar" aria-label="Cerrar menú" class="grid place-items-center w-10 h-10 rounded-xl text-cedine-blue hover:bg-slate-100" data-cerrar-menu>${ico(I.close, 'w-6 h-6')}</button>
          </div>
          <nav aria-label="Navegación móvil" class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1">${mobileLinks}</nav>
          <div class="p-4 border-t border-slate-100 space-y-3 bg-cedine-cream">
            <a href="/donar" class="btn-apoyar w-full justify-center py-3">${ico(I.heart, 'w-5 h-5')}<span data-i18n="nav_donate">Apoyar Ahora</span></a>
            <div class="grid grid-cols-2 gap-2">
              <button id="lang-toggle-mobile" type="button" aria-label="Cambiar idioma" class="rounded-2xl border-2 border-cedine-blue/20 py-2.5 font-display font-bold text-cedine-blue text-sm">ES</button>
              <a href="/admin/" rel="nofollow" class="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-cedine-blue/20 py-2.5 font-display font-semibold text-cedine-blue text-sm">${ico(I.user, 'w-4 h-4')}<span data-i18n="nav_login">Ingresar</span></a>
            </div>
            <p class="text-center text-xs text-slate-500"><a href="tel:+576019087403" class="underline">(601) 908 7403</a> · <a href="https://wa.me/573125182773" class="underline" target="_blank" rel="noopener">WhatsApp</a></p>
          </div>
        </aside>
      </div>
    `;

    // ---------- Comportamiento ----------
    const header = document.getElementById('navbar');
    const alDesplazar = () => header.classList.toggle('is-scrolled', window.scrollY > 30);
    window.addEventListener('scroll', alDesplazar, { passive: true });
    alDesplazar();

    // Desplegable "Más sobre CEDINE" (clic, teclado y hover)
    const mas = document.getElementById('nav-mas');
    const masBtn = document.getElementById('nav-mas-btn');
    if (mas && masBtn) {
      const abrir = (v) => { mas.classList.toggle('is-open', v); masBtn.setAttribute('aria-expanded', String(v)); };
      masBtn.addEventListener('click', (e) => { e.stopPropagation(); abrir(!mas.classList.contains('is-open')); });
      mas.addEventListener('mouseenter', () => abrir(true));
      mas.addEventListener('mouseleave', () => abrir(false));
      document.addEventListener('click', (e) => { if (!mas.contains(e.target)) abrir(false); });
      mas.addEventListener('keydown', (e) => { if (e.key === 'Escape') { abrir(false); masBtn.focus(); } });
      mas.addEventListener('focusout', (e) => { if (!mas.contains(e.relatedTarget)) abrir(false); });
    }

    // Menú móvil
    const menu = document.getElementById('menu-movil');
    const menuBtn = document.getElementById('menu-movil-btn');
    const menuCerrar = document.getElementById('menu-movil-cerrar');
    const abrirMenu = (v) => {
      menu.classList.toggle('is-open', v);
      menu.setAttribute('aria-hidden', String(!v));
      menuBtn.setAttribute('aria-expanded', String(v));
      document.documentElement.classList.toggle('overflow-hidden', v);
      if (v) setTimeout(() => menuCerrar.focus(), 50); else menuBtn.focus();
    };
    if (menu && menuBtn) {
      menuBtn.addEventListener('click', () => abrirMenu(true));
      menu.querySelectorAll('[data-cerrar-menu]').forEach(el => el.addEventListener('click', () => abrirMenu(false)));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) abrirMenu(false); });
      window.addEventListener('resize', () => { if (window.innerWidth >= 1280 && menu.classList.contains('is-open')) abrirMenu(false); });
    }

    // Ancla para "Saltar al contenido": primera sección después del encabezado
    if (!document.getElementById('contenido')) {
      const primera = headerContainer.nextElementSibling;
      if (primera) { primera.id = primera.id || 'contenido'; if (primera.id !== 'contenido') primera.insertAdjacentHTML('beforebegin', '<span id="contenido"></span>'); }
    }
  }

  const footerContainer = document.getElementById('global-footer');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <footer class="bg-cedine-blue text-white pt-14 pb-8 px-6 border-t border-white/10">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-white/15">
          <div class="space-y-1.5">
            <img src="/assets/img/imagotipo-horizontal-blanco-cedine.svg" alt="Fundación CEDINE" class="h-12 w-auto mb-3" />
            <p class="text-white font-semibold text-xs">FUNDACIÓN CENTRO DE DIAGNÓSTICO DE NECESIDADES EDUCATIVAS</p>
            <p class="text-blue-100 text-xs">NIT 900.773.102-4 • Cámara de Comercio de Bogotá (Matrícula S00047132)</p>
            <p class="text-blue-100 text-xs">Calle 11 A No. 35 23 • Bogotá D.C., Colombia</p>
            <p class="text-blue-100 text-xs">Tel: +57 (601) 908 7403 / 317 263 7946 / +57 312 518 2773</p>
            <p class="text-blue-100 text-xs">Correo: <a href="mailto:administracion@fundacioncedine.org" class="text-white underline underline-offset-2 hover:text-cedine-orange">administracion@fundacioncedine.org</a> / <a href="mailto:fundacedine@gmail.com" class="text-white underline underline-offset-2 hover:text-cedine-orange">fundacedine@gmail.com</a></p>
          </div>

          <nav aria-label="Enlaces del pie de página" class="flex flex-wrap gap-6 text-sm text-blue-100">
            <a href="/" class="hover:text-cedine-orange transition" data-i18n="nav_home">Inicio</a>
            <a href="/nosotros" class="hover:text-cedine-orange transition" data-i18n="nav_about">Nuestra Labor</a>
            <a href="/programas" class="hover:text-cedine-orange transition" data-i18n="nav_programs">Terapias e Inclusión</a>
            <a href="/galeria" class="hover:text-cedine-orange transition" data-i18n="nav_gallery">Jornadas</a>
            <a href="/formacion" class="hover:text-cedine-orange transition" data-i18n="nav_sub_formacion">Formación para el Trabajo</a>
            <a href="/verificacion" class="hover:text-cedine-orange transition" data-i18n="nav_sub_verif">Verificación de Certificados</a>
            <a href="/contacto" class="hover:text-cedine-orange transition" data-i18n="nav_contact">Contáctenos</a>
            <a href="/donar" class="hover:text-cedine-orange transition" data-i18n="nav_donate">Apoyar Ahora</a>
            <a href="/admin/" rel="nofollow" class="hover:text-cedine-orange transition" data-i18n="nav_staff">Acceso personal</a>
          </nav>
        </div>

        <!-- Bloque Legal Obligatorio (Ley 1581 de 2012) -->
        <div class="max-w-7xl mx-auto py-5 border-b border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-blue-100">
          <div class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <a href="/politica-de-datos" class="hover:text-cedine-orange underline underline-offset-4 transition">Política de Tratamiento de Datos</a>
            <span aria-hidden="true">·</span>
            <a href="/politica-de-cookies" class="hover:text-cedine-orange underline underline-offset-4 transition">Política de Cookies</a>
            <span aria-hidden="true">·</span>
            <a href="/terminos" class="hover:text-cedine-orange underline underline-offset-4 transition">Términos y Condiciones</a>
            <span aria-hidden="true">·</span>
            <button type="button" data-cookie-settings class="hover:text-cedine-orange underline underline-offset-4 transition">Configurar cookies</button>
          </div>
          <p class="text-blue-100 text-center sm:text-right">
            FUNDACIÓN CENTRO DE DIAGNÓSTICO DE NECESIDADES EDUCATIVAS · NIT 900.773.102-4 · © 2026
          </p>
        </div>

        <div class="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-100 gap-3">
          <p class="font-playful text-base text-cedine-orange-light">“Cuestión de actitud”</p>
          <p>
            <span data-i18n="footer_dev_by">Desarrollado por</span>
            <a href="https://github.com/Julian-Andres-Guerrero" target="_blank" rel="noopener noreferrer" class="text-white font-semibold hover:text-cedine-orange underline decoration-cedine-orange/50 transition">
              Julian Andres Guerrero Vasquez
            </a>
          </p>
        </div>
      </footer>
    `;
  }
})();

// Consentimiento de cookies (Ley 1581 + Google Consent Mode v2) en todas las páginas
(function cargarConsentimientoCookies() {
  if (window.CedineCookies || document.getElementById('cedine-cookies-js')) return;
  var s = document.createElement('script');
  s.id = 'cedine-cookies-js';
  s.src = '/assets/js/cookies.js?v=1';
  document.head.appendChild(s);
})();
