/*!
 * Fundación CEDINE · Motor de documentos PDF con control documental (ISO 9001 §7.5 / ISO 15489)
 * Encabezado con código-versión-vigencia, pie con paginación "Página n de N",
 * consecutivo único en cada página y marca de agua institucional.
 * Requiere jsPDF 2.x (window.jspdf).
 */
(function () {
  'use strict';

  var BASE = '/assets/';
  var REC = {
    isotipo: BASE + 'admin/img/isotipo.jpg',
    marcaAgua: BASE + 'admin/img/marca-agua.jpg',
    fuenteNormal: BASE + 'fonts/Carlito-Regular.ttf?v=5',
    fuenteBold: BASE + 'fonts/Carlito-Bold.ttf?v=5'
  };
  var AZUL = [28, 75, 124], TEXTO = [43, 43, 43], GRIS = [110, 116, 128];
  var NARANJA = [247, 150, 56], VERDE = [145, 190, 102];
  var PIE = 'Centro de Diagnóstico de Necesidades Educativas · NIT 900.773.102-4 · Bogotá, Colombia — “Cuestión de actitud”';

  var cache = null;
  function b64(buffer) {
    var bytes = new Uint8Array(buffer), bin = '', paso = 0x8000;
    for (var i = 0; i < bytes.length; i += paso) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
    return btoa(bin);
  }
  function bajar(url) {
    return fetch(url, { cache: 'force-cache' }).then(function (r) {
      if (!r.ok) throw new Error('No se pudo cargar ' + url);
      return r.arrayBuffer();
    }).then(b64);
  }
  function recursos() {
    if (!cache) {
      cache = Promise.all([bajar(REC.isotipo), bajar(REC.marcaAgua),
        bajar(REC.fuenteNormal).catch(function () { return null; }),
        bajar(REC.fuenteBold).catch(function () { return null; })])
        .then(function (r) { return { isotipo: r[0], marca: r[1], fn: r[2], fb: r[3] }; });
      cache.catch(function () { cache = null; });
    }
    return cache;
  }

  /**
   * Crea un documento.
   * meta: { codigo, nombre, version, vigencia ('2026-11-21' o texto), consecutivo, borrador:bool }
   */
  function Documento(meta, rec) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'letter', compress: true });
    var fam = 'helvetica', esc = 0.92;
    if (rec.fn && rec.fb) {
      doc.addFileToVFS('Carlito-Regular.ttf', rec.fn); doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
      doc.addFileToVFS('Carlito-Bold.ttf', rec.fb); doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
      fam = 'Carlito'; esc = 1;
    }
    var W = 215.9, H = 279.4, MX = 22, TOP = 44, BOTTOM = H - 24;
    var y = TOP;
    var self = this;
    var PT = 11; // tamaño base del cuerpo
    this.tamano = function (pt) { PT = pt; return self; };

    function fuente(bold, pt, color) {
      doc.setFont(fam, bold ? 'bold' : 'normal');
      doc.setFontSize(pt * esc);
      doc.setTextColor.apply(doc, color || TEXTO);
    }
    function fondoPagina() {
      // franja tricolor superior
      var t = W / 3;
      doc.setFillColor.apply(doc, NARANJA); doc.rect(0, 0, t, 2.2, 'F');
      doc.setFillColor.apply(doc, VERDE); doc.rect(t, 0, t, 2.2, 'F');
      doc.setFillColor.apply(doc, AZUL); doc.rect(2 * t, 0, t + 0.5, 2.2, 'F');
      doc.setFillColor.apply(doc, NARANJA); doc.rect(0, H - 2.2, t, 2.2, 'F');
      doc.setFillColor.apply(doc, VERDE); doc.rect(t, H - 2.2, t, 2.2, 'F');
      doc.setFillColor.apply(doc, AZUL); doc.rect(2 * t, H - 2.2, t + 0.5, 2.2, 'F');
      // marca de agua (imagen ya atenuada, se dibuja antes del texto)
      var mw = 120, mh = mw * 227 / 400;
      doc.addImage('data:image/jpeg;base64,' + rec.marca, 'JPEG', (W - mw) / 2, (H - mh) / 2, mw, mh, 'marca', 'FAST');
      // encabezado
      var ih = 15, iw = ih * 400 / 227;
      doc.addImage('data:image/jpeg;base64,' + rec.isotipo, 'JPEG', MX, 9, iw, ih, 'iso', 'FAST');
      fuente(true, 13, AZUL); doc.text('FUNDACIÓN CEDINE', MX + iw + 4, 15.5);
      fuente(false, 9.5, GRIS); doc.text(doc.splitTextToSize(meta.nombre, 88)[0], MX + iw + 4, 20.5);
      // recuadro de control documental
      var bx = W - MX - 52, by = 8.5, bw = 52, bh = 18;
      doc.setDrawColor.apply(doc, AZUL); doc.setLineWidth(0.3); doc.roundedRect(bx, by, bw, bh, 1.5, 1.5, 'S');
      fuente(true, 8.5, AZUL);
      doc.text('Código: ' + meta.codigo, bx + 3, by + 5);
      fuente(false, 8.5, TEXTO);
      doc.text('Versión: ' + meta.version, bx + 3, by + 9.5);
      doc.text('Vigencia: ' + fechaCorta(meta.vigencia), bx + 3, by + 14);
      doc.setDrawColor(210, 214, 220); doc.line(MX, 30, W - MX, 30);
      if (meta.borrador) {
        doc.saveGraphicsState && doc.saveGraphicsState();
        fuente(true, 60, [220, 38, 38]);
        if (doc.GState) doc.setGState(new doc.GState({ opacity: 0.12 }));
        doc.text('BORRADOR', W / 2, H / 2 + 40, { align: 'center', angle: 30 });
        if (doc.GState) doc.setGState(new doc.GState({ opacity: 1 }));
        doc.restoreGraphicsState && doc.restoreGraphicsState();
      }
    }
    fondoPagina();

    function nuevaPagina() { doc.addPage('letter'); fondoPagina(); y = TOP; }
    function asegurar(alto) { if (y + alto > BOTTOM) nuevaPagina(); }

    // --- texto enriquecido: segmentos [{t, b}] con ajuste de línea ---
    function tokens(segs) {
      var out = [];
      (Array.isArray(segs) ? segs : [segs]).forEach(function (s) {
        if (typeof s === 'string') s = { t: s };
        String(s.t == null ? '' : s.t).split(/(\s+)/).forEach(function (p) {
          if (p) out.push({ t: /^\s+$/.test(p) ? ' ' : p, b: !!s.b, esp: /^\s+$/.test(p) });
        });
      });
      return out;
    }
    function lineas(segs, pt, ancho) {
      var tk = tokens(segs), res = [], act = [], w = 0;
      tk.forEach(function (k) { fuente(k.b, pt); k.w = doc.getTextWidth(k.t); });
      function cerrar() {
        while (act.length && act[act.length - 1].esp) w -= act.pop().w;
        if (act.length) res.push({ k: act, w: w });
        act = []; w = 0;
      }
      tk.forEach(function (k) {
        if (k.esp && !act.length) return;
        if (!k.esp && act.length && w + k.w > ancho) cerrar();
        act.push(k); w += k.w;
      });
      cerrar();
      return res;
    }

    this.parrafo = function (segs, o) {
      o = o || {};
      var pt = o.pt || PT, ancho = (o.ancho || (W - 2 * MX)) - (o.sangria || 0);
      var lh = pt * 0.3528 * (o.interlineado || 1.35);
      var ls = lineas(segs, pt, ancho);
      var x0 = MX + (o.sangria || 0);
      ls.forEach(function (ln, i) {
        asegurar(lh);
        var ultima = i === ls.length - 1;
        var x = o.align === 'center' ? (W - ln.w) / 2 : x0;
        // justificado: reparte el espacio sobrante entre los espacios (salvo última línea)
        var extra = 0;
        if (o.justificar !== false && o.align !== 'center' && !ultima) {
          var esp = ln.k.filter(function (k) { return k.esp; }).length;
          if (esp) extra = (ancho - ln.w) / esp;
        }
        ln.k.forEach(function (k) {
          if (!k.esp) { fuente(k.b, pt, o.color); doc.text(k.t, x, y); x += k.w; }
          else x += k.w + extra;
        });
        y += lh;
      });
      y += o.despues == null ? 2.5 : o.despues;
      return self;
    };
    this.titulo = function (t, o) {
      o = o || {};
      asegurar(14);
      y += 2;
      lineas([{ t: t, b: true }], o.pt || 15, W - 2 * MX).forEach(function (ln) {
        fuente(true, o.pt || 15, AZUL); doc.text(ln.k.map(function (k) { return k.t; }).join(''), W / 2, y, { align: 'center' });
        y += (o.pt || 15) * 0.45;
      });
      y += 3;
      return self;
    };
    this.subtitulo = function (t) {
      asegurar(10); y += 1.5;
      fuente(true, 11.5, AZUL); doc.text(t, MX, y); y += 6;
      return self;
    };
    this.espacio = function (mm) { y += mm; return self; };
    this.casilla = function (marcada, segs, o) {
      o = o || {};
      asegurar(6);
      doc.setDrawColor.apply(doc, TEXTO); doc.setLineWidth(0.3);
      doc.rect(MX + (o.sangria || 0), y - 3.3, 3.6, 3.6, 'S');
      if (marcada) { fuente(true, PT); doc.text('X', MX + (o.sangria || 0) + 0.75, y - 0.35); }
      var y0 = y;
      this.parrafo(segs, { sangria: (o.sangria || 0) + 6, despues: o.despues == null ? 1.2 : o.despues, justificar: false });
      return self;
    };
    this.campos = function (pares, o) {
      o = o || {};
      pares.forEach(function (p) {
        self.parrafo([{ t: p[0] + ': ', b: true }, String(p[1] || '—')], { despues: 1, justificar: false, pt: o.pt || PT });
      });
      y += 1.5;
      return self;
    };
    this.tabla = function (cabeceras, filas, anchos, o) {
      o = o || {};
      var pt = o.pt || 9.5, total = W - 2 * MX;
      var ws = anchos.map(function (a) { return a * total; });
      var pad = 1.8, lh = pt * 0.3528 * 1.25;
      function fila(celdas, esCab) {
        var partes = celdas.map(function (c, i) {
          fuente(esCab, pt); return doc.splitTextToSize(String(c == null ? '' : c), ws[i] - 2 * pad);
        });
        var alto = Math.max(o.altoMin || 0, Math.max.apply(null, partes.map(function (p) { return p.length; })) * lh + 2 * pad);
        if (y + alto > BOTTOM) { nuevaPagina(); if (!esCab) fila(cabeceras, true); }
        var x = MX;
        celdas.forEach(function (c, i) {
          if (esCab) { doc.setFillColor.apply(doc, AZUL); doc.rect(x, y, ws[i], alto, 'F'); }
          doc.setDrawColor(190, 196, 205); doc.setLineWidth(0.2); doc.rect(x, y, ws[i], alto, 'S');
          fuente(esCab, pt, esCab ? [255, 255, 255] : TEXTO);
          doc.text(partes[i], x + pad, y + pad + lh * 0.78);
          x += ws[i];
        });
        y += alto;
      }
      asegurar(lh * 3);
      fila(cabeceras, true);
      filas.forEach(function (f) { fila(f, false); });
      y += 4;
      return self;
    };
    /** firmas: [{ nombre, cargo, etiqueta, documento }] en 1 o 2 columnas */
    this.firmas = function (lista) {
      var porFila = lista.length === 1 ? 1 : 2;
      for (var i = 0; i < lista.length; i += porFila) {
        asegurar(36);
        y += 15;
        var grupo = lista.slice(i, i + porFila);
        var colW = (W - 2 * MX) / porFila;
        grupo.forEach(function (f, j) {
          var cx = MX + colW * j + colW / 2, lw = Math.min(70, colW - 10);
          doc.setDrawColor.apply(doc, TEXTO); doc.setLineWidth(0.3);
          doc.line(cx - lw / 2, y, cx + lw / 2, y);
          var yy = y + 4.5;
          fuente(true, 10); doc.text(f.nombre || '', cx, yy, { align: 'center' }); yy += 4.4;
          if (f.documento) { fuente(false, 9); doc.text(f.documento, cx, yy, { align: 'center' }); yy += 4; }
          if (f.cargo) { fuente(false, 9); doc.text(f.cargo, cx, yy, { align: 'center' }); yy += 4; }
          if (f.etiqueta) { fuente(true, 8.5, AZUL); doc.text(f.etiqueta, cx, yy, { align: 'center' }); }
        });
        y += 24;
      }
      return self;
    };
    this.cerrar = function () {
      var n = doc.getNumberOfPages();
      for (var p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setDrawColor(210, 214, 220); doc.setLineWidth(0.2); doc.line(MX, H - 15.5, W - MX, H - 15.5);
        fuente(false, 7.5, GRIS);
        doc.text(PIE, W / 2, H - 11.5, { align: 'center' });
        var linea = 'Formato ' + meta.codigo + ' · Versión ' + meta.version + ' · Página ' + p + ' de ' + n;
        doc.text(linea, MX, H - 7.5);
        fuente(true, 7.5, AZUL);
        doc.text((meta.borrador ? 'BORRADOR — sin consecutivo' : 'Consecutivo: ' + meta.consecutivo), W - MX, H - 7.5, { align: 'right' });
      }
      doc.setProperties({
        title: meta.nombre + (meta.consecutivo ? ' · ' + meta.consecutivo : ''),
        subject: meta.codigo + ' versión ' + meta.version,
        author: 'Fundación CEDINE (NIT 900.773.102-4)',
        keywords: [meta.codigo, meta.consecutivo || 'borrador', 'CEDINE'].join(', '),
        creator: 'Panel de administración CEDINE'
      });
      return doc;
    };
    this.jspdf = doc;
  }

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechaCorta(v) {
    var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(v || '');
    return +m[3] + '-' + MESES[+m[2] - 1].slice(0, 3) + '-' + m[1];
  }
  function fechaLarga(v) {
    var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(v || '');
    return { dia: +m[3], mes: MESES[+m[2] - 1], anio: m[1], texto: +m[3] + ' de ' + MESES[+m[2] - 1] + ' de ' + m[1] };
  }

  async function sha256(blob) {
    var buf = await blob.arrayBuffer();
    var h = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(h)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  /** Construye el PDF con la función "dibujar(builder, datos)" y devuelve { blob, doc } */
  async function generar(meta, dibujar, datos) {
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('La librería jsPDF no cargó. Revisa tu conexión.');
    var rec = await recursos();
    var b = new Documento(meta, rec);
    dibujar(b, datos, { fechaLarga: fechaLarga });
    var doc = b.cerrar();
    return { doc: doc, blob: doc.output('blob') };
  }

  window.CedineDocPDF = { generar: generar, sha256: sha256, fechaLarga: fechaLarga, fechaCorta: fechaCorta, precargar: recursos };
})();
