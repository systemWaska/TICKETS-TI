/**
 * usuarios.js v5 - Alta y gestión de usuarios con roles
 * Solo accesible para Administrador (guard en usuarios.html).
 */
(function () {
  'use strict';
  const U = window.Utils;
  const SCRIPT = () => window.CONFIG.SCRIPT_URL;
  let usuarios = [], roles = [];

  /* ── CARGA ─────────────────────────────────────────── */
  window.initUsuarios_ = async function () {
    wireUI_();
    await load_();
  };

  async function load_() {
    setListMsg_('Cargando usuarios...');
    try {
      const [lista, config] = await Promise.all([
        U.jsonpRequest(SCRIPT(), { action: 'usuarios' }),
        U.jsonpCached(SCRIPT() + '?action=config', {}, 'config', 300),
      ]);
      usuarios = Array.isArray(lista) ? lista : [];
      roles = (config?.roles) || window.Session.ROLES;
      fillRolesSelects_();
      fillEquiposDatalist_();
      render_();
    } catch (err) {
      setListMsg_(`❌ Error al cargar: ${err.message}`);
    }
  }

  function fillRolesSelects_() {
    const opt = roles.map(r => `<option value="${U.escapeHtml(r)}">${U.escapeHtml(r)}</option>`).join('');
    const uRol = document.getElementById('uRol');
    if (uRol) uRol.innerHTML = opt;
    const fRol = document.getElementById('filtroRol');
    if (fRol) fRol.innerHTML = `<option value="">Todos los roles</option>` + opt;
  }

  function fillEquiposDatalist_() {
    const equipos = [...new Set(usuarios.map(u => String(u.Equipo || '').trim()).filter(Boolean))].sort();
    const dl = document.getElementById('equiposList');
    if (dl) dl.innerHTML = equipos.map(e => `<option value="${U.escapeHtml(e)}">`).join('');
    const fEq = document.getElementById('filtroEquipo');
    if (fEq) fEq.innerHTML = `<option value="">Todos los equipos</option>` +
      equipos.map(e => `<option value="${U.escapeHtml(e)}">${U.escapeHtml(e)}</option>`).join('');
  }

  /* ── RENDER ────────────────────────────────────────── */
  function filtered_() {
    const q  = (document.getElementById('buscar')?.value || '').toLowerCase().trim();
    const fr = document.getElementById('filtroRol')?.value || '';
    const fe = document.getElementById('filtroEquipo')?.value || '';
    return usuarios.filter(u =>
      (!q || [u.Nombre, u.Email, u.Equipo].some(v => String(v || '').toLowerCase().includes(q))) &&
      (!fr || String(u.Rol || '') === fr) &&
      (!fe || String(u.Equipo || '') === fe));
  }

  function render_() {
    renderStats_();
    const rows = filtered_();
    const cont = document.getElementById('usuariosList');
    if (!cont) return;
    if (!rows.length) {
      cont.innerHTML = `<div class="empty-state"><span class="es-icon">👤</span><p>No hay usuarios para los filtros aplicados.</p></div>`;
      return;
    }
    cont.innerHTML = `
      <table class="tickets-table">
        <thead><tr>
          <th>Nombre</th><th>Correo / usuario</th><th>Rol</th><th>Equipo</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(u => {
            const activo = String(u.Activo || 'Sí').trim().toLowerCase() !== 'no';
            return `<tr>
              <td><strong>${U.escapeHtml(u.Nombre || '-')}</strong></td>
              <td class="code">${U.escapeHtml(u.Email || '—')}</td>
              <td><span class="badge rol ${U.normalizeClass(u.Rol || 'Usuario')}">${U.escapeHtml(u.Rol || 'Usuario')}</span></td>
              <td>${U.escapeHtml(u.Equipo || '—')}</td>
              <td><span class="badge ${activo ? 'atendido' : 'anulado'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
              <td class="actions"><button class="row-btn" data-id="${U.escapeHtml(u.ID)}">✏️ Editar</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('.row-btn').forEach(b =>
      b.addEventListener('click', () => openModal_(b.dataset.id)));
  }

  function renderStats_() {
    const total = usuarios.length;
    const porRol = r => usuarios.filter(u => String(u.Rol || '') === r).length;
    const cards = [
      { n: total, l: 'Total' },
      { n: porRol('Administrador'), l: 'Admins' },
      { n: porRol('Técnico TI'), l: 'Técnicos' },
      { n: porRol('Líder de equipo'), l: 'Líderes' },
      { n: porRol('Usuario'), l: 'Usuarios' },
    ];
    const el = document.getElementById('statRow');
    if (el) el.innerHTML = cards.map(c =>
      `<div class="stat-card"><div class="sc-num">${c.n}</div><div class="sc-label">${c.l}</div></div>`).join('');
  }

  /* ── MODAL ─────────────────────────────────────────── */
  function openModal_(id) {
    const u = id ? usuarios.find(x => x.ID === id) : null;
    document.getElementById('modalTitle').textContent = u ? `Editar — ${u.Nombre}` : 'Nuevo usuario';
    document.getElementById('uId').value     = u ? u.ID : '';
    document.getElementById('uNombre').value = u ? (u.Nombre || '') : '';
    document.getElementById('uEmail').value  = u ? (u.Email || '') : '';
    document.getElementById('uPin').value    = '';
    document.getElementById('uRol').value    = u ? (u.Rol || 'Usuario') : 'Usuario';
    document.getElementById('uEquipo').value = u ? (u.Equipo || '') : '';
    document.getElementById('uActivo').value = u && String(u.Activo || '').toLowerCase() === 'no' ? 'No' : 'Sí';
    document.getElementById('lblPin').textContent = u ? 'PIN (dejar vacío para no cambiar)' : 'PIN de acceso *';
    setModalMsg_('', '');
    toggleModal_(true);
  }

  function toggleModal_(open) {
    document.getElementById('userModal')?.classList.toggle('open', open);
  }

  async function save_(e) {
    e.preventDefault();
    const id     = document.getElementById('uId').value.trim();
    const nombre = document.getElementById('uNombre').value.trim();
    const email  = document.getElementById('uEmail').value.trim();
    const pin    = document.getElementById('uPin').value.trim();
    const rol    = document.getElementById('uRol').value.trim();
    const equipo = document.getElementById('uEquipo').value.trim();
    const activo = document.getElementById('uActivo').value;

    if (!nombre) return setModalMsg_('El nombre es obligatorio.', 'error');
    if (!id && !pin) return setModalMsg_('El PIN es obligatorio para un usuario nuevo.', 'error');

    const btn = document.getElementById('btnGuardar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    try {
      const action = id ? 'actualizarUsuario' : 'crearUsuario';
      const res = await U.jsonpRequest(SCRIPT(), { action, id, nombre, email, pin, rol, equipo, activo });
      if (res?.ok) {
        U.toast(id ? 'Usuario actualizado' : 'Usuario creado', 'success');
        toggleModal_(false);
        await load_();
      } else {
        setModalMsg_(`❌ ${res?.error || 'No se pudo guardar.'}`, 'error');
      }
    } catch (err) {
      setModalMsg_(`❌ Error de red: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
  }

  /* ── UI WIRING ─────────────────────────────────────── */
  function wireUI_() {
    document.getElementById('btnNuevo')?.addEventListener('click', () => openModal_(null));
    ['buscar', 'filtroRol', 'filtroEquipo'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener(id === 'buscar' ? 'input' : 'change', render_);
    });
    document.getElementById('userForm')?.addEventListener('submit', save_);
    document.querySelectorAll('#userModal .modal-close, #userModal .modal-close-btn, #userModal .modal-backdrop')
      .forEach(el => el.addEventListener('click', () => toggleModal_(false)));
  }

  function setListMsg_(msg) {
    const el = document.getElementById('usuariosList');
    if (el) el.innerHTML = `<p class="muted" style="text-align:center;padding:2rem;">${U.escapeHtml(msg)}</p>`;
  }
  function setModalMsg_(text, type) {
    const el = document.getElementById('modalMsg');
    if (el) { el.textContent = text || ''; el.className = `form-msg ${type || ''}`.trim(); }
  }
})();
