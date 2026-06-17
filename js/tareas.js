/**
 * tareas.js v7 - Tareas por persona alineadas al BACKEND AVANZADO
 * Lee/escribe las pestañas "Tasks - <persona>" vía listSubTareas / guardarSubTarea.
 * Modelo real: Tarea (categoría) → Sub Tareas → Estado → Observaciones, por persona.
 * Reglas:
 *  - Administrador / Líder: ven TODAS; crean y editan para cualquier persona.
 *  - Técnico TI: ve las SUYAS; crea/edita las suyas y cambia su estado.
 *  - Usuario: solo ve las suyas y cambia el estado.
 */
(function () {
  'use strict';
  const U = window.Utils;
  const SCRIPT = () => window.CONFIG.SCRIPT_URL;
  const sesion = window.Session.get() || {};
  const rol = sesion.rol;
  const esGestor = ['Administrador', 'Líder de equipo'].includes(rol);
  const esTecnico = rol === 'Técnico TI';
  const puedeCrear = esGestor || esTecnico;
  const puedeEditar = esGestor || esTecnico;

  let subtareas = [], estadosTarea = [], catalogo = [], usuarios = [];

  window.initTareas_ = async function () {
    document.getElementById('panelTitulo').textContent = esGestor ? '✅ Tareas del equipo' : '✅ Mis tareas';
    if (puedeCrear) document.getElementById('btnNueva').style.display = '';
    if (esGestor) {
      document.getElementById('btnCatalogo').style.display = '';
      document.getElementById('filtroAsignado').style.display = '';
    }
    wireUI_();
    await load_();
  };

  async function load_() {
    setListMsg_('Cargando tareas...');
    try {
      const reqs = [
        U.jsonpRequest(SCRIPT(), { action: 'listSubTareas' }),
        U.jsonpCached(SCRIPT() + '?action=config', {}, 'config', 300),
        U.jsonpRequest(SCRIPT(), { action: 'catalogo' }).catch(() => []),
      ];
      if (puedeCrear) reqs.push(U.jsonpRequest(SCRIPT(), { action: 'usuarios' }).catch(() => []));
      const [lista, config, cat, users] = await Promise.all(reqs);

      let rows = Array.isArray(lista) ? lista : [];
      // Técnico/Usuario: solo sus tareas (filtra por persona).
      if (!esGestor) {
        const yo = String(sesion.nombre || '').trim().toLowerCase();
        rows = rows.filter(r => String(r._persona || '').trim().toLowerCase() === yo);
      }
      subtareas = rows;
      estadosTarea = (config?.estadosTarea) || ['Pendiente', 'En desarrollo', 'Pausado', 'Terminado', 'Cancelada'];
      catalogo = Array.isArray(cat) ? cat : [];
      usuarios = Array.isArray(users) ? users : [];

      fillSelects_();
      render_();
    } catch (err) {
      setListMsg_(`❌ Error al cargar: ${err.message}`);
    }
  }

  const optionList_ = arr => arr.map(v => `<option value="${U.escapeHtml(v)}">${U.escapeHtml(v)}</option>`).join('');

  function fillSelects_() {
    const fEstado = document.getElementById('filtroEstado');
    if (fEstado) fEstado.innerHTML = `<option value="">Todos los estados</option>` + optionList_(estadosTarea);
    const tEstado = document.getElementById('tEstado');
    if (tEstado) tEstado.innerHTML = optionList_(estadosTarea);

    // Categorías existentes (de tus tareas + catálogo) como sugerencias
    const cats = [...new Set([
      ...subtareas.map(t => String(t.Tarea || '').trim()),
      ...catalogo.map(c => String(c.Nombre || '').trim()),
    ].filter(Boolean))].sort();
    const catDL = document.getElementById('categoriasDL');
    if (catDL) catDL.innerHTML = cats.map(c => `<option value="${U.escapeHtml(c)}">`).join('');

    // Personas (para asignar): de usuarios + de las tareas existentes
    const personas = [...new Set([
      ...usuarios.map(u => String(u.Nombre || '').trim()),
      ...subtareas.map(t => String(t._persona || '').trim()),
    ].filter(Boolean))].sort();
    const dl = document.getElementById('usuariosDL');
    if (dl) dl.innerHTML = personas.map(n => `<option value="${U.escapeHtml(n)}">`).join('');
    const fAsig = document.getElementById('filtroAsignado');
    if (fAsig) {
      const nombres = [...new Set(subtareas.map(t => String(t._persona || '').trim()).filter(Boolean))].sort();
      fAsig.innerHTML = `<option value="">Todas las personas</option>` + optionList_(nombres);
    }

    const cRol = document.getElementById('cRol');
    if (cRol) cRol.innerHTML = `<option value="">—</option>` + optionList_((window.Session.ROLES) || []);
  }

  /* ── RENDER ────────────────────────────────────────── */
  function filtered_() {
    const q  = (document.getElementById('buscar')?.value || '').toLowerCase().trim();
    const fe = document.getElementById('filtroEstado')?.value || '';
    const fa = document.getElementById('filtroAsignado')?.value || '';
    return subtareas
      .map((t, i) => ({ t, i }))
      .filter(({ t }) =>
        (!q || [t.Tarea, t['Sub Tareas'], t._persona].some(v => String(v || '').toLowerCase().includes(q))) &&
        (!fe || String(t.Estado || '') === fe) &&
        (!fa || String(t._persona || '') === fa));
  }

  function render_() {
    renderStats_();
    const rows = filtered_();
    const cont = document.getElementById('tareasList');
    if (!cont) return;
    if (!rows.length) {
      cont.innerHTML = `<div class="empty-state"><span class="es-icon">📝</span><p>No hay tareas para mostrar.</p></div>`;
      return;
    }
    cont.innerHTML = `
      <table class="tickets-table">
        <thead><tr>
          <th>Tarea (categoría)</th><th>Sub-tarea</th>
          ${esGestor ? '<th>Persona</th>' : ''}
          <th>Prioridad</th><th>Estado</th>${puedeEditar ? '<th></th>' : ''}
        </tr></thead>
        <tbody>
          ${rows.map(({ t, i }) => `
            <tr>
              <td>${U.escapeHtml(t.Tarea || '—')}</td>
              <td class="title" title="${U.escapeHtml(t['Sub Tareas'] || '')}">${U.escapeHtml(t['Sub Tareas'] || '-')}</td>
              ${esGestor ? `<td>${U.escapeHtml(t._persona || '—')}</td>` : ''}
              <td>${U.escapeHtml(String(t.Prioridad ?? '—'))}</td>
              <td>${estadoSelect_(t, i)}</td>
              ${puedeEditar ? `<td class="actions"><button class="row-btn" data-edit="${i}">✏️</button></td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>`;

    cont.querySelectorAll('.estado-select').forEach(sel =>
      sel.addEventListener('change', () => cambiarEstado_(parseInt(sel.dataset.idx, 10), sel.value)));
    cont.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openModal_(parseInt(b.dataset.edit, 10))));
  }

  function estadoSelect_(t, i) {
    const opts = estadosTarea.map(e =>
      `<option value="${U.escapeHtml(e)}"${e === t.Estado ? ' selected' : ''}>${U.escapeHtml(e)}</option>`).join('');
    return `<select class="estado-select badge ${U.normalizeClass(t.Estado || 'pendiente')}" data-idx="${i}"
              style="border:none;font-weight:600;cursor:pointer;padding:.2rem .4rem;border-radius:20px;">${opts}</select>`;
  }

  function renderStats_() {
    const cuenta = est => subtareas.filter(t => String(t.Estado || '').toLowerCase() === est).length;
    const cards = [
      { n: subtareas.length, l: 'Total' },
      { n: cuenta('pendiente'), l: 'Pendientes' },
      { n: cuenta('en desarrollo'), l: 'En desarrollo' },
      { n: cuenta('terminado'), l: 'Terminadas' },
    ];
    const el = document.getElementById('statRow');
    if (el) el.innerHTML = cards.map(c =>
      `<div class="stat-card"><div class="sc-num">${c.n}</div><div class="sc-label">${c.l}</div></div>`).join('');
  }

  async function cambiarEstado_(idx, estado) {
    const t = subtareas[idx];
    if (!t) return;
    try {
      const res = await U.jsonpRequest(SCRIPT(), {
        action: 'guardarSubTarea', persona: t._persona, tarea: t.Tarea, subTarea: t['Sub Tareas'], estado,
      });
      if (res?.ok) { t.Estado = estado; U.toast(`${t['Sub Tareas']} → ${estado}`, 'success'); render_(); }
      else U.toast(res?.error || 'No se pudo actualizar', 'error');
    } catch (err) { U.toast(`Error: ${err.message}`, 'error'); }
  }

  /* ── MODAL ─────────────────────────────────────────── */
  let editIdx = null;
  function openModal_(idx) {
    const t = (idx != null && idx >= 0) ? subtareas[idx] : null;
    editIdx = t ? idx : null;
    document.getElementById('modalTitle').textContent = t ? 'Editar tarea' : 'Nueva tarea';
    // En edición: persona/categoría/sub-tarea son la CLAVE → solo lectura (cambiarlas crearía otra fila).
    const persona = document.getElementById('tAsignado');
    const cat = document.getElementById('tCategoria');
    const sub = document.getElementById('tTitulo');
    persona.value = t ? (t._persona || '') : (esTecnico ? (sesion.nombre || '') : '');
    cat.value     = t ? (t.Tarea || '') : '';
    sub.value     = t ? (t['Sub Tareas'] || '') : '';
    persona.readOnly = !!t || esTecnico;   // técnico no reasigna; en edición es clave
    cat.readOnly = !!t;
    sub.readOnly = !!t;
    document.getElementById('tEstado').value = t ? (t.Estado || 'Pendiente') : 'Pendiente';
    document.getElementById('tObs').value    = t ? (t.Observaciones || '') : '';
    document.getElementById('tFechaAct').value = t ? dateForInput_(t['Fecha actividad']) : '';
    setModalMsg_('', '');
    toggleModal_('tarModal', true);
  }

  function dateForInput_(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  function onCatChange_() {
    const c = catalogo.find(x => x.Nombre === document.getElementById('tCategoria').value);
    if (c && !document.getElementById('tTitulo').value && c.Descripcion)
      document.getElementById('tTitulo').value = c.Descripcion;
  }

  async function saveTarea_(e) {
    e.preventDefault();
    const data = {
      action: 'guardarSubTarea',
      persona:  document.getElementById('tAsignado').value.trim(),
      tarea:    document.getElementById('tCategoria').value.trim(),
      subTarea: document.getElementById('tTitulo').value.trim(),
      estado:   document.getElementById('tEstado').value,
      observacion: document.getElementById('tObs').value.trim(),
      fechaActividad: document.getElementById('tFechaAct').value,
    };
    if (!data.persona)  return setModalMsg_('Indica la persona / técnico.', 'error');
    if (!data.tarea)    return setModalMsg_('Indica la tarea (categoría).', 'error');
    if (!data.subTarea) return setModalMsg_('Indica la sub-tarea.', 'error');

    const btn = document.getElementById('btnGuardar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    try {
      const res = await U.jsonpRequest(SCRIPT(), data);
      if (res?.ok) {
        U.toast(editIdx != null ? 'Tarea actualizada' : 'Tarea creada', 'success');
        toggleModal_('tarModal', false);
        await load_();
      } else setModalMsg_(`❌ ${res?.error || 'No se pudo guardar.'}`, 'error');
    } catch (err) {
      setModalMsg_(`❌ Error de red: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
  }

  /* ── CATÁLOGO ──────────────────────────────────────── */
  function openCatalogo_() { renderCatalogo_(); toggleModal_('catModal', true); }
  function renderCatalogo_() {
    const cont = document.getElementById('catList');
    if (!cont) return;
    if (!catalogo.length) { cont.innerHTML = `<p class="muted" style="text-align:center;">Aún no hay tareas parametrizadas.</p>`; return; }
    cont.innerHTML = `
      <table class="tickets-table"><thead><tr><th>Nombre</th><th>Categoría</th><th>Dur. (h)</th><th>Rol</th></tr></thead>
        <tbody>${catalogo.map(c => `<tr>
          <td><strong>${U.escapeHtml(c.Nombre || '-')}</strong>${c.Descripcion ? `<br><span class="muted" style="font-size:.75rem;">${U.escapeHtml(c.Descripcion)}</span>` : ''}</td>
          <td>${U.escapeHtml(c.Categoria || '—')}</td><td>${U.escapeHtml(c['Duracion estimada (h)'] || '—')}</td>
          <td>${U.escapeHtml(c['Rol sugerido'] || '—')}</td></tr>`).join('')}</tbody></table>`;
  }
  async function saveCatalogo_(e) {
    e.preventDefault();
    const data = {
      action: 'crearCatalogoTarea',
      nombre: document.getElementById('cNombre').value.trim(),
      categoria: document.getElementById('cCategoria').value.trim(),
      descripcion: document.getElementById('cDesc').value.trim(),
      duracion: document.getElementById('cDuracion').value.trim(),
      rol: document.getElementById('cRol').value,
    };
    if (!data.nombre) return setCatMsg_('El nombre es obligatorio.', 'error');
    try {
      const res = await U.jsonpRequest(SCRIPT(), data);
      if (res?.ok) {
        U.toast('Agregado al catálogo', 'success');
        document.getElementById('catForm').reset(); setCatMsg_('', '');
        catalogo = await U.jsonpRequest(SCRIPT(), { action: 'catalogo' }).catch(() => catalogo);
        fillSelects_(); renderCatalogo_();
      } else setCatMsg_(`❌ ${res?.error || 'No se pudo guardar.'}`, 'error');
    } catch (err) { setCatMsg_(`❌ Error: ${err.message}`, 'error'); }
  }

  /* ── UI ────────────────────────────────────────────── */
  function toggleModal_(id, open) { document.getElementById(id)?.classList.toggle('open', open); }
  function wireUI_() {
    document.getElementById('btnNueva')?.addEventListener('click', () => openModal_(null));
    document.getElementById('btnCatalogo')?.addEventListener('click', openCatalogo_);
    document.getElementById('tCategoria')?.addEventListener('change', onCatChange_);
    document.getElementById('tarForm')?.addEventListener('submit', saveTarea_);
    document.getElementById('catForm')?.addEventListener('submit', saveCatalogo_);
    ['buscar', 'filtroEstado', 'filtroAsignado'].forEach(id => {
      const el = document.getElementById(id);
      el?.addEventListener(id === 'buscar' ? 'input' : 'change', render_);
    });
    document.querySelectorAll('#tarModal .modal-close, #tarModal .modal-close-btn, #tarModal .modal-backdrop')
      .forEach(el => el.addEventListener('click', () => toggleModal_('tarModal', false)));
    document.querySelectorAll('#catModal .modal-close, #catModal .modal-backdrop')
      .forEach(el => el.addEventListener('click', () => toggleModal_('catModal', false)));
  }

  function setListMsg_(m) { const el = document.getElementById('tareasList'); if (el) el.innerHTML = `<p class="muted" style="text-align:center;padding:2rem;">${U.escapeHtml(m)}</p>`; }
  function setModalMsg_(t, type) { const el = document.getElementById('modalMsg'); if (el) { el.textContent = t || ''; el.className = `form-msg ${type || ''}`.trim(); } }
  function setCatMsg_(t, type) { const el = document.getElementById('catMsg'); if (el) { el.textContent = t || ''; el.className = `form-msg ${type || ''}`.trim(); } }
})();
