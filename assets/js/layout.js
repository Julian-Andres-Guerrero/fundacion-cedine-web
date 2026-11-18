(function renderGlobalLayout() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const navItems = [
    { href: 'index.html', key: 'nav_home', label: 'Inicio' },
    { href: 'nosotros.html', key: 'nav_about', label: 'Nuestra Labor' },
    { href: 'programas.html', key: 'nav_programs', label: 'Terapias e Inclusión' },
    { href: 'galeria.html', key: 'nav_gallery', label: 'Jornadas' }
  ];

  // Generar enlaces Desktop con estado activo automático
  const desktopLinks = navItems.map(item => {
    const isActive = currentPage === item.href || (currentPage === '' && item.href === 'index.html');
    const classes = isActive
      ? 'text-cedine-orange font-semibold'
      : 'hover:text-cedine-orange transition-colors';
    return `<a href="${item.href}" class="${classes}" data-i18n="${item.key}">${item.label}</a>`;
  }).join('');

  // Generar enlaces Móvil con estado activo automático
  const mobileLinks = navItems.map(item => {
    const isActive = currentPage === item.href || (currentPage === '' && item.href === 'index.html');
    const classes = isActive
      ? 'font-display font-semibold text-cedine-orange py-2 border-b border-slate-100'
      : 'font-display font-medium text-cedine-blue py-2 border-b border-slate-100';
    return `<a href="${item.href}" class="${classes}" data-i18n="${item.key}">${item.label}</a>`;
  }).join('');

  const isDonateActive = currentPage === 'donar.html';
  const donateBtnClass = isDonateActive
    ? 'bg-cedine-orange text-white font-display font-semibold text-base px-6 py-2.5 rounded-full shadow-md ring-2 ring-cedine-orange/40'
    : 'bg-cedine-orange hover:brightness-105 text-white font-display font-semibold text-base px-6 py-2.5 rounded-full shadow-md shadow-cedine-orange/30 transition-all transform hover:-translate-y-0.5';

  // Inyectar Header Único
  const headerContainer = document.getElementById('global-header');
  if (headerContainer) {
    headerContainer.innerHTML = `
      <header id="navbar" class="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div class="max-w-7xl mx-auto px-6 lg:px-10 py-3 flex items-center justify-between">
          <a href="index.html" class="py-1 focus:outline-none" aria-label="Inicio Fundación CEDINE">
            <img src="assets/img/imagotipo-horizontal-cedine.svg" alt="Fundación CEDINE" class="h-12 sm:h-14 w-auto object-contain" />
          </a>

          <!-- Menú Desktop -->
          <nav class="hidden lg:flex items-center gap-8 text-[15px] font-medium text-cedine-blue">
            ${desktopLinks}
          </nav>

          <!-- Acciones -->
          <div class="hidden lg:flex items-center gap-4">
            <button id="lang-toggle" class="px-3.5 py-2 rounded-xl border-2 border-cedine-blue/20 text-xs font-display font-bold text-cedine-blue hover:border-cedine-blue transition flex items-center gap-1.5">
              <span id="current-lang">ES</span>
              <svg class="w-4 h-4 text-cedine-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
            </button>

            <a href="donar.html" class="${donateBtnClass}" data-i18n="nav_donate">
              Apoyar Ahora
            </a>
          </div>

          <!-- Controles Móviles -->
          <div class="flex items-center gap-3 lg:hidden">
            <button id="lang-toggle-mobile" class="px-3 py-1.5 rounded-lg border border-cedine-blue/30 text-xs font-display font-bold text-cedine-blue">ES</button>
            <button id="mobile-menu-btn" class="p-2 rounded-xl text-cedine-blue hover:bg-slate-100" aria-label="Abrir menú">
              <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>

        <!-- Menú Desplegable Móvil -->
        <div id="mobile-menu" class="hidden lg:hidden bg-white border-t border-slate-100 px-6 py-5 flex-col gap-3 shadow-xl">
          ${mobileLinks}
          <a href="donar.html" class="mt-2 text-center bg-cedine-orange text-white font-display font-semibold py-3 rounded-full shadow-md" data-i18n="nav_donate">Apoyar Ahora</a>
        </div>
      </header>
    `;
  }

  // Inyectar Footer Único
  const footerContainer = document.getElementById('global-footer');
  if (footerContainer) {
    footerContainer.innerHTML = `
      <footer class="bg-cedine-blue text-white pt-14 pb-8 px-6 border-t border-white/10">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-white/15">
          <div>
            <img src="assets/img/imagotipo-horizontal-blanco-cedine.svg" alt="Fundación CEDINE" class="h-12 w-auto mb-3" />
            <p class="text-blue-200 text-xs">NIT 900.773.102-4 • Cámara de Comercio de Bogotá (Matrícula 90047132)</p>
          </div>

          <div class="flex flex-wrap gap-6 text-sm text-blue-100">
            <a href="index.html" class="hover:text-cedine-orange transition" data-i18n="nav_home">Inicio</a>
            <a href="nosotros.html" class="hover:text-cedine-orange transition" data-i18n="nav_about">Nuestra Labor</a>
            <a href="programas.html" class="hover:text-cedine-orange transition" data-i18n="nav_programs">Terapias e Inclusión</a>
            <a href="galeria.html" class="hover:text-cedine-orange transition" data-i18n="nav_gallery">Jornadas</a>
            <a href="donar.html" class="hover:text-cedine-orange transition" data-i18n="nav_donate">Apoyar Ahora</a>
          </div>
        </div>

        <div class="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-blue-200 gap-3">
          <p>© 2026 Fundación CEDINE • Bogotá, Colombia.</p>
          <p class="font-playful text-base text-cedine-orange">“Cuestión de actitud”</p>
        </div>
      </footer>
    `;
  }
})();