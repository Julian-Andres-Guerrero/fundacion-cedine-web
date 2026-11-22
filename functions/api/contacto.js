/**
 * Fundación CEDINE · Recepción del formulario "Contáctenos / Quiero apoyar"
 * Ruta: POST /api/contacto
 * Usa las mismas variables de entorno de Cloudflare que /api/admin/usuarios:
 *   SUPABASE_URL, SUPABASE_SECRET_KEY
 * Opcionales:
 *   TURNSTILE_SECRET   → activa la verificación anti-robots de Cloudflare Turnstile
 *   RESEND_API_KEY     → envía un aviso por correo por cada mensaje nuevo (resend.com)
 *   AVISO_CORREO       → a quién llega el aviso (p. ej. administracion@fundacioncedine.org)
 *   AVISO_REMITENTE    → remitente verificado en Resend (p. ej. "Web CEDINE <avisos@fundacioncedine.org>")
 * Protección: origen del sitio, campo trampa, tiempo mínimo de llenado,
 * límite de 3 envíos por visitante cada 10 minutos, validación de datos y
 * autorización de tratamiento de datos (Ley 1581 de 2012).
 */

const TIPOS = ['Voluntariado', 'Donación en especie', 'Donación en dinero', 'Alianza empresarial', 'Cursos y formación', 'Validación de certificado', 'Otro'];
const VERSION_POLITICA = 'POL-001 v01';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function limpiar(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function origenPermitido(request) {
  const origen = request.headers.get('Origin') || '';
  if (!origen) return false;
  try {
    const h = new URL(origen).hostname;
    return h === 'fundacioncedine.org' || h.endsWith('.fundacioncedine.org') || h.endsWith('.pages.dev') || h === 'localhost' || h === '127.0.0.1';
  } catch (e) { return false; }
}

export async function onRequestPost({ request, env, waitUntil }) {
  const url = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const secreta = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !secreta) return json({ error: 'El formulario no está configurado todavía.' }, 503);
  if (!origenPermitido(request)) return json({ error: 'Solicitud no permitida.' }, 403);

  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'Datos inválidos.' }, 400); }

  // Bots: campo trampa lleno o formulario enviado en menos de 3 segundos → respuesta "exitosa" sin guardar
  if (b.sitio_web || Number(b.t) < 3000) return json({ ok: true, radicado: 'CTO-OK' });

  // Cloudflare Turnstile (solo si está configurado)
  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', String(b.turnstile || ''));
    form.append('remoteip', request.headers.get('CF-Connecting-IP') || '');
    let ok = false;
    try {
      const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
      ok = (await v.json()).success === true;
    } catch (e) { ok = false; }
    if (!ok) return json({ error: 'No pudimos verificar que no eres un robot. Recarga la página e intenta de nuevo.' }, 400);
  }

  const d = {
    tipo_apoyo: limpiar(b.tipo, 40),
    nombre: limpiar(b.nombre, 120),
    organizacion: limpiar(b.organizacion, 120) || null,
    correo: limpiar(b.correo, 254).toLowerCase(),
    telefono: limpiar(b.telefono, 20) || null,
    mensaje: limpiar(b.mensaje, 2000)
  };
  if (!TIPOS.includes(d.tipo_apoyo)) return json({ error: 'Elige cómo te gustaría apoyar.' }, 400);
  if (d.nombre.length < 3) return json({ error: 'Escribe tu nombre completo.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) return json({ error: 'El correo no es válido.' }, 400);
  if (d.telefono && !/^[\d\s+()-]{7,20}$/.test(d.telefono)) return json({ error: 'El teléfono no es válido.' }, 400);
  if (d.mensaje.length < 10) return json({ error: 'El mensaje es muy corto.' }, 400);
  if (b.acepta !== true) return json({ error: 'Debes autorizar el tratamiento de datos para que podamos responderte.' }, 400);
  if ((d.mensaje.match(/https?:\/\//g) || []).length > 3) return json({ error: 'El mensaje tiene demasiados enlaces.' }, 400);

  const h = { apikey: secreta, 'Content-Type': 'application/json' };
  if (secreta.startsWith('eyJ')) h.Authorization = 'Bearer ' + secreta;

  // Límite de envíos: huella del visitante (no se guarda la IP)
  const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';
  const huella = await sha256(ip + '|' + (env.CONTACTO_SAL || url));
  const desde = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  try {
    const r = await fetch(`${url}/rest/v1/contactos?select=id&ip_hash=eq.${huella}&creado_en=gte.${encodeURIComponent(desde)}`, { headers: h });
    if (r.ok && (await r.json()).length >= 3) {
      return json({ error: 'Recibimos varios mensajes tuyos hace poco. Intenta de nuevo en unos minutos.' }, 429);
    }
  } catch (e) { /* si falla la consulta, se continúa */ }

  const ins = await fetch(`${url}/rest/v1/contactos?select=radicado`, {
    method: 'POST',
    headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({
      ...d,
      acepta_politica: true,
      version_politica: VERSION_POLITICA,
      ip_hash: huella,
      origen: limpiar(request.headers.get('Referer') || '', 200) || null
    })
  });
  if (!ins.ok) return json({ error: 'No pudimos guardar tu mensaje en este momento.' }, 502);
  const fila = (await ins.json())[0] || {};

  // Aviso por correo al equipo (no retrasa la respuesta al visitante)
  if (env.RESEND_API_KEY && env.AVISO_CORREO) {
    const aviso = fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.AVISO_REMITENTE || 'Web CEDINE <avisos@fundacioncedine.org>',
        to: env.AVISO_CORREO.split(',').map((x) => x.trim()),
        reply_to: d.correo,
        subject: `Nuevo mensaje ${fila.radicado || ''} · ${d.tipo_apoyo} · ${d.nombre}`,
        text: [`Radicado: ${fila.radicado || ''}`, `Tipo: ${d.tipo_apoyo}`, `Nombre: ${d.nombre}`, `Organización: ${d.organizacion || '—'}`,
          `Correo: ${d.correo}`, `Teléfono: ${d.telefono || '—'}`, '', d.mensaje, '',
          'Gestiónalo en https://fundacioncedine.org/admin/#mensajes',
          'Contiene datos personales: trátalos según la Política POL-001.'].join('\n')
      })
    }).catch(() => {});
    if (waitUntil) waitUntil(aviso);
  }
  return json({ ok: true, radicado: fila.radicado || '' }, 201);
}
