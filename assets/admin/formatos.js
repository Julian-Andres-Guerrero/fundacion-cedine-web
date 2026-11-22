/*!
 * Fundación CEDINE · Formatos diligenciables desde el panel
 * Cada formato define sus campos (formulario) y cómo se redacta el PDF.
 * El código, la versión y la vigencia se toman del Listado Maestro (tabla "formatos").
 */
(function () {
  'use strict';

  var FUNDACION = 'FUNDACIÓN CEDINE — Centro de Diagnóstico de Necesidades Educativas, NIT 900.773.102-4';
  var DIRECCION = 'Calle 11 A No. 35-23, barrio Pensilvania, Bogotá D.C.';
  var CORREOS = 'administracion@fundacioncedine.org / fundacedine@gmail.com';
  var REP_LEGAL = 'Wilian Alfonso Pardo Martinez';
  var hoy = function () { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  function pesos(n) {
    var v = Number(n) || 0;
    return '$ ' + v.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }
  function enFecha(b, f, ciudad) {
    var x = f && f.dia ? f : null;
    return 'en ' + (ciudad || 'Bogotá D.C.') + ', a los ' + (x ? x.dia : '____') + ' días del mes de ' + (x ? x.mes : '__________') + ' de ' + (x ? x.anio : '______');
  }

  var FORMATOS = {

    // -----------------------------------------------------------------------
    'AUT-001': {
      icono: '📸',
      resumen: 'Autorización de uso de imagen y datos personales (adultos y menores de edad).',
      titulo: function (d) { return 'Autorización de imagen — ' + (d.persona_nombre || ''); },
      campos: [
        { id: 'autorizante_nombre', etiqueta: 'Nombre de quien autoriza', tipo: 'text', req: true },
        { id: 'autorizante_documento', etiqueta: 'Documento de quien autoriza', tipo: 'text', req: true },
        { id: 'calidad', etiqueta: 'Actúa en calidad de', tipo: 'select', req: true,
          opciones: ['La persona que aparece en las imágenes', 'Padre', 'Madre', 'Representante legal'] },
        { id: 'persona_nombre', etiqueta: 'Nombre de la persona que aparece en las imágenes', tipo: 'text', req: true },
        { id: 'persona_documento', etiqueta: 'Documento de esa persona', tipo: 'text', req: true },
        { id: 'es_menor', etiqueta: 'La persona es menor de edad', tipo: 'checkbox' },
        { id: 'canales', etiqueta: 'Canales autorizados', tipo: 'checkgroup', req: true,
          opciones: ['Página web', 'Facebook', 'Instagram', 'YouTube', 'TikTok', 'Material impreso institucional'],
          defecto: ['Página web', 'Facebook', 'Instagram', 'YouTube', 'TikTok', 'Material impreso institucional'] },
        { id: 'datos_sensibles', etiqueta: 'Autoriza el tratamiento de datos sensibles (salud, diagnóstico, imagen de menores)', tipo: 'checkbox' },
        { id: 'telefono', etiqueta: 'Teléfono de contacto', tipo: 'text' },
        { id: 'correo', etiqueta: 'Correo de contacto', tipo: 'email' },
        { id: 'fecha', etiqueta: 'Fecha de firma', tipo: 'date', req: true, defecto: hoy }
      ],
      validar: function (d) {
        if (d.es_menor && d.calidad === 'La persona que aparece en las imágenes') {
          return 'Si la persona es menor de edad, debe firmar el padre, la madre o el representante legal.';
        }
        return null;
      },
      dibujar: function (b, d, u) {
        var f = u.fechaLarga(d.fecha);
        b.tamano(10);
        b.titulo('AUTORIZACIÓN DE USO DE IMAGEN Y DATOS PERSONALES', { pt: 14 });
        b.parrafo(['Yo, ', { t: d.autorizante_nombre, b: true }, ', identificado(a) con documento No. ', { t: d.autorizante_documento, b: true },
          ', actuando en calidad de ', { t: String(d.calidad || '').toLowerCase(), b: true }, ', autorizo a la ', FUNDACION, ', para:']);
        b.parrafo(['1. Captar y conservar fotografías y videos de: ', { t: d.persona_nombre, b: true }, ', documento ', { t: d.persona_documento, b: true },
          d.es_menor ? ' (menor de edad).' : '.'], { sangria: 4 });
        b.parrafo(['2. Publicar ese material con fines institucionales y de divulgación únicamente en los canales marcados:'], { sangria: 4, despues: 1 });
        ['Página web', 'Facebook', 'Instagram', 'YouTube', 'TikTok', 'Material impreso institucional'].forEach(function (c) {
          b.casilla((d.canales || []).indexOf(c) !== -1, c, { sangria: 10, despues: 0.2 });
        });
        b.espacio(1.5);
        b.parrafo(['3. Usarlo sin contraprestación económica alguna, sin que la imagen sea vendida ni cedida a terceros con fines comerciales.'], { sangria: 4 });
        b.parrafo([{ t: 'TRATAMIENTO DE DATOS PERSONALES (Ley 1581 de 2012 y Decreto 1377 de 2013). ', b: true },
          'Autorizo el tratamiento de los datos e imágenes suministrados en este formato conforme a la Política de Tratamiento de Datos Personales de la fundación (POL-001), publicada en fundacioncedine.org/politica-de-datos. Responsable: ',
          FUNDACION, ', ', DIRECCION, ', Tel. 601 908 7403, correo ', CORREOS, '. Como titular tengo derecho a conocer, actualizar, rectificar y suprimir mis datos y a revocar esta autorización en cualquier momento, por escrito o a los correos indicados; la revocación no afecta las publicaciones realizadas antes de buena fe.']);
        b.casilla(!!d.datos_sensibles, [{ t: 'DATOS SENSIBLES. ', b: true },
          'Autorizo de manera expresa el tratamiento de datos sensibles (información de salud, diagnósticos y la imagen de niños, niñas y adolescentes) con las finalidades descritas. He sido informado(a) de que no estoy obligado(a) a autorizar el tratamiento de datos sensibles.']);
        b.parrafo([{ t: 'MENORES DE EDAD. ', b: true },
          'Cuando la persona que aparece en las imágenes sea menor de edad, esta autorización debe ser firmada por su padre, madre o representante legal, conforme al Código de la Infancia y la Adolescencia (Ley 1098 de 2006), respetando su interés superior y sus derechos prevalentes. Sin esta firma la fundación no publicará imágenes del menor.']);
        if (d.telefono || d.correo) b.campos([['Teléfono', d.telefono], ['Correo', d.correo]]);
        b.parrafo(['Para constancia, se firma ' + enFecha(b, f) + '.']);
        b.firmas([{ nombre: d.autorizante_nombre, documento: 'Doc. ' + d.autorizante_documento, etiqueta: 'FIRMA DE QUIEN AUTORIZA' }]);
      }
    },

    // -----------------------------------------------------------------------
    'ACT-001': {
      icono: '🎁',
      resumen: 'Acta de donación en especie (bienes o servicios), soporte contable y tributario RTE.',
      titulo: function (d) { return 'Donación en especie — ' + (d.donante_nombre || ''); },
      campos: [
        { id: 'donante_tipo', etiqueta: 'Tipo de donante', tipo: 'select', req: true, opciones: ['Persona natural', 'Persona jurídica (empresa)'] },
        { id: 'donante_nombre', etiqueta: 'Nombre o razón social del donante', tipo: 'text', req: true },
        { id: 'donante_documento', etiqueta: 'C.C. o NIT del donante', tipo: 'text', req: true },
        { id: 'donante_representante', etiqueta: 'Representante legal del donante (si es empresa)', tipo: 'text' },
        { id: 'donante_contacto', etiqueta: 'Teléfono o correo del donante', tipo: 'text' },
        { id: 'objeto', etiqueta: 'Objeto de la donación (resumen)', tipo: 'text', req: true, ayuda: 'Ej.: Útiles escolares para la jornada "Un Día para Soñar"' },
        { id: 'items', etiqueta: 'Bienes o servicios donados', tipo: 'items', req: true,
          columnas: [{ id: 'descripcion', etiqueta: 'Descripción', ancho: 0.5 }, { id: 'cantidad', etiqueta: 'Cantidad', tipo: 'number', ancho: 0.14 },
            { id: 'valor_unitario', etiqueta: 'Valor unitario (COP)', tipo: 'number', ancho: 0.18 }] },
        { id: 'destino', etiqueta: 'Destino o uso que dará la fundación', tipo: 'textarea' },
        { id: 'rep_fundacion', etiqueta: 'Representante legal de la fundación', tipo: 'text', req: true, defecto: REP_LEGAL },
        { id: 'fecha', etiqueta: 'Fecha del acta', tipo: 'date', req: true, defecto: hoy }
      ],
      dibujar: function (b, d, u) {
        var f = u.fechaLarga(d.fecha);
        var items = (d.items || []).filter(function (i) { return i.descripcion; });
        var total = items.reduce(function (s, i) { return s + (Number(i.cantidad) || 0) * (Number(i.valor_unitario) || 0); }, 0);
        b.titulo('ACTA DE DONACIÓN EN ESPECIE');
        b.parrafo(['En la ciudad de Bogotá D.C., a los ' + f.dia + ' días del mes de ' + f.mes + ' de ' + f.anio + ', se reunieron: por una parte, la ',
          FUNDACION, ', representada por ', { t: d.rep_fundacion, b: true }, ', en calidad de representante legal; y por la otra, ',
          { t: d.donante_nombre, b: true }, ', identificado(a) con ', /jur/i.test(d.donante_tipo) ? 'NIT ' : 'C.C. ', { t: d.donante_documento, b: true },
          d.donante_representante ? ', representada por ' + d.donante_representante : '', ', quien actúa como DONANTE, con el fin de dejar constancia de lo siguiente:']);
        b.parrafo([{ t: 'PRIMERO — OBJETO. ', b: true }, 'El donante entrega a la fundación, a título gratuito, los siguientes bienes o servicios: ', { t: d.objeto, b: true }, '.']);
        b.tabla(['Descripción', 'Cantidad', 'Valor unitario', 'Subtotal'],
          items.map(function (i) {
            return [i.descripcion, String(i.cantidad || ''), pesos(i.valor_unitario), pesos((Number(i.cantidad) || 0) * (Number(i.valor_unitario) || 0))];
          }).concat([['TOTAL', '', '', pesos(total)]]), [0.52, 0.12, 0.18, 0.18]);
        b.parrafo([{ t: 'SEGUNDO — CARÁCTER DE LA DONACIÓN. ', b: true }, 'La donación es irrevocable, gratuita y sin contraprestación alguna. La fundación la destinará exclusivamente al cumplimiento de su objeto social',
          d.destino ? ', en particular a: ' + d.destino : '', '.']);
        b.parrafo([{ t: 'TERCERO — VALOR. ', b: true }, 'Las partes estiman el valor de lo donado en ', { t: pesos(total) + ' COP', b: true },
          ', correspondiente a su valor comercial, para efectos del registro contable de la fundación.']);
        b.parrafo([{ t: 'CUARTO — CERTIFICADO DE DONACIÓN. ', b: true }, 'La fundación pertenece al Régimen Tributario Especial (RTE). Previa solicitud del donante, expedirá el certificado de donación con los requisitos del artículo 125-2 del Estatuto Tributario y del Decreto Único Reglamentario 1625 de 2016.']);
        b.parrafo([{ t: 'QUINTO — ACEPTACIÓN. ', b: true }, 'La fundación acepta la donación, agradece el aporte y lo incorpora a su inventario y a su sistema de gestión documental.']);
        b.parrafo(['En constancia, se firma en la fecha indicada.']);
        b.firmas([
          { nombre: d.donante_nombre, documento: (/jur/i.test(d.donante_tipo) ? 'NIT ' : 'C.C. ') + d.donante_documento, cargo: d.donante_representante ? 'Rep. legal: ' + d.donante_representante : 'Donante', etiqueta: 'ENTREGA' },
          { nombre: d.rep_fundacion, cargo: 'Representante Legal, Fundación Cedine', etiqueta: 'RECIBE Y APRUEBA' }
        ]);
      }
    },

    // -----------------------------------------------------------------------
    'ACT-002': {
      icono: '🛡️',
      resumen: 'Designación de administrador de canales digitales (web, redes y correo).',
      titulo: function (d) { return 'Designación administrador digital — ' + (d.designado_nombre || ''); },
      campos: [
        { id: 'rep_fundacion', etiqueta: 'Representante legal de la fundación', tipo: 'text', req: true, defecto: REP_LEGAL },
        { id: 'rep_documento', etiqueta: 'C.C. del representante legal', tipo: 'text', req: true },
        { id: 'designado_nombre', etiqueta: 'Nombre de la persona designada', tipo: 'text', req: true },
        { id: 'designado_documento', etiqueta: 'C.C. de la persona designada', tipo: 'text', req: true },
        { id: 'designado_perfil', etiqueta: 'Profesión / matrícula profesional', tipo: 'text' },
        { id: 'gratuito', etiqueta: 'La administración se presta como donación en especie (sin pago)', tipo: 'checkbox', defecto: true },
        { id: 'inventario', etiqueta: 'Anexo 1 — Inventario de canales y accesos', tipo: 'items',
          columnas: [{ id: 'canal', etiqueta: 'Canal / plataforma', ancho: 0.24 }, { id: 'cuenta', etiqueta: 'Cuenta o dirección', ancho: 0.32 },
            { id: 'admins', etiqueta: 'Administradores', ancho: 0.26 }, { id: 'estado', etiqueta: 'Estado', ancho: 0.18 }],
          defecto: [
            { canal: 'Dominio y sitio web', cuenta: 'fundacioncedine.org', admins: '', estado: 'Activo' },
            { canal: 'Correo institucional', cuenta: 'administracion@fundacioncedine.org', admins: '', estado: 'Activo' },
            { canal: 'Facebook', cuenta: '', admins: '', estado: '' },
            { canal: 'Instagram', cuenta: '', admins: '', estado: '' },
            { canal: 'YouTube / TikTok', cuenta: '', admins: '', estado: '' }
          ] },
        { id: 'fecha', etiqueta: 'Fecha', tipo: 'date', req: true, defecto: hoy }
      ],
      dibujar: function (b, d, u) {
        var f = u.fechaLarga(d.fecha);
        b.titulo('DESIGNACIÓN DE ADMINISTRADOR DE CANALES DIGITALES');
        b.parrafo(['En la ciudad de Bogotá D.C., a los ' + f.dia + ' días del mes de ' + f.mes + ' de ' + f.anio + ', la ', FUNDACION, ', representada por ',
          { t: d.rep_fundacion, b: true }, ', identificado(a) con C.C. No. ', { t: d.rep_documento, b: true }, ', en su calidad de representante legal, DESIGNA a ',
          { t: String(d.designado_nombre || '').toUpperCase(), b: true }, ', identificado(a) con C.C. No. ', { t: d.designado_documento, b: true },
          d.designado_perfil ? ', ' + d.designado_perfil : '', ', como ', { t: 'ADMINISTRADOR DE CANALES DIGITALES', b: true }, ' de la fundación, en los siguientes términos:']);
        b.parrafo([{ t: 'PRIMERO — ALCANCE. ', b: true }, 'La designación cubre: (a) el dominio de internet y el sitio web institucional; (b) las cuentas oficiales de la fundación en redes sociales; y (c) el correo electrónico institucional asociado a esos canales.']);
        b.parrafo([{ t: 'SEGUNDO — FACULTADES. ', b: true }, 'El administrador podrá crear y configurar las cuentas a nombre de la fundación; diseñar y publicar contenido institucional; responder mensajes y comentarios; y administrar la seguridad de los accesos (contraseñas, verificación en dos pasos y roles).']);
        b.parrafo([{ t: 'TERCERO — LÍMITES. ', b: true }, 'El administrador no podrá cambiar la titularidad de las cuentas ni del dominio, que serán siempre de la fundación; celebrar contratos ni recibir dineros a nombre de la fundación por estos canales; ni publicar imágenes de personas sin la autorización de uso de imagen firmada (Formato AUT-001), en especial tratándose de menores de edad.']);
        b.parrafo([{ t: 'CUARTO — TITULARIDAD Y ACCESOS. ', b: true }, 'Todas las cuentas, el dominio y las credenciales son propiedad de la fundación. Siempre existirán como mínimo dos (2) administradores con acceso: el aquí designado y un delegado de la fundación, ambos con verificación en dos pasos activa. El inventario del Anexo 1 hace parte integral de este documento y se actualizará con cada cambio.']);
        b.parrafo([{ t: 'QUINTO — CARÁCTER. ', b: true }, d.gratuito ? 'La administración se presta como donación en especie, sin contraprestación económica, en los términos del Acta de Donación en Especie (ACT-001).' : 'Las condiciones económicas, si las hay, constan en documento aparte.']);
        b.parrafo([{ t: 'SEXTO — VIGENCIA Y REVOCACIÓN. ', b: true }, 'La designación tiene vigencia indefinida. La fundación podrá revocarla en cualquier momento mediante comunicación escrita; en ese caso, el administrador entregará la totalidad de los accesos y credenciales en un plazo máximo de cinco (5) días hábiles.']);
        b.parrafo([{ t: 'SÉPTIMO — CONFIDENCIALIDAD Y DATOS. ', b: true }, 'El administrador guardará reserva sobre la información y los datos personales a los que tenga acceso, conforme a la Ley 1581 de 2012 y a la Política de Tratamiento de Datos Personales (POL-001).']);
        b.parrafo(['En constancia, se firma la presente designación en la fecha indicada.']);
        b.firmas([
          { nombre: d.rep_fundacion, documento: 'C.C. ' + d.rep_documento, cargo: 'Representante Legal, Fundación Cedine', etiqueta: 'DESIGNA' },
          { nombre: String(d.designado_nombre || '').toUpperCase(), documento: 'C.C. ' + d.designado_documento, cargo: 'Administrador de canales digitales', etiqueta: 'ACEPTA LA DESIGNACIÓN' }
        ]);
        var inv = (d.inventario || []).filter(function (r) { return r.canal; });
        if (inv.length) {
          b.subtitulo('ANEXO 1 — INVENTARIO DE CANALES Y ACCESOS');
          b.parrafo(['No registre contraseñas en este anexo.'], { pt: 9, despues: 2 });
          b.tabla(['Canal / plataforma', 'Cuenta o dirección', 'Administradores', 'Estado'],
            inv.map(function (r) { return [r.canal, r.cuenta, r.admins, r.estado]; }), [0.24, 0.32, 0.26, 0.18]);
        }
      }
    },

    // -----------------------------------------------------------------------
    'DOC-001': {
      icono: '✉️',
      resumen: 'Carta o comunicación oficial de la fundación.',
      titulo: function (d) { return 'Carta — ' + (d.asunto || ''); },
      campos: [
        { id: 'ciudad', etiqueta: 'Ciudad', tipo: 'text', req: true, defecto: 'Bogotá D.C.' },
        { id: 'fecha', etiqueta: 'Fecha', tipo: 'date', req: true, defecto: hoy },
        { id: 'tratamiento', etiqueta: 'Tratamiento', tipo: 'select', opciones: ['', 'Señor', 'Señora', 'Señores', 'Doctor', 'Doctora'] },
        { id: 'destinatario', etiqueta: 'Destinatario', tipo: 'text', req: true },
        { id: 'cargo', etiqueta: 'Cargo', tipo: 'text' },
        { id: 'entidad', etiqueta: 'Entidad', tipo: 'text' },
        { id: 'direccion', etiqueta: 'Dirección o correo', tipo: 'text' },
        { id: 'asunto', etiqueta: 'Asunto', tipo: 'text', req: true },
        { id: 'saludo', etiqueta: 'Saludo', tipo: 'text', defecto: 'Cordial saludo:' },
        { id: 'cuerpo', etiqueta: 'Texto de la carta', tipo: 'textarea', req: true, filas: 10, ayuda: 'Deja una línea en blanco entre párrafos.' },
        { id: 'despedida', etiqueta: 'Despedida', tipo: 'text', defecto: 'Atentamente,' },
        { id: 'firmante', etiqueta: 'Firma (nombre)', tipo: 'text', req: true, defecto: REP_LEGAL },
        { id: 'firmante_cargo', etiqueta: 'Cargo de quien firma', tipo: 'text', defecto: 'Representante Legal' },
        { id: 'anexos', etiqueta: 'Anexos', tipo: 'text' },
        { id: 'proyecto', etiqueta: 'Proyectó', tipo: 'text' }
      ],
      dibujar: function (b, d, u) {
        var f = u.fechaLarga(d.fecha);
        b.espacio(2);
        b.parrafo([d.ciudad + ', ' + f.texto], { justificar: false, despues: 6 });
        var dest = [d.tratamiento ? d.tratamiento : '', d.destinatario].filter(Boolean).join(' ');
        b.parrafo([{ t: dest, b: true }], { justificar: false, despues: 0.5 });
        [d.cargo, d.entidad, d.direccion].filter(Boolean).forEach(function (l) { b.parrafo([l], { justificar: false, despues: 0.5 }); });
        b.espacio(5);
        b.parrafo([{ t: 'Asunto: ', b: true }, d.asunto], { justificar: false, despues: 6 });
        if (d.saludo) b.parrafo([d.saludo], { despues: 4 });
        String(d.cuerpo || '').split(/\n\s*\n/).forEach(function (p) {
          if (p.trim()) b.parrafo([p.replace(/\s*\n\s*/g, ' ').trim()], { despues: 4 });
        });
        b.parrafo([d.despedida || 'Atentamente,'], { despues: 2 });
        b.firmas([{ nombre: d.firmante, cargo: (d.firmante_cargo || '') + ' · Fundación Cedine' }]);
        if (d.anexos) b.parrafo([{ t: 'Anexos: ', b: true }, d.anexos], { pt: 9, despues: 1 });
        if (d.proyecto) b.parrafo([{ t: 'Proyectó: ', b: true }, d.proyecto], { pt: 9, despues: 1 });
      }
    },

    // -----------------------------------------------------------------------
    'REG-001': {
      icono: '📋',
      resumen: 'Registro de asistencia a jornadas, terapias o actividades (para imprimir y firmar).',
      titulo: function (d) { return 'Registro — ' + (d.actividad || ''); },
      campos: [
        { id: 'titulo_registro', etiqueta: 'Título del registro', tipo: 'text', req: true, defecto: 'REGISTRO DE ASISTENCIA' },
        { id: 'actividad', etiqueta: 'Actividad / terapia / jornada', tipo: 'text', req: true },
        { id: 'lugar', etiqueta: 'Lugar', tipo: 'text', req: true },
        { id: 'fecha', etiqueta: 'Fecha', tipo: 'date', req: true, defecto: hoy },
        { id: 'responsable', etiqueta: 'Responsable', tipo: 'text', req: true },
        { id: 'filas_vacias', etiqueta: 'Filas en blanco adicionales', tipo: 'number', defecto: 15 },
        { id: 'participantes', etiqueta: 'Participantes ya conocidos (opcional)', tipo: 'items',
          columnas: [{ id: 'nombre', etiqueta: 'Nombre', ancho: 0.5 }, { id: 'documento', etiqueta: 'Documento', ancho: 0.3 }] }
      ],
      dibujar: function (b, d, u) {
        var f = u.fechaLarga(d.fecha);
        b.titulo(String(d.titulo_registro || 'REGISTRO').toUpperCase(), { pt: 14 });
        b.campos([['Actividad', d.actividad], ['Lugar', d.lugar], ['Fecha', f.texto], ['Responsable', d.responsable]]);
        b.parrafo(['Los datos de este registro se tratan conforme a la Política de Tratamiento de Datos Personales (POL-001) de la fundación.'], { pt: 8.5, despues: 3 });
        var filas = (d.participantes || []).filter(function (p) { return p.nombre; }).map(function (p, i) { return [String(i + 1), p.nombre, p.documento || '', '', '']; });
        var extra = Math.max(0, Math.min(60, parseInt(d.filas_vacias, 10) || 0));
        for (var i = 0; i < extra; i++) filas.push([String(filas.length + 1), '', '', '', '']);
        b.tabla(['N°', 'Nombre completo', 'Documento', 'Firma', 'Observaciones'], filas, [0.06, 0.36, 0.18, 0.2, 0.2], { altoMin: 8.5 });
        b.firmas([{ nombre: d.responsable, cargo: 'Responsable de la actividad' }]);
      }
    },

    // -----------------------------------------------------------------------
    'CER-001': {
      icono: '🏅',
      resumen: 'Certificado de participación en actividades o programas (no cursos). Para cursos usa el módulo Certificados.',
      titulo: function (d) { return 'Certificado de participación — ' + (d.nombre || ''); },
      horizontal: true,
      campos: [
        { id: 'nombre', etiqueta: 'Nombre completo', tipo: 'text', req: true },
        { id: 'tipo_documento', etiqueta: 'Tipo de documento', tipo: 'select', opciones: ['CC', 'TI', 'CE', 'PA', 'PPT', 'RC'], defecto: 'CC' },
        { id: 'documento', etiqueta: 'Número de documento', tipo: 'text', req: true },
        { id: 'actividad', etiqueta: 'Actividad o programa', tipo: 'text', req: true },
        { id: 'lugar', etiqueta: 'Lugar', tipo: 'text', defecto: 'Bogotá D.C.' },
        { id: 'horas', etiqueta: 'Intensidad (horas)', tipo: 'number' },
        { id: 'fecha_actividad', etiqueta: 'Fecha de la actividad', tipo: 'date', req: true, defecto: hoy },
        { id: 'fecha', etiqueta: 'Fecha de expedición', tipo: 'date', req: true, defecto: hoy }
      ]
      // Se genera con el mismo diseño de los certificados de cursos (CedineCertificado).
    }
  };

  window.CedineFormatos = FORMATOS;
})();
