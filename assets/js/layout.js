(function renderGlobalLayout() {
  const rawPath = window.location.pathname.replace(/\/$/, '').split('/').pop() || '';
  const currentPage = rawPath.replace('.html', '');

  const navItems = [
    { href: '/', slug: '', key: 'nav_home', label: 'Inicio' },
    { href: '/nosotros', slug: 'nosotros', key: 'nav_about', label: 'Nuestra Labor' },
    { href: '/programas', slug: 'programas', key: 'nav_programs', label: 'Terapias e Inclusión' },
    { href: '/casos-de-exito', slug: 'casos-de-exito', key: 'nav_cases', label: 'Casos de Éxito' },
    { href: '/galeria', slug: 'galeria', key: 'nav_gallery', label: 'Jornadas' }
  ];

  const subMenuItems = [
    { href: '/formacion', slug: 'formacion', key: 'nav_sub_formacion', label: 'Formación para el Trabajo' },
    { href: '/verificacion', slug: 'verificacion', key: 'nav_sub_verif', label: 'Verificación de Certificados' }
  ];

  const desktopLinks = navItems.map(item => {
    const isActive = currentPage === item.slug;
    const classes = isActive
      ? 'text-[#B85400] font-bold underline decoration-2 underline-offset-8'
      : 'text-cedine-blue hover:text-[#B85400] transition-colors';
    return `<a href="${item.href}" class="${classes}" data-i18n="${item.key}">${item.label}</a>`;
  }).join('');

  const isSubActive = currentPage === 'formacion' || currentPage === 'verificacion';
  const dropdownDesktop = `
    <div class="relative group">
      <button type="button" aria-haspopup="true" aria-expanded="false" class="flex items-center gap-1 ${isSubActive ? 'text-[#B85400] font-bold' : 'text-cedine-blue hover:text-[#B85400]'} transition-colors py-2">
        <span data-i18n="nav_more">Más sobre CEDINE</span>
        <svg aria-hidden="true" class="w-4 h-4 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </button>
      <div class="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-all duration-200 absolute left-0 top-full pt-2 w-64 z-50">
        <div class="bg-white rounded-2xl shadow-xl border border-slate-200 py-2 overflow-hidden">
          ${subMenuItems.map(sub => `
            <a href="${sub.href}" class="block px-4 py-2.5 text-sm text-cedine-blue hover:bg-cedine-cream hover:text-[#B85400] transition-colors font-semibold" data-i18n="${sub.key}">
              ${sub.label}
            </a>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const mobileLinks = navItems.map(item => {
    const isActive = currentPage === item.slug;
    const classes = isActive
      ? 'font-display font-bold text-[#B85400] py-2 border-b border-slate-100'
      : 'font-display font-medium text-cedine-blue py-2 border-b border-slate-100';
    return `<a href="${item.href}" class="${classes}" data-i18n="${item.key}">${item.label}</a>`;
  }).join('');

  const mobileSubLinks = `
    <div class="py-2 border-b border-slate-100">
      <span class="block font-display font-bold text-xs uppercase tracking-wider text-[#B85400] mb-2" data-i18n="nav_more">Más sobre CEDINE</span>
      <div class="pl-3 flex flex-col gap-2 border-l-2 border-[#B85400]/40">
        ${subMenuItems.map(sub => `
          <a href="${sub.href}" class="text-sm font-semibold text-cedine-blue hover:text-[#B85400] py-1" data-i18n="${sub.key}">
            ${sub.label}
          </a>
        `).join('')}
      </div>
    </div>
  `;

  const isDonateActive = currentPage === 'donar';
  const donateBtnClass = isDonateActive
    ? 'bg-[#B85400] text-white font-display font-semibold text-base px-6 py-2.5 rounded-full shadow-md ring-2 ring-[#B85400]/40'
    : 'bg-[#B85400] hover:bg-[#9E4700] text-white font-display font-semibold text-base px-6 py-2.5 rounded-full shadow-md transition-all transform hover:-translate-y-0.5';

  const headerContainer = document.getElementById('global-header');
  if (headerContainer) {
    headerContainer.innerHTML = `
      <header id="navbar" class="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-6 lg:px-10 py-3 flex items-center justify-between">
          <a href="/" class="py-1" aria-label="Inicio Fundación CEDINE">
            <img src="assets/img/imagotipo-horizontal-cedine.svg" alt="Fundación CEDINE" class="h-12 sm:h-14 w-auto object-contain" />
          </a>

          <nav aria-label="Navegación principal" class="hidden lg:flex items-center gap-6 text-[15px] font-medium text-cedine-blue">
            ${desktopLinks}
            ${dropdownDesktop}
          </nav>

          <div class="hidden lg:flex items-center gap-4">
            <button id="lang-toggle" type="button" aria-label="Cambiar idioma entre Español e Inglés" class="px-3.5 py-2 rounded-xl border-2 border-cedine-blue/30 text-xs font-display font-bold text-cedine-blue hover:border-cedine-blue transition flex items-center gap-1.5">
              <span id="current-lang">ES</span>
              <svg aria-hidden="true" class="w-4 h-4 text-[#B85400]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
            </button>

            <a href="/donar" class="${donateBtnClass}" data-i18n="nav_donate">
              Donar Ahora
            </a>
          </div>

          <div class="flex items-center gap-3 lg:hidden">
            <button id="lang-toggle-mobile" type="button" aria-label="Cambiar idioma" class="px-3 py-1.5 rounded-lg border border-cedine-blue/30 text-xs font-display font-bold text-cedine-blue">ES</button>
            <button id="mobile-menu-btn" type="button" aria-label="Abrir menú de navegación" aria-expanded="false" class="p-2 rounded-xl text-cedine-blue hover:bg-slate-100">
              <svg aria-hidden="true" class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>

        <div id="mobile-menu" class="hidden lg:hidden bg-white border-t border-slate-100 px-6 py-5 flex-col gap-3 shadow-xl max-h-[85vh] overflow-y-auto">
          ${mobileLinks}
          ${mobileSubLinks}
          <a href="/donar" class="mt-2 text-center bg-[#B85400] text-white font-display font-semibold py-3 rounded-full shadow-md" data-i18n="nav_donate">Donar Ahora</a>
        </div>
      </header>
    `;
  }

  const footerContainer = document.getElementById('global-footer');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <footer class="bg-cedine-blue text-white pt-14 pb-8 px-6 border-t border-white/10">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-white/15">
          <div class="space-y-1.5">
            <img src="assets/img/imagotipo-horizontal-blanco-cedine.svg" alt="Fundación CEDINE" class="h-12 w-auto mb-3" />
            <p class="text-white font-semibold text-xs">FUNDACIÓN CENTRO DE DIAGNÓSTICO DE NECESIDADES EDUCATIVAS</p>
            <p class="text-blue-100 text-xs">NIT 900.773.102-4 • Cámara de Comercio de Bogotá (Matrícula S00047132)</p>
            <p class="text-blue-100 text-xs">Calle 11 A No. 35 23 • Bogotá D.C., Colombia</p>
            <p class="text-blue-100 text-xs">Tel: +57 (601) 908 7403 / 317 263 7946 / +57 312 518 2773 • fundacedine@gmail.com</p>
          </div>

          <nav aria-label="Enlaces del pie de página" class="flex flex-wrap gap-6 text-sm text-blue-100">
            <a href="/" class="hover:text-cedine-orange transition" data-i18n="nav_home">Inicio</a>
            <a href="/nosotros" class="hover:text-cedine-orange transition" data-i18n="nav_about">Nuestra Labor</a>
            <a href="/programas" class="hover:text-cedine-orange transition" data-i18n="nav_programs">Terapias e Inclusión</a>
            <a href="/galeria" class="hover:text-cedine-orange transition" data-i18n="nav_gallery">Jornadas</a>
            <a href="/formacion" class="hover:text-cedine-orange transition" data-i18n="nav_sub_formacion">Formación para el Trabajo</a>
            <a href="/verificacion" class="hover:text-cedine-orange transition" data-i18n="nav_sub_verif">Verificación de Certificados</a>
            <a href="/donar" class="hover:text-cedine-orange transition" data-i18n="nav_donate">Donar Ahora</a>
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
          </div>
          <p class="text-blue-100 text-center sm:text-right">
            FUNDACIÓN CENTRO DE DIAGNÓSTICO DE NECESIDADES EDUCATIVAS · NIT 900.773.102-4 · © 2026
          </p>
        </div>

        <div class="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-100 gap-3">
          <p class="font-playful text-base text-cedine-orange">“Cuestión de actitud”</p>
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