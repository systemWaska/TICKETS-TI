/**
 * login.js v5 - Autenticación con roles
 * Valida correo/usuario + PIN contra la hoja USUARIOS (backend Apps Script).
 */
(function () {
  'use strict';
  const U = window.Utils;

  // Si ya hay sesión activa, ir directo al inicio.
  if (window.Session?.get()) { location.href = 'index.html'; return; }

  function setMsg(text, type) {
    const el = document.getElementById('msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = `form-msg ${type || ''}`.trim();
  }

  async function doLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const pin   = document.getElementById('pin')?.value.trim();
    if (!email || !pin) return setMsg('Ingresa correo/usuario y PIN.', 'error');

    const btn = document.getElementById('btnLogin');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Verificando...'; }
    setMsg('Verificando credenciales...', 'info');

    try {
      const res = await U.jsonpRequest(window.CONFIG.SCRIPT_URL, { action: 'login', email, pin });
      if (res?.ok === true && res.usuario) {
        window.Session.set({ ...res.usuario, token: res.token });
        setMsg('✅ Bienvenido/a, redirigiendo...', 'success');
        const next = new URLSearchParams(location.search).get('next');
        setTimeout(() => location.href = next || 'index.html', 500);
      } else {
        setMsg(`❌ ${res?.error || 'No se pudo iniciar sesión.'}`, 'error');
        const card = document.querySelector('.login-card');
        card?.classList.add('shake');
        setTimeout(() => card?.classList.remove('shake'), 450);
      }
    } catch (err) {
      setMsg(`❌ Error de conexión: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Ingresar →'; }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm')?.addEventListener('submit', doLogin);
    document.getElementById('email')?.focus();

    // Aviso visible cuando se corre en modo DEMO (datos locales de prueba).
    if (window.CONFIG?.DEMO) {
      const card = document.querySelector('.login-card');
      const sub = card?.querySelector('.sub');
      if (sub) {
        const b = document.createElement('div');
        b.style.cssText = 'background:#fef9c3;color:#854d0e;border:1px solid #fde047;border-radius:8px;padding:.5rem .7rem;font-size:.76rem;text-align:center;margin:.2rem 0 1.1rem;';
        b.innerHTML = '🧪 <b>Modo DEMO</b> — datos de prueba locales. Usuarios: <b>admin</b>, tecnico, lider, usuario · PIN <b>1234</b>.';
        sub.insertAdjacentElement('afterend', b);
      }
    }
  });
})();
