/*!
 * Fundación CEDINE · Historias publicadas desde el panel (Casos de Éxito)
 * Mismo diseño que el caso de Julián. Solo se muestran historias con AUT-001 confirmada.
 */
(function () {
  'use strict';
  var URL = 'https://sjfoivxzmaxaevsvjqcv.supabase.co';
  var KEY = 'sb_publishable_ateiww11CKWirRw0Vamh8g_wOf1vvAB';
  var cont = document.getElementById('historias-dinamicas');
  if (!cont) return;

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function urlFoto(p) { return URL + '/storage/v1/object/public/galeria/' + p.split('/').map(encodeURIComponent).join('/'); }
  // Párrafos separados por línea en blanco; **texto** en negrita
  function parrafos(t) {
    return String(t || '').split(/\n\s*\n/).filter(function (p) { return p.trim(); }).map(function (p) {
      return '<p class="text-slate-700 text-base leading-relaxed">' + esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  function tarjeta(h, n) {
    var fotos = Array.isArray(h.fotos) ? h.fotos.filter(function (f) { return f && f.path; }) : [];
    var id = 'historia-' + n;
    return '<section id="' + id + '" class="py-16 px-6 ' + (n % 2 ? 'bg-white' : 'bg-cedine-cream/60') + '"><div class="max-w-7xl mx-auto">' +
      '<div class="bg-cedine-cream rounded-3xl p-8 sm:p-12 border border-slate-200/80 shadow-sm ' + (fotos.length ? 'mb-12 ' : '') + 'grid lg:grid-cols-12 gap-10 items-center" data-aos="fade-up">' +
      '<div class="lg:col-span-8 space-y-5">' +
      (h.etiqueta ? '<div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cedine-orange/15 text-cedine-orange-dark font-display font-bold text-xs uppercase tracking-wider"><span class="w-2 h-2 rounded-full bg-cedine-orange-dark"></span>' + esc(h.etiqueta) + '</div>' : '') +
      '<h2 class="font-display font-bold text-3xl sm:text-4xl text-cedine-blue leading-tight">' + esc(h.titulo) + '</h2>' +
      '<p class="text-lg text-slate-700 font-medium leading-relaxed">' + esc(h.resumen) + '</p>' + parrafos(h.contenido) +
      '<p class="text-xs text-slate-500 pt-1">* Historia y registro fotográfico publicados con autorización expresa e informada del representante legal conforme a la Ley 1581 de 2012 y el formato institucional AUT-001.</p></div>' +
      '<div class="lg:col-span-4 bg-cedine-blue text-white rounded-3xl p-8 shadow-lg space-y-5">' +
      '<span class="inline-block px-3 py-1 rounded-full bg-white/15 text-cedine-orange font-display font-semibold text-xs uppercase tracking-wider">“Cuestión de actitud”</span>' +
      '<h3 class="font-display font-bold text-2xl leading-snug">' + esc(h.frase || 'Cada niño avanza a su ritmo. Nosotros caminamos con él.') + '</h3>' +
      '<p class="text-sm text-blue-100 leading-relaxed">Con tu apoyo más niños como ' + esc(h.nombre) + ' continúan su proceso pedagógico y terapéutico en Bogotá.</p>' +
      '<a href="/donar" class="w-full inline-flex items-center justify-center bg-cedine-orange-dark hover:bg-[#9E4700] text-white font-display font-semibold text-sm px-6 py-3.5 rounded-full shadow transition">Apoyar procesos como el de ' + esc(h.nombre) + ' →</a></div></div>' +
      (fotos.length ? '<h3 class="font-display font-bold text-2xl text-cedine-blue mb-6">Evidencia del proceso de ' + esc(h.nombre) + ' (' + fotos.length + ' registro' + (fotos.length > 1 ? 's' : '') + ')</h3>' +
        '<div class="swiper historia-swiper ' + id + '-swiper pb-12"><div class="swiper-wrapper">' + fotos.map(function (f, i) {
          var src = urlFoto(f.path);
          return '<div class="swiper-slide"><div role="button" tabindex="0" data-lightbox="' + esc(src) + '" aria-label="Ampliar fotografía ' + (i + 1) + ' del caso de ' + esc(h.nombre) + '" class="group relative rounded-3xl overflow-hidden shadow-md bg-slate-100 aspect-[4/3] cursor-pointer border border-slate-200/80">' +
            '<img src="' + esc(src) + '" alt="' + esc(f.pie || ('Proceso de ' + h.nombre + ' en la Fundación CEDINE')) + '" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />' +
            (f.pie ? '<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cedine-blue/85 to-transparent p-4"><span class="text-white font-display font-semibold text-sm">' + esc(f.pie) + '</span></div>' : '') + '</div></div>';
        }).join('') + '</div><div class="swiper-pagination ' + id + '-pag"></div></div>' : '') +
      '</div></section>';
  }

  (async function () {
    var lista = [];
    try {
      var r = await fetch(URL + '/rest/v1/historias?select=nombre,titulo,etiqueta,resumen,contenido,frase,fotos&publicado=eq.true&order=orden.asc,creado_en.desc',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      if (r.ok) lista = await r.json();
    } catch (e) { /* sin conexión: solo se ve el caso de Julián */ }
    if (!lista.length) return;
    cont.innerHTML = lista.map(tarjeta).join('');
    if (window.Swiper) {
      lista.forEach(function (h, n) {
        if (!document.querySelector('.historia-' + n + '-swiper')) return;
        new window.Swiper('.historia-' + n + '-swiper', {
          slidesPerView: 1.15, spaceBetween: 20, centeredSlides: true, keyboard: { enabled: true, onlyInViewport: true },
          pagination: { el: '.historia-' + n + '-pag', clickable: true },
          breakpoints: { 640: { slidesPerView: 2, centeredSlides: false }, 1024: { slidesPerView: 3, centeredSlides: false } }
        });
      });
    }
    if (window.AOS) window.AOS.refreshHard();
  })();

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lightbox]'); if (t && window.openLightbox) window.openLightbox(t.dataset.lightbox);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-lightbox]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); window.openLightbox(t.dataset.lightbox); }
  });
})();
