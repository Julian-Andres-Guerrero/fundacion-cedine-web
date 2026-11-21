/*!
 * Fundación CEDINE · Generador de certificados en PDF
 * ----------------------------------------------------
 * Dibuja el certificado sobre una plantilla limpia (sin textos variables)
 * y compone las frases completas, centradas y con salto de línea automático,
 * igual que los modelos oficiales en PowerPoint.
 *
 * Requiere jsPDF 2.x cargado antes (window.jspdf).
 * Uso: CedineCertificado.descargar(cert)  -> Promise
 *      CedineCertificado.precargar()       -> Promise (opcional, acelera el primer clic)
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuración
  // ---------------------------------------------------------------------------
  var VERSION = '5';
  var CFG = {
    plantilla: 'assets/img/plantilla-certificado-base.jpg?v=' + VERSION,
    fuentes: {
      normal: 'assets/fonts/Carlito-Regular.ttf?v=' + VERSION,
      bold: 'assets/fonts/Carlito-Bold.ttf?v=' + VERSION
    },
    // Página 4:3 idéntica a la diapositiva original (10 x 7.5 pulgadas)
    pagina: { w: 254, h: 190.5 },
    color: {
      azul: [28, 75, 124],
      texto: [43, 43, 43],
      gris: [125, 130, 140]
    },
    ciudad: 'Bogotá D.C.',
    lugarExpedicionDefecto: 'Bogotá',
    urlVerificacion: 'fundacioncedine.org/verificacion',
    timeoutMs: 20000
  };

  // Frase según el curso. La clave se compara sin tildes y en mayúsculas.
  // Agrega aquí cualquier curso que use una redacción distinta.
  var PREFIJO_POR_CURSO = [
    { contiene: 'ALTURA', prefijo: 'curso básico de' }
  ];
  var PREFIJO_DEFECTO = 'curso de';

  var TIPOS_DOCUMENTO = {
    CC: 'cédula de ciudadanía',
    TI: 'tarjeta de identidad',
    CE: 'cédula de extranjería',
    PA: 'pasaporte',
    PP: 'pasaporte',
    PPT: 'permiso por protección temporal',
    RC: 'registro civil'
  };

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // ---------------------------------------------------------------------------
  // Utilidades de datos
  // ---------------------------------------------------------------------------
  function limpio(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function sinTildes(s) {
    return limpio(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  }

  function prefijoCurso(curso) {
    var clave = sinTildes(curso);
    for (var i = 0; i < PREFIJO_POR_CURSO.length; i++) {
      if (clave.indexOf(PREFIJO_POR_CURSO[i].contiene) !== -1) return PREFIJO_POR_CURSO[i].prefijo;
    }
    return PREFIJO_DEFECTO;
  }

  function formatearMiles(digitos) {
    return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // "79259617", "79.259.617 de Bogotá", "79.259.617 de Bogotá." -> { numero, lugar }
  function parsearIdentificacion(cert) {
    var bruto = limpio(cert.identificacion).replace(/\.$/, '');
    var lugar = limpio(cert.lugar_expedicion);
    var m = bruto.match(/^(.*?)\s+de\s+(.+)$/i);
    var numero = m ? m[1] : bruto;
    if (m && !lugar) lugar = m[2];
    numero = numero.replace(/^(no\.?|n°|nº)\s*/i, '');
    var soloDigitos = numero.replace(/[.\s]/g, '');
    if (/^\d+$/.test(soloDigitos)) numero = formatearMiles(soloDigitos);
    return { numero: numero, lugar: (lugar || CFG.lugarExpedicionDefecto).replace(/\.$/, '') };
  }

  function tipoDocumento(cert) {
    var t = sinTildes(cert.tipo_documento || cert.tipo_identificacion || '');
    if (!t) return TIPOS_DOCUMENTO.CC;
    if (TIPOS_DOCUMENTO[t]) return TIPOS_DOCUMENTO[t];
    return limpio(cert.tipo_documento || cert.tipo_identificacion).toLowerCase();
  }

  // "40" | "40h" | "40 hrs" | "40 horas" -> "40 horas"
  function normalizarIntensidad(v) {
    var s = limpio(v);
    var m = s.match(/^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hora|horas)?\.?$/i);
    if (m) return m[1] + (m[1] === '1' ? ' hora' : ' horas');
    return s;
  }

  // Acepta "12/08/2026", "12-08-2026", "2026-08-12" y "2026-08-12T00:00:00Z"
  function parsearFecha(v) {
    var s = limpio(v);
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return { dia: +m[3], mes: +m[2], anio: m[1] };
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return { dia: +m[1], mes: +m[2], anio: m[3] };
    return null;
  }

  function fechaLegible(v) {
    var f = parsearFecha(v);
    if (!f || !MESES[f.mes - 1]) return limpio(v);
    return f.dia + ' de ' + MESES[f.mes - 1] + ' de ' + f.anio;
  }

  // ---------------------------------------------------------------------------
  // Carga de recursos (con caché y tiempo máximo, para que nunca se quede colgado)
  // ---------------------------------------------------------------------------
  var cacheRecursos = null;

  function conTiempoMaximo(promesa, ms, que) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () {
        reject(new Error('Tiempo de espera agotado cargando ' + que));
      }, ms);
      promesa.then(function (v) { clearTimeout(t); resolve(v); },
        function (e) { clearTimeout(t); reject(e); });
    });
  }

  function bufferABase64(buffer) {
    var bytes = new Uint8Array(buffer);
    var bin = '';
    var paso = 0x8000;
    for (var i = 0; i < bytes.length; i += paso) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + paso));
    }
    return btoa(bin);
  }

  function descargarBase64(url) {
    return conTiempoMaximo(
      fetch(url, { cache: 'force-cache' }).then(function (r) {
        if (!r.ok) throw new Error('No se encontró ' + url + ' (HTTP ' + r.status + ')');
        return r.arrayBuffer();
      }).then(bufferABase64),
      CFG.timeoutMs, url);
  }

  function precargar() {
    if (cacheRecursos) return cacheRecursos;
    var plantilla = descargarBase64(CFG.plantilla);
    // Si las fuentes fallan se usa Helvetica; la plantilla sí es obligatoria.
    var normal = descargarBase64(CFG.fuentes.normal).catch(function () { return null; });
    var bold = descargarBase64(CFG.fuentes.bold).catch(function () { return null; });
    cacheRecursos = Promise.all([plantilla, normal, bold]).then(function (r) {
      return { plantilla: r[0], fuenteNormal: r[1], fuenteBold: r[2] };
    });
    cacheRecursos.catch(function () { cacheRecursos = null; }); // permitir reintento
    return cacheRecursos;
  }

  // ---------------------------------------------------------------------------
  // Texto enriquecido (negritas en medio de la frase) con ajuste de línea
  // ---------------------------------------------------------------------------
  function crearTipografia(doc, recursos) {
    var familia = 'helvetica';
    var escala = 0.9; // Helvetica es más ancha que Calibri
    if (recursos.fuenteNormal && recursos.fuenteBold) {
      try {
        doc.addFileToVFS('Carlito-Regular.ttf', recursos.fuenteNormal);
        doc.addFont('Carlito-Regular.ttf', 'Carlito', 'normal');
        doc.addFileToVFS('Carlito-Bold.ttf', recursos.fuenteBold);
        doc.addFont('Carlito-Bold.ttf', 'Carlito', 'bold');
        familia = 'Carlito';
        escala = 1;
      } catch (e) {
        console.warn('No se pudieron registrar las fuentes; se usará Helvetica.', e);
      }
    }
    return {
      usar: function (bold, puntos) {
        doc.setFont(familia, bold ? 'bold' : 'normal');
        doc.setFontSize(puntos * escala);
      }
    };
  }

  function partirEnTokens(segmentos) {
    var tokens = [];
    segmentos.forEach(function (seg) {
      var s = typeof seg === 'string' ? { t: seg, b: false } : seg;
      String(s.t).split(/(\s+)/).forEach(function (p) {
        if (p) tokens.push({ t: /^\s+$/.test(p) ? ' ' : p, b: !!s.b, esp: /^\s+$/.test(p) });
      });
    });
    return tokens;
  }

  function componerLineas(doc, tipo, segmentos, puntos, anchoMax) {
    var tokens = partirEnTokens(segmentos);
    tokens.forEach(function (tk) {
      tipo.usar(tk.b, puntos);
      tk.w = doc.getTextWidth(tk.t);
    });
    var lineas = [];
    var actual = [];
    var ancho = 0;
    function cerrar() {
      while (actual.length && actual[actual.length - 1].esp) ancho -= actual.pop().w;
      if (actual.length) lineas.push({ tokens: actual, w: ancho });
      actual = [];
      ancho = 0;
    }
    tokens.forEach(function (tk) {
      if (tk.esp && !actual.length) return;
      if (!tk.esp && actual.length && ancho + tk.w > anchoMax) cerrar();
      actual.push(tk);
      ancho += tk.w;
    });
    cerrar();
    return lineas;
  }

  function dibujarParrafo(doc, tipo, opts) {
    var lineas = componerLineas(doc, tipo, opts.segmentos, opts.puntos, opts.anchoMax);
    var y = opts.y;
    lineas.forEach(function (ln) {
      var x = opts.cx - ln.w / 2;
      ln.tokens.forEach(function (tk) {
        tipo.usar(tk.b, opts.puntos);
        doc.setTextColor.apply(doc, tk.b && opts.colorBold ? opts.colorBold : opts.color);
        if (!tk.esp) doc.text(tk.t, x, y);
        x += tk.w;
      });
      y += opts.interlineado;
    });
    return y; // línea base siguiente
  }

  // ---------------------------------------------------------------------------
  // Construcción del certificado
  // ---------------------------------------------------------------------------
  function construirPDF(cert, recursos) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('La librería jsPDF no cargó. Revisa tu conexión o el bloqueador de anuncios.');
    }
    var W = CFG.pagina.w;
    var H = CFG.pagina.h;
    var cx = W / 2;
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H], compress: true });
    var tipo = crearTipografia(doc, recursos);

    var nombre = limpio(cert.nombre_completo);
    var curso = limpio(cert.curso).toUpperCase();
    var intensidad = normalizarIntensidad(cert.intensidad_horaria);
    var codigo = limpio(cert.codigo_verificacion);
    var ident = parsearIdentificacion(cert);
    var fecha = parsearFecha(cert.fecha_expedicion || cert.fecha_realizacion);

    doc.setProperties({
      title: 'Certificado - ' + nombre + ' - ' + curso,
      subject: 'Certificado de asistencia: ' + curso + (intensidad ? ' (' + intensidad + ')' : ''),
      author: 'Fundación Centro de Diagnóstico de Necesidades Educativas - CEDINE (NIT 900.773.102-4)',
      keywords: 'CEDINE, certificado, ' + codigo,
      creator: 'Fundación CEDINE · ' + CFG.urlVerificacion
    });

    // 1. Plantilla limpia (logos, marca de agua, firmas, sellos, pie)
    doc.addImage('data:image/jpeg;base64,' + recursos.plantilla, 'JPEG', 0, 0, W, H, 'plantilla', 'FAST');

    // 2. Nombre (se reduce solo si es muy largo)
    var puntosNombre = 36;
    tipo.usar(true, puntosNombre);
    while (doc.getTextWidth(nombre) > 205 && puntosNombre > 20) {
      puntosNombre -= 1;
      tipo.usar(true, puntosNombre);
    }
    doc.setTextColor.apply(doc, CFG.color.azul);
    doc.text(nombre, cx, 84.5, { align: 'center' });

    // 3. Identificación
    dibujarParrafo(doc, tipo, {
      segmentos: ['Identificado con ' + tipoDocumento(cert) + ' No. ' + ident.numero + ' de ' + ident.lugar + '.'],
      puntos: 13.5, cx: cx, y: 97.45, anchoMax: 203, interlineado: 6.42, color: CFG.color.texto
    });

    // 4. Curso + intensidad (curso en negrita) y código de aprobación en la línea siguiente
    var segCurso = ['Asistió al ' + prefijoCurso(curso) + ' ', { t: curso, b: true }];
    segCurso.push(intensidad ? ', con una intensidad de ' + intensidad + '.' : '.');
    var yCodigo = dibujarParrafo(doc, tipo, {
      segmentos: segCurso,
      puntos: 13.5, cx: cx, y: 109.7, anchoMax: 203, interlineado: 6.42, color: CFG.color.texto
    });
    dibujarParrafo(doc, tipo, {
      segmentos: ['Cód. Aprobación: ' + codigo + '.'],
      puntos: 13.5, cx: cx, y: yCodigo, anchoMax: 203, interlineado: 6.42, color: CFG.color.texto
    });

    // 5. Fecha de expedición (baja si el bloque del curso ocupó más líneas)
    var textoFecha = 'La presente se certifica a solicitud del interesado en la ciudad de ' + CFG.ciudad;
    if (fecha && MESES[fecha.mes - 1]) {
      textoFecha += fecha.dia === 1
        ? ', al 1 día del mes de ' + MESES[fecha.mes - 1] + ' de ' + fecha.anio + '.'
        : ', a los ' + fecha.dia + ' días del mes de ' + MESES[fecha.mes - 1] + ' de ' + fecha.anio + '.';
    } else {
      textoFecha += '.';
    }
    dibujarParrafo(doc, tipo, {
      segmentos: [textoFecha],
      puntos: 12, cx: cx, y: Math.max(134.5, yCodigo + 12), anchoMax: 183, interlineado: 5.84, color: CFG.color.texto
    });

    // 6. Línea de control (texto pequeño a la derecha, a la altura de "LEY 1503 DE 2011")
    tipo.usar(false, 7);
    doc.setTextColor.apply(doc, CFG.color.gris);
    doc.text('Verifique su autenticidad en ' + CFG.urlVerificacion, W - 14, 168.6, { align: 'right' });
    doc.text('Código: ' + codigo, W - 14, 172.0, { align: 'right' });

    return doc;
  }

  function nombreArchivo(cert) {
    var base = ('Certificado_CEDINE_' + limpio(cert.curso) + '_' + limpio(cert.codigo_verificacion))
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9_\-]+/g, '_').replace(/_+/g, '_');
    return base + '.pdf';
  }

  function entregarArchivo(doc, nombre) {
    var blob = doc.output('blob');
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function descargar(cert) {
    return precargar().then(function (recursos) {
      var doc = construirPDF(cert, recursos);
      entregarArchivo(doc, nombreArchivo(cert));
    });
  }

  window.CedineCertificado = {
    descargar: descargar,
    precargar: precargar,
    construirPDF: construirPDF,
    fechaLegible: fechaLegible,
    normalizarIntensidad: normalizarIntensidad,
    _interno: { parsearIdentificacion: parsearIdentificacion, parsearFecha: parsearFecha, prefijoCurso: prefijoCurso, componerLineas: componerLineas }
  };
})();
