/*!
 * Fundación CEDINE · Módulos de contenido del panel
 *  - Mis certificados (rol estudiante)
 *  - Galería: fotos (con caras pixeladas) y videos de YouTube (solo administrador)
 *  - Historias de niños para Casos de Éxito (solo administrador, exige AUT-001)
 * Se cargan antes de app.js y se registran con window.CedineAdminModulos.
 */
(window.CedineAdminModulos = window.CedineAdminModulos || []).push(function (A) {
  'use strict';
  var sb = A.sb, esc = A.esc, $ = A.$, $$ = A.$$;
  var URL_PUBLICA = A.SUPABASE_URL + '/storage/v1/object/public/galeria/';

  function urlFoto(path) { return path ? URL_PUBLICA + path.split('/').map(encodeURIComponent).join('/') : ''; }
  function uuid() { return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)); }

  async function subirImagen(blob, carpeta) {
    var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    var path = carpeta + '/' + new Date().getFullYear() + '/' + uuid() + '.' + ext;
    var r = await sb.storage.from('galeria').upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (r.error) throw new Error('No se pudo subir la imagen: ' + A.errorTexto(r.error));
    return path;
  }

  // ===========================================================================
  // MIS CERTIFICADOS (estudiantes)
  // ===========================================================================
  A.VISTAS.miscertificados = async function (c) {
    var r = await sb.from('certificados').select('*').eq('estado', 'activo').order('creado_en', { ascending: false, nullsFirst: false });
    var nombre = (A.S.perfil.nombre || '').split(' ')[0];
    var lista = r.data || [];
    c.innerHTML = A.encabezado('Hola, ' + nombre, 'Aquí están los certificados de los cursos que realizaste con la Fundación CEDINE. Descárgalos en PDF cuando los necesites.') +
      (r.error ? '<p class="tarjeta p-6 text-red-700">' + esc(A.errorTexto(r.error)) + '</p>' :
        lista.length ? '<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">' + lista.map(function (x, i) {
          return '<article class="tarjeta p-6 flex flex-col">' +
            '<div class="flex items-start gap-3 mb-3"><span class="text-3xl" aria-hidden="true">🎓</span><div>' +
            '<h2 class="font-display font-bold text-lg text-cedine-blue leading-tight">' + esc(x.curso) + '</h2>' +
            '<p class="text-sm text-slate-600">' + esc(window.CedineCertificado.normalizarIntensidad(x.intensidad_horaria)) + ' · ' + esc(window.CedineCertificado.fechaLegible(x.fecha_realizacion)) + '</p></div></div>' +
            '<p class="text-xs text-slate-500 mb-4">Código: <span class="font-mono">' + esc(x.codigo_verificacion) + '</span></p>' +
            '<button class="btn btn-primario mt-auto" data-desc="' + i + '">⬇️ Descargar certificado (PDF)</button></article>';
        }).join('') + '</div>' :
        '<div class="tarjeta p-8 text-center"><p class="text-4xl mb-3" aria-hidden="true">📭</p><p class="font-semibold text-cedine-blue mb-1">Aún no encontramos certificados asociados a tu documento.</p>' +
        '<p class="text-sm text-slate-600">Si ya terminaste un curso, escríbenos en <a class="underline" href="/contacto?tipo=cursos">Contáctenos</a> y lo revisamos.</p></div>') +
      '<p class="text-xs text-slate-500 mt-6">Tus datos se tratan conforme a la <a class="underline" href="/politica-de-datos" target="_blank" rel="noopener">Política de Tratamiento de Datos Personales</a>.</p>';
    $$('[data-desc]', c).forEach(function (b) {
      b.addEventListener('click', async function () {
        A.ocupado(b, true, 'Generando PDF...');
        try { await window.CedineCertificado.descargar(lista[b.dataset.desc]); } catch (e) { A.toast(A.errorTexto(e), 'error'); }
        A.ocupado(b, false);
      });
    });
  };

  // ===========================================================================
  // GALERÍA Y VIDEOS
  // ===========================================================================
  var pestanaGal = 'foto';

  function idYouTube(url) {
    var s = String(url || '').trim();
    var m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return { id: m[1], vertical: /\/shorts\//.test(s) };
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { id: s, vertical: false };
    return null;
  }

  A.VISTAS.galeria = async function (c) {
    c.innerHTML = A.encabezado('Galería y videos', 'Lo que publiques aquí aparece en <a class="underline" href="/galeria" target="_blank" rel="noopener">/galeria</a>. Las fotos se pixelan en tu computador antes de subirse.',
      '<label class="btn btn-primario cursor-pointer">📷 Cargue masivo de fotos<input type="file" id="g-fotos" accept="image/jpeg,image/png,image/webp,image/heic" multiple class="sr-only"></label>' +
      '<label class="btn btn-secundario cursor-pointer">📁 Subir una carpeta<input type="file" id="g-carpeta" webkitdirectory multiple class="sr-only"></label>' +
      '<button class="btn btn-secundario" id="g-video">▶️ Agregar video de YouTube</button>') +
      '<div class="tarjeta p-4 mb-4 text-sm bg-amber-50 border-amber-200">🛡️ <strong>Antes de publicar:</strong> toda persona reconocible debe tener la autorización <strong>AUT-001</strong> firmada. ' +
      'Si no la tiene —en especial niños y niñas— su cara debe quedar pixelada. El editor detecta las caras automáticamente; revisa siempre el resultado.</div>' +
      '<div class="flex gap-2 mb-4" role="tablist"><button class="btn btn-chico" data-gpest="foto" role="tab">📷 Fotos</button><button class="btn btn-chico" data-gpest="video" role="tab">▶️ Videos</button></div>' +
      '<div id="g-lista" class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"></div>';
    ['#g-fotos', '#g-carpeta'].forEach(function (sel) {
      $(sel).addEventListener('change', function () { var f = Array.prototype.slice.call(this.files); this.value = ''; subirFotos(f, c); });
    });
    $('#g-video').addEventListener('click', function () { formVideo(null, c); });
    $$('[data-gpest]', c).forEach(function (b) { b.addEventListener('click', function () { pestanaGal = b.dataset.gpest; listar(c); }); });
    if (window.CedinePixelar) window.CedinePixelar.precargar();
    await listar(c);
  };

  async function listar(c) {
    $$('[data-gpest]', c).forEach(function (b) { b.className = 'btn btn-chico ' + (b.dataset.gpest === pestanaGal ? 'btn-primario' : 'btn-secundario'); b.setAttribute('aria-selected', String(b.dataset.gpest === pestanaGal)); });
    var r = await sb.from('medios').select('*').eq('tipo', pestanaGal).order('orden', { ascending: true }).order('creado_en', { ascending: false });
    var cont = $('#g-lista'); if (!cont) return;
    if (r.error) { cont.innerHTML = '<p class="text-red-700">' + esc(A.errorTexto(r.error)) + '</p>'; return; }
    var lista = r.data || [];
    cont.innerHTML = lista.length ? lista.map(function (m, i) {
      var img = m.tipo === 'foto' ? urlFoto(m.storage_path) : 'https://i.ytimg.com/vi/' + m.youtube_id + '/hqdefault.jpg';
      return '<article class="tarjeta overflow-hidden flex flex-col ' + (m.publicado ? '' : 'opacity-60') + '">' +
        '<div class="relative bg-slate-200 ' + (m.formato === 'vertical' ? 'aspect-[9/16] max-h-80' : 'aspect-video') + '"><img src="' + esc(img) + '" alt="" loading="lazy" class="w-full h-full object-cover">' +
        (m.tipo === 'video' ? '<span class="absolute inset-0 grid place-items-center text-4xl" aria-hidden="true">▶️</span>' : '') +
        (m.caras_pixeladas ? '<span class="absolute top-2 left-2 chip chip-verde">🛡️ Caras protegidas</span>' : '') + '</div>' +
        '<div class="p-3 flex-1 flex flex-col"><p class="font-semibold text-cedine-blue text-sm">' + esc(m.titulo) + '</p>' +
        (m.album ? '<p class="text-xs text-slate-500">' + esc(m.album) + '</p>' : '') +
        '<div class="flex items-center gap-2 mt-auto pt-3"><label class="flex items-center gap-1.5 text-xs"><input type="checkbox" data-pub="' + i + '" ' + (m.publicado ? 'checked' : '') + '> Publicado</label>' +
        '<input type="number" class="input !py-1 !px-2 w-16 text-xs ml-auto" data-orden="' + i + '" value="' + (m.orden || 0) + '" title="Orden (menor aparece primero)" aria-label="Orden">' +
        '<button class="btn-icono" data-ed="' + i + '" aria-label="Editar">✏️</button><button class="btn-icono" data-del="' + i + '" aria-label="Eliminar">🗑️</button></div></div></article>';
    }).join('') : '<p class="tarjeta p-8 text-center text-slate-500 sm:col-span-2 lg:col-span-3 xl:col-span-4">' +
      (pestanaGal === 'foto' ? 'Aún no hay fotos. Usa «Subir fotos».' : 'Aún no hay videos. Sube el video a YouTube y pega aquí el enlace con «Agregar video de YouTube».') + '</p>';
    $$('[data-pub]', cont).forEach(function (x) {
      x.addEventListener('change', async function () {
        var r2 = await sb.from('medios').update({ publicado: x.checked, actualizado_en: new Date().toISOString() }).eq('id', lista[x.dataset.pub].id).select('id');
        if (r2.error || !r2.data.length) { x.checked = !x.checked; return A.toast(A.errorTexto(r2.error || 'No tienes permiso.'), 'error'); }
        A.toast(x.checked ? 'Publicado en la galería.' : 'Oculto de la galería.', 'ok'); listar(c);
      });
    });
    $$('[data-orden]', cont).forEach(function (x) {
      x.addEventListener('change', async function () {
        await sb.from('medios').update({ orden: parseInt(x.value, 10) || 0 }).eq('id', lista[x.dataset.orden].id).select('id'); listar(c);
      });
    });
    $$('[data-ed]', cont).forEach(function (b) {
      b.addEventListener('click', function () { var m = lista[b.dataset.ed]; if (m.tipo === 'video') formVideo(m, c); else formFoto(m, c); });
    });
    $$('[data-del]', cont).forEach(function (b) {
      b.addEventListener('click', async function () {
        var m = lista[b.dataset.del];
        if (!(await A.confirmar('Eliminar ' + (m.tipo === 'foto' ? 'foto' : 'video'), '<p>¿Eliminar <strong>' + esc(m.titulo) + '</strong> de la galería?' + (m.tipo === 'foto' ? ' La imagen se borra del almacenamiento.' : ' El video sigue en YouTube.') + '</p>', 'Eliminar'))) return;
        if (m.storage_path) await sb.storage.from('galeria').remove([m.storage_path]);
        var r3 = await sb.from('medios').delete().eq('id', m.id).select('id');
        if (r3.error) return A.toast(A.errorTexto(r3.error), 'error');
        A.toast('Eliminado.', 'ok'); listar(c);
      });
    });
  }

  function formFoto(m, c) {
    var md = A.modal('Editar foto', '<form id="f-foto" class="grid gap-4"><img src="' + esc(urlFoto(m.storage_path)) + '" alt="" class="rounded-xl max-h-64 object-contain bg-slate-100">' +
      '<div><label class="etiqueta req" for="ff-titulo">Título o descripción corta</label><input id="ff-titulo" class="input" maxlength="140" value="' + esc(m.titulo) + '"></div>' +
      '<div><label class="etiqueta" for="ff-album">Jornada o álbum</label><input id="ff-album" class="input" maxlength="80" value="' + esc(m.album || '') + '"></div>' +
      '<div><label class="etiqueta" for="ff-aut">Autorizaciones AUT-001 de las personas visibles</label><input id="ff-aut" class="input" maxlength="300" value="' + esc(m.autorizacion || '') + '"></div>' +
      '<div class="flex justify-end gap-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-primario">Guardar</button></div></form>');
    $('#f-foto', md.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var r = await sb.from('medios').update({ titulo: $('#ff-titulo', md.el).value.trim() || m.titulo, album: $('#ff-album', md.el).value.trim() || null,
        autorizacion: $('#ff-aut', md.el).value.trim() || null, actualizado_en: new Date().toISOString() }).eq('id', m.id).select('id');
      if (r.error) return A.toast(A.errorTexto(r.error), 'error');
      md.cerrar(); A.toast('Foto actualizada.', 'ok'); listar(c);
    });
  }

  // ---------------------------------------------------------------------------
  // CARGUE MASIVO: elegir muchas fotos (o una carpeta) → pixelado automático de
  // todas → cuadrícula de revisión (ajustar / quitar) → subida en paralelo.
  // ---------------------------------------------------------------------------
  var MAX_FOTOS = 150, MAX_MB = 25;

  function esImagen(f) { return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name); }

  async function subirFotos(archivos, c) {
    var todas = archivos.filter(esImagen);
    var grandes = todas.filter(function (f) { return f.size > MAX_MB * 1048576; });
    todas = todas.filter(function (f) { return f.size <= MAX_MB * 1048576; })
      .sort(function (x, y) { return (x.webkitRelativePath || x.name).localeCompare(y.webkitRelativePath || y.name, 'es', { numeric: true }); });
    if (grandes.length) A.toast(grandes.length + ' archivo(s) de más de ' + MAX_MB + ' MB se omitieron.', 'error');
    if (!todas.length) return A.toast('No se encontraron fotos (JPG, PNG, WEBP o HEIC).', 'error');
    if (todas.length > MAX_FOTOS) { A.toast('Máximo ' + MAX_FOTOS + ' fotos por cargue. Se tomarán las primeras ' + MAX_FOTOS + '.', 'error'); todas = todas.slice(0, MAX_FOTOS); }
    if (!window.CedinePixelar) return A.toast('El editor de fotos no cargó. Recarga la página.', 'error');

    var carpeta = (todas[0].webkitRelativePath || '').split('/')[0] || '';
    var datos = await new Promise(function (resolve) {
      var md = A.modal('Cargue masivo: ' + todas.length + ' foto(s)', '<form id="f-lote" class="grid gap-4">' +
        '<div><label class="etiqueta req" for="fl-album">Jornada o álbum</label><input id="fl-album" class="input" maxlength="80" value="' + esc(carpeta) + '" placeholder="Ej.: Jornada Un Día para Soñar 2026"></div>' +
        '<div><label class="etiqueta" for="fl-titulo">Descripción (se aplica a todas; luego puedes editar cada una)</label><input id="fl-titulo" class="input" maxlength="140"></div>' +
        '<div><label class="etiqueta" for="fl-aut">Autorizaciones AUT-001 de las personas que se ven sin pixelar</label><input id="fl-aut" class="input" maxlength="300" placeholder="Ej.: AUT-001-2026-0003, AUT-001-2026-0004"></div>' +
        '<label class="flex items-start gap-2 text-sm"><input type="checkbox" id="fl-pub" class="mt-1"> Publicar de inmediato en la galería (si no, quedan como borrador)</label>' +
        '<p class="text-sm text-slate-600">El sistema pixelará las caras de todas las fotos automáticamente. Después verás una cuadrícula para revisarlas, ajustar las que necesites y quitar las que no quieras subir.</p>' +
        '<div class="flex justify-end gap-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-primario">Procesar fotos</button></div></form>',
        { alCerrar: function () { resolve(null); } });
      $('#f-lote', md.el).addEventListener('submit', function (e) {
        e.preventDefault();
        var album = $('#fl-album', md.el).value.trim();
        if (!album) return A.toast('Escribe la jornada o álbum.', 'error');
        resolve({ album: album, titulo: $('#fl-titulo', md.el).value.trim(), aut: $('#fl-aut', md.el).value.trim(), pub: $('#fl-pub', md.el).checked });
        md.el.remove();
      });
    });
    if (!datos) return;
    await revisarLote(todas, datos, c);
  }

  function revisarLote(archivos, datos, c) {
    return new Promise(function (fin) {
      var items = archivos.map(function (f, i) { return { i: i, file: f, estado: 'pendiente', res: null, url: '', quitada: false }; });
      var cancelado = false, subiendo = false;

      var fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML = '<div class="modal ancho" role="dialog" aria-modal="true" aria-labelledby="lote-titulo">' +
        '<div class="flex items-center justify-between px-6 pt-5 pb-3"><h2 id="lote-titulo" class="font-display font-bold text-xl text-cedine-blue">Revisar ' + items.length + ' foto(s) — ' + esc(datos.album) + '</h2>' +
        '<button type="button" class="btn-icono" data-l="cancelar" aria-label="Cerrar">✕</button></div><div class="px-6 pb-6">' +
        '<div class="lote-barra mb-2"><div id="l-barra" style="width:0%"></div></div>' +
        '<p class="text-sm text-slate-600 mb-3" id="l-estado"><span class="cargando"></span> Preparando el detector de caras...</p>' +
        '<div class="flex flex-wrap gap-2 text-xs mb-3" id="l-filtros"></div>' +
        '<div id="l-grilla" class="lote-grilla"></div>' +
        '<div class="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t">' +
        '<label class="flex items-start gap-2 text-sm max-w-xl"><input type="checkbox" id="l-ok" class="mt-1"> Revisé todas las fotos: no queda ninguna cara de niño, niña o persona sin autorización AUT-001 sin pixelar.</label>' +
        '<div class="flex gap-2"><button type="button" class="btn btn-secundario" data-l="cancelar">Cancelar</button>' +
        '<button type="button" class="btn btn-primario" data-l="subir" disabled>Subir fotos</button></div></div></div></div>';
      document.body.appendChild(fondo);

      var grilla = $('#l-grilla', fondo), estado = $('#l-estado', fondo), barra = $('#l-barra', fondo), bSubir = fondo.querySelector('[data-l="subir"]'), chk = $('#l-ok', fondo);

      function activas() { return items.filter(function (x) { return !x.quitada && x.estado === 'listo'; }); }
      function sinCaras() { return activas().filter(function (x) { return x.res.caras === 0; }); }
      function tarjeta(x) {
        var aviso = x.estado === 'error' ? '<span class="lote-chip rojo">⚠️ No se pudo leer</span>'
          : x.estado !== 'listo' ? '<span class="lote-chip"><span class="cargando"></span> Procesando</span>'
          : !x.res.detecto ? '<span class="lote-chip ambar">✋ Revisar a mano</span>'
          : x.res.caras ? '<span class="lote-chip verde">🛡️ ' + x.res.caras + ' cara(s) pixelada(s)</span>'
          : '<span class="lote-chip ambar">⚠️ Sin caras detectadas</span>';
        return '<figure class="lote-item' + (x.quitada ? ' quitada' : '') + '" data-i="' + x.i + '">' +
          (x.url ? '<img src="' + x.url + '" alt="">' : '<div class="lote-vacio"></div>') +
          '<figcaption><span class="truncate" title="' + esc(x.file.name) + '">' + esc(x.file.name) + '</span>' + aviso + '</figcaption>' +
          (x.estado === 'listo' ? '<div class="lote-acciones">' +
            (x.quitada ? '<button type="button" class="btn btn-secundario btn-chico" data-l="volver" data-i="' + x.i + '">↩️ Incluir</button>'
              : '<button type="button" class="btn btn-secundario btn-chico" data-l="ajustar" data-i="' + x.i + '">✏️ Ajustar</button>' +
                '<button type="button" class="btn btn-secundario btn-chico" data-l="quitar" data-i="' + x.i + '" aria-label="No subir esta foto">🗑️</button>') + '</div>' : '') +
          '</figure>';
      }
      function pintarUna(x) {
        var el = grilla.querySelector('[data-i="' + x.i + '"]');
        if (el) el.outerHTML = tarjeta(x); else grilla.insertAdjacentHTML('beforeend', tarjeta(x));
      }
      function resumen() {
        var hechas = items.filter(function (x) { return x.estado !== 'pendiente'; }).length;
        barra.style.width = Math.round(hechas * 100 / items.length) + '%';
        var act = activas(), sc = sinCaras(), caras = act.reduce(function (t, x) { return t + x.res.caras; }, 0);
        if (subiendo) return;
        if (hechas < items.length) estado.innerHTML = '<span class="cargando"></span> Pixelando caras: ' + hechas + ' de ' + items.length + '... (no cierres esta ventana)';
        else estado.innerHTML = '✅ Listas <strong>' + act.length + '</strong> foto(s) con <strong>' + caras + '</strong> cara(s) pixelada(s).' +
          (act.some(function (x) { return !x.res.detecto; }) ? ' <strong class="text-amber-700">La detección automática no está disponible en este navegador: abre cada foto con ✏️ Ajustar y pixela las caras a mano.</strong>'
            : sc.length ? ' <strong class="text-amber-700">' + sc.length + ' foto(s) sin caras detectadas: ábrelas con ✏️ Ajustar y confirma.</strong>' : '') +
          ' Toca ✏️ para corregir una foto o 🗑️ para no subirla.';
        bSubir.disabled = !(hechas === items.length && act.length && chk.checked);
        bSubir.textContent = 'Subir ' + act.length + ' foto(s)';
      }
      chk.addEventListener('change', resumen);

      function cerrar() {
        cancelado = true;
        items.forEach(function (x) { if (x.url) URL.revokeObjectURL(x.url); });
        fondo.remove(); fin();
      }

      fondo.addEventListener('click', async function (e) {
        var b = e.target.closest('[data-l]'); if (!b || subiendo) return;
        var a = b.dataset.l, x = items[+b.dataset.i];
        if (a === 'cancelar') {
          if (activas().length && !(await A.confirmar('¿Cancelar el cargue?', '<p>Las fotos procesadas no se subirán.</p>', 'Sí, cancelar'))) return;
          cerrar();
        } else if (a === 'quitar') { x.quitada = true; pintarUna(x); resumen(); }
        else if (a === 'volver') { x.quitada = false; pintarUna(x); resumen(); }
        else if (a === 'ajustar') {
          var r = await window.CedinePixelar.editar(x.file, { titulo: x.file.name + ' — ajustar pixelado', zonas: x.res.zonas, intensidad: x.res.intensidad });
          if (!r) return;
          var mini = await miniatura(r.blob);
          if (x.url) URL.revokeObjectURL(x.url);
          x.res = { blob: r.blob, ancho: r.ancho, alto: r.alto, caras: r.caras, zonas: r.zonas, intensidad: r.intensidad, detecto: true };
          x.url = URL.createObjectURL(mini); x.revisada = true;
          pintarUna(x); resumen();
        } else if (a === 'subir') subir();
      });

      async function subir() {
        var lista = activas();
        if (!lista.length || !chk.checked) return;
        subiendo = true; bSubir.disabled = true; chk.disabled = true;
        fondo.querySelectorAll('[data-l="ajustar"],[data-l="quitar"],[data-l="cancelar"]').forEach(function (z) { z.disabled = true; });
        var ok = 0, fallos = 0, n = 0, base = Date.now();
        async function una(x, k) {
          try {
            var path = await subirImagen(x.res.blob, 'galeria');
            var r = await sb.from('medios').insert({
              tipo: 'foto', titulo: datos.titulo || datos.album, album: datos.album, storage_path: path, ancho: x.res.ancho, alto: x.res.alto,
              formato: x.res.alto > x.res.ancho ? 'vertical' : 'horizontal', caras_pixeladas: x.res.caras > 0,
              autorizacion: datos.aut || null, publicado: datos.pub, orden: k
            });
            if (r.error) { await sb.storage.from('galeria').remove([path]); throw r.error; }
            ok++; x.subida = true;
            var el = grilla.querySelector('[data-i="' + x.i + '"] figcaption'); if (el) el.insertAdjacentHTML('beforeend', '<span class="lote-chip verde">☁️ Subida</span>');
          } catch (e) {
            fallos++; console.warn(e);
            var el2 = grilla.querySelector('[data-i="' + x.i + '"] figcaption'); if (el2) el2.insertAdjacentHTML('beforeend', '<span class="lote-chip rojo">❌ ' + esc(A.errorTexto(e)) + '</span>');
          }
          n++;
          barra.style.width = Math.round(n * 100 / lista.length) + '%';
          estado.innerHTML = '<span class="cargando"></span> Subiendo ' + n + ' de ' + lista.length + '...';
        }
        barra.style.width = '0%';
        var cola = lista.map(function (x, k) { return [x, k]; });
        async function trabajador() { while (cola.length) { var t = cola.shift(); await una(t[0], t[1]); } }
        await Promise.all([trabajador(), trabajador(), trabajador()]);
        subiendo = false;
        estado.innerHTML = (fallos ? '⚠️ ' : '✅ ') + '<strong>' + ok + '</strong> foto(s) subida(s)' + (fallos ? ', <strong class="text-red-700">' + fallos + ' con error</strong> (puedes intentarlas de nuevo en otro cargue)' : '') +
          (datos.pub ? ' y publicadas en la galería.' : ' como borrador: actívalas con el interruptor «Publicada».') + ' Tardó ' + Math.round((Date.now() - base) / 1000) + ' s.';
        bSubir.outerHTML = '<button type="button" class="btn btn-primario" id="l-fin">Terminar</button>';
        fondo.querySelector('[data-l="cancelar"].btn').remove();
        $('#l-fin', fondo).addEventListener('click', function () { cerrar(); pestanaGal = 'foto'; listar(c); });
        A.toast(ok + ' foto(s) subida(s).', fallos ? 'error' : 'ok');
      }

      async function miniatura(blob) {
        var bmp = await createImageBitmap(blob);
        var k = Math.min(1, 360 / Math.max(bmp.width, bmp.height));
        var cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        return new Promise(function (r) { cv.toBlob(r, 'image/jpeg', 0.8); });
      }

      grilla.innerHTML = items.map(tarjeta).join('');
      resumen();
      (async function () {
        await window.CedinePixelar.precargar();
        for (var k = 0; k < items.length; k++) {
          if (cancelado) return;
          var x = items[k];
          try {
            x.res = await window.CedinePixelar.procesar(x.file);
            x.url = URL.createObjectURL(x.res.miniatura); x.res.miniatura = null;
            x.estado = 'listo';
          } catch (e) { console.warn(x.file.name, e); x.estado = 'error'; }
          if (cancelado) return;
          pintarUna(x); resumen();
        }
      })();
    });
  }

  function formVideo(m, c) {
    var md = A.modal(m ? 'Editar video' : 'Agregar video de YouTube', '<form id="f-vid" class="grid gap-4" novalidate>' +
      '<div><label class="etiqueta req" for="fv-url">Enlace de YouTube</label><input id="fv-url" class="input" placeholder="https://youtu.be/... o https://youtube.com/shorts/..." value="' + (m ? 'https://youtu.be/' + esc(m.youtube_id) : '') + '">' +
      '<p class="ayuda">Sube el video a YouTube (puede ser «No listado») y pega aquí el enlace. Se mostrará con youtube-nocookie.com, sin cookies de seguimiento hasta que el visitante lo reproduzca.</p></div>' +
      '<div id="fv-prev" class="hidden"><img alt="Miniatura del video" class="rounded-xl w-full max-h-56 object-cover"></div>' +
      '<div><label class="etiqueta req" for="fv-titulo">Título</label><input id="fv-titulo" class="input" maxlength="140" value="' + esc(m ? m.titulo : '') + '"></div>' +
      '<div><label class="etiqueta" for="fv-desc">Descripción corta</label><input id="fv-desc" class="input" maxlength="200" value="' + esc(m ? m.descripcion || '' : '') + '"></div>' +
      '<div><label class="etiqueta" for="fv-formato">Formato</label><select id="fv-formato" class="input"><option value="horizontal">Horizontal (16:9)</option><option value="vertical">Vertical (Short o Reel, 9:16)</option></select></div>' +
      '<label class="flex items-start gap-2 text-sm"><input type="checkbox" id="fv-aut" class="mt-1" ' + (m ? 'checked' : '') + '> Confirmo que las personas reconocibles en el video tienen autorización AUT-001 o no se les ve la cara.</label>' +
      '<div class="flex justify-end gap-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-primario">' + (m ? 'Guardar' : 'Agregar video') + '</button></div></form>');
    if (m) $('#fv-formato', md.el).value = m.formato;
    function previa() {
      var v = idYouTube($('#fv-url', md.el).value), caja = $('#fv-prev', md.el);
      if (!v) { caja.classList.add('hidden'); return null; }
      caja.querySelector('img').src = 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg'; caja.classList.remove('hidden');
      if (v.vertical) $('#fv-formato', md.el).value = 'vertical';
      return v;
    }
    $('#fv-url', md.el).addEventListener('input', previa); previa();
    $('#f-vid', md.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var v = previa(), titulo = $('#fv-titulo', md.el).value.trim();
      if (!v) return A.toast('El enlace de YouTube no es válido.', 'error');
      if (titulo.length < 3) return A.toast('Escribe un título.', 'error');
      if (!$('#fv-aut', md.el).checked) return A.toast('Confirma la autorización de las personas que aparecen.', 'error');
      var fila = { tipo: 'video', youtube_id: v.id, titulo: titulo, descripcion: $('#fv-desc', md.el).value.trim() || null, formato: $('#fv-formato', md.el).value };
      var r = m ? await sb.from('medios').update(Object.assign(fila, { actualizado_en: new Date().toISOString() })).eq('id', m.id).select('id')
        : await sb.from('medios').insert(Object.assign(fila, { publicado: true }));
      if (r.error) return A.toast(A.errorTexto(r.error), 'error');
      md.cerrar(); A.toast(m ? 'Video actualizado.' : 'Video agregado a la galería.', 'ok'); pestanaGal = 'video'; listar(c);
    });
  }

  // ===========================================================================
  // HISTORIAS (Casos de Éxito)
  // ===========================================================================
  A.VISTAS.historias = async function (c) {
    var r = await sb.from('historias').select('*').order('orden').order('creado_en', { ascending: false });
    var lista = r.data || [];
    c.innerHTML = A.encabezado('Historias de niños', 'Se publican en <a class="underline" href="/casos-de-exito" target="_blank" rel="noopener">/casos-de-exito</a>. Solo el administrador las crea y edita. Para publicar es obligatoria la autorización AUT-001 firmada por el padre, la madre o el representante legal.',
      '<button class="btn btn-primario" id="h-nueva">+ Nueva historia</button>') +
      (r.error ? '<p class="text-red-700">' + esc(A.errorTexto(r.error)) + '</p>' :
        '<div class="grid md:grid-cols-2 gap-4">' + (lista.map(function (h, i) {
          var foto = (h.fotos || [])[0];
          return '<article class="tarjeta overflow-hidden flex">' + (foto ? '<img src="' + esc(urlFoto(foto.path)) + '" alt="" class="w-32 object-cover">' : '<div class="w-32 bg-cedine-cream grid place-items-center text-4xl" aria-hidden="true">💛</div>') +
            '<div class="p-4 flex-1"><div class="flex items-center gap-2 mb-1">' + (h.publicado ? '<span class="chip chip-verde">Publicada</span>' : '<span class="chip chip-gris">Borrador</span>') +
            '<span class="text-xs text-slate-500">' + esc(h.aut_consecutivo || 'Sin autorización') + '</span></div>' +
            '<h2 class="font-display font-bold text-cedine-blue">' + esc(h.titulo) + '</h2><p class="text-sm text-slate-600 line-clamp-2">' + esc(h.resumen) + '</p>' +
            '<div class="flex gap-2 mt-3"><button class="btn btn-secundario btn-chico" data-hed="' + i + '">Editar</button><button class="btn btn-peligro btn-chico" data-hdel="' + i + '">Eliminar</button></div></div></article>';
        }).join('') || '<p class="tarjeta p-8 text-center text-slate-500 md:col-span-2">Aún no hay historias en el panel. La de Julián sigue publicada en la página tal como está.</p>') + '</div>');
    $('#h-nueva').addEventListener('click', function () { formHistoria(null, c); });
    $$('[data-hed]', c).forEach(function (b) { b.addEventListener('click', function () { formHistoria(lista[b.dataset.hed], c); }); });
    $$('[data-hdel]', c).forEach(function (b) {
      b.addEventListener('click', async function () {
        var h = lista[b.dataset.hdel];
        if (!(await A.confirmar('Eliminar historia', '<p>¿Eliminar la historia <strong>' + esc(h.titulo) + '</strong> y sus fotos? Si solo quieres ocultarla, edítala y desmarca «Publicar».</p>', 'Eliminar'))) return;
        var paths = (h.fotos || []).map(function (f) { return f.path; });
        if (paths.length) await sb.storage.from('galeria').remove(paths);
        var r2 = await sb.from('historias').delete().eq('id', h.id).select('id');
        if (r2.error) return A.toast(A.errorTexto(r2.error), 'error');
        A.toast('Historia eliminada.', 'ok'); A.VISTAS.historias(c);
      });
    });
  };

  async function formHistoria(h, c) {
    var auts = await sb.from('documentos').select('consecutivo,titulo').eq('codigo_formato', 'AUT-001').eq('estado', 'vigente').order('creado_en', { ascending: false }).limit(200);
    var fotos = (h && h.fotos ? h.fotos.slice() : []);
    var md = A.modal(h ? 'Editar historia' : 'Nueva historia', '<form id="f-hist" class="grid sm:grid-cols-2 gap-4" novalidate>' +
      '<div><label class="etiqueta req" for="h-nombre">Nombre del niño o niña</label><input id="h-nombre" class="input" maxlength="40" value="' + esc(h ? h.nombre : '') + '"><p class="ayuda">Solo el primer nombre o un alias. Nunca apellidos ni documento.</p></div>' +
      '<div><label class="etiqueta" for="h-etiqueta">Etiqueta</label><input id="h-etiqueta" class="input" maxlength="60" placeholder="Caso de acompañamiento integral" value="' + esc(h ? h.etiqueta || '' : '') + '"></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta req" for="h-titulo">Título</label><input id="h-titulo" class="input" maxlength="120" placeholder="Sofía: aprendiendo a comunicarse con confianza" value="' + esc(h ? h.titulo : '') + '"></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta req" for="h-resumen">Resumen (1 o 2 frases)</label><textarea id="h-resumen" class="input" rows="2" maxlength="400">' + esc(h ? h.resumen : '') + '</textarea></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta req" for="h-contenido">Historia</label><textarea id="h-contenido" class="input" rows="8" maxlength="6000">' + esc(h ? h.contenido : '') + '</textarea>' +
      '<p class="ayuda">Deja una línea en blanco entre párrafos. Escribe **así** para negrita. Evita diagnósticos médicos detallados: cuenta el proceso y los logros.</p></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta" for="h-frase">Frase destacada</label><input id="h-frase" class="input" maxlength="160" placeholder="Cada niño avanza a su ritmo. Nosotros caminamos con él." value="' + esc(h ? h.frase || '' : '') + '"></div>' +
      '<div class="sm:col-span-2"><p class="etiqueta">Fotos del proceso</p><div id="h-fotos" class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2"></div>' +
      '<label class="btn btn-secundario btn-chico cursor-pointer">📷 Agregar fotos<input type="file" id="h-subir" accept="image/*" multiple class="sr-only"></label>' +
      '<p class="ayuda">Cada foto pasa por el editor: si la autorización permite mostrar la cara, puedes quitar el pixelado.</p></div>' +
      '<div class="sm:col-span-2 border-t pt-4"><label class="etiqueta req" for="h-aut">Autorización AUT-001 (consecutivo o referencia del documento físico)</label>' +
      '<input id="h-aut" class="input font-mono" list="h-auts" maxlength="80" value="' + esc(h ? h.aut_consecutivo || '' : '') + '"><datalist id="h-auts">' +
      ((auts.data || []).map(function (a) { return '<option value="' + esc(a.consecutivo) + '">' + esc(a.titulo) + '</option>'; }).join('')) + '</datalist>' +
      '<label class="flex items-start gap-2 text-sm mt-2"><input type="checkbox" id="h-autok" class="mt-1" ' + (h && h.aut_confirmada ? 'checked' : '') + '> Confirmo que existe la autorización firmada por el padre, la madre o el representante legal, que incluye el uso de imagen y la casilla de <strong>datos sensibles</strong>.</label></div>' +
      '<div><label class="etiqueta" for="h-orden">Orden</label><input id="h-orden" type="number" class="input" value="' + (h ? h.orden || 0 : 0) + '"></div>' +
      '<label class="flex items-center gap-2 text-sm self-end pb-3"><input type="checkbox" id="h-pub" ' + (h && h.publicado ? 'checked' : '') + '> Publicar en Casos de Éxito</label>' +
      '<div class="sm:col-span-2 flex justify-end gap-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-primario" id="h-ok">Guardar historia</button></div></form>', { ancho: true });

    function pintarFotos() {
      $('#h-fotos', md.el).innerHTML = fotos.map(function (f, i) {
        return '<div class="relative"><img src="' + esc(urlFoto(f.path)) + '" alt="" class="rounded-lg aspect-square object-cover w-full">' +
          '<input class="input !py-1 !px-2 text-xs mt-1" data-pie="' + i + '" placeholder="Pie de foto" value="' + esc(f.pie || '') + '" aria-label="Pie de foto ' + (i + 1) + '">' +
          '<button type="button" class="absolute top-1 right-1 btn-icono bg-white" data-qf="' + i + '" aria-label="Quitar foto">✕</button></div>';
      }).join('');
      $$('[data-pie]', md.el).forEach(function (x) { x.addEventListener('input', function () { fotos[x.dataset.pie].pie = x.value; }); });
      $$('[data-qf]', md.el).forEach(function (x) { x.addEventListener('click', function () { fotos.splice(+x.dataset.qf, 1); pintarFotos(); }); });
    }
    pintarFotos();
    $('#h-subir', md.el).addEventListener('change', async function () {
      var lista = Array.prototype.slice.call(this.files); this.value = '';
      for (var i = 0; i < lista.length; i++) {
        var res = await window.CedinePixelar.editar(lista[i], { titulo: 'Foto ' + (i + 1) + ' de ' + lista.length + ' — revisar caras' });
        if (!res) continue;
        try { fotos.push({ path: await subirImagen(res.blob, 'historias'), pie: '' }); pintarFotos(); } catch (e) { A.toast(e.message, 'error'); }
      }
    });
    $('#f-hist', md.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var v = function (id) { return $(id, md.el).value.trim(); };
      var fila = {
        nombre: v('#h-nombre'), etiqueta: v('#h-etiqueta') || null, titulo: v('#h-titulo'), resumen: v('#h-resumen'), contenido: v('#h-contenido'),
        frase: v('#h-frase') || null, fotos: fotos, aut_consecutivo: v('#h-aut') || null, aut_confirmada: $('#h-autok', md.el).checked,
        publicado: $('#h-pub', md.el).checked, orden: parseInt(v('#h-orden'), 10) || 0
      };
      if (!fila.nombre || !fila.titulo || !fila.resumen || fila.contenido.length < 40) return A.toast('Completa nombre, título, resumen e historia (mínimo 40 caracteres).', 'error');
      if (/\s\S+\s\S+/.test(fila.nombre)) return A.toast('Usa solo el primer nombre o un alias del niño o niña.', 'error');
      if (fila.publicado && (!fila.aut_confirmada || !fila.aut_consecutivo)) return A.toast('Para publicar, registra la AUT-001 y confirma la autorización.', 'error');
      var b = $('#h-ok', md.el); A.ocupado(b, true, 'Guardando...');
      var r = h ? await sb.from('historias').update(fila).eq('id', h.id).select('id') : await sb.from('historias').insert(fila).select('id');
      A.ocupado(b, false);
      if (r.error) return A.toast(A.errorTexto(r.error), 'error');
      md.cerrar(); A.toast(fila.publicado ? 'Historia publicada en Casos de Éxito.' : 'Historia guardada como borrador.', 'ok'); A.VISTAS.historias(c);
    });
  }
});
