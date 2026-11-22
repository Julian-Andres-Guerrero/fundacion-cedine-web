/*!
 * Fundación CEDINE · Galería pública dinámica
 * Lee fotos y videos publicados desde el panel (tabla "medios" en Supabase)
 * y arma los carruseles. Los videos se cargan desde youtube-nocookie.com solo
 * cuando el visitante hace clic (sin cookies de seguimiento antes).
 */
(function () {
  'use strict';
  var URL = 'https://sjfoivxzmaxaevsvjqcv.supabase.co';
  var KEY = 'sb_publishable_ateiww11CKWirRw0Vamh8g_wOf1vvAB';

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function urlFoto(p) { return URL + '/storage/v1/object/public/galeria/' + p.split('/').map(encodeURIComponent).join('/'); }

  async function medios() {
    try {
      var r = await fetch(URL + '/rest/v1/medios?select=id,tipo,titulo,descripcion,album,storage_path,youtube_id,formato&publicado=eq.true&order=orden.asc,creado_en.desc&limit=200',
        { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      return r.ok ? await r.json() : [];
    } catch (e) { return []; }
  }

  function slideFoto(m) {
    var src = urlFoto(m.storage_path);
    return '<div class="swiper-slide"><div role="button" tabindex="0" data-lightbox="' + esc(src) + '" aria-label="Ampliar foto: ' + esc(m.titulo) + '" ' +
      'class="group relative rounded-3xl overflow-hidden shadow-lg bg-slate-100 aspect-[4/3] cursor-pointer">' +
      '<img src="' + esc(src) + '" alt="' + esc(m.titulo) + '" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />' +
      '<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cedine-blue/85 to-transparent p-4"><span class="text-white font-display font-semibold text-sm">' + esc(m.album || m.titulo) + '</span></div></div></div>';
  }

  function slideVideo(m) {
    var vertical = m.formato === 'vertical';
    return '<div class="swiper-slide"><div class="bg-white rounded-3xl p-2.5 shadow-md border border-slate-100">' +
      '<button type="button" class="yt-fachada relative block w-full rounded-2xl overflow-hidden bg-cedine-blue ' + (vertical ? 'aspect-[9/16]' : 'aspect-video') + '" data-yt="' + esc(m.youtube_id) + '" aria-label="Reproducir video: ' + esc(m.titulo) + '">' +
      '<img src="https://i.ytimg.com/vi/' + esc(m.youtube_id) + '/hqdefault.jpg" alt="" loading="lazy" class="w-full h-full object-cover opacity-90">' +
      '<span class="absolute inset-0 grid place-items-center"><span class="w-16 h-16 rounded-full bg-[#B85400] text-white grid place-items-center shadow-xl">' +
      '<svg aria-hidden="true" class="w-7 h-7 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span></span></button>' +
      '<p class="font-display font-semibold text-cedine-blue text-sm px-2 pt-3 pb-1">' + esc(m.titulo) + '</p>' +
      (m.descripcion ? '<p class="text-xs text-slate-600 px-2 pb-2">' + esc(m.descripcion) + '</p>' : '') + '</div></div>';
  }

  function activarVideos(raiz) {
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('.yt-fachada'); if (!b) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.dataset.yt) + '?autoplay=1&rel=0&modestbranding=1';
      f.title = b.getAttribute('aria-label').replace('Reproducir video: ', '');
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      f.allowFullscreen = true; f.loading = 'lazy';
      f.className = 'w-full h-full'; f.style.border = '0';
      var caja = document.createElement('div');
      caja.className = b.className.replace('yt-fachada', '').trim();
      caja.appendChild(f);
      b.replaceWith(caja);
      if (window.gtag) window.gtag('event', 'video_start', { video_id: b.dataset.yt });
    });
  }

  function iniciarSwipers() {
    if (!window.Swiper) return;
    new window.Swiper('.photo-swiper', {
      effect: 'coverflow', grabCursor: true, centeredSlides: true, loop: document.querySelectorAll('.photo-swiper .swiper-slide').length > 3,
      slidesPerView: 1.18, spaceBetween: 16, autoplay: { delay: 4200, disableOnInteraction: true },
      coverflowEffect: { rotate: 8, stretch: 0, depth: 120, modifier: 1, slideShadows: false },
      breakpoints: { 640: { slidesPerView: 1.6, spaceBetween: 24 }, 1024: { slidesPerView: 2.3, spaceBetween: 30 } },
      pagination: { el: '.photo-swiper .swiper-pagination', clickable: true },
      navigation: { nextEl: '.photo-next', prevEl: '.photo-prev' }
    });
    if (document.querySelector('.video-swiper .swiper-slide')) {
      new window.Swiper('.video-swiper', {
        grabCursor: true, slidesPerView: 1.35, spaceBetween: 16,
        breakpoints: { 640: { slidesPerView: 2.5, spaceBetween: 20 }, 1024: { slidesPerView: 4, spaceBetween: 24 } },
        pagination: { el: '.video-swiper .swiper-pagination', clickable: true },
        navigation: { nextEl: '.vid-next', prevEl: '.vid-prev' }
      });
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-lightbox]'); if (t && window.openLightbox) window.openLightbox(t.dataset.lightbox);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-lightbox]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); window.openLightbox(t.dataset.lightbox); }
    if (e.key === 'Escape' && window.closeLightbox) window.closeLightbox();
  });

  (async function () {
    var lista = await medios();
    var fotos = lista.filter(function (m) { return m.tipo === 'foto'; });
    var videos = lista.filter(function (m) { return m.tipo === 'video'; });
    var wf = document.querySelector('.photo-swiper .swiper-wrapper');
    if (wf && fotos.length) wf.insertAdjacentHTML('afterbegin', fotos.map(slideFoto).join(''));
    var wv = document.querySelector('.video-swiper .swiper-wrapper');
    var secVideos = document.getElementById('seccion-videos');
    if (wv) {
      wv.innerHTML = videos.map(slideVideo).join('');
      if (!videos.length && secVideos) secVideos.hidden = true;
      activarVideos(wv);
    }
    iniciarSwipers();
  })();
})();
