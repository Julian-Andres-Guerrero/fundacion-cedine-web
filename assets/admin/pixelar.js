/*!
 * Fundación CEDINE · Editor de fotos con pixelado de caras
 * - Detecta caras automáticamente con MediaPipe (Google), revisando la foto por
 *   ventanas de varios tamaños para encontrar también caras pequeñas.
 * - Permite agregar zonas arrastrando sobre la foto y quitarlas con un clic.
 * - El pixelado se aplica EN EL NAVEGADOR antes de subir: la foto original
 *   con las caras visibles nunca sale del computador.
 * Uso: CedinePixelar.editar(file, { titulo }) -> Promise<{ blob, ancho, alto, caras } | null>
 */
(function () {
  'use strict';

  var MAX_LADO = 1920;
  var MP_VERSION = '0.10.14';
  var MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MP_VERSION;
  var MP_MODELO = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

  var detectorPromesa = null;

  function cargarDetector() {
    if (detectorPromesa) return detectorPromesa;
    detectorPromesa = (async function () {
      // MediaPipe (probado: detecta caras de 90 a 700 px en fotos de 1920 px)
      var vision = await import(/* webpackIgnore: true */ MP_BASE + '/vision_bundle.mjs');
      var fileset = await vision.FilesetResolver.forVisionTasks(MP_BASE + '/wasm');
      var det = await vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MP_MODELO }, runningMode: 'IMAGE', minDetectionConfidence: 0.5
      });
      return {
        tipo: 'mediapipe',
        detectar: function (c) {
          return det.detect(c).detections.map(function (d) {
            var b = d.boundingBox;
            return { x: b.originX, y: b.originY, width: b.width, height: b.height, score: d.categories[0].score };
          });
        }
      };
    })();
    detectorPromesa.catch(function () { detectorPromesa = null; });
    return detectorPromesa;
  }

  // El modelo trabaja a 128 px: las caras pequeñas se pierden en la foto completa.
  // Se recorre la foto con ventanas cuadradas de varios tamaños (1, 1/2, 1/3, 1/4 y 1/6
  // del lado menor), superpuestas a la mitad, y se unen los resultados.
  var DIVISIONES = [1, 2, 3, 4, 6], N = 256, UMBRAL = 0.6;
  async function detectarCaras(lienzo) {
    var d = await cargarDetector();
    var W = lienzo.width, H = lienzo.height, lado0 = Math.min(W, H), cajas = [];
    var t = document.createElement('canvas'); t.width = N; t.height = N;
    var tc = t.getContext('2d');
    for (var di = 0; di < DIVISIONES.length; di++) {
      var k = DIVISIONES[di], s = Math.round(lado0 / k), paso = Math.max(1, Math.round(s / 2));
      for (var y = 0; y < H; y += paso) {
        var y0 = Math.min(y, Math.max(0, H - s));
        for (var x = 0; x < W; x += paso) {
          var x0 = Math.min(x, Math.max(0, W - s));
          tc.clearRect(0, 0, N, N);
          tc.drawImage(lienzo, x0, y0, s, s, 0, 0, N, N);
          var res = await d.detectar(t);
          for (var r = 0; r < res.length; r++) {
            var b = res[r];
            if (b.score != null && b.score < UMBRAL) continue;
            if (k > 1) { // descarta caras cortadas por el borde de la ventana (se verán completas en otra)
              var m = N * 0.02;
              if ((b.x < m && x0 > 0) || (b.y < m && y0 > 0) || (b.x + b.width > N - m && x0 + s < W) || (b.y + b.height > N - m && y0 + s < H)) continue;
            }
            var e = s / N;
            cajas.push({ x: x0 + b.x * e, y: y0 + b.y * e, w: b.width * e, h: b.height * e, s: b.score || 1 });
          }
          if (x0 + s >= W) break;
          if (x % (paso * 6) === 0) await new Promise(function (ok) { setTimeout(ok, 0); }); // no congelar la pantalla
        }
        if (y0 + s >= H) break;
      }
    }
    return { cajas: fusionar(cajas), motor: d.tipo };
  }

  function iou(a, b) {
    var x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    var y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    return x * y / Math.min(a.w * a.h, b.w * b.h);
  }
  function centroDentro(a, b) {
    var cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    return cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.h;
  }
  function fusionar(cajas) {
    var out = [];
    cajas.sort(function (a, b) { return b.s - a.s; }).forEach(function (c) {
      if (c.w < 6 || c.h < 6) return;
      if (!out.some(function (o) { return iou(o, c) > 0.3 || centroDentro(c, o) || centroDentro(o, c); })) out.push(c);
    });
    return out;
  }

  function ampliar(c, W, H) {
    var mx = c.w * 0.25, my = c.h * 0.3;
    var x = Math.max(0, c.x - mx), y = Math.max(0, c.y - my);
    return { x: x, y: y, w: Math.min(W - x, c.w + 2 * mx), h: Math.min(H - y, c.h + 2 * my) };
  }

  function pixelar(ctx, origen, c, intensidad) {
    var bloque = Math.max(6, Math.round(Math.max(c.w, c.h) / intensidad));
    var pw = Math.max(1, Math.round(c.w / bloque)), ph = Math.max(1, Math.round(c.h / bloque));
    var t = document.createElement('canvas'); t.width = pw; t.height = ph;
    var tc = t.getContext('2d'); tc.imageSmoothingEnabled = true;
    tc.drawImage(origen, c.x, c.y, c.w, c.h, 0, 0, pw, ph);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(t, 0, 0, pw, ph, c.x, c.y, c.w, c.h);
    ctx.restore();
  }

  async function cargarImagen(file) {
    var bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) {
      bmp = await new Promise(function (res, rej) {
        var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error('No se pudo leer la imagen.')); };
        im.src = URL.createObjectURL(file);
      });
    }
    var w = bmp.width, h = bmp.height, k = Math.min(1, MAX_LADO / Math.max(w, h));
    var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }

  function editar(file, opciones) {
    opciones = opciones || {};
    return new Promise(async function (resolve) {
      var original;
      try { original = await cargarImagen(file); } catch (e) { alert(e.message); return resolve(null); }
      var W = original.width, H = original.height;
      var zonas = [], intensidad = 10;

      var fondo = document.createElement('div');
      fondo.className = 'modal-fondo';
      fondo.innerHTML = '<div class="modal ancho" role="dialog" aria-modal="true" aria-labelledby="px-titulo">' +
        '<div class="flex items-center justify-between px-6 pt-5 pb-3"><h2 id="px-titulo" class="font-display font-bold text-xl text-cedine-blue">' + esc(opciones.titulo || 'Proteger caras antes de publicar') + '</h2>' +
        '<button type="button" class="btn-icono" data-px="cancelar" aria-label="Cerrar">✕</button></div><div class="px-6 pb-6">' +
        '<p class="text-sm text-slate-600 mb-3" id="px-estado"><span class="cargando"></span> Buscando caras en la foto...</p>' +
        '<div class="relative bg-slate-900 rounded-xl overflow-hidden flex justify-center"><canvas id="px-lienzo" class="max-w-full max-h-[62vh] cursor-crosshair touch-none" style="image-rendering:auto"></canvas></div>' +
        '<div class="flex flex-wrap items-center gap-3 mt-3 text-sm">' +
        '<span class="text-slate-600">✋ Arrastra sobre la foto para pixelar otra zona · toca una zona para quitarla</span>' +
        '<label class="flex items-center gap-2 ml-auto">Intensidad <input type="range" id="px-int" min="5" max="20" value="10"></label></div>' +
        '<div class="flex flex-wrap justify-between gap-2 mt-4 pt-4 border-t">' +
        '<div class="flex gap-2"><button type="button" class="btn btn-secundario btn-chico" data-px="detectar">🔍 Detectar de nuevo</button>' +
        '<button type="button" class="btn btn-secundario btn-chico" data-px="limpiar">Quitar todas</button></div>' +
        '<div class="flex gap-2"><button type="button" class="btn btn-secundario" data-px="cancelar">Cancelar</button>' +
        '<button type="button" class="btn btn-primario" data-px="usar">Usar esta foto</button></div></div></div></div>';
      document.body.appendChild(fondo);

      var lienzo = fondo.querySelector('#px-lienzo');
      lienzo.width = W; lienzo.height = H;
      var ctx = lienzo.getContext('2d');
      var estado = fondo.querySelector('#px-estado');
      var arrastre = null;

      function dibujar(final) {
        ctx.drawImage(original, 0, 0);
        zonas.forEach(function (z) { pixelar(ctx, original, z, intensidad); });
        if (final) return;
        ctx.lineWidth = Math.max(2, W / 400);
        zonas.forEach(function (z) {
          ctx.strokeStyle = '#F79638'; ctx.setLineDash([]); ctx.strokeRect(z.x, z.y, z.w, z.h);
          var r = Math.max(10, W / 90);
          ctx.fillStyle = '#B85400'; ctx.beginPath(); ctx.arc(z.x + z.w, z.y, r, 0, 7); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(r * 1.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('×', z.x + z.w, z.y + 1);
        });
        if (arrastre && arrastre.w) {
          ctx.strokeStyle = '#fff'; ctx.setLineDash([8, 6]); ctx.strokeRect(arrastre.x, arrastre.y, arrastre.w, arrastre.h); ctx.setLineDash([]);
        }
      }
      function aviso() {
        estado.innerHTML = zonas.length
          ? '🛡️ <strong>' + zonas.length + '</strong> zona(s) pixelada(s). Revisa que no quede ninguna cara visible sin autorización (AUT-001).'
          : '⚠️ No hay zonas pixeladas. Si aparecen personas sin autorización AUT-001, arrastra sobre sus caras.';
      }
      function punto(e) {
        var r = lienzo.getBoundingClientRect();
        return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
      }
      async function detectar() {
        estado.innerHTML = '<span class="cargando"></span> Buscando caras en la foto...';
        try {
          var r = await detectarCaras(original);
          zonas = r.cajas.map(function (c) { return ampliar(c, W, H); });
          dibujar(); aviso();
        } catch (e) {
          console.warn('Detección automática no disponible:', e);
          dibujar();
          estado.innerHTML = '⚠️ La detección automática no está disponible en este navegador. Arrastra sobre cada cara para pixelarla.';
        }
      }

      lienzo.addEventListener('pointerdown', function (e) {
        var p = punto(e);
        var r = Math.max(10, W / 90) * 1.6;
        for (var i = zonas.length - 1; i >= 0; i--) {
          var z = zonas[i];
          var enX = Math.hypot(p.x - (z.x + z.w), p.y - z.y) < r;
          var dentro = p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h;
          if (enX || dentro) { zonas.splice(i, 1); dibujar(); aviso(); return; }
        }
        arrastre = { x0: p.x, y0: p.y, x: p.x, y: p.y, w: 0, h: 0 };
        lienzo.setPointerCapture(e.pointerId);
      });
      lienzo.addEventListener('pointermove', function (e) {
        if (!arrastre) return;
        var p = punto(e);
        arrastre.x = Math.min(arrastre.x0, p.x); arrastre.y = Math.min(arrastre.y0, p.y);
        arrastre.w = Math.abs(p.x - arrastre.x0); arrastre.h = Math.abs(p.y - arrastre.y0);
        dibujar();
      });
      lienzo.addEventListener('pointerup', function () {
        if (arrastre && arrastre.w > 8 && arrastre.h > 8) zonas.push({ x: arrastre.x, y: arrastre.y, w: arrastre.w, h: arrastre.h });
        arrastre = null; dibujar(); aviso();
      });
      fondo.querySelector('#px-int').addEventListener('input', function () { intensidad = +this.value; dibujar(); });

      function cerrar(valor) { fondo.remove(); resolve(valor); }
      fondo.addEventListener('click', async function (e) {
        var b = e.target.closest('[data-px]'); if (!b) return;
        var a = b.dataset.px;
        if (a === 'cancelar') cerrar(null);
        else if (a === 'detectar') detectar();
        else if (a === 'limpiar') { zonas = []; dibujar(); aviso(); }
        else if (a === 'usar') {
          dibujar(true);
          var blob = await new Promise(function (r) { lienzo.toBlob(r, 'image/webp', 0.82); });
          if (!blob || blob.type !== 'image/webp') blob = await new Promise(function (r) { lienzo.toBlob(r, 'image/jpeg', 0.85); });
          cerrar({ blob: blob, ancho: W, alto: H, caras: zonas.length });
        }
      });
      document.addEventListener('keydown', function tecla(e) {
        if (e.key === 'Escape' && document.body.contains(fondo)) { document.removeEventListener('keydown', tecla); cerrar(null); }
      });

      dibujar();
      if (opciones.detectar === false) aviso(); else detectar();
    });
  }

  window.CedinePixelar = { editar: editar, precargar: function () { return cargarDetector().catch(function () {}); }, _detectarCaras: detectarCaras };
})();
