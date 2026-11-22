/* Fundación CEDINE · Formulario "Contáctenos / Quiero apoyar" → /api/contacto */
(function () {
  'use strict';
  var form = document.getElementById('form-contacto');
  if (!form) return;
  var inicio = Date.now();

  // Cloudflare Turnstile: pega aquí la "Site Key" para activarlo (y TURNSTILE_SECRET en Cloudflare)
  var TURNSTILE_SITEKEY = '';
  var turnstileToken = '';
  if (TURNSTILE_SITEKEY) {
    var caja = document.createElement('div');
    caja.className = 'mt-6';
    caja.id = 'turnstile-caja';
    form.querySelector('#contacto-error').before(caja);
    window.onTurnstileListo = function () {
      window.turnstile.render('#turnstile-caja', {
        sitekey: TURNSTILE_SITEKEY, language: 'es',
        callback: function (t) { turnstileToken = t; }, 'expired-callback': function () { turnstileToken = ''; }
      });
    };
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileListo&render=explicit';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }
  var err = document.getElementById('contacto-error');
  var btn = document.getElementById('c-enviar');
  var msg = document.getElementById('c-msg');

  // Preseleccionar el tipo desde la URL: /contacto?tipo=voluntariado
  var tipoUrl = (new URLSearchParams(location.search).get('tipo') || '').toLowerCase();
  if (tipoUrl) {
    form.querySelectorAll('input[name="tipo"]').forEach(function (r) {
      if (r.value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').indexOf(tipoUrl) === 0) r.checked = true;
    });
  }
  msg.addEventListener('input', function () { document.getElementById('c-cont').textContent = msg.value.length; });

  function mostrarError(t, campo) {
    err.textContent = t; err.classList.remove('hidden');
    if (campo) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); }
  }
  form.addEventListener('input', function (e) { if (e.target.removeAttribute) e.target.removeAttribute('aria-invalid'); });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    err.classList.add('hidden');
    var tipo = form.querySelector('input[name="tipo"]:checked');
    var d = {
      tipo: tipo ? tipo.value : '',
      nombre: form.nombre.value.trim(),
      organizacion: form.organizacion.value.trim(),
      correo: form.correo.value.trim(),
      telefono: form.telefono.value.trim(),
      mensaje: form.mensaje.value.trim(),
      acepta: form.acepta.checked,
      sitio_web: form.sitio_web.value,
      t: Date.now() - inicio,
      turnstile: turnstileToken
    };
    if (!d.tipo) return mostrarError('Elige cómo te gustaría apoyar.', form.querySelector('input[name="tipo"]'));
    if (d.nombre.length < 3) return mostrarError('Escribe tu nombre completo.', form.nombre);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo)) return mostrarError('Escribe un correo válido.', form.correo);
    if (d.telefono && !/^[\d\s+()-]{7,20}$/.test(d.telefono)) return mostrarError('El teléfono no es válido.', form.telefono);
    if (d.mensaje.length < 10) return mostrarError('Cuéntanos un poco más en el mensaje (mínimo 10 caracteres).', form.mensaje);
    if (!d.acepta) return mostrarError('Para responderte necesitamos tu autorización de tratamiento de datos.', form.acepta);
    if (TURNSTILE_SITEKEY && !turnstileToken) return mostrarError('Completa la verificación de seguridad antes de enviar.');

    btn.disabled = true; var txt = btn.textContent; btn.textContent = 'Enviando...';
    try {
      var r = await fetch('/api/contacto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || 'No pudimos enviar tu mensaje.');
      form.classList.add('hidden');
      document.getElementById('contacto-num').textContent = j.radicado || '';
      var ok = document.getElementById('contacto-ok');
      ok.classList.remove('hidden'); ok.focus();
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (window.gtag) window.gtag('event', 'generate_lead', { form: 'contacto', tipo: d.tipo });
    } catch (ex) {
      mostrarError(ex.message + ' Si el problema sigue, escríbenos a administracion@fundacioncedine.org o por WhatsApp al +57 312 518 2773.');
      btn.disabled = false; btn.textContent = txt;
    }
  });
})();
