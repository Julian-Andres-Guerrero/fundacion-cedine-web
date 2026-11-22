/**
 * Fundación CEDINE · API de gestión de usuarios (Cloudflare Pages Function)
 * Ruta: /api/admin/usuarios
 *
 * La llave secreta de Supabase NUNCA está en el código: se lee de las variables
 * de entorno del proyecto en Cloudflare (Settings → Variables and Secrets):
 *   SUPABASE_URL               https://sjfoivxzmaxaevsvjqcv.supabase.co
 *   SUPABASE_PUBLISHABLE_KEY   sb_publishable_...   (la pública)
 *   SUPABASE_SECRET_KEY        sb_secret_...        (tipo "Secret" / cifrada)
 *
 * Solo responde a usuarios con rol "administrador" y cuenta activa.
 *   GET    → lista de usuarios con su rol
 *   POST   → crea usuario  { email, nombre, rol, password, documento? }  (documento obligatorio para estudiantes)
 *   PATCH  → modifica      { id, nombre?, rol?, activo?, password?, documento? }
 */

const ROLES = ['administrador', 'coordinador', 'secretaria', 'consulta', 'estudiante'];

// Documento: solo letras y números ("79.259.617" -> "79259617")
function normalizarDocumento(v) { return String(v || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function config(env) {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const secreta = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  const publica = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY || '';
  if (!url || !secreta || !publica) {
    throw new Error('Faltan variables de entorno en Cloudflare (Production): '+[!url&&'SUPABASE_URL',!publica&&'SUPABASE_PUBLISHABLE_KEY',!secreta&&'SUPABASE_SECRET_KEY'].filter(Boolean).join(', ')+'. Después de agregarlas vuelve a publicar (Deployments → Retry deployment).');
  }
  return { url, secreta, publica };
}

// Las llaves nuevas (sb_secret_) van solo en "apikey"; las antiguas (JWT eyJ...) también como Bearer.
function cabecerasServicio(cfg, extra = {}) {
  const h = { apikey: cfg.secreta, 'Content-Type': 'application/json', ...extra };
  if (cfg.secreta.startsWith('eyJ')) h.Authorization = 'Bearer ' + cfg.secreta;
  return h;
}

async function supa(cfg, ruta, opciones = {}) {
  const r = await fetch(cfg.url + ruta, {
    ...opciones,
    headers: cabecerasServicio(cfg, opciones.headers || {})
  });
  const texto = await r.text();
  let cuerpo = null;
  try { cuerpo = texto ? JSON.parse(texto) : null; } catch (e) { cuerpo = texto; }
  if (!r.ok) {
    const msg = (cuerpo && (cuerpo.msg || cuerpo.message || cuerpo.error_description || cuerpo.error)) || ('HTTP ' + r.status);
    const err = new Error(traducirError(String(msg)));
    err.status = r.status >= 500 ? 502 : 400;
    throw err;
  }
  return cuerpo;
}

function traducirError(msg) {
  if (/already been registered|already registered|email_exists/i.test(msg)) return 'Ya existe un usuario con ese correo.';
  if (/password/i.test(msg) && /(short|weak|at least)/i.test(msg)) return 'La contraseña no cumple los requisitos de seguridad.';
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'El correo no es válido.';
  return msg;
}

// Verifica el token del usuario que llama y que sea administrador activo.
async function exigirAdministrador(request, cfg) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) { const e = new Error('Debes iniciar sesión.'); e.status = 401; throw e; }

  const r = await fetch(cfg.url + '/auth/v1/user', {
    headers: { apikey: cfg.publica, Authorization: 'Bearer ' + token }
  });
  if (!r.ok) { const e = new Error('Tu sesión expiró. Vuelve a iniciar sesión.'); e.status = 401; throw e; }
  const usuario = await r.json();

  const perfiles = await supa(cfg, `/rest/v1/perfiles?id=eq.${encodeURIComponent(usuario.id)}&select=rol,activo,email`);
  const p = perfiles && perfiles[0];
  if (!p || !p.activo || p.rol !== 'administrador') {
    const e = new Error('Solo un administrador puede gestionar usuarios.'); e.status = 403; throw e;
  }
  return { id: usuario.id, email: p.email || usuario.email };
}

async function auditar(cfg, actor, accion, registro, detalle) {
  try {
    await supa(cfg, '/rest/v1/auditoria', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        usuario: actor.id, usuario_email: actor.email, accion,
        tabla: 'usuarios (panel)', registro, despues: detalle
      })
    });
  } catch (e) { /* la auditoría no debe impedir la operación */ }
}

function validarPassword(p) {
  if (typeof p !== 'string' || p.length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe combinar letras y números.';
  return null;
}

function limpiar(s, max = 120) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

async function leerCuerpo(request) {
  try { return await request.json(); } catch (e) { const er = new Error('Datos inválidos.'); er.status = 400; throw er; }
}

async function manejar(context, fn) {
  try {
    const cfg = config(context.env);
    const actor = await exigirAdministrador(context.request, cfg);
    return await fn(cfg, actor);
  } catch (e) {
    return json({ error: e.message || 'Error inesperado.' }, e.status || 500);
  }
}

// ---------------------------------------------------------------------------
export const onRequestGet = (context) => manejar(context, async (cfg) => {
  const [lista, perfiles] = await Promise.all([
    supa(cfg, '/auth/v1/admin/users?per_page=500'),
    supa(cfg, '/rest/v1/perfiles?select=id,nombre,email,rol,activo,creado_en,documento')
  ]);
  const porId = new Map((perfiles || []).map((p) => [p.id, p]));
  const usuarios = ((lista && lista.users) || []).map((u) => {
    const p = porId.get(u.id) || {};
    return {
      id: u.id,
      email: u.email,
      nombre: p.nombre || '',
      rol: p.rol || null,
      documento: p.documento || null,
      activo: p.activo !== false && !u.banned_until,
      ultimo_ingreso: u.last_sign_in_at || null,
      creado_en: u.created_at,
      mfa: Array.isArray(u.factors) && u.factors.some((f) => f.status === 'verified')
    };
  }).sort((a, b) => (a.nombre || a.email).localeCompare(b.nombre || b.email, 'es'));
  return json({ usuarios });
});

export const onRequestPost = (context) => manejar(context, async (cfg, actor) => {
  const b = await leerCuerpo(context.request);
  const email = limpiar(b.email, 254).toLowerCase();
  const nombre = limpiar(b.nombre);
  const rol = String(b.rol || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'El correo no es válido.' }, 400);
  if (!nombre) return json({ error: 'Escribe el nombre completo.' }, 400);
  if (!ROLES.includes(rol)) return json({ error: 'Rol no válido.' }, 400);
  const errPass = validarPassword(b.password);
  if (errPass) return json({ error: errPass }, 400);
  const documento = normalizarDocumento(b.documento) || null;
  if (rol === 'estudiante' && !documento) return json({ error: 'Para un estudiante escribe su número de documento.' }, 400);
  if (documento && !/^[0-9A-Z]{4,15}$/.test(documento)) return json({ error: 'El número de documento no es válido.' }, 400);
  if (documento) {
    const ya = await supa(cfg, `/rest/v1/perfiles?documento=eq.${encodeURIComponent(documento)}&select=email`);
    if (ya && ya.length) return json({ error: 'Ya existe una cuenta con ese documento (' + ya[0].email + ').' }, 400);
  }

  const creado = await supa(cfg, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email, password: b.password, email_confirm: true,
      user_metadata: { nombre, debe_cambiar_password: true }
    })
  });
  const id = creado.id || (creado.user && creado.user.id);

  await supa(cfg, '/rest/v1/perfiles', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id, nombre, email, rol, activo: true, documento })
  });
  await auditar(cfg, actor, 'CREAR USUARIO', email, { nombre, email, rol, documento });
  return json({ ok: true, id }, 201);
});

export const onRequestPatch = (context) => manejar(context, async (cfg, actor) => {
  const b = await leerCuerpo(context.request);
  const id = String(b.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Usuario no válido.' }, 400);

  const cambios = {};
  if (b.nombre !== undefined) cambios.nombre = limpiar(b.nombre);
  if (b.rol !== undefined) {
    if (!ROLES.includes(b.rol)) return json({ error: 'Rol no válido.' }, 400);
    cambios.rol = b.rol;
  }
  if (b.activo !== undefined) cambios.activo = !!b.activo;
  if (b.documento !== undefined) {
    const doc = normalizarDocumento(b.documento) || null;
    if (doc && !/^[0-9A-Z]{4,15}$/.test(doc)) return json({ error: 'El número de documento no es válido.' }, 400);
    if (doc) {
      const ya = await supa(cfg, `/rest/v1/perfiles?documento=eq.${encodeURIComponent(doc)}&id=neq.${id}&select=email`);
      if (ya && ya.length) return json({ error: 'Ya existe una cuenta con ese documento (' + ya[0].email + ').' }, 400);
    }
    cambios.documento = doc;
  }
  if (cambios.rol === 'estudiante' && b.documento === undefined) {
    const actual = await supa(cfg, `/rest/v1/perfiles?id=eq.${id}&select=documento`);
    if (!actual || !actual[0] || !actual[0].documento) return json({ error: 'Para cambiar a estudiante, primero registra su número de documento.' }, 400);
  }

  if (id === actor.id && ((cambios.rol && cambios.rol !== 'administrador') || cambios.activo === false)) {
    return json({ error: 'No puedes cambiar tu propio rol ni desactivar tu propia cuenta.' }, 400);
  }

  if (Object.keys(cambios).length) {
    const usuarioAuth = await supa(cfg, `/auth/v1/admin/users/${id}`);
    await supa(cfg, '/rest/v1/perfiles', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id, email: usuarioAuth.email, ...cambios })
    });
  }

  const authCambios = {};
  if (cambios.activo !== undefined) authCambios.ban_duration = cambios.activo ? 'none' : '876000h';
  if (b.password) {
    const errPass = validarPassword(b.password);
    if (errPass) return json({ error: errPass }, 400);
    authCambios.password = b.password;
    authCambios.user_metadata = { debe_cambiar_password: true };
  }
  if (Object.keys(authCambios).length) {
    await supa(cfg, `/auth/v1/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(authCambios) });
  }

  await auditar(cfg, actor, 'MODIFICAR USUARIO', id, { ...cambios, password_restablecida: !!b.password });
  return json({ ok: true });
});
