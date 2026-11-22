/*!
 * Fundación CEDINE · Panel de administración
 * Login (con verificación en dos pasos), certificados, documentos ISO, listado maestro,
 * usuarios y auditoría. Los permisos reales los aplica la base de datos (RLS);
 * la interfaz solo oculta lo que cada rol no puede hacer.
 */
(function () {
  'use strict';

  // ===========================================================================
  // Configuración (la llave publicable es pública por diseño; la secreta vive en Cloudflare)
  // ===========================================================================
  var SUPABASE_URL = 'https://sjfoivxzmaxaevsvjqcv.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_ateiww11CKWirRw0Vamh8g_wOf1vvAB';
  var MINUTOS_INACTIVIDAD = 30;
  var POR_PAGINA = 25;

  var ROLES = {
    administrador: { nombre: 'Administrador', chip: 'chip-naranja', desc: 'Todo, incluidos usuarios y auditoría' },
    coordinador: { nombre: 'Coordinador académico', chip: 'chip-azul', desc: 'Certificados de cursos' },
    secretaria: { nombre: 'Secretaría', chip: 'chip-verde', desc: 'Diligenciar y emitir documentos' },
    consulta: { nombre: 'Consulta', chip: 'chip-gris', desc: 'Solo lectura' },
    estudiante: { nombre: 'Estudiante', chip: 'chip-gris', desc: 'Solo ve y descarga sus propios certificados' }
  };
  var ROLES_PERSONAL = ['administrador', 'coordinador', 'secretaria', 'consulta'];
  var PERMISOS = {
    'cert.editar': ['administrador', 'coordinador'],
    'cert.reactivar': ['administrador'],
    'doc.emitir': ['administrador', 'coordinador', 'secretaria'],
    'maestro.editar': ['administrador'],
    'usuarios': ['administrador'],
    'auditoria': ['administrador'],
    'mensajes': ['administrador', 'secretaria'],
    'galeria': ['administrador'],
    'historias': ['administrador'],
    'personal': ['administrador', 'coordinador', 'secretaria', 'consulta'],
    'estudiante': ['estudiante']
  };

  // Se captura antes de crear el cliente, porque el cliente limpia la URL al leer la sesión
  var ES_RECUPERACION = /type=recovery/.test(location.hash) || /type=recovery/.test(location.search);

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'cedine-admin' }
  });

  var S = { sesion: null, perfil: null, vista: 'inicio', personal: {}, columnas: null, cursos: [] };
  var $app = document.getElementById('app');

  // ===========================================================================
  // Utilidades
  // ===========================================================================
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function puede(accion) { return !!(S.perfil && (PERMISOS[accion] || []).indexOf(S.perfil.rol) !== -1); }
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }
  function hoyISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function fechaHora(v) {
    if (!v) return '—';
    try { return new Date(v).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }); }
    catch (e) { return v; }
  }
  function isoADmy(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); }
  function dmyAIso(v) {
    var s = String(v || '').trim(), m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : '';
  }
  function miles(d) { return String(d).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function errorTexto(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || String(e || 'Error');
    if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para esta acción.';
    if (/duplicate key|23505/i.test(m)) return 'Ya existe un registro con ese código.';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/Email not confirmed/i.test(m)) return 'El correo aún no está confirmado.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet.';
    return m;
  }
  function toast(msg, tipo) {
    var t = document.createElement('div');
    t.className = 'toast toast-' + (tipo || 'info');
    t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, tipo === 'error' ? 7000 : 4000);
  }
  function ocupado(btn, si, texto) {
    if (!btn) return;
    if (si) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="cargando"></span> ' + esc(texto || 'Procesando...'); }
    else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
  }
  function descargarBlob(blob, nombre) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function passwordTemporal() {
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ', a = 'abcdefghijkmnopqrstuvwxyz', n = '23456789', s = '!@#$%*?';
    var all = A + a + n, arr = new Uint32Array(14); crypto.getRandomValues(arr);
    var p = A[arr[0] % A.length] + a[arr[1] % a.length] + n[arr[2] % n.length] + s[arr[3] % s.length];
    for (var i = 4; i < 14; i++) p += all[arr[i] % all.length];
    return p.split('').sort(function () { return 0.5 - Math.random(); }).join('');
  }
  function csvDescargar(filas, nombre) {
    var txt = '﻿' + filas.map(function (f) {
      return f.map(function (c) { var s = String(c == null ? '' : c); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';');
    }).join('\r\n');
    descargarBlob(new Blob([txt], { type: 'text/csv;charset=utf-8' }), nombre);
  }

  // ---------------------------------------------------------------------------
  // Modal genérico. Devuelve { el, cerrar }. onListo(el) se llama al montar.
  // ---------------------------------------------------------------------------
  function modal(titulo, cuerpoHtml, opciones) {
    opciones = opciones || {};
    var previo = document.activeElement;
    var fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = '<div class="modal ' + (opciones.ancho ? 'ancho' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">' +
      '<div class="flex items-center justify-between px-6 pt-5 pb-3"><h2 id="modal-titulo" class="font-display font-bold text-xl text-cedine-blue">' + esc(titulo) + '</h2>' +
      '<button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">✕</button></div>' +
      '<div class="px-6 pb-6">' + cuerpoHtml + '</div></div>';
    document.body.appendChild(fondo);
    function cerrar() { fondo.remove(); document.removeEventListener('keydown', tecla); if (opciones.alCerrar) opciones.alCerrar(); if (previo && previo.focus) previo.focus(); }
    function tecla(e) { if (e.key === 'Escape') cerrar(); }
    document.addEventListener('keydown', tecla);
    fondo.addEventListener('click', function (e) { if (e.target === fondo || e.target.closest('[data-cerrar]')) cerrar(); });
    var foco = fondo.querySelector('input:not([readonly]),select,textarea,button.btn');
    if (foco) setTimeout(function () { foco.focus(); }, 30);
    return { el: fondo, cerrar: cerrar };
  }
  function confirmar(titulo, mensajeHtml, textoBoton, conMotivo) {
    return new Promise(function (resolve) {
      var m = modal(titulo, '<div class="text-sm text-slate-700 space-y-2">' + mensajeHtml + '</div>' +
        (conMotivo ? '<label class="etiqueta req mt-4" for="motivo">Motivo</label><textarea id="motivo" class="input" rows="3" maxlength="500"></textarea>' : '') +
        '<div class="flex justify-end gap-2 mt-6"><button class="btn btn-secundario" data-cerrar>Cancelar</button>' +
        '<button class="btn ' + (conMotivo ? 'btn-peligro' : 'btn-primario') + '" id="ok">' + esc(textoBoton || 'Aceptar') + '</button></div>',
        { alCerrar: function () { resolve(null); } });
      $('#ok', m.el).addEventListener('click', function () {
        var motivo = conMotivo ? $('#motivo', m.el).value.trim() : true;
        if (conMotivo && motivo.length < 5) { toast('Escribe el motivo (mínimo 5 caracteres).', 'error'); return; }
        resolve(motivo); m.el.remove();
      });
    });
  }

  // ===========================================================================
  // Sesión, inactividad y verificación en dos pasos
  // ===========================================================================
  var temporizador = null;
  function reiniciarInactividad() {
    clearTimeout(temporizador);
    if (!S.sesion) return;
    temporizador = setTimeout(function () {
      toast('Cerramos tu sesión por inactividad.', 'info');
      salir();
    }, MINUTOS_INACTIVIDAD * 60000);
  }
  ['click', 'keydown', 'mousemove', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, function () { if (S.sesion) reiniciarInactividad(); }, { passive: true });
  });

  async function salir() {
    clearTimeout(temporizador);
    try { await sb.auth.signOut(); } catch (e) { /* sin conexión */ }
    S.sesion = null; S.perfil = null; S.vista = 'inicio';
    pantallaLogin();
  }

  async function iniciar() {
    var r = await sb.auth.getSession();
    S.sesion = r.data && r.data.session;
    if (!S.sesion) return pantallaLogin(ES_RECUPERACION ? 'El enlace para recuperar la contraseña venció o ya se usó. Solicita uno nuevo.' : null);
    if (ES_RECUPERACION) return pantallaCambioPassword(false, true);
    await despuesDeLogin();
  }

  async function despuesDeLogin() {
    // ¿Necesita código de verificación en dos pasos?
    try {
      var aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data && aal.data.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') return pantallaCodigoMfa();
    } catch (e) { /* MFA no disponible: continúa */ }

    var u = (await sb.auth.getUser()).data.user;
    var r = await sb.from('perfiles').select('id,nombre,email,rol,activo').eq('id', u.id).maybeSingle();
    if (r.error || !r.data || !r.data.activo) {
      await sb.auth.signOut();
      return pantallaLogin('Tu usuario no tiene acceso al panel o está desactivado. Pide acceso a un administrador.');
    }
    S.perfil = r.data;
    S.usuario = u;
    if (u.user_metadata && u.user_metadata.debe_cambiar_password) return pantallaCambioPassword(true);
    reiniciarInactividad();
    var hash = (location.hash || '').replace('#', '');
    if (/^[a-z]+$/.test(hash)) S.vista = hash;
    render();
  }

  sb.auth.onAuthStateChange(function (evento, sesion) {
    S.sesion = sesion;
    if (evento === 'PASSWORD_RECOVERY' && !ES_RECUPERACION) pantallaCambioPassword(false, true);
    if (evento === 'SIGNED_OUT') { S.perfil = null; }
  });

  // ---------------------------------------------------------------------------
  function marcoAcceso(contenido) {
    return '<div class="franja"></div><main class="min-h-[calc(100vh-5px)] flex items-center justify-center p-4 bg-gradient-to-br from-cedine-cream to-slate-200">' +
      '<div class="tarjeta w-full max-w-md p-8">' +
      '<div class="flex items-center gap-3 mb-6"><img src="/assets/admin/img/isotipo.png" alt="" class="h-12 w-auto">' +
      '<div><p class="font-display font-bold text-cedine-blue text-xl leading-tight">Fundación CEDINE</p>' +
      '<p class="text-xs text-slate-500">Ingreso de estudiantes y personal</p></div></div>' + contenido + '</div></main>';
  }

  function pantallaLogin(aviso) {
    document.title = 'Ingresar | Fundación CEDINE';
    $app.innerHTML = marcoAcceso(
      (aviso ? '<p class="mb-4 text-sm bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3">' + esc(aviso) + '</p>' : '') +
      '<form id="f-login" class="space-y-4" novalidate>' +
      '<div><label class="etiqueta" for="email">Correo</label><input id="email" type="email" autocomplete="username" class="input" required></div>' +
      '<div><label class="etiqueta" for="password">Contraseña</label><input id="password" type="password" autocomplete="current-password" class="input" required></div>' +
      '<button class="btn btn-primario w-full" id="b-login">Ingresar</button>' +
      '<button type="button" class="text-sm text-cedine-blue underline w-full" id="b-olvido">Olvidé mi contraseña</button></form>' +
      '<p class="text-xs text-slate-500 mt-6"><strong>¿Eres estudiante?</strong> Aquí descargas tus certificados. Si aún no tienes cuenta, pídela en <a href="/contacto?tipo=cursos" class="underline text-cedine-blue">Contáctenos</a>.<br>Toda actividad queda registrada (Ley 1581 de 2012).</p>');
    $('#f-login').addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = $('#b-login'); ocupado(b, true, 'Ingresando...');
      var r = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
      ocupado(b, false);
      if (r.error) return toast(errorTexto(r.error), 'error');
      S.sesion = r.data.session;
      despuesDeLogin();
    });
    $('#b-olvido').addEventListener('click', async function () {
      var email = $('#email').value.trim();
      if (!email) return toast('Escribe tu correo arriba y vuelve a hacer clic.', 'info');
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/admin/' });
      if (r.error) return toast(errorTexto(r.error), 'error');
      toast('Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.', 'ok');
    });
    setTimeout(function () { var x = $('#email'); if (x) x.focus(); }, 50);
  }

  async function pantallaCodigoMfa() {
    $app.innerHTML = marcoAcceso('<h1 class="font-display font-bold text-lg text-cedine-blue mb-2">Verificación en dos pasos</h1>' +
      '<p class="text-sm text-slate-600 mb-4">Escribe el código de 6 dígitos de tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator, etc.).</p>' +
      '<form id="f-mfa" class="space-y-4"><input id="codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="input text-center text-2xl tracking-[.5em] font-mono" required>' +
      '<button class="btn btn-primario w-full" id="b-mfa">Verificar</button>' +
      '<button type="button" class="text-sm text-cedine-blue underline w-full" id="b-salir">Cancelar</button></form>');
    $('#b-salir').addEventListener('click', salir);
    $('#f-mfa').addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = $('#b-mfa'); ocupado(b, true, 'Verificando...');
      try {
        var f = await sb.auth.mfa.listFactors();
        var factor = f.data && f.data.totp && f.data.totp.find(function (x) { return x.status === 'verified'; });
        var r = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: $('#codigo').value.trim() });
        if (r.error) throw r.error;
        despuesDeLogin();
      } catch (err) { ocupado(b, false); toast('Código incorrecto o vencido.', 'error'); }
    });
  }

  function reglasPassword(p) {
    if (p.length < 10) return 'Mínimo 10 caracteres.';
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Debe combinar letras y números.';
    return null;
  }

  function pantallaCambioPassword(obligatorio, recuperacion) {
    $app.innerHTML = marcoAcceso('<h1 class="font-display font-bold text-lg text-cedine-blue mb-2">' + (recuperacion ? 'Crea tu nueva contraseña' : 'Cambia tu contraseña temporal') + '</h1>' +
      '<p class="text-sm text-slate-600 mb-4">Mínimo 10 caracteres, combinando letras y números. No la compartas con nadie.</p>' +
      '<form id="f-pass" class="space-y-4"><div><label class="etiqueta" for="p1">Nueva contraseña</label><input id="p1" type="password" autocomplete="new-password" class="input" required></div>' +
      '<div><label class="etiqueta" for="p2">Repítela</label><input id="p2" type="password" autocomplete="new-password" class="input" required></div>' +
      '<button class="btn btn-primario w-full" id="b-pass">Guardar contraseña</button></form>');
    $('#f-pass').addEventListener('submit', async function (e) {
      e.preventDefault();
      var p1 = $('#p1').value, p2 = $('#p2').value, err = reglasPassword(p1);
      if (err) return toast(err, 'error');
      if (p1 !== p2) return toast('Las contraseñas no coinciden.', 'error');
      var b = $('#b-pass'); ocupado(b, true, 'Guardando...');
      var r = await sb.auth.updateUser({ password: p1, data: { debe_cambiar_password: false } });
      ocupado(b, false);
      if (r.error) return toast(errorTexto(r.error), 'error');
      toast('Contraseña actualizada.', 'ok');
      history.replaceState(null, '', '/admin/');
      despuesDeLogin();
    });
  }

  // ===========================================================================
  // Estructura general
  // ===========================================================================
  var MENU = [
    { id: 'miscertificados', texto: 'Mis certificados', icono: '🎓', permiso: 'estudiante' },
    { id: 'inicio', texto: 'Inicio', icono: '🏠', permiso: 'personal' },
    { id: 'certificados', texto: 'Certificados', icono: '🎓', permiso: 'personal' },
    { id: 'documentos', texto: 'Documentos', icono: '📝', permiso: 'personal' },
    { id: 'registro', texto: 'Registro documental', icono: '🗂️', permiso: 'personal' },
    { id: 'mensajes', texto: 'Mensajes', icono: '📬', permiso: 'mensajes' },
    { id: 'galeria', texto: 'Galería y videos', icono: '🖼️', permiso: 'galeria' },
    { id: 'historias', texto: 'Historias', icono: '💛', permiso: 'historias' },
    { id: 'maestro', texto: 'Listado maestro', icono: '📚', permiso: 'personal' },
    { id: 'usuarios', texto: 'Usuarios y roles', icono: '👥', permiso: 'usuarios' },
    { id: 'auditoria', texto: 'Auditoría', icono: '🔎', permiso: 'auditoria' },
    { id: 'cuenta', texto: 'Mi cuenta', icono: '🔐' }
  ];
  var VISTAS = {};

  function render() {
    var item = MENU.find(function (m) { return m.id === S.vista; });
    if (!item || (item.permiso && !puede(item.permiso))) {
      S.vista = S.perfil.rol === 'estudiante' ? 'miscertificados' : 'inicio';
      item = MENU.find(function (m) { return m.id === S.vista; });
    }
    document.title = item.texto + ' | Panel CEDINE';
    if (location.hash !== '#' + S.vista) history.replaceState(null, '', '#' + S.vista);
    var rol = ROLES[S.perfil.rol] || ROLES.consulta;
    $app.innerHTML = '<div class="franja"></div><div class="md:flex min-h-[calc(100vh-5px)]">' +
      '<aside class="md:w-64 bg-cedine-blue text-white md:min-h-full p-4 md:sticky md:top-0 md:h-screen flex flex-col">' +
      '<div class="flex items-center justify-between md:block"><a href="/" class="flex items-center gap-2 mb-0 md:mb-6" title="Ir al sitio web">' +
      '<span class="bg-white rounded-xl p-1.5"><img src="/assets/admin/img/isotipo.png" alt="" class="h-7 w-auto"></span>' +
      '<span class="font-display font-bold text-lg leading-tight">CEDINE<br><span class="text-xs font-sans font-normal text-blue-100">' + (S.perfil.rol === 'estudiante' ? 'Portal del estudiante' : 'Administración') + '</span></span></a>' +
      '<button class="md:hidden btn-icono text-white border-white/40" id="b-menu" aria-expanded="false" aria-controls="menu">☰</button></div>' +
      '<nav id="menu" class="hidden md:block space-y-1 mt-4 md:mt-0 flex-1" aria-label="Menú del panel">' +
      MENU.filter(function (m) { return !m.permiso || puede(m.permiso); }).map(function (m) {
        return '<a href="#' + m.id + '" data-vista="' + m.id + '" class="nav-item ' + (m.id === S.vista ? 'activo' : '') + '"' + (m.id === S.vista ? ' aria-current="page"' : '') + '>' +
          '<span aria-hidden="true">' + m.icono + '</span>' + esc(m.texto) + (m.id === 'mensajes' ? '<span id="badge-mensajes" class="ml-auto hidden chip chip-naranja"></span>' : '') + '</a>';
      }).join('') + '</nav>' +
      '<div class="hidden md:block border-t border-white/15 pt-4 text-sm"><p class="font-semibold truncate" title="' + esc(S.perfil.email) + '">' + esc(S.perfil.nombre || S.perfil.email) + '</p>' +
      '<p class="text-blue-100 text-xs mb-3">' + esc(rol.nombre) + '</p><button class="btn btn-secundario btn-chico w-full" id="b-salir">Cerrar sesión</button></div></aside>' +
      '<main class="flex-1 p-4 md:p-8 min-w-0"><div id="vista" class="max-w-7xl mx-auto"></div></main></div>';
    $('#b-salir').addEventListener('click', salir);
    $('#b-menu').addEventListener('click', function () {
      var n = $('#menu'); n.classList.toggle('hidden'); this.setAttribute('aria-expanded', String(!n.classList.contains('hidden')));
    });
    $$('[data-vista]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); S.vista = a.dataset.vista; render(); });
    });
    actualizarBadgeMensajes();
    var cont = $('#vista');
    cont.innerHTML = '<p class="text-slate-500 flex items-center gap-2"><span class="cargando"></span> Cargando...</p>';
    Promise.resolve(VISTAS[S.vista](cont)).catch(function (e) {
      console.error(e);
      cont.innerHTML = '<div class="tarjeta p-6 text-red-800">No se pudo cargar esta sección: ' + esc(errorTexto(e)) + '</div>';
    });
  }
  window.addEventListener('hashchange', function () {
    var v = location.hash.replace('#', '');
    if (S.perfil && v && v !== S.vista) { S.vista = v; render(); }
  });

  function encabezado(titulo, subtitulo, acciones) {
    return '<div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"><div>' +
      '<h1 class="font-display font-bold text-2xl md:text-3xl text-cedine-blue">' + esc(titulo) + '</h1>' +
      (subtitulo ? '<p class="text-slate-600 text-sm mt-1">' + subtitulo + '</p>' : '') + '</div>' +
      '<div class="flex flex-wrap gap-2">' + (acciones || '') + '</div></div>';
  }

  async function cargarPersonal() {
    var r = await sb.rpc('nombres_personal');
    if (!r.error) (r.data || []).forEach(function (p) { S.personal[p.id] = p.nombre || p.email; });
  }
  function quien(id) { return id ? (S.personal[id] || 'Usuario') : '—'; }

  // ===========================================================================
  // INICIO
  // ===========================================================================
  VISTAS.inicio = async function (c) {
    var inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    var q = await Promise.all([
      sb.from('certificados').select('codigo_verificacion', { count: 'exact', head: true }).eq('estado', 'activo'),
      sb.from('certificados').select('codigo_verificacion', { count: 'exact', head: true }).eq('estado', 'anulado'),
      sb.from('documentos').select('id', { count: 'exact', head: true }),
      sb.from('documentos').select('id', { count: 'exact', head: true }).gte('creado_en', inicioMes.toISOString()),
      sb.from('documentos').select('consecutivo,titulo,creado_en,estado').order('creado_en', { ascending: false }).limit(6)
    ]);
    var n = function (i) { return q[i].error ? '—' : (q[i].count || 0).toLocaleString('es-CO'); };
    var tarjeta = function (t, v, color, vista) {
      return '<a href="#' + vista + '" data-ir="' + vista + '" class="tarjeta p-5 block hover:shadow-md transition"><p class="text-sm text-slate-500">' + t + '</p>' +
        '<p class="font-display font-bold text-3xl mt-1" style="color:' + color + '">' + v + '</p></a>';
    };
    var docs = (q[4].data || []);
    c.innerHTML = encabezado('Hola, ' + (S.perfil.nombre || '').split(' ')[0], 'Rol: <strong>' + esc(ROLES[S.perfil.rol].nombre) + '</strong> · ' + esc(ROLES[S.perfil.rol].desc)) +
      '<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">' +
      tarjeta('Certificados activos', n(0), '#1C4B7C', 'certificados') + tarjeta('Certificados anulados', n(1), '#B85400', 'certificados') +
      tarjeta('Documentos emitidos', n(2), '#3D6B1E', 'registro') + tarjeta('Documentos este mes', n(3), '#1C4B7C', 'registro') + '</div>' +
      (puede('mensajes') ? '<a href="#mensajes" data-ir="mensajes" id="aviso-msg" class="hidden tarjeta p-4 mb-6 flex items-center gap-3 border-l-4 border-l-[#B85400] hover:shadow-md"><span class="text-2xl" aria-hidden="true">📬</span><span class="font-semibold text-cedine-blue" id="aviso-msg-txt"></span></a>' : '') +
      '<div class="grid lg:grid-cols-2 gap-6">' +
      '<section class="tarjeta p-6"><h2 class="font-display font-bold text-lg text-cedine-blue mb-4">Accesos rápidos</h2><div class="flex flex-wrap gap-2">' +
      (puede('cert.editar') ? '<a class="btn btn-primario" href="#certificados" data-ir="certificados" data-accion="nuevo-cert">+ Nuevo certificado</a>' : '') +
      (puede('doc.emitir') ? '<a class="btn btn-secundario" href="#documentos" data-ir="documentos">Diligenciar documento</a>' : '') +
      '<a class="btn btn-secundario" href="/verificacion" target="_blank" rel="noopener">Ver página pública de verificación ↗</a></div>' +
      '<div class="mt-6 text-sm text-slate-600 bg-slate-50 rounded-xl p-4"><p class="font-semibold text-cedine-blue mb-1">Recuerda</p>' +
      '<ul class="list-disc pl-5 space-y-1"><li>Los certificados y documentos no se borran: se <strong>anulan</strong> con un motivo.</li>' +
      '<li>Antes de publicar fotos, verifica que exista la autorización <strong>AUT-001</strong> firmada.</li>' +
      '<li>Activa la verificación en dos pasos en <a href="#cuenta" data-ir="cuenta" class="underline">Mi cuenta</a>.</li></ul></div></section>' +
      '<section class="tarjeta p-6"><h2 class="font-display font-bold text-lg text-cedine-blue mb-4">Últimos documentos</h2>' +
      (docs.length ? '<ul class="divide-y">' + docs.map(function (d) {
        return '<li class="py-2 flex justify-between gap-3 text-sm"><span><span class="font-mono text-xs text-cedine-blue">' + esc(d.consecutivo) + '</span><br>' + esc(d.titulo) + '</span>' +
          '<span class="text-right text-slate-500 text-xs">' + fechaHora(d.creado_en) + (d.estado === 'anulado' ? '<br><span class="chip chip-rojo">Anulado</span>' : '') + '</span></li>';
      }).join('') + '</ul>' : '<p class="text-sm text-slate-500">Aún no hay documentos emitidos.</p>') + '</section></div>';
    $$('[data-ir]', c).forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault(); S.vista = a.dataset.ir; S.accionPendiente = a.dataset.accion || null; render();
      });
    });
    if (puede('mensajes')) {
      var rm = await sb.from('contactos').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo');
      if (!rm.error && rm.count) { $('#aviso-msg-txt').textContent = 'Tienes ' + rm.count + ' mensaje(s) nuevo(s) de personas que quieren apoyar.'; $('#aviso-msg').classList.remove('hidden'); }
    }
  };

  // ===========================================================================
  // CERTIFICADOS
  // ===========================================================================
  var filtroCert = { q: '', estado: 'activo', pagina: 0 };

  async function columnasCert() {
    if (S.columnas) return S.columnas;
    var r = await sb.rpc('columnas_certificados');
    var mapa = {};
    (r.data || []).forEach(function (c) { mapa[c.columna] = c; });
    S.columnas = mapa;
    return mapa;
  }
  function esFechaReal(col) { return col && /date|timestamp/.test(col.tipo); }
  function esNumero(col) { return col && /int|numeric|real|double/.test(col.tipo); }

  async function cargarCursos() {
    var r = await sb.from('certificados').select('curso').limit(2000);
    var set = {};
    (r.data || []).forEach(function (x) { if (x.curso) set[x.curso] = 1; });
    ['Manejo Defensivo', 'Primeros Auxilios', 'Mecánica Básica', 'Seguridad Industrial', 'Manejo de Extintores y Control de Incendios',
      'Seguridad Vial', 'Normas de Tránsito', 'Alistamiento Vehicular', 'Curso Básico en Alturas'].forEach(function (c) { set[c] = set[c] || 1; });
    S.cursos = Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }

  function patronBusqueda(q) {
    var limpio = q.replace(/[%,()*\\]/g, ' ').trim();
    if (!limpio) return null;
    var partes = ['nombre_completo.ilike.%' + limpio + '%', 'codigo_verificacion.ilike.%' + limpio + '%', 'curso.ilike.%' + limpio + '%',
      'identificacion.ilike.%' + limpio + '%'];
    var dig = limpio.replace(/\D/g, '');
    if (dig.length >= 5 && dig === limpio.replace(/[.\s]/g, '')) partes.push('identificacion.ilike.%' + miles(dig) + '%');
    return partes.join(',');
  }

  VISTAS.certificados = async function (c) {
    await Promise.all([columnasCert(), cargarPersonal()]);
    c.innerHTML = encabezado('Certificados de cursos', 'Los certificados activos aparecen en <a class="underline" href="/verificacion" target="_blank" rel="noopener">/verificacion</a>. Los anulados dejan de aparecer, pero se conservan.',
      (puede('cert.editar') ? '<button class="btn btn-primario" id="b-nuevo">+ Nuevo certificado</button><button class="btn btn-secundario" id="b-masiva">Carga masiva</button>' : '') +
      '<button class="btn btn-secundario" id="b-export">Exportar CSV</button>') +
      '<div class="tarjeta p-4 mb-4 flex flex-col md:flex-row gap-3">' +
      '<label class="sr-only" for="q">Buscar</label><input id="q" class="input md:flex-1" placeholder="Buscar por nombre, cédula, código o curso" value="' + esc(filtroCert.q) + '">' +
      '<label class="sr-only" for="estado">Estado</label><select id="estado" class="input md:w-48"><option value="activo">Activos</option><option value="anulado">Anulados</option><option value="todos">Todos</option></select></div>' +
      '<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Código</th><th>Nombre</th><th>Identificación</th><th>Curso</th><th>Horas</th><th>Fecha</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead>' +
      '<tbody id="filas"><tr><td colspan="8" class="text-center text-slate-500 py-8"><span class="cargando"></span></td></tr></tbody></table></div>' +
      '<div class="flex items-center justify-between mt-4 text-sm" id="paginador"></div>';
    $('#estado').value = filtroCert.estado;
    var t = null;
    $('#q').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { filtroCert.q = v; filtroCert.pagina = 0; listarCert(); }, 350); });
    $('#estado').addEventListener('change', function () { filtroCert.estado = this.value; filtroCert.pagina = 0; listarCert(); });
    if ($('#b-nuevo')) $('#b-nuevo').addEventListener('click', function () { formCert(null); });
    if ($('#b-masiva')) $('#b-masiva').addEventListener('click', cargaMasiva);
    $('#b-export').addEventListener('click', exportarCert);
    await listarCert();
    if (S.accionPendiente === 'nuevo-cert' && puede('cert.editar')) { S.accionPendiente = null; formCert(null); }
  };

  function consultaCert(sel, opciones) {
    var q = sb.from('certificados').select(sel, opciones);
    if (filtroCert.estado !== 'todos') q = q.eq('estado', filtroCert.estado);
    var p = patronBusqueda(filtroCert.q);
    if (p) q = q.or(p);
    return q;
  }

  async function listarCert() {
    var desde = filtroCert.pagina * POR_PAGINA;
    var r = await consultaCert('*', { count: 'exact' }).order('creado_en', { ascending: false, nullsFirst: false })
      .order('codigo_verificacion', { ascending: false }).range(desde, desde + POR_PAGINA - 1);
    var tb = $('#filas'); if (!tb) return;
    if (r.error) { tb.innerHTML = '<tr><td colspan="8" class="text-red-700 p-4">' + esc(errorTexto(r.error)) + '</td></tr>'; return; }
    S.certPagina = r.data || [];
    if (!S.certPagina.length) { tb.innerHTML = '<tr><td colspan="8" class="text-center text-slate-500 py-8">No hay certificados con ese filtro.</td></tr>'; }
    else tb.innerHTML = S.certPagina.map(function (x, i) {
      var anulado = x.estado === 'anulado';
      return '<tr class="' + (anulado ? 'anulado' : '') + '"><td class="font-mono text-xs whitespace-nowrap"><span class="tachar">' + esc(x.codigo_verificacion) + '</span></td>' +
        '<td class="font-semibold">' + esc(x.nombre_completo) + '</td><td class="whitespace-nowrap">' + esc(x.identificacion) + '</td><td>' + esc(x.curso) + '</td>' +
        '<td class="whitespace-nowrap">' + esc(window.CedineCertificado.normalizarIntensidad(x.intensidad_horaria)) + '</td>' +
        '<td class="whitespace-nowrap">' + esc(window.CedineCertificado.fechaLegible(x.fecha_realizacion)) + '</td>' +
        '<td>' + (anulado ? '<span class="chip chip-rojo" title="' + esc(x.motivo_anulacion) + '">Anulado</span>' : '<span class="chip chip-verde">Activo</span>') + '</td>' +
        '<td class="text-right whitespace-nowrap"><button class="btn-icono" data-pdf="' + i + '" title="Descargar PDF" aria-label="Descargar PDF de ' + esc(x.nombre_completo) + '">⬇️</button> ' +
        '<button class="btn-icono" data-ver="' + i + '" title="Ver detalle" aria-label="Ver detalle">👁️</button> ' +
        (puede('cert.editar') && !anulado ? '<button class="btn-icono" data-editar="' + i + '" title="Editar" aria-label="Editar">✏️</button> <button class="btn-icono" data-anular="' + i + '" title="Anular" aria-label="Anular">🚫</button>' : '') +
        (puede('cert.reactivar') && anulado ? '<button class="btn-icono" data-reactivar="' + i + '" title="Reactivar" aria-label="Reactivar">♻️</button>' : '') +
        (puede('usuarios') && !anulado ? ' <button class="btn-icono" data-acceso="' + i + '" title="Crear cuenta de estudiante" aria-label="Crear cuenta de estudiante para ' + esc(x.nombre_completo) + '">🔑</button>' : '') + '</td></tr>';
    }).join('');
    var total = r.count || 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    $('#paginador').innerHTML = '<span class="text-slate-600">' + total.toLocaleString('es-CO') + ' certificado(s) · página ' + (filtroCert.pagina + 1) + ' de ' + paginas + '</span>' +
      '<span class="flex gap-2"><button class="btn btn-secundario btn-chico" id="pg-ant" ' + (filtroCert.pagina ? '' : 'disabled') + '>← Anterior</button>' +
      '<button class="btn btn-secundario btn-chico" id="pg-sig" ' + (filtroCert.pagina + 1 < paginas ? '' : 'disabled') + '>Siguiente →</button></span>';
    $('#pg-ant').addEventListener('click', function () { filtroCert.pagina--; listarCert(); });
    $('#pg-sig').addEventListener('click', function () { filtroCert.pagina++; listarCert(); });
    $$('[data-pdf]', tb).forEach(function (b) {
      b.addEventListener('click', async function () {
        ocupado(b, true, '');
        try { await window.CedineCertificado.descargar(S.certPagina[b.dataset.pdf]); } catch (e) { toast(errorTexto(e), 'error'); }
        ocupado(b, false);
      });
    });
    $$('[data-ver]', tb).forEach(function (b) { b.addEventListener('click', function () { verCert(S.certPagina[b.dataset.ver]); }); });
    $$('[data-editar]', tb).forEach(function (b) { b.addEventListener('click', function () { formCert(S.certPagina[b.dataset.editar]); }); });
    $$('[data-anular]', tb).forEach(function (b) { b.addEventListener('click', function () { anularCert(S.certPagina[b.dataset.anular]); }); });
    $$('[data-reactivar]', tb).forEach(function (b) { b.addEventListener('click', function () { reactivarCert(S.certPagina[b.dataset.reactivar]); }); });
    $$('[data-acceso]', tb).forEach(function (b) {
      b.addEventListener('click', function () {
        var x = S.certPagina[b.dataset.acceso];
        nuevoUsuario(null, { rol: 'estudiante', nombre: tituloNombre(x.nombre_completo), documento: partirIdentificacion(x.identificacion).numero });
      });
    });
  }

  function verCert(x) {
    modal('Certificado ' + x.codigo_verificacion, '<dl class="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">' +
      [['Nombre', x.nombre_completo], ['Identificación', x.identificacion], ['Curso', x.curso], ['Intensidad', window.CedineCertificado.normalizarIntensidad(x.intensidad_horaria)],
        ['Fecha', window.CedineCertificado.fechaLegible(x.fecha_realizacion)], ['Estado', x.estado], ['Motivo de anulación', x.motivo_anulacion],
        ['Creado por', quien(x.creado_por)], ['Creado el', fechaHora(x.creado_en)], ['Última modificación', x.actualizado_en ? fechaHora(x.actualizado_en) + ' · ' + quien(x.actualizado_por) : '—']]
        .map(function (p) { return '<dt class="font-semibold text-cedine-blue">' + esc(p[0]) + '</dt><dd class="col-span-2">' + esc(p[1] || '—') + '</dd>'; }).join('') + '</dl>');
  }

  // Código con el mismo patrón de los certificados existentes: ddmmaaaa-mm-#########NNN
  async function generarCodigo(fechaIso) {
    var m = fechaIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var base = m[3] + m[2] + m[1] + '-' + m[2] + '-';
    var r = await sb.from('certificados').select('codigo_verificacion').order('creado_en', { ascending: false, nullsFirst: false }).limit(200);
    var max = 0;
    (r.data || []).forEach(function (x) { var d = String(x.codigo_verificacion || '').match(/(\d{3})$/); if (d) max = Math.max(max, +d[1]); });
    var rnd = new Uint32Array(3); crypto.getRandomValues(rnd);
    var nueve = String(rnd[0] % 1000).padStart(3, '0') + String(rnd[1] % 1000).padStart(3, '0') + String(rnd[2] % 1000).padStart(3, '0');
    return base + nueve + String((max + 1) % 1000).padStart(3, '0');
  }

  function partirIdentificacion(v) {
    var s = String(v || '').trim(), m = s.match(/^(.*?)\s+de\s+(.+)$/i);
    return { numero: (m ? m[1] : s).replace(/[^\dA-Za-z]/g, ''), lugar: m ? m[2].replace(/\.$/, '') : 'Bogotá' };
  }
  function tituloNombre(v) {
    return String(v || '').toLowerCase().replace(/(^|\s)(\S)/g, function (m, e, l) { return e + l.toUpperCase(); });
  }
  function horasNumero(v) { var m = String(v || '').match(/\d+(?:[.,]\d+)?/); return m ? m[0].replace(',', '.') : ''; }

  // Arma la fila según el tipo real de cada columna
  function filaCertificado(d) {
    var col = S.columnas || {};
    var numDoc = d.numero.replace(/\D/g, '') === d.numero ? miles(d.numero) : d.numero;
    return {
      nombre_completo: d.nombre.trim().replace(/\s+/g, ' '),
      identificacion: numDoc + (d.lugar ? ' de ' + d.lugar.trim() : ''),
      curso: d.curso.trim().replace(/\s+/g, ' '),
      intensidad_horaria: esNumero(col.intensidad_horaria) ? Number(d.horas) : (d.horas + (String(d.horas) === '1' ? ' hora' : ' horas')),
      fecha_realizacion: esFechaReal(col.fecha_realizacion) ? d.fecha : isoADmy(d.fecha)
    };
  }

  function validarCert(d) {
    if (d.nombre.trim().length < 5) return 'Escribe el nombre completo.';
    if (!/^[\dA-Za-z]{4,15}$/.test(d.numero)) return 'El número de documento no es válido.';
    if (d.curso.trim().length < 3) return 'Escribe el nombre del curso.';
    if (!(Number(d.horas) > 0 && Number(d.horas) <= 2000)) return 'La intensidad debe ser un número de horas.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha)) return 'La fecha no es válida.';
    if (d.fecha > hoyISO()) return 'La fecha de realización no puede ser futura.';
    return null;
  }

  async function formCert(x) {
    if (!S.cursos.length) await cargarCursos();
    var id = x ? partirIdentificacion(x.identificacion) : { numero: '', lugar: 'Bogotá' };
    var m = modal(x ? 'Editar certificado' : 'Nuevo certificado',
      '<form id="f-cert" class="grid sm:grid-cols-2 gap-4" novalidate>' +
      '<div class="sm:col-span-2"><label class="etiqueta req" for="c-nombre">Nombre completo</label><input id="c-nombre" class="input" maxlength="120" value="' + esc(x ? x.nombre_completo : '') + '">' +
      '<p class="ayuda">Tal como debe aparecer en el certificado (nombres y apellidos).</p></div>' +
      '<div><label class="etiqueta req" for="c-num">Número de documento</label><input id="c-num" class="input" inputmode="numeric" maxlength="15" value="' + esc(id.numero) + '"></div>' +
      '<div><label class="etiqueta" for="c-lugar">Lugar de expedición</label><input id="c-lugar" class="input" maxlength="40" value="' + esc(id.lugar) + '"></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta req" for="c-curso">Curso</label><input id="c-curso" class="input" list="lista-cursos" maxlength="120" value="' + esc(x ? x.curso : '') + '">' +
      '<datalist id="lista-cursos">' + S.cursos.map(function (cu) { return '<option value="' + esc(cu) + '">'; }).join('') + '</datalist>' +
      '<p class="ayuda">Usa siempre el mismo nombre para el mismo curso. Ej.: "Curso Básico en Alturas".</p></div>' +
      '<div><label class="etiqueta req" for="c-horas">Intensidad (horas)</label><input id="c-horas" type="number" min="1" max="2000" class="input" value="' + esc(x ? horasNumero(x.intensidad_horaria) : '') + '"></div>' +
      '<div><label class="etiqueta req" for="c-fecha">Fecha de realización</label><input id="c-fecha" type="date" class="input" max="' + hoyISO() + '" value="' + esc(x ? dmyAIso(x.fecha_realizacion) : hoyISO()) + '"></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta" for="c-codigo">Código de aprobación</label><input id="c-codigo" class="input font-mono" readonly value="' + esc(x ? x.codigo_verificacion : 'Se genera al guardar') + '">' +
      (x ? '<p class="ayuda">El código no se puede cambiar: identifica al certificado (ISO 15489).</p>' : '') + '</div>' +
      '<div class="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button>' +
      '<button type="button" class="btn btn-secundario" id="c-vista">Vista previa PDF</button>' +
      '<button class="btn btn-primario" id="c-guardar">' + (x ? 'Guardar cambios' : 'Crear certificado') + '</button></div></form>');
    function datos() {
      return { nombre: $('#c-nombre', m.el).value, numero: $('#c-num', m.el).value.replace(/[.\s]/g, ''), lugar: $('#c-lugar', m.el).value,
        curso: $('#c-curso', m.el).value, horas: $('#c-horas', m.el).value, fecha: $('#c-fecha', m.el).value };
    }
    $('#c-vista', m.el).addEventListener('click', async function () {
      var d = datos(), err = validarCert(d); if (err) return toast(err, 'error');
      var fila = filaCertificado(d); fila.codigo_verificacion = x ? x.codigo_verificacion : 'VISTA-PREVIA';
      vistaPreviaBlob(await window.CedineCertificado.generarBlob(fila), 'Vista previa del certificado');
    });
    $('#f-cert', m.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var d = datos(), err = validarCert(d); if (err) return toast(err, 'error');
      var b = $('#c-guardar', m.el); ocupado(b, true, 'Guardando...');
      try {
        var fila = filaCertificado(d), r;
        if (x) {
          r = await sb.from('certificados').update(fila).eq('codigo_verificacion', x.codigo_verificacion).select();
          if (!r.error && (!r.data || !r.data.length)) throw new Error('No tienes permiso para esta acción.');
        } else {
          for (var intento = 0; intento < 4; intento++) {
            fila.codigo_verificacion = await generarCodigo(d.fecha);
            r = await sb.from('certificados').insert(fila).select();
            if (!r.error || !/duplicate|23505/.test(r.error.message + r.error.code)) break;
          }
        }
        if (r.error) throw r.error;
        m.cerrar();
        toast(x ? 'Certificado actualizado.' : 'Certificado creado: ' + fila.codigo_verificacion, 'ok');
        if (!x && S.cursos.indexOf(fila.curso) === -1) S.cursos.push(fila.curso);
        listarCert();
      } catch (er) { ocupado(b, false); toast(errorTexto(er), 'error'); }
    });
  }

  async function anularCert(x) {
    var motivo = await confirmar('Anular certificado', '<p>Vas a anular el certificado <strong class="font-mono">' + esc(x.codigo_verificacion) + '</strong> de <strong>' + esc(x.nombre_completo) + '</strong>.</p>' +
      '<p>Dejará de aparecer en la verificación pública, pero se conservará en el sistema. Si fue un error de datos, después crea uno nuevo correcto.</p>', 'Anular certificado', true);
    if (!motivo) return;
    var r = await sb.from('certificados').update({ estado: 'anulado', motivo_anulacion: motivo }).eq('codigo_verificacion', x.codigo_verificacion).select();
    if (r.error || !r.data.length) return toast(errorTexto(r.error || 'No tienes permiso para esta acción.'), 'error');
    toast('Certificado anulado.', 'ok'); listarCert();
  }
  async function reactivarCert(x) {
    if (!(await confirmar('Reactivar certificado', '<p>El certificado <strong class="font-mono">' + esc(x.codigo_verificacion) + '</strong> volverá a aparecer en la verificación pública.</p>', 'Reactivar'))) return;
    var r = await sb.from('certificados').update({ estado: 'activo', motivo_anulacion: null }).eq('codigo_verificacion', x.codigo_verificacion).select();
    if (r.error || !r.data.length) return toast(errorTexto(r.error || 'No tienes permiso para esta acción.'), 'error');
    toast('Certificado reactivado.', 'ok'); listarCert();
  }

  async function exportarCert() {
    var r = await consultaCert('*').order('creado_en', { ascending: false, nullsFirst: false }).limit(10000);
    if (r.error) return toast(errorTexto(r.error), 'error');
    csvDescargar([['Código', 'Nombre', 'Identificación', 'Curso', 'Intensidad', 'Fecha', 'Estado', 'Motivo anulación', 'Creado']].concat(
      r.data.map(function (x) {
        return [x.codigo_verificacion, x.nombre_completo, x.identificacion, x.curso, x.intensidad_horaria, x.fecha_realizacion, x.estado, x.motivo_anulacion, x.creado_en];
      })), 'certificados-cedine-' + hoyISO() + '.csv');
    toast('Exportados ' + r.data.length + ' certificados. El archivo contiene datos personales: guárdalo de forma segura.', 'info');
  }

  // ---------------------------------------------------------------------------
  // Carga masiva (pegar desde Excel o subir CSV)
  // ---------------------------------------------------------------------------
  function parsearTabla(texto) {
    var lineas = texto.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    if (!lineas.length) return [];
    var sep = lineas[0].indexOf('\t') !== -1 ? '\t' : (lineas[0].split(';').length >= lineas[0].split(',').length ? ';' : ',');
    function partir(l) {
      var out = [], cur = '', q = false;
      for (var i = 0; i < l.length; i++) {
        var ch = l[i];
        if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
        else if (ch === sep && !q) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out.map(function (s) { return s.trim(); });
    }
    var filas = lineas.map(partir);
    if (/nombre/i.test(filas[0].join(' '))) filas.shift();
    return filas;
  }

  function cargaMasiva() {
    var m = modal('Carga masiva de certificados',
      '<ol class="text-sm text-slate-700 list-decimal pl-5 space-y-1 mb-4"><li>Descarga la <button type="button" class="underline text-cedine-blue" id="cm-plantilla">plantilla CSV</button> y llénala en Excel, o copia las filas desde tu Excel.</li>' +
      '<li>Columnas en este orden: <strong>Nombre completo · Número de documento · Lugar de expedición · Curso · Horas · Fecha (dd/mm/aaaa)</strong>.</li>' +
      '<li>Pega las filas abajo (o sube el CSV), revisa la vista previa y confirma.</li></ol>' +
      '<textarea id="cm-texto" class="input font-mono text-xs" rows="7" placeholder="MARIN AYALA JORGE ENRIQUE	79259617	Bogotá	Curso Básico en Alturas	40	12/08/2026"></textarea>' +
      '<div class="flex flex-wrap gap-2 mt-3"><label class="btn btn-secundario btn-chico cursor-pointer">Subir CSV<input type="file" accept=".csv,.txt" id="cm-archivo" class="sr-only"></label>' +
      '<button class="btn btn-secundario btn-chico" id="cm-revisar">Revisar datos</button></div>' +
      '<div id="cm-preview" class="mt-4"></div>', { ancho: true });
    var filasValidas = [];
    $('#cm-plantilla', m.el).addEventListener('click', function () {
      csvDescargar([['Nombre completo', 'Número de documento', 'Lugar de expedición', 'Curso', 'Horas', 'Fecha (dd/mm/aaaa)'],
        ['MARIN AYALA JORGE ENRIQUE', '79259617', 'Bogotá', 'Curso Básico en Alturas', '40', '12/08/2026']], 'plantilla-carga-certificados.csv');
    });
    $('#cm-archivo', m.el).addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { $('#cm-texto', m.el).value = String(rd.result).replace(/^﻿/, ''); revisar(); };
      rd.readAsText(f, 'utf-8');
    });
    $('#cm-revisar', m.el).addEventListener('click', revisar);
    function revisar() {
      var filas = parsearTabla($('#cm-texto', m.el).value);
      filasValidas = [];
      if (!filas.length) { $('#cm-preview', m.el).innerHTML = '<p class="text-sm text-slate-500">No hay filas para revisar.</p>'; return; }
      if (filas.length > 500) { $('#cm-preview', m.el).innerHTML = '<p class="text-sm text-red-700">Máximo 500 filas por carga.</p>'; return; }
      var html = filas.map(function (f, i) {
        var d = { nombre: f[0] || '', numero: String(f[1] || '').replace(/[.\s]/g, ''), lugar: f[2] || 'Bogotá', curso: f[3] || '', horas: horasNumero(f[4]), fecha: dmyAIso(f[5]) };
        var err = validarCert(d);
        if (!err) filasValidas.push(d);
        return '<tr class="' + (err ? 'bg-red-50' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(d.nombre) + '</td><td>' + esc(d.numero) + '</td><td>' + esc(d.curso) + '</td><td>' + esc(d.horas) + '</td><td>' + esc(isoADmy(d.fecha)) + '</td>' +
          '<td>' + (err ? '<span class="text-red-700 text-xs">' + esc(err) + '</span>' : '<span class="chip chip-verde">OK</span>') + '</td></tr>';
      }).join('');
      $('#cm-preview', m.el).innerHTML = '<div class="max-h-72 overflow-auto rounded-xl border"><table class="tabla"><thead><tr><th>#</th><th>Nombre</th><th>Documento</th><th>Curso</th><th>Horas</th><th>Fecha</th><th>Revisión</th></tr></thead><tbody>' + html + '</tbody></table></div>' +
        '<div class="flex items-center justify-between mt-4"><p class="text-sm">' + filasValidas.length + ' válidas de ' + filas.length + '. Las filas con error no se cargarán.</p>' +
        '<button class="btn btn-primario" id="cm-cargar" ' + (filasValidas.length ? '' : 'disabled') + '>Crear ' + filasValidas.length + ' certificado(s)</button></div><div id="cm-progreso" class="mt-3 text-sm"></div>';
      var bc = $('#cm-cargar', m.el); if (bc) bc.addEventListener('click', cargar);
    }
    async function cargar() {
      var b = $('#cm-cargar', m.el); ocupado(b, true, 'Creando...');
      var resultado = [['Nombre', 'Documento', 'Curso', 'Código', 'Resultado']], ok = 0;
      for (var i = 0; i < filasValidas.length; i++) {
        var d = filasValidas[i], fila = filaCertificado(d), r = null;
        for (var intento = 0; intento < 4; intento++) {
          fila.codigo_verificacion = await generarCodigo(d.fecha);
          r = await sb.from('certificados').insert(fila).select('codigo_verificacion');
          if (!r.error || !/duplicate|23505/.test(r.error.message + r.error.code)) break;
        }
        if (r.error) resultado.push([d.nombre, d.numero, d.curso, '', 'ERROR: ' + errorTexto(r.error)]);
        else { ok++; resultado.push([d.nombre, d.numero, d.curso, fila.codigo_verificacion, 'Creado']); }
        $('#cm-progreso', m.el).textContent = 'Procesados ' + (i + 1) + ' de ' + filasValidas.length + '...';
      }
      $('#cm-progreso', m.el).innerHTML = '<strong>' + ok + ' certificado(s) creados.</strong> <button class="underline text-cedine-blue" id="cm-res">Descargar resultado con los códigos</button>';
      $('#cm-res', m.el).addEventListener('click', function () { csvDescargar(resultado, 'resultado-carga-' + hoyISO() + '.csv'); });
      b.remove();
      toast(ok + ' certificado(s) creados.', ok ? 'ok' : 'error');
      listarCert();
    }
  }

  // ===========================================================================
  // DOCUMENTOS (diligenciar formatos)
  // ===========================================================================
  async function cargarFormatosBD() {
    var r = await sb.from('formatos').select('*').order('codigo');
    if (r.error) throw r.error;
    S.formatosBD = r.data || [];
    return S.formatosBD;
  }

  VISTAS.documentos = async function (c) {
    var bd = await cargarFormatosBD();
    var disponibles = bd.filter(function (f) { return f.generable_en_panel && f.estado === 'vigente' && window.CedineFormatos[f.codigo]; });
    c.innerHTML = encabezado('Diligenciar documentos', 'Cada documento emitido recibe un <strong>consecutivo único</strong>, se guarda en PDF con su huella digital (SHA-256) y queda en el Registro documental.') +
      (puede('doc.emitir') ? '' : '<p class="tarjeta p-4 mb-4 text-sm bg-amber-50">Tu rol es de consulta: puedes generar vistas previas, pero no emitir documentos.</p>') +
      '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">' + disponibles.map(function (f) {
        var def = window.CedineFormatos[f.codigo];
        return '<button class="tarjeta formato-card p-5" data-formato="' + esc(f.codigo) + '"><span class="text-3xl" aria-hidden="true">' + def.icono + '</span>' +
          '<p class="font-mono text-xs text-cedine-orange-dark mt-2">' + esc(f.codigo) + ' · v' + esc(f.version) + '</p>' +
          '<p class="font-display font-bold text-cedine-blue text-lg leading-tight">' + esc(f.nombre) + '</p><p class="text-sm text-slate-600 mt-1">' + esc(def.resumen) + '</p></button>';
      }).join('') + '</div>';
    $$('[data-formato]', c).forEach(function (b) { b.addEventListener('click', function () { formularioDocumento(c, b.dataset.formato); }); });
  };

  function campoHtml(f) {
    var id = 'd-' + f.id, req = f.req ? ' req' : '', def = typeof f.defecto === 'function' ? f.defecto() : f.defecto;
    var ayuda = f.ayuda ? '<p class="ayuda">' + esc(f.ayuda) + '</p>' : '';
    var ancho = (f.tipo === 'textarea' || f.tipo === 'items' || f.tipo === 'checkgroup') ? 'sm:col-span-2' : '';
    if (f.tipo === 'checkbox') {
      return '<div class="sm:col-span-2"><label class="flex items-start gap-2 text-sm"><input type="checkbox" id="' + id + '" class="mt-1 h-4 w-4" ' + (def ? 'checked' : '') + '><span>' + esc(f.etiqueta) + '</span></label>' + ayuda + '</div>';
    }
    if (f.tipo === 'checkgroup') {
      return '<fieldset class="' + ancho + '"><legend class="etiqueta' + req + '">' + esc(f.etiqueta) + '</legend><div class="flex flex-wrap gap-x-5 gap-y-2">' +
        f.opciones.map(function (o, i) {
          return '<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="' + id + '" value="' + esc(o) + '" class="h-4 w-4" ' + ((def || []).indexOf(o) !== -1 ? 'checked' : '') + '>' + esc(o) + '</label>';
        }).join('') + '</div>' + ayuda + '</fieldset>';
    }
    if (f.tipo === 'select') {
      return '<div class="' + ancho + '"><label class="etiqueta' + req + '" for="' + id + '">' + esc(f.etiqueta) + '</label><select id="' + id + '" class="input">' +
        f.opciones.map(function (o) { return '<option ' + (o === def ? 'selected' : '') + ' value="' + esc(o) + '">' + esc(o || '—') + '</option>'; }).join('') + '</select>' + ayuda + '</div>';
    }
    if (f.tipo === 'textarea') {
      return '<div class="' + ancho + '"><label class="etiqueta' + req + '" for="' + id + '">' + esc(f.etiqueta) + '</label><textarea id="' + id + '" class="input" rows="' + (f.filas || 4) + '" maxlength="8000">' + esc(def || '') + '</textarea>' + ayuda + '</div>';
    }
    if (f.tipo === 'items') {
      return '<div class="' + ancho + '"><p class="etiqueta' + req + '">' + esc(f.etiqueta) + '</p><div class="overflow-x-auto"><table class="tabla items-tabla" data-items="' + f.id + '"><thead><tr>' +
        f.columnas.map(function (col) { return '<th>' + esc(col.etiqueta) + '</th>'; }).join('') + '<th></th></tr></thead><tbody></tbody></table></div>' +
        '<button type="button" class="btn btn-secundario btn-chico mt-2" data-agregar="' + f.id + '">+ Agregar fila</button>' + ayuda + '</div>';
    }
    var tipo = { email: 'email', number: 'number', date: 'date' }[f.tipo] || 'text';
    return '<div class="' + ancho + '"><label class="etiqueta' + req + '" for="' + id + '">' + esc(f.etiqueta) + '</label><input id="' + id + '" type="' + tipo + '" class="input" maxlength="300" value="' + esc(def == null ? '' : def) + '">' + ayuda + '</div>';
  }

  function filaItems(f, valores) {
    valores = valores || {};
    return '<tr>' + f.columnas.map(function (col) {
      return '<td><input class="input !py-1.5 text-sm" data-col="' + col.id + '" type="' + (col.tipo === 'number' ? 'number' : 'text') + '" aria-label="' + esc(col.etiqueta) + '" value="' + esc(valores[col.id] || '') + '"></td>';
    }).join('') + '<td><button type="button" class="btn-icono" data-quitar aria-label="Quitar fila">✕</button></td></tr>';
  }

  function leerFormulario(def, raiz) {
    var d = {};
    def.campos.forEach(function (f) {
      var id = 'd-' + f.id;
      if (f.tipo === 'checkbox') d[f.id] = $('#' + id, raiz).checked;
      else if (f.tipo === 'checkgroup') d[f.id] = $$('input[name="' + id + '"]:checked', raiz).map(function (x) { return x.value; });
      else if (f.tipo === 'items') {
        d[f.id] = $$('[data-items="' + f.id + '"] tbody tr', raiz).map(function (tr) {
          var o = {}; $$('[data-col]', tr).forEach(function (inp) { o[inp.dataset.col] = inp.value.trim(); }); return o;
        }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
      } else d[f.id] = $('#' + id, raiz).value.trim();
    });
    return d;
  }
  function validarFormulario(def, d) {
    for (var i = 0; i < def.campos.length; i++) {
      var f = def.campos[i], v = d[f.id];
      if (f.req && (v === '' || v == null || (Array.isArray(v) && !v.length))) return 'Completa el campo: ' + f.etiqueta;
      if (f.tipo === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'El correo no es válido: ' + f.etiqueta;
    }
    return def.validar ? def.validar(d) : null;
  }

  function metaFormato(codigo) {
    var f = (S.formatosBD || []).find(function (x) { return x.codigo === codigo; }) || {};
    return { codigo: codigo, nombre: f.nombre || codigo, version: f.version || '01', vigencia: f.vigencia || '' };
  }

  async function construirDocumento(codigo, d, consecutivo) {
    var def = window.CedineFormatos[codigo], meta = metaFormato(codigo);
    meta.consecutivo = consecutivo; meta.borrador = !consecutivo;
    if (codigo === 'CER-001') {
      var fa = window.CedineDocPDF.fechaLarga(d.fecha_actividad);
      return window.CedineCertificado.generarBlob({
        tipo: 'participacion', nombre_completo: d.nombre, tipo_documento: d.tipo_documento, identificacion: d.documento,
        curso: d.actividad, lugar: d.lugar, intensidad_horaria: d.horas, fecha_expedicion: d.fecha,
        fecha_actividad_texto: fa.texto, codigo_verificacion: consecutivo || 'BORRADOR', version_formato: meta.version
      });
    }
    var r = await window.CedineDocPDF.generar(meta, def.dibujar, d);
    return r.blob;
  }

  function vistaPreviaBlob(blob, titulo) {
    var url = URL.createObjectURL(blob);
    modal(titulo || 'Vista previa', '<iframe class="vista-pdf" src="' + url + '" title="Vista previa del PDF"></iframe>' +
      '<p class="ayuda mt-2">Si no ves el documento, <a class="underline" href="' + url + '" target="_blank" rel="noopener">ábrelo en otra pestaña</a>.</p>',
      { ancho: true, alCerrar: function () { setTimeout(function () { URL.revokeObjectURL(url); }, 1000); } });
  }

  function formularioDocumento(c, codigo) {
    var def = window.CedineFormatos[codigo], meta = metaFormato(codigo);
    c.innerHTML = encabezado(meta.nombre, '<span class="font-mono">' + esc(codigo) + ' · Versión ' + esc(meta.version) + '</span> · ' + esc(def.resumen),
      '<button class="btn btn-secundario" id="b-volver">← Volver</button>') +
      '<form id="f-doc" class="tarjeta p-6 grid sm:grid-cols-2 gap-4" novalidate>' + def.campos.map(campoHtml).join('') +
      '<div class="sm:col-span-2 flex flex-wrap justify-end gap-2 pt-4 border-t"><button type="button" class="btn btn-secundario" id="b-previa">Vista previa (borrador)</button>' +
      (puede('doc.emitir') ? '<button class="btn btn-primario" id="b-emitir">Emitir documento</button>' : '') + '</div></form>';
    $('#b-volver').addEventListener('click', function () { VISTAS.documentos(c); });
    def.campos.filter(function (f) { return f.tipo === 'items'; }).forEach(function (f) {
      var tb = $('[data-items="' + f.id + '"] tbody', c);
      var iniciales = f.defecto || [{}];
      tb.innerHTML = iniciales.map(function (v) { return filaItems(f, v); }).join('');
      $('[data-agregar="' + f.id + '"]', c).addEventListener('click', function () { tb.insertAdjacentHTML('beforeend', filaItems(f)); });
      tb.addEventListener('click', function (e) { if (e.target.closest('[data-quitar]')) e.target.closest('tr').remove(); });
    });
    $('#b-previa').addEventListener('click', async function () {
      var d = leerFormulario(def, c), err = validarFormulario(def, d);
      if (err) return toast(err, 'error');
      var b = this; ocupado(b, true, 'Generando...');
      try { vistaPreviaBlob(await construirDocumento(codigo, d, null), 'Vista previa — ' + meta.nombre); } catch (e) { toast(errorTexto(e), 'error'); }
      ocupado(b, false);
    });
    $('#f-doc').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!puede('doc.emitir')) return;
      var d = leerFormulario(def, c), err = validarFormulario(def, d);
      if (err) return toast(err, 'error');
      var ok = await confirmar('Emitir ' + codigo, '<p>Se asignará un <strong>consecutivo único</strong> y el PDF quedará archivado con su huella digital.</p>' +
        '<p>Un documento emitido <strong>no se puede modificar</strong>: si hay un error, deberás anularlo y emitir uno nuevo.</p>', 'Emitir');
      if (!ok) return;
      var b = $('#b-emitir'); ocupado(b, true, 'Emitiendo...');
      try {
        var r = await sb.rpc('siguiente_consecutivo', { p_codigo: codigo });
        if (r.error) throw r.error;
        var consecutivo = r.data;
        var blob = await construirDocumento(codigo, d, consecutivo);
        var hash = await window.CedineDocPDF.sha256(blob);
        var ruta = codigo + '/' + consecutivo.split('-')[2] + '/' + consecutivo + '.pdf';
        var up = await sb.storage.from('documentos').upload(ruta, blob, { contentType: 'application/pdf', upsert: false });
        if (up.error) throw new Error('No se pudo archivar el PDF: ' + errorTexto(up.error));
        var ins = await sb.from('documentos').insert({
          consecutivo: consecutivo, codigo_formato: codigo, version_formato: meta.version,
          titulo: def.titulo(d).slice(0, 200), datos: d, archivo_path: ruta, hash_sha256: hash
        });
        if (ins.error) throw new Error('El PDF se archivó (' + consecutivo + ') pero no se pudo registrar: ' + errorTexto(ins.error));
        descargarBlob(blob, consecutivo + '.pdf');
        toast('Documento emitido: ' + consecutivo, 'ok');
        S.vista = 'registro'; render();
      } catch (er) { ocupado(b, false); toast(errorTexto(er), 'error'); }
    });
  }

  // ===========================================================================
  // REGISTRO DOCUMENTAL
  // ===========================================================================
  var filtroDoc = { codigo: '', q: '', pagina: 0 };
  VISTAS.registro = async function (c) {
    await Promise.all([cargarPersonal(), S.formatosBD ? null : cargarFormatosBD()]);
    c.innerHTML = encabezado('Registro documental', 'Documentos emitidos desde el panel. Integridad verificable con la huella SHA-256 (ISO 15489: autenticidad, integridad y fiabilidad).',
      '<button class="btn btn-secundario" id="b-exp-doc">Exportar CSV</button>') +
      '<div class="tarjeta p-4 mb-4 flex flex-col md:flex-row gap-3"><input id="dq" class="input md:flex-1" placeholder="Buscar por consecutivo o título" aria-label="Buscar" value="' + esc(filtroDoc.q) + '">' +
      '<select id="dc" class="input md:w-64" aria-label="Formato"><option value="">Todos los formatos</option>' +
      (S.formatosBD || []).filter(function (f) { return f.generable_en_panel; }).map(function (f) { return '<option value="' + esc(f.codigo) + '">' + esc(f.codigo + ' · ' + f.nombre) + '</option>'; }).join('') + '</select></div>' +
      '<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Consecutivo</th><th>Título</th><th>Emitido</th><th>Por</th><th>Conservar hasta</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead><tbody id="dfilas"></tbody></table></div>' +
      '<div class="flex items-center justify-between mt-4 text-sm" id="dpag"></div>';
    $('#dc').value = filtroDoc.codigo;
    var t = null;
    $('#dq').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { filtroDoc.q = v; filtroDoc.pagina = 0; listarDocs(); }, 350); });
    $('#dc').addEventListener('change', function () { filtroDoc.codigo = this.value; filtroDoc.pagina = 0; listarDocs(); });
    $('#b-exp-doc').addEventListener('click', async function () {
      var r = await consultaDocs('*').order('creado_en', { ascending: false }).limit(10000);
      if (r.error) return toast(errorTexto(r.error), 'error');
      csvDescargar([['Consecutivo', 'Formato', 'Versión', 'Título', 'Emitido', 'Por', 'Estado', 'Motivo anulación', 'Conservar hasta', 'SHA-256']].concat(r.data.map(function (x) {
        return [x.consecutivo, x.codigo_formato, x.version_formato, x.titulo, x.creado_en, quien(x.creado_por), x.estado, x.motivo_anulacion, x.conservar_hasta, x.hash_sha256];
      })), 'registro-documental-' + hoyISO() + '.csv');
    });
    await listarDocs();
  };
  function consultaDocs(sel, op) {
    var q = sb.from('documentos').select(sel, op);
    if (filtroDoc.codigo) q = q.eq('codigo_formato', filtroDoc.codigo);
    var s = filtroDoc.q.replace(/[%,()*\\]/g, ' ').trim();
    if (s) q = q.or('consecutivo.ilike.%' + s + '%,titulo.ilike.%' + s + '%');
    return q;
  }
  async function listarDocs() {
    var desde = filtroDoc.pagina * POR_PAGINA;
    var r = await consultaDocs('*', { count: 'exact' }).order('creado_en', { ascending: false }).range(desde, desde + POR_PAGINA - 1);
    var tb = $('#dfilas'); if (!tb) return;
    if (r.error) { tb.innerHTML = '<tr><td colspan="7" class="text-red-700 p-4">' + esc(errorTexto(r.error)) + '</td></tr>'; return; }
    S.docsPagina = r.data || [];
    tb.innerHTML = S.docsPagina.length ? S.docsPagina.map(function (x, i) {
      var an = x.estado === 'anulado';
      return '<tr class="' + (an ? 'anulado' : '') + '"><td class="font-mono text-xs whitespace-nowrap"><span class="tachar">' + esc(x.consecutivo) + '</span></td><td>' + esc(x.titulo) + '</td>' +
        '<td class="whitespace-nowrap text-xs">' + fechaHora(x.creado_en) + '</td><td class="text-xs">' + esc(quien(x.creado_por)) + '</td><td class="text-xs whitespace-nowrap">' + esc(x.conservar_hasta || '—') + '</td>' +
        '<td>' + (an ? '<span class="chip chip-rojo" title="' + esc(x.motivo_anulacion) + '">Anulado</span>' : '<span class="chip chip-verde">Vigente</span>') + '</td>' +
        '<td class="text-right whitespace-nowrap"><button class="btn-icono" data-bajar="' + i + '" title="Descargar PDF" aria-label="Descargar PDF">⬇️</button> ' +
        '<button class="btn-icono" data-integridad="' + i + '" title="Verificar integridad" aria-label="Verificar integridad">🛡️</button> ' +
        '<button class="btn-icono" data-datos="' + i + '" title="Ver datos" aria-label="Ver datos">👁️</button> ' +
        (puede('doc.emitir') && !an ? '<button class="btn-icono" data-anular-doc="' + i + '" title="Anular" aria-label="Anular">🚫</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="text-center text-slate-500 py-8">No hay documentos con ese filtro.</td></tr>';
    var total = r.count || 0, paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    $('#dpag').innerHTML = '<span class="text-slate-600">' + total + ' documento(s) · página ' + (filtroDoc.pagina + 1) + ' de ' + paginas + '</span><span class="flex gap-2">' +
      '<button class="btn btn-secundario btn-chico" id="dp-a" ' + (filtroDoc.pagina ? '' : 'disabled') + '>← Anterior</button><button class="btn btn-secundario btn-chico" id="dp-s" ' + (filtroDoc.pagina + 1 < paginas ? '' : 'disabled') + '>Siguiente →</button></span>';
    $('#dp-a').addEventListener('click', function () { filtroDoc.pagina--; listarDocs(); });
    $('#dp-s').addEventListener('click', function () { filtroDoc.pagina++; listarDocs(); });
    $$('[data-bajar]', tb).forEach(function (b) { b.addEventListener('click', function () { bajarDoc(S.docsPagina[b.dataset.bajar], b); }); });
    $$('[data-integridad]', tb).forEach(function (b) { b.addEventListener('click', function () { integridadDoc(S.docsPagina[b.dataset.integridad], b); }); });
    $$('[data-datos]', tb).forEach(function (b) { b.addEventListener('click', function () { datosDoc(S.docsPagina[b.dataset.datos]); }); });
    $$('[data-anular-doc]', tb).forEach(function (b) { b.addEventListener('click', function () { anularDoc(S.docsPagina[b.dataset.anularDoc]); }); });
  }
  async function blobDoc(x) {
    if (!x.archivo_path) throw new Error('Este documento no tiene PDF archivado.');
    var r = await sb.storage.from('documentos').download(x.archivo_path);
    if (r.error) throw r.error;
    return r.data;
  }
  async function bajarDoc(x, b) {
    ocupado(b, true, '');
    try { descargarBlob(await blobDoc(x), x.consecutivo + '.pdf'); } catch (e) { toast(errorTexto(e), 'error'); }
    ocupado(b, false);
  }
  async function integridadDoc(x, b) {
    ocupado(b, true, '');
    try {
      var h = await window.CedineDocPDF.sha256(await blobDoc(x));
      if (h === x.hash_sha256) toast('Íntegro: el PDF archivado de ' + x.consecutivo + ' no ha sido alterado.', 'ok');
      else toast('ALERTA: la huella del PDF de ' + x.consecutivo + ' no coincide con la registrada. Informa al administrador.', 'error');
    } catch (e) { toast(errorTexto(e), 'error'); }
    ocupado(b, false);
  }
  function datosDoc(x) {
    var def = window.CedineFormatos[x.codigo_formato];
    var etiquetas = {}; (def ? def.campos : []).forEach(function (f) { etiquetas[f.id] = f.etiqueta; });
    var fmt = function (v) {
      if (Array.isArray(v)) return v.map(function (o) { return typeof o === 'object' ? Object.values(o).filter(Boolean).join(' · ') : o; }).join('<br>');
      if (v === true) return 'Sí'; if (v === false) return 'No';
      return esc(v);
    };
    modal(x.consecutivo, '<dl class="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">' +
      [['Formato', x.codigo_formato + ' v' + x.version_formato], ['Emitido', fechaHora(x.creado_en) + ' por ' + quien(x.creado_por)], ['Estado', x.estado + (x.motivo_anulacion ? ' — ' + x.motivo_anulacion : '')],
        ['Conservar hasta', x.conservar_hasta], ['Huella SHA-256', '<span class="font-mono text-[10px] break-all">' + esc(x.hash_sha256) + '</span>']]
        .map(function (p) { return '<dt class="font-semibold text-cedine-blue">' + p[0] + '</dt><dd class="col-span-2">' + (p[0] === 'Huella SHA-256' ? p[1] : esc(p[1] || '—')) + '</dd>'; }).join('') +
      '<dt class="col-span-3 border-t pt-3 mt-2 font-display font-bold text-cedine-blue">Datos diligenciados</dt>' +
      Object.keys(x.datos || {}).map(function (k) { return '<dt class="font-semibold text-slate-600">' + esc(etiquetas[k] || k) + '</dt><dd class="col-span-2">' + fmt(x.datos[k]) + '</dd>'; }).join('') + '</dl>', { ancho: true });
  }
  async function anularDoc(x) {
    var motivo = await confirmar('Anular ' + x.consecutivo, '<p>El documento quedará marcado como <strong>anulado</strong>. El PDF y sus datos se conservan como evidencia.</p>', 'Anular documento', true);
    if (!motivo) return;
    var r = await sb.from('documentos').update({ estado: 'anulado', motivo_anulacion: motivo }).eq('id', x.id).select('id');
    if (r.error || !r.data.length) return toast(errorTexto(r.error || 'No tienes permiso para esta acción.'), 'error');
    toast('Documento anulado.', 'ok'); listarDocs();
  }

  // ===========================================================================
  // MENSAJES (formulario Contáctenos / Quiero apoyar)
  // ===========================================================================
  var ESTADOS_MSG = { nuevo: ['Nuevo', 'chip-naranja'], en_gestion: ['En gestión', 'chip-azul'], cerrado: ['Cerrado', 'chip-verde'] };
  var filtroMsg = { estado: 'abiertos', q: '' };

  async function actualizarBadgeMensajes() {
    if (!puede('mensajes')) return;
    var r = await sb.from('contactos').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo');
    var b = document.getElementById('badge-mensajes');
    if (b && !r.error) { b.textContent = r.count || ''; b.classList.toggle('hidden', !r.count); }
  }

  VISTAS.mensajes = async function (c) {
    c.innerHTML = encabezado('Mensajes de Contáctenos', 'Solicitudes enviadas desde <a class="underline" href="/contacto" target="_blank" rel="noopener">/contacto</a>. Contienen datos personales: úsalos solo para responder (POL-001).',
      '<button class="btn btn-secundario" id="b-exp-msg">Exportar CSV</button>') +
      '<div class="tarjeta p-4 mb-4 flex flex-col md:flex-row gap-3"><input id="mq" class="input md:flex-1" placeholder="Buscar por nombre, correo, radicado u organización" aria-label="Buscar" value="' + esc(filtroMsg.q) + '">' +
      '<select id="me" class="input md:w-56" aria-label="Estado"><option value="abiertos">Nuevos y en gestión</option><option value="nuevo">Nuevos</option><option value="en_gestion">En gestión</option><option value="cerrado">Cerrados</option><option value="todos">Todos</option></select></div>' +
      '<div id="mlista" class="grid gap-3"></div>';
    $('#me').value = filtroMsg.estado;
    var t = null;
    $('#mq').addEventListener('input', function () { clearTimeout(t); var v = this.value; t = setTimeout(function () { filtroMsg.q = v; listarMensajes(); }, 350); });
    $('#me').addEventListener('change', function () { filtroMsg.estado = this.value; listarMensajes(); });
    $('#b-exp-msg').addEventListener('click', async function () {
      var r = await consultaMsg().limit(5000);
      if (r.error) return toast(errorTexto(r.error), 'error');
      csvDescargar([['Radicado', 'Fecha', 'Tipo', 'Nombre', 'Organización', 'Correo', 'Teléfono', 'Mensaje', 'Estado', 'Notas']].concat(r.data.map(function (m) {
        return [m.radicado, m.creado_en, m.tipo_apoyo, m.nombre, m.organizacion, m.correo, m.telefono, m.mensaje, m.estado, m.notas];
      })), 'mensajes-contacto-' + hoyISO() + '.csv');
      toast('El archivo contiene datos personales: guárdalo de forma segura.', 'info');
    });
    await listarMensajes();
  };
  function consultaMsg() {
    var q = sb.from('contactos').select('*').order('creado_en', { ascending: false });
    if (filtroMsg.estado === 'abiertos') q = q.in('estado', ['nuevo', 'en_gestion']);
    else if (filtroMsg.estado !== 'todos') q = q.eq('estado', filtroMsg.estado);
    var s = filtroMsg.q.replace(/[%,()*\\]/g, ' ').trim();
    if (s) q = q.or('nombre.ilike.%' + s + '%,correo.ilike.%' + s + '%,radicado.ilike.%' + s + '%,organizacion.ilike.%' + s + '%');
    return q;
  }
  async function listarMensajes() {
    var r = await consultaMsg().limit(200);
    var cont = $('#mlista'); if (!cont) return;
    if (r.error) { cont.innerHTML = '<p class="text-red-700">' + esc(errorTexto(r.error)) + '</p>'; return; }
    S.mensajes = r.data || [];
    cont.innerHTML = S.mensajes.length ? S.mensajes.map(function (m, i) {
      var e = ESTADOS_MSG[m.estado] || ESTADOS_MSG.nuevo;
      return '<button class="tarjeta p-4 text-left hover:shadow-md transition w-full ' + (m.estado === 'nuevo' ? 'border-l-4 border-l-[#B85400]' : '') + '" data-msg="' + i + '">' +
        '<div class="flex flex-wrap items-center gap-2 mb-1"><span class="chip ' + e[1] + '">' + e[0] + '</span><span class="chip chip-gris">' + esc(m.tipo_apoyo) + '</span>' +
        '<span class="font-mono text-xs text-slate-500">' + esc(m.radicado) + '</span><span class="text-xs text-slate-500 ml-auto">' + fechaHora(m.creado_en) + '</span></div>' +
        '<p class="font-semibold text-cedine-blue">' + esc(m.nombre) + (m.organizacion ? ' <span class="font-normal text-slate-500">· ' + esc(m.organizacion) + '</span>' : '') + '</p>' +
        '<p class="text-sm text-slate-600 line-clamp-2">' + esc(m.mensaje) + '</p></button>';
    }).join('') : '<p class="tarjeta p-6 text-center text-slate-500">No hay mensajes con ese filtro.</p>';
    $$('[data-msg]', cont).forEach(function (b) { b.addEventListener('click', function () { verMensaje(S.mensajes[b.dataset.msg]); }); });
  }
  function verMensaje(m) {
    var tel = String(m.telefono || '').replace(/\D/g, '');
    if (tel.length === 10) tel = '57' + tel;
    var saludo = encodeURIComponent('Hola ' + m.nombre.split(' ')[0] + ', te escribimos de la Fundación CEDINE en respuesta a tu mensaje ' + m.radicado + '.');
    var md = modal('Mensaje ' + m.radicado,
      '<dl class="grid grid-cols-3 gap-x-4 gap-y-2 text-sm mb-4">' +
      [['Fecha', fechaHora(m.creado_en)], ['Tipo de apoyo', m.tipo_apoyo], ['Nombre', m.nombre], ['Organización', m.organizacion], ['Correo', m.correo], ['Teléfono', m.telefono],
        ['Autorización de datos', m.acepta_politica ? 'Sí (' + (m.version_politica || 'POL-001') + ')' : 'No'], ['Atendido por', m.atendido_por ? quien(m.atendido_por) + ' · ' + fechaHora(m.actualizado_en) : '—']]
        .map(function (p) { return '<dt class="font-semibold text-cedine-blue">' + esc(p[0]) + '</dt><dd class="col-span-2 break-words">' + esc(p[1] || '—') + '</dd>'; }).join('') + '</dl>' +
      '<div class="bg-slate-50 rounded-xl p-4 text-sm whitespace-pre-wrap mb-4">' + esc(m.mensaje) + '</div>' +
      '<div class="flex flex-wrap gap-2 mb-5"><a class="btn btn-primario btn-chico" href="mailto:' + esc(m.correo) + '?subject=' + encodeURIComponent('Fundación CEDINE · ' + m.radicado) + '">✉️ Responder por correo</a>' +
      (tel.length >= 10 ? '<a class="btn btn-exito btn-chico" target="_blank" rel="noopener" href="https://wa.me/' + tel + '?text=' + saludo + '">💬 WhatsApp</a>' : '') + '</div>' +
      '<form id="f-msg" class="grid sm:grid-cols-3 gap-3 border-t pt-4"><div><label class="etiqueta" for="msg-estado">Estado</label><select id="msg-estado" class="input">' +
      Object.keys(ESTADOS_MSG).map(function (k) { return '<option value="' + k + '" ' + (k === m.estado ? 'selected' : '') + '>' + ESTADOS_MSG[k][0] + '</option>'; }).join('') + '</select></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta" for="msg-notas">Notas internas</label><textarea id="msg-notas" class="input" rows="2" maxlength="2000">' + esc(m.notas || '') + '</textarea></div>' +
      '<div class="sm:col-span-3 flex justify-end"><button class="btn btn-primario">Guardar</button></div></form>', { ancho: true });
    $('#f-msg', md.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var r = await sb.from('contactos').update({ estado: $('#msg-estado', md.el).value, notas: $('#msg-notas', md.el).value.trim() || null }).eq('id', m.id).select('id');
      if (r.error || !r.data.length) return toast(errorTexto(r.error || 'No tienes permiso para esta acción.'), 'error');
      md.cerrar(); toast('Mensaje actualizado.', 'ok'); listarMensajes(); actualizarBadgeMensajes();
    });
    if (m.estado === 'nuevo') {
      sb.from('contactos').update({ estado: 'en_gestion' }).eq('id', m.id).select('id').then(function () {
        m.estado = 'en_gestion'; $('#msg-estado', md.el).value = 'en_gestion'; actualizarBadgeMensajes();
      });
    }
  }

  // ===========================================================================
  // LISTADO MAESTRO
  // ===========================================================================
  VISTAS.maestro = async function (c) {
    var bd = await cargarFormatosBD();
    c.innerHTML = encabezado('Listado maestro de documentos', 'Control de la información documentada (ISO 9001 §7.5) y tiempos de retención (Tabla de Retención Documental, Ley 594 de 2000).',
      '<button class="btn btn-secundario" id="b-exp-m">Exportar CSV</button>') +
      '<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Código</th><th>Documento</th><th>Tipo</th><th>Versión</th><th>Vigencia</th><th>Responsable</th><th>Retención</th><th>Disposición final</th><th>Estado</th>' +
      (puede('maestro.editar') ? '<th></th>' : '') + '</tr></thead><tbody>' + bd.map(function (f, i) {
        var ret = (f.retencion_gestion_anios == null && f.retencion_central_anios == null) ? 'Permanente' :
          (f.retencion_gestion_anios || 0) + ' gestión + ' + (f.retencion_central_anios || 0) + ' central';
        return '<tr><td class="font-mono text-xs whitespace-nowrap">' + esc(f.codigo) + '</td><td class="font-semibold">' + esc(f.nombre) + (f.observaciones ? '<p class="text-xs font-normal text-slate-500">' + esc(f.observaciones) + '</p>' : '') + '</td>' +
          '<td class="text-xs">' + esc(f.tipo) + '</td><td>' + esc(f.version) + '</td><td class="whitespace-nowrap text-xs">' + esc(window.CedineDocPDF.fechaCorta(f.vigencia)) + '</td><td class="text-xs">' + esc(f.responsable) + '</td>' +
          '<td class="text-xs">' + esc(ret) + '</td><td class="text-xs">' + esc(f.disposicion_final) + '</td>' +
          '<td><span class="chip ' + (f.estado === 'vigente' ? 'chip-verde' : f.estado === 'obsoleto' ? 'chip-rojo' : 'chip-naranja') + '">' + esc(f.estado.replace('_', ' ')) + '</span></td>' +
          (puede('maestro.editar') ? '<td><button class="btn-icono" data-ed="' + i + '" aria-label="Editar ' + esc(f.codigo) + '">✏️</button></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
    $('#b-exp-m').addEventListener('click', function () {
      csvDescargar([['Código', 'Nombre', 'Tipo', 'Versión', 'Vigencia', 'Responsable', 'Años gestión', 'Años central', 'Disposición final', 'Estado', 'Observaciones']].concat(bd.map(function (f) {
        return [f.codigo, f.nombre, f.tipo, f.version, f.vigencia, f.responsable, f.retencion_gestion_anios, f.retencion_central_anios, f.disposicion_final, f.estado, f.observaciones];
      })), 'listado-maestro-' + hoyISO() + '.csv');
    });
    $$('[data-ed]', c).forEach(function (b) { b.addEventListener('click', function () { editarFormato(bd[b.dataset.ed], c); }); });
  };
  function editarFormato(f, c) {
    var m = modal('Editar ' + f.codigo, '<form id="f-fmt" class="grid sm:grid-cols-2 gap-4">' +
      '<div class="sm:col-span-2"><label class="etiqueta" for="m-nombre">Nombre</label><input id="m-nombre" class="input" value="' + esc(f.nombre) + '"></div>' +
      '<div><label class="etiqueta" for="m-version">Versión</label><input id="m-version" class="input" value="' + esc(f.version) + '"><p class="ayuda">Si cambias el contenido del formato, sube la versión (01 → 02).</p></div>' +
      '<div><label class="etiqueta" for="m-vigencia">Vigencia desde</label><input id="m-vigencia" type="date" class="input" value="' + esc(f.vigencia || '') + '"></div>' +
      '<div><label class="etiqueta" for="m-resp">Responsable</label><input id="m-resp" class="input" value="' + esc(f.responsable || '') + '"></div>' +
      '<div><label class="etiqueta" for="m-estado">Estado</label><select id="m-estado" class="input"><option value="vigente">Vigente</option><option value="en_revision">En revisión</option><option value="obsoleto">Obsoleto</option></select></div>' +
      '<div><label class="etiqueta" for="m-g">Años en archivo de gestión</label><input id="m-g" type="number" min="0" class="input" value="' + esc(f.retencion_gestion_anios == null ? '' : f.retencion_gestion_anios) + '"></div>' +
      '<div><label class="etiqueta" for="m-c">Años en archivo central</label><input id="m-c" type="number" min="0" class="input" value="' + esc(f.retencion_central_anios == null ? '' : f.retencion_central_anios) + '"></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta" for="m-disp">Disposición final</label><select id="m-disp" class="input">' +
      ['Conservación total', 'Selección', 'Eliminación', 'Digitalización'].map(function (o) { return '<option ' + (o === f.disposicion_final ? 'selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' +
      '<div class="sm:col-span-2"><label class="etiqueta" for="m-obs">Observaciones</label><textarea id="m-obs" class="input" rows="2">' + esc(f.observaciones || '') + '</textarea></div>' +
      '<div class="sm:col-span-2 flex justify-end gap-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-primario" id="m-ok">Guardar</button></div></form>');
    $('#m-estado', m.el).value = f.estado;
    $('#f-fmt', m.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var num = function (id) { var v = $(id, m.el).value; return v === '' ? null : parseInt(v, 10); };
      var r = await sb.from('formatos').update({
        nombre: $('#m-nombre', m.el).value.trim(), version: $('#m-version', m.el).value.trim(), vigencia: $('#m-vigencia', m.el).value || null,
        responsable: $('#m-resp', m.el).value.trim(), estado: $('#m-estado', m.el).value, retencion_gestion_anios: num('#m-g'), retencion_central_anios: num('#m-c'),
        disposicion_final: $('#m-disp', m.el).value, observaciones: $('#m-obs', m.el).value.trim() || null
      }).eq('codigo', f.codigo).select('codigo');
      if (r.error || !r.data.length) return toast(errorTexto(r.error || 'No tienes permiso para esta acción.'), 'error');
      m.cerrar(); toast('Listado maestro actualizado.', 'ok'); VISTAS.maestro(c);
    });
  }

  // ===========================================================================
  // USUARIOS (solo administrador; usa la función segura de Cloudflare)
  // ===========================================================================
  async function api(metodo, cuerpo) {
    var token = (await sb.auth.getSession()).data.session.access_token;
    var r = await fetch('/api/admin/usuarios', {
      method: metodo, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('Error ' + r.status + '. ¿Configuraste las variables en Cloudflare?'));
    return j;
  }

  var pestanaUsuarios = 'personal';
  VISTAS.usuarios = async function (c) {
    c.innerHTML = encabezado('Usuarios y roles', 'Mínimo dos administradores activos con verificación en dos pasos (ACT-002, ISO 27001 A.5.15). Las cuentas de estudiantes solo las crea el administrador.',
      '<button class="btn btn-secundario" id="b-nuevo-est">+ Cuenta de estudiante</button><button class="btn btn-primario" id="b-nuevo-u">+ Usuario del personal</button>') +
      '<div class="grid md:grid-cols-5 gap-3 mb-6">' + Object.keys(ROLES).map(function (k) {
        return '<div class="tarjeta p-4"><span class="chip ' + ROLES[k].chip + '">' + esc(ROLES[k].nombre) + '</span><p class="text-xs text-slate-600 mt-2">' + esc(ROLES[k].desc) + '</p></div>';
      }).join('') + '</div>' +
      '<div class="flex gap-2 mb-3" role="tablist"><button role="tab" class="btn btn-chico" data-pest="personal">👥 Personal</button><button role="tab" class="btn btn-chico" data-pest="estudiantes">🎓 Estudiantes</button>' +
      '<input id="u-buscar" class="input !py-1.5 text-sm ml-auto max-w-xs" placeholder="Buscar nombre, correo o documento" aria-label="Buscar usuario"></div>' +
      '<div class="tarjeta overflow-x-auto"><table class="tabla"><thead><tr><th>Nombre</th><th>Correo</th><th>Documento</th><th>Rol</th><th>2 pasos</th><th>Último ingreso</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead><tbody id="ufilas">' +
      '<tr><td colspan="8" class="text-center py-6"><span class="cargando"></span></td></tr></tbody></table></div>';
    $('#b-nuevo-u').addEventListener('click', function () { nuevoUsuario(c); });
    $('#b-nuevo-est').addEventListener('click', function () { nuevoUsuario(c, { rol: 'estudiante' }); });
    var j;
    try { j = await api('GET'); } catch (e) { $('#ufilas').innerHTML = '<tr><td colspan="8" class="text-red-700 p-4">' + esc(e.message) + '</td></tr>'; return; }
    var lista = j.usuarios || [];
    function pintar() {
      $$('[data-pest]', c).forEach(function (b) {
        var act = b.dataset.pest === pestanaUsuarios;
        b.className = 'btn btn-chico ' + (act ? 'btn-primario' : 'btn-secundario'); b.setAttribute('aria-selected', String(act));
      });
      var q = ($('#u-buscar').value || '').toLowerCase().trim();
      var vis = lista.map(function (u, i) { return { u: u, i: i }; }).filter(function (x) {
        var est = x.u.rol === 'estudiante';
        if ((pestanaUsuarios === 'estudiantes') !== est) return false;
        return !q || [x.u.nombre, x.u.email, x.u.documento].join(' ').toLowerCase().indexOf(q) !== -1;
      });
      $('#ufilas').innerHTML = vis.map(function (x) {
        var u = x.u, i = x.i, yo = u.id === S.perfil.id;
        var opciones = (u.rol === 'estudiante' ? ['estudiante'] : ROLES_PERSONAL);
        return '<tr class="' + (u.activo ? '' : 'anulado') + '"><td class="font-semibold">' + esc(u.nombre || '—') + (yo ? ' <span class="chip chip-gris">Tú</span>' : '') + '</td><td class="text-xs">' + esc(u.email) + '</td>' +
          '<td class="font-mono text-xs">' + esc(u.documento || '—') + '</td>' +
          '<td><select class="input !py-1 text-sm" data-rol="' + i + '" ' + (yo || u.rol === 'estudiante' ? 'disabled' : '') + ' aria-label="Rol de ' + esc(u.email) + '">' +
          (u.rol ? '' : '<option value="">Sin acceso</option>') + opciones.map(function (k) { return '<option value="' + k + '" ' + (u.rol === k ? 'selected' : '') + '>' + ROLES[k].nombre + '</option>'; }).join('') + '</select></td>' +
          '<td>' + (u.mfa ? '<span class="chip chip-verde">Sí</span>' : '<span class="chip ' + (u.rol === 'estudiante' ? 'chip-gris' : 'chip-naranja') + '">No</span>') + '</td>' +
          '<td class="text-xs whitespace-nowrap">' + fechaHora(u.ultimo_ingreso) + '</td><td>' + (u.activo ? '<span class="chip chip-verde">Activo</span>' : '<span class="chip chip-rojo">Inactivo</span>') + '</td>' +
          '<td class="text-right whitespace-nowrap">' + (yo ? '' : '<button class="btn btn-secundario btn-chico" data-reset="' + i + '">Restablecer clave</button> ' +
            '<button class="btn ' + (u.activo ? 'btn-peligro' : 'btn-exito') + ' btn-chico" data-toggle="' + i + '">' + (u.activo ? 'Desactivar' : 'Activar') + '</button>') + '</td></tr>';
      }).join('') || '<tr><td colspan="8" class="text-center py-6 text-slate-500">' + (pestanaUsuarios === 'estudiantes' ? 'Aún no hay cuentas de estudiantes. Créalas con «+ Cuenta de estudiante» o desde el módulo Certificados (botón 🔑).' : 'No hay usuarios.') + '</td></tr>';
      $$('[data-rol]', c).forEach(function (s) {
        s.addEventListener('change', async function () {
          var u = lista[s.dataset.rol];
          try { await api('PATCH', { id: u.id, rol: s.value, nombre: u.nombre }); toast('Rol actualizado: ' + u.email, 'ok'); u.rol = s.value; }
          catch (e) { toast(e.message, 'error'); s.value = u.rol || ''; }
        });
      });
      $$('[data-toggle]', c).forEach(function (b) {
        b.addEventListener('click', async function () {
          var u = lista[b.dataset.toggle];
          if (u.activo && !(await confirmar('Desactivar usuario', '<p><strong>' + esc(u.email) + '</strong> no podrá volver a ingresar hasta que lo actives de nuevo. Su historial se conserva.</p>', 'Desactivar'))) return;
          try { await api('PATCH', { id: u.id, activo: !u.activo }); toast('Usuario ' + (u.activo ? 'desactivado' : 'activado') + '.', 'ok'); VISTAS.usuarios(c); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
      $$('[data-reset]', c).forEach(function (b) {
        b.addEventListener('click', async function () {
          var u = lista[b.dataset.reset], clave = passwordTemporal();
          if (!(await confirmar('Restablecer contraseña', '<p>Se asignará una contraseña temporal a <strong>' + esc(u.email) + '</strong>. Deberá cambiarla al ingresar.</p>', 'Restablecer'))) return;
          try { await api('PATCH', { id: u.id, password: clave }); mostrarClave(u.email, clave); } catch (e) { toast(e.message, 'error'); }
        });
      });
    }
    $$('[data-pest]', c).forEach(function (b) { b.addEventListener('click', function () { pestanaUsuarios = b.dataset.pest; pintar(); }); });
    $('#u-buscar').addEventListener('input', pintar);
    pintar();
  };
  function mostrarClave(email, clave) {
    var m = modal('Contraseña temporal', '<p class="text-sm mb-3">Entrégala a <strong>' + esc(email) + '</strong> por un canal privado (en persona o WhatsApp directo). No la envíes por correo junto con el usuario.</p>' +
      '<div class="flex gap-2"><input class="input font-mono text-lg" readonly value="' + esc(clave) + '" id="clave-t"><button class="btn btn-primario" id="b-copiar">Copiar</button></div>' +
      '<p class="ayuda mt-2">Ingreso: ' + esc(location.origin) + '/admin/ (botón «Ingresar» del sitio) · Se le pedirá cambiarla en su primer ingreso.</p>');
    $('#b-copiar', m.el).addEventListener('click', function () {
      navigator.clipboard.writeText(clave).then(function () { toast('Copiada.', 'ok'); }, function () { $('#clave-t', m.el).select(); });
    });
  }
  function nuevoUsuario(c, pre) {
    pre = pre || {};
    var clave = passwordTemporal();
    var esEst = pre.rol === 'estudiante';
    var roles = esEst ? ['estudiante'] : ROLES_PERSONAL;
    var m = modal(esEst ? 'Nueva cuenta de estudiante' : 'Nuevo usuario del personal', '<form id="f-u" class="grid gap-4" novalidate>' +
      '<div><label class="etiqueta req" for="u-nombre">Nombre completo</label><input id="u-nombre" class="input" maxlength="120" value="' + esc(pre.nombre || '') + '"></div>' +
      '<div><label class="etiqueta req" for="u-email">Correo</label><input id="u-email" type="email" class="input" maxlength="254" value="' + esc(pre.email || '') + '"></div>' +
      '<div><label class="etiqueta req" for="u-rol">Rol</label><select id="u-rol" class="input">' + roles.map(function (k) {
        return '<option value="' + k + '" ' + (k === (pre.rol || 'consulta') ? 'selected' : '') + '>' + ROLES[k].nombre + ' — ' + ROLES[k].desc + '</option>';
      }).join('') + '</select>' + (esEst ? '' : '<p class="ayuda">Asigna el mínimo rol necesario (principio de mínimo privilegio).</p>') + '</div>' +
      '<div id="u-doc-caja" class="' + (esEst ? '' : 'hidden') + '"><label class="etiqueta req" for="u-doc">Número de documento</label><input id="u-doc" class="input font-mono" inputmode="numeric" maxlength="20" value="' + esc(pre.documento || '') + '">' +
      '<p class="ayuda" id="u-doc-info">El estudiante verá los certificados activos registrados con este documento.</p></div>' +
      '<div><label class="etiqueta" for="u-clave">Contraseña temporal</label><input id="u-clave" class="input font-mono" value="' + esc(clave) + '"><p class="ayuda">Se le pedirá cambiarla en su primer ingreso.</p></div>' +
      '<div class="flex justify-end gap-2"><button type="button" class="btn btn-secundario" data-cerrar>Cancelar</button><button class="btn btn-primario" id="u-ok">Crear cuenta</button></div></form>');
    var t0 = null;
    async function revisarDoc() {
      var doc = $('#u-doc', m.el).value.replace(/[^0-9A-Za-z]/g, '');
      var info = $('#u-doc-info', m.el);
      if (doc.length < 5) { info.textContent = 'El estudiante verá los certificados activos registrados con este documento.'; return; }
      var r = await sb.rpc('certificados_de_documento', { p_documento: doc });
      if (r.error) return;
      info.innerHTML = r.data.length
        ? '✅ Este documento tiene <strong>' + r.data.length + '</strong> certificado(s) activo(s): ' + r.data.map(function (x) { return esc(x.curso); }).join(', ') + '.'
        : '⚠️ No hay certificados activos con este documento. La cuenta se puede crear igual; verá sus certificados cuando se registren.';
    }
    $('#u-doc', m.el).addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(revisarDoc, 400); });
    if (pre.documento) revisarDoc();
    $('#f-u', m.el).addEventListener('submit', async function (e) {
      e.preventDefault();
      var b = $('#u-ok', m.el); ocupado(b, true, 'Creando...');
      var datos = { nombre: $('#u-nombre', m.el).value.trim(), email: $('#u-email', m.el).value.trim(), rol: $('#u-rol', m.el).value, password: $('#u-clave', m.el).value };
      if (datos.rol === 'estudiante') datos.documento = $('#u-doc', m.el).value;
      try {
        await api('POST', datos); m.cerrar(); mostrarClave(datos.email, datos.password);
        if (c && S.vista === 'usuarios') { pestanaUsuarios = datos.rol === 'estudiante' ? 'estudiantes' : 'personal'; VISTAS.usuarios(c); }
      } catch (er) { ocupado(b, false); toast(er.message, 'error'); }
    });
  }

  // ===========================================================================
  // AUDITORÍA
  // ===========================================================================
  VISTAS.auditoria = async function (c) {
    c.innerHTML = encabezado('Auditoría', 'Últimos 300 eventos. Los registros de auditoría no se pueden modificar ni borrar desde el panel.') +
      '<div class="tarjeta p-4 mb-4 flex flex-col md:flex-row gap-3"><select id="at" class="input md:w-64" aria-label="Tabla"><option value="">Todo</option><option value="certificados">Certificados</option><option value="documentos">Documentos</option>' +
      '<option value="perfiles">Perfiles</option><option value="usuarios (panel)">Usuarios (panel)</option><option value="formatos">Listado maestro</option>' +
      '<option value="contactos">Mensajes</option><option value="medios">Galería</option><option value="historias">Historias</option></select>' +
      '<input id="aq" class="input md:flex-1" placeholder="Filtrar por registro o correo" aria-label="Filtrar"></div><div id="alista" class="space-y-2"></div>';
    async function cargar() {
      var q = sb.from('auditoria').select('*').order('id', { ascending: false }).limit(300);
      if ($('#at').value) q = q.eq('tabla', $('#at').value);
      var s = $('#aq').value.replace(/[%,()*\\]/g, ' ').trim();
      if (s) q = q.or('registro.ilike.%' + s + '%,usuario_email.ilike.%' + s + '%');
      var r = await q;
      if (r.error) { $('#alista').innerHTML = '<p class="text-red-700">' + esc(errorTexto(r.error)) + '</p>'; return; }
      $('#alista').innerHTML = (r.data || []).map(function (a) {
        var cambios = '';
        if (a.antes && a.despues) {
          cambios = Object.keys(a.despues).filter(function (k) {
            return !/^(actualizado_en|actualizado_por)$/.test(k) && JSON.stringify(a.antes[k]) !== JSON.stringify(a.despues[k]);
          }).map(function (k) { return '<li><strong>' + esc(k) + ':</strong> ' + esc(JSON.stringify(a.antes[k])) + ' → ' + esc(JSON.stringify(a.despues[k])) + '</li>'; }).join('');
        }
        return '<details class="tarjeta p-3 text-sm"><summary class="cursor-pointer flex flex-wrap gap-x-3 gap-y-1 items-center"><span class="text-xs text-slate-500 whitespace-nowrap">' + fechaHora(a.fecha) + '</span>' +
          '<span class="chip ' + (/INSERT|CREAR/.test(a.accion) ? 'chip-verde' : /DELETE/.test(a.accion) ? 'chip-rojo' : 'chip-azul') + '">' + esc(a.accion) + '</span><span class="font-semibold">' + esc(a.tabla) + '</span>' +
          '<span class="font-mono text-xs">' + esc(a.registro) + '</span><span class="text-xs text-slate-500 ml-auto">' + esc(a.usuario_email || 'sistema') + '</span></summary>' +
          (cambios ? '<ul class="mt-2 text-xs space-y-1 break-all">' + cambios + '</ul>' : '<pre class="mt-2 text-[11px] bg-slate-50 p-2 rounded overflow-x-auto">' + esc(JSON.stringify(a.despues, null, 1)) + '</pre>') + '</details>';
      }).join('') || '<p class="text-slate-500 text-sm">Sin eventos.</p>';
    }
    var t = null;
    $('#at').addEventListener('change', cargar);
    $('#aq').addEventListener('input', function () { clearTimeout(t); t = setTimeout(cargar, 350); });
    await cargar();
  };

  // ===========================================================================
  // MI CUENTA (contraseña y verificación en dos pasos)
  // ===========================================================================
  VISTAS.cuenta = async function (c) {
    var f = await sb.auth.mfa.listFactors();
    var totp = (f.data && f.data.totp) || [];
    var activo = totp.find(function (x) { return x.status === 'verified'; });
    c.innerHTML = encabezado('Mi cuenta', esc(S.perfil.email) + ' · ' + esc(ROLES[S.perfil.rol].nombre)) +
      '<div class="grid lg:grid-cols-2 gap-6"><section class="tarjeta p-6"><h2 class="font-display font-bold text-lg text-cedine-blue mb-4">Cambiar contraseña</h2>' +
      '<form id="f-cp" class="space-y-3"><input type="password" id="cp1" class="input" placeholder="Nueva contraseña" autocomplete="new-password" aria-label="Nueva contraseña">' +
      '<input type="password" id="cp2" class="input" placeholder="Repite la contraseña" autocomplete="new-password" aria-label="Repite la contraseña"><button class="btn btn-primario">Guardar</button></form></section>' +
      '<section class="tarjeta p-6"><h2 class="font-display font-bold text-lg text-cedine-blue mb-2">Verificación en dos pasos</h2>' +
      (activo ? '<p class="text-sm mb-4"><span class="chip chip-verde">Activa</span> Tu cuenta pide un código de tu aplicación cada vez que ingresas.</p><button class="btn btn-peligro btn-chico" id="mfa-quitar">Desactivar</button>'
        : '<p class="text-sm text-slate-600 mb-4">Protege tu cuenta con un código de 6 dígitos desde Google Authenticator o Microsoft Authenticator. <strong>Obligatorio para administradores</strong> según la política de la fundación.</p><button class="btn btn-primario" id="mfa-activar">Activar</button><div id="mfa-paso" class="mt-4"></div>') +
      '</section></div>';
    $('#f-cp').addEventListener('submit', async function (e) {
      e.preventDefault();
      var p1 = $('#cp1').value, err = reglasPassword(p1);
      if (err) return toast(err, 'error');
      if (p1 !== $('#cp2').value) return toast('Las contraseñas no coinciden.', 'error');
      var r = await sb.auth.updateUser({ password: p1 });
      if (r.error) return toast(errorTexto(r.error), 'error');
      toast('Contraseña actualizada.', 'ok'); this.reset();
    });
    if ($('#mfa-quitar')) $('#mfa-quitar').addEventListener('click', async function () {
      if (!(await confirmar('Desactivar verificación en dos pasos', '<p>Tu cuenta quedará protegida solo con contraseña. No es recomendable.</p>', 'Desactivar'))) return;
      var r = await sb.auth.mfa.unenroll({ factorId: activo.id });
      if (r.error) return toast(errorTexto(r.error), 'error');
      toast('Verificación en dos pasos desactivada.', 'info'); VISTAS.cuenta(c);
    });
    if ($('#mfa-activar')) $('#mfa-activar').addEventListener('click', async function () {
      for (var i = 0; i < totp.length; i++) if (totp[i].status !== 'verified') await sb.auth.mfa.unenroll({ factorId: totp[i].id });
      var r = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'CEDINE ' + Date.now() });
      if (r.error) return toast(errorTexto(r.error), 'error');
      var fid = r.data.id;
      $('#mfa-paso').innerHTML = '<p class="text-sm mb-2">1. Escanea este código con tu aplicación:</p><img alt="Código QR para la aplicación de autenticación" class="w-44 h-44 border rounded-xl bg-white p-2" src="' + esc(r.data.totp.qr_code) + '">' +
        '<p class="text-xs text-slate-500 mt-1 break-all">O escribe la clave: <span class="font-mono">' + esc(r.data.totp.secret) + '</span></p>' +
        '<form id="f-mfa2" class="flex gap-2 mt-3"><input id="mfa-cod" class="input font-mono" inputmode="numeric" maxlength="6" placeholder="2. Código de 6 dígitos" aria-label="Código de 6 dígitos"><button class="btn btn-primario">Confirmar</button></form>';
      $('#f-mfa2').addEventListener('submit', async function (e) {
        e.preventDefault();
        var v = await sb.auth.mfa.challengeAndVerify({ factorId: fid, code: $('#mfa-cod').value.trim() });
        if (v.error) return toast('Código incorrecto. Intenta de nuevo.', 'error');
        toast('¡Verificación en dos pasos activada!', 'ok'); VISTAS.cuenta(c);
      });
    });
  };

  // ===========================================================================
  // Módulos adicionales (contenido.js) se registran aquí
  var API = {
    sb: sb, S: S, VISTAS: VISTAS, ROLES: ROLES, SUPABASE_URL: SUPABASE_URL, esc: esc, $: $, $$: $$, puede: puede, toast: toast,
    ocupado: ocupado, modal: modal, confirmar: confirmar, encabezado: encabezado, errorTexto: errorTexto, fechaHora: fechaHora,
    hoyISO: hoyISO, descargarBlob: descargarBlob, quien: quien, cargarPersonal: cargarPersonal, render: function () { render(); },
    nuevoUsuario: function (c, pre) { nuevoUsuario(c, pre); }
  };
  (window.CedineAdminModulos || []).forEach(function (registrar) { registrar(API); });

  iniciar().catch(function (e) { console.error(e); pantallaLogin('No fue posible conectar con el servidor: ' + errorTexto(e)); });
})();
