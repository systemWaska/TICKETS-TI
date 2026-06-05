/**
 * equipos.js v5 - Inventario de equipos informáticos
 * Acceso: Técnico TI, Líder de equipo, Administrador.
 */
(function () {
  'use strict';
  const U = window.Utils;
  const SCRIPT = () => window.CONFIG.SCRIPT_URL;
  let equipos = [], tipos = [], estados = [];

  window.initEquipos_ = async function () {
    wireUI_();
    await load_();
  };

  async function load_() {
    setListMsg_('Cargando inventario...');
    try {
      const [lista, config, usuarios] = await Promise.all([
        U.jsonpRequest(SCRIPT(), { action: 'equipos' }),
        U.jsonpCached(SCRIPT() + '?action=config', {}, 'config', 300),
        U.jsonpRequest(SCRIPT(), { action: 'usuarios' }).catch(() => []),
      ]);
      equipos = Array.isArray(lista) ? lista : [];
      tipos   = (config?.tiposEquipo)   || [];
      estados = (config?.estadosEquipo) || [];
      fillSelects_();
      fillUsuariosDatalist_(usuarios);
      render_();
    } catch (err) {
      setListMsg_(`❌ Error al cargar: ${err.message}`);
    }
  }

  function optionList_(arr) { return arr.map(v => `<option value="${U.escapeHtml(v)}">${U.escapeHtml(v)}</option>`).join(''); }

  function fillSelects_() {
    const eTipo = document.getElementById('eTipo');
    if (eTipo) eTipo.innerHTML = `<option value="">Seleccione...</option>` + optionList_(tipos);
    const eEstado = document.getElementById('eEstado');
    if (eEstado) eEstado.innerHTML = optionList_(estados);
    const fTipo = document.getElementById('filtroTipo');
    if (fTipo) fTipo.innerHTML = `<option value="">Todos los tipos</option>` + optionList_(tipos);
    const fEstado = document.getElementById('filtroEstado');
    if (fEstado) fEstado.innerHTML = `<option value="">Todos los estados</option>` + optionList_(estados);
  }

  function fillUsuariosDatalist_(usuarios) {
    const dl = document.getElementById('usuariosDL');
    if (dl && Array.isArray(usuarios))
      dl.innerHTML = usuarios.map(u => `<option value="${U.escapeHtml(u.Nombre || '')}">`).join('');
  }

  /* ── RENDER ────────────────────────────────────────── */
  function filtered_() {
    const q  = (document.getElementById('buscar')?.value || '').toLowerCase().trim();
    const ft = document.getElementById('filtroTipo')?.value || '';
    const fe = document.getElementById('filtroEstado')?.value || '';
    return equipos.filter(e =>
      (!q || [e.Codigo, e.Marca, e.Modelo, e['N Serie'], e['Asignado a'], e.Area]
        .some(v => String(v || '').toLowerCase().includes(q))) &&
      (!ft || String(e.Tipo || '') === ft) &&
      (!fe || String(e.Estado || '') === fe));
  }

  function render_() {
    renderStats_();
    const rows = filtered_();
    const cont = document.getElementById('equiposList');
    if (!cont) return;
    if (!rows.length) {
      cont.innerHTML = `<div class="empty-state"><span class="es-icon">💻</span><p>No hay equipos para los filtros aplicados.</p></div>`;
      return;
    }
    cont.innerHTML = `
      <table class="tickets-table">
        <thead><tr>
          <th>Código</th><th>Tipo</th><th>Marca / Modelo</th><th>N° Serie</th>
          <th>Asignado a</th><th>Ubicación</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(e => `
            <tr>
              <td class="code">${U.escapeHtml(e.Codigo || '-')}</td>
              <td>${U.escapeHtml(e.Tipo || '-')}</td>
              <td>${U.escapeHtml([e.Marca, e.Modelo].filter(Boolean).join(' ') || '—')}</td>
              <td class="code">${U.escapeHtml(e['N Serie'] || '—')}</td>
              <td>${U.escapeHtml(e['Asignado a'] || '—')}</td>
              <td>${U.escapeHtml([e.Area, e.Ubicacion].filter(Boolean).join(' · ') || '—')}</td>
              <td><span class="badge ${U.normalizeClass(e.Estado || '')}">${U.escapeHtml(e.Estado || '-')}</span></td>
              <td class="actions"><button class="row-btn" data-id="${U.escapeHtml(e.Codigo)}">✏️ Editar</button></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    cont.querySelectorAll('.row-btn').forEach(b =>
      b.addEventListener('click', () => openModal_(b.dataset.id)));
  }

  function renderStats_() {
    const total = equipos.length;
    const cuenta = est => equipos.filter(e => String(e.Estado || '').toLowerCase() === est).length;
    const cards = [
      { n: total, l: 'Total' },
      { n: cuenta('operativo'), l: 'Operativos' },
      { n: cuenta('asignado'), l: 'Asignados' },
      { n: cuenta('en stock'), l: 'En stock' },
      { n: cuenta('en reparación'), l: 'En reparación' },
    ];
    const el = document.getElementById('statRow');
    if (el) el.innerHTML = cards.map(c =>
      `<div class="stat-card"><div class="sc-num">${c.n}</div><div class="sc-label">${c.l}</div></div>`).join('');
  }

  /* ── MODAL ─────────────────────────────────────────── */
  function openModal_(id) {
    const e = id ? equipos.find(x => x.Codigo === id) : null;
    document.getElementById('modalTitle').textContent = e ? `Editar — ${e.Codigo}` : 'Nuevo equipo';
    document.getElementById('eId').value        = e ? e.Codigo : '';
    document.getElementById('eTipo').value      = e ? (e.Tipo || '') : '';
    document.getElementById('eMarca').value     = e ? (e.Marca || '') : '';
    document.getElementById('eModelo').value    = e ? (e.Modelo || '') : '';
    document.getElementById('eSerie').value     = e ? (e['N Serie'] || '') : '';
    document.getElementById('eAsignado').value  = e ? (e['Asignado a'] || '') : '';
    document.getElementById('eArea').value      = e ? (e.Area || '') : '';
    document.getElementById('eUbicacion').value = e ? (e.Ubicacion || '') : '';
    document.getElementById('eEstado').value    = e ? (e.Estado || 'En stock') : 'En stock';
    document.getElementById('eObs').value       = e ? (e.Observaciones || '') : '';
    setModalMsg_('', '');
    toggleModal_(true);
  }

  function toggleModal_(open) { document.getElementById('eqModal')?.classList.toggle('open', open); }

  async function save_(ev) {
    ev.preventDefault();
    const id = document.getElementById('eId').value.trim();
    const data = {
      action: id ? 'actualizarEquipo' : 'crearEquipo',
      codigo: id,
      tipo:   document.getElementById('eTipo').value.trim(),
      marca:  document.getElementById('eMarca').value.trim(),
      modelo: document.getElementById('eModelo').value.trim(),
      serie:  document.getElementById('eSerie').value.trim(),
      asignado: document.getElementById('eAsignado').value.trim(),
      area:   document.getElementById('eArea').value.trim(),
      ubicacion: document.getElementById('eUbicacion').value.trim(),
      estado: document.getElementById('eEstado').value.trim(),
      observaciones: document.getElementById('eObs').value.trim(),
    };
    if (!data.tipo) return setModalMsg_('El tipo de equipo es obligatorio.', 'error');

    const btn = document.getElementById('btnGuardar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    try {
      const res = await U.jsonpRequest(SCRIPT(), data);
      if (res?.ok) {
        U.toast(id ? 'Equipo actualizado' : 'Equipo registrado', 'success');
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

  /* ── UI ────────────────────────────────────────────── */
  function wireUI_() {
    document.getElementById('btnNuevo')?.addEventListener('click', () => openModal_(null));
    ['buscar', 'filtroTipo', 'filtroEstado'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener(id === 'buscar' ? 'input' : 'change', render_);
    });
    document.getElementById('eqForm')?.addEventListener('submit', save_);
    document.querySelectorAll('#eqModal .modal-close, #eqModal .modal-close-btn, #eqModal .modal-backdrop')
      .forEach(el => el.addEventListener('click', () => toggleModal_(false)));
  }

  function setListMsg_(msg) {
    const el = document.getElementById('equiposList');
    if (el) el.innerHTML = `<p class="muted" style="text-align:center;padding:2rem;">${U.escapeHtml(msg)}</p>`;
  }
  function setModalMsg_(text, type) {
    const el = document.getElementById('modalMsg');
    if (el) { el.textContent = text || ''; el.className = `form-msg ${type || ''}`.trim(); }
  }
})();
