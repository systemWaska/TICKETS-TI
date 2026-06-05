/**
 * tareas.js v5 - Tareas asignadas + catálogo parametrizado
 * - Administrador / Líder de equipo: crean y asignan tareas, gestionan el catálogo y ven todo.
 * - Técnico TI / Usuario: ven sus propias tareas y actualizan su estado.
 * Base lista para integración futura con Google Calendar (checkbox "Agendar").
 */
(function () {
  'use strict';
  const U = window.Utils;
  const SCRIPT = () => window.CONFIG.SCRIPT_URL;

  const sesion = window.Session.get() || {};
  const esGestor = ['Administrador', 'Líder de equipo'].includes(sesion.rol);

  let tareas = [], catalogo = [], estadosTarea = [], roles = [], usuarios = [];

  window.initTareas_ = async function () {
    document.getElementById('panelTitulo').textContent = esGestor ? '✅ Tareas del equipo' : '✅ Mis tareas';
    if (esGestor) {
      document.getElementById('btnNueva').style.display = '';
      document.getElementById('btnCatalogo').style.display = '';
      document.getElementById('filtroAsignado').style.display = '';
    }
    wireUI_();
    await load_();
  };

  async function load_() {
    setListMsg_('Cargando tareas...');
    try {
      const params = esGestor ? { action: 'tareas' } : { action: 'tareas', asignado: sesion.nombre };
      const reqs = [
        U.jsonpRequest(SCRIPT(), params),
        U.jsonpCached(SCRIPT() + '?action=config', {}, 'config', 300),
        U.jsonpRequest(SCRIPT(), { action: 'catalogo' }).catch(() => []),
      ];
      if (esGestor) reqs.push(U.jsonpRequest(SCRIPT(), { action: 'usuarios' }).catch(() => []));
      const [lista, config, cat, users] = await Promise.all(reqs);

      tareas = Array.isArray(lista) ? lista : [];
      catalogo = Array.isArray(cat) ? cat : [];
      estadosTarea = (config?.estadosTarea) || ['Pendiente', 'En progreso', 'Completada', 'Cancelada'];
      roles = (config?.roles) || window.Session.ROLES;
      usuarios = Array.isArray(users) ? users : [];

      fillSelects_();
      render_();
    } catch (err) {
      setListMsg_(`❌ Error al cargar: ${err.message}`);
    }
  }

  function optionList_(arr) { return arr.map(v => `<option value="${U.escapeHtml(v)}">${U.escapeHtml(v)}</option>`).join(''); }

  function fillSelects_() {
    // Estados (filtro + modal)
    const fEstado = document.getElementById('filtroEstado');
    if (fEstado) fEstado.innerHTML = `<option value="">Todos los estados</option>` + optionList_(estadosTarea);
    const tEstado = document.getElementById('tEstado');
    if (tEstado) tEstado.innerHTML = optionList_(estadosTarea);

    // Tipos desde catálogo (parametrización)
    const tTipo = document.getElementById('tTipo');
    if (tTipo) tTipo.innerHTML = `<option value="">— Libre / sin catálogo —</option>` +
      catalogo.map(c => `<option value="${U.escapeHtml(c.Nombre)}">${U.escapeHtml(c.Nombre)}</option>`).join('');

    // Roles (catálogo)
    const cRol = document.getElementById('cRol');
    if (cRol) cRol.innerHTML = `<option value="">—</option>` + optionList_(roles);

    // Usuarios (datalist + filtro)
    const dl = document.getElementById('usuariosDL');
    if (dl) dl.innerHTML = usuarios.map(u => `<option value="${U.escapeHtml(u.Nombre || '')}">`).join('');
    const fAsig = document.getElementById('filtroAsignado');
    if (fAsig) {
      const nombres = [...new Set(tareas.map(t => String(t['Asignado a'] || '').trim()).filter(Boolean))].sort();
      fAsig.innerHTML = `<option value="">Todas las personas</option>` + optionList_(nombres);
    }
  }

  /* ── RENDER ────────────────────────────────────────── */
  function filtered_() {
    const q  = (document.getElementById('buscar')?.value || '').toLowerCase().trim();
    const fe = document.getElementById('filtroEstado')?.value || '';
    const fa = document.getElementById('filtroAsignado')?.value || '';
    return tareas.filter(t =>
      (!q || [t.Titulo, t.Tipo, t['Asignado a']].some(v => String(v || '').toLowerCase().includes(q))) &&
      (!fe || String(t.Estado || '') === fe) &&
      (!fa || String(t['Asignado a'] || '') === fa));
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
          <th>ID</th><th>Título</th><th>Tipo</th>
          ${esGestor ? '<th>Asignado a</th>' : ''}
          <th>Prioridad</th><th>Límite</th><th>Estado</th><th></th>
        </tr></thead>
        <tbody>
          ${rows.map(t => `
            <tr>
              <td class="code">${U.escapeHtml(t.ID || '-')}</td>
              <td class="title" title="${U.escapeHtml(t.Titulo || '')}">${U.escapeHtml(t.Titulo || '-')}</td>
              <td>${U.escapeHtml(t.Tipo || '—')}</td>
              ${esGestor ? `<td>${U.escapeHtml(t['Asignado a'] || '—')}</td>` : ''}
              <td><span class="badge ${U.normalizeClass(t.Prioridad || 'Media')}">${U.escapeHtml(t.Prioridad || 'Media')}</span></td>
              <td>${t['Fecha limite'] ? U.formatDateShort(t['Fecha limite']) : '—'}</td>
              <td>${estadoSelect_(t)}</td>
              <td class="actions">${esGestor ? `<button class="row-btn" data-edit="${U.escapeHtml(t.ID)}">✏️</button>` : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    cont.querySelectorAll('.estado-select').forEach(sel =>
      sel.addEventListener('change', () => cambiarEstado_(sel.dataset.id, sel.value)));
    cont.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => openModal_(b.dataset.edit)));
  }

  function estadoSelect_(t) {
    const opts = estadosTarea.map(e =>
      `<option value="${U.escapeHtml(e)}"${e === t.Estado ? ' selected' : ''}>${U.escapeHtml(e)}</option>`).join('');
    return `<select class="estado-select badge ${U.normalizeClass(t.Estado || 'pendiente')}" data-id="${U.escapeHtml(t.ID)}"
              style="border:none;font-weight:600;cursor:pointer;padding:.2rem .4rem;border-radius:20px;">${opts}</select>`;
  }

  function renderStats_() {
    const cuenta = est => tareas.filter(t => String(t.Estado || '').toLowerCase() === est).length;
    const cards = [
      { n: tareas.length, l: 'Total' },
      { n: cuenta('pendiente'), l: 'Pendientes' },
      { n: cuenta('en progreso'), l: 'En progreso' },
      { n: cuenta('completada'), l: 'Completadas' },
    ];
    const el = document.getElementById('statRow');
    if (el) el.innerHTML = cards.map(c =>
      `<div class="stat-card"><div class="sc-num">${c.n}</div><div class="sc-label">${c.l}</div></div>`).join('');
  }

  async function cambiarEstado_(id, estado) {
    try {
      const res = await U.jsonpRequest(SCRIPT(), { action: 'actualizarTarea', id, estado });
      if (res?.ok) {
        const t = tareas.find(x => x.ID === id);
        if (t) t.Estado = estado;
        U.toast(`${id} → ${estado}`, 'success');
        render_();
      } else U.toast(res?.error || 'No se pudo actualizar', 'error');
    } catch (err) { U.toast(`Error: ${err.message}`, 'error'); }
  }

  /* ── MODAL TAREA ───────────────────────────────────── */
  function openModal_(id) {
    const t = id ? tareas.find(x => x.ID === id) : null;
    document.getElementById('modalTitle').textContent = t ? `Editar — ${t.ID}` : 'Nueva tarea';
    document.getElementById('tId').value        = t ? t.ID : '';
    document.getElementById('tTipo').value      = t ? (t.Tipo || '') : '';
    document.getElementById('tTitulo').value    = t ? (t.Titulo || '') : '';
    document.getElementById('tDesc').value      = t ? (t.Descripcion || '') : '';
    document.getElementById('tAsignado').value  = t ? (t['Asignado a'] || '') : '';
    document.getElementById('tPrioridad').value = t ? (t.Prioridad || 'Media') : 'Media';
    document.getElementById('tEstado').value    = t ? (t.Estado || 'Pendiente') : 'Pendiente';
    document.getElementById('tInicio').value    = t ? dateForInput_(t['Fecha inicio']) : '';
    document.getElementById('tLimite').value    = t ? dateForInput_(t['Fecha limite']) : '';
    document.getElementById('tTicket').value    = t ? (t['Ticket relacionado'] || '') : '';
    document.getElementById('tAgendar').checked = false;
    setModalMsg_('', '');
    toggleModal_('tarModal', true);
  }

  function dateForInput_(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  // Autocompletar desde el catálogo al elegir tipo
  function onTipoChange_() {
    const nombre = document.getElementById('tTipo').value;
    const c = catalogo.find(x => x.Nombre === nombre);
    if (!c) return;
    const tit = document.getElementById('tTitulo');
    if (!tit.value) tit.value = c.Nombre;
    const desc = document.getElementById('tDesc');
    if (!desc.value && c.Descripcion) desc.value = c.Descripcion;
  }

  async function saveTarea_(e) {
    e.preventDefault();
    const id = document.getElementById('tId').value.trim();
    const data = {
      action: id ? 'actualizarTarea' : 'crearTarea',
      id,
      titulo:      document.getElementById('tTitulo').value.trim(),
      descripcion: document.getElementById('tDesc').value.trim(),
      tipo:        document.getElementById('tTipo').value.trim(),
      asignado:    document.getElementById('tAsignado').value.trim(),
      asignadoPor: sesion.nombre || '',
      prioridad:   document.getElementById('tPrioridad').value,
      estado:      document.getElementById('tEstado').value,
      fechaInicio: document.getElementById('tInicio').value,
      fechaLimite: document.getElementById('tLimite').value,
      ticket:      document.getElementById('tTicket').value.trim(),
      agendar:     document.getElementById('tAgendar').checked ? 'true' : 'false',
    };
    if (!data.titulo)   return setModalMsg_('El título es obligatorio.', 'error');
    if (!data.asignado) return setModalMsg_('Debes asignar la tarea a una persona.', 'error');

    const btn = document.getElementById('btnGuardar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    try {
      const res = await U.jsonpRequest(SCRIPT(), data);
      if (res?.ok) {
        U.toast(id ? 'Tarea actualizada' : 'Tarea creada', 'success');
        toggleModal_('tarModal', false);
        await load_();
      } else setModalMsg_(`❌ ${res?.error || 'No se pudo guardar.'}`, 'error');
    } catch (err) {
      setModalMsg_(`❌ Error de red: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar'; }
    }
  }

  /* ── MODAL CATÁLOGO ────────────────────────────────── */
  function openCatalogo_() {
    renderCatalogo_();
    toggleModal_('catModal', true);
  }

  function renderCatalogo_() {
    const cont = document.getElementById('catList');
    if (!cont) return;
    if (!catalogo.length) {
      cont.innerHTML = `<p class="muted" style="text-align:center;">Aún no hay tareas parametrizadas. Agrega la primera arriba.</p>`;
      return;
    }
    cont.innerHTML = `
      <table class="tickets-table">
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Dur. (h)</th><th>Rol sugerido</th></tr></thead>
        <tbody>${catalogo.map(c => `
          <tr>
            <td><strong>${U.escapeHtml(c.Nombre || '-')}</strong>${c.Descripcion ? `<br><span class="muted" style="font-size:.75rem;">${U.escapeHtml(c.Descripcion)}</span>` : ''}</td>
            <td>${U.escapeHtml(c.Categoria || '—')}</td>
            <td>${U.escapeHtml(c['Duracion estimada (h)'] || '—')}</td>
            <td>${U.escapeHtml(c['Rol sugerido'] || '—')}</td>
          </tr>`).join('')}</tbody>
      </table>`;
  }

  async function saveCatalogo_(e) {
    e.preventDefault();
    const data = {
      action: 'crearCatalogoTarea',
      nombre:     document.getElementById('cNombre').value.trim(),
      categoria:  document.getElementById('cCategoria').value.trim(),
      descripcion: document.getElementById('cDesc').value.trim(),
      duracion:   document.getElementById('cDuracion').value.trim(),
      rol:        document.getElementById('cRol').value,
    };
    if (!data.nombre) return setCatMsg_('El nombre es obligatorio.', 'error');
    try {
      const res = await U.jsonpRequest(SCRIPT(), data);
      if (res?.ok) {
        U.toast('Tarea agregada al catálogo', 'success');
        document.getElementById('catForm').reset();
        setCatMsg_('', '');
        const cat = await U.jsonpRequest(SCRIPT(), { action: 'catalogo' }).catch(() => catalogo);
        catalogo = Array.isArray(cat) ? cat : catalogo;
        fillSelects_();
        renderCatalogo_();
      } else setCatMsg_(`❌ ${res?.error || 'No se pudo guardar.'}`, 'error');
    } catch (err) { setCatMsg_(`❌ Error: ${err.message}`, 'error'); }
  }

  /* ── UI ────────────────────────────────────────────── */
  function toggleModal_(id, open) { document.getElementById(id)?.classList.toggle('open', open); }

  function wireUI_() {
    document.getElementById('btnNueva')?.addEventListener('click', () => openModal_(null));
    document.getElementById('btnCatalogo')?.addEventListener('click', openCatalogo_);
    document.getElementById('tTipo')?.addEventListener('change', onTipoChange_);
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

  function setListMsg_(msg) {
    const el = document.getElementById('tareasList');
    if (el) el.innerHTML = `<p class="muted" style="text-align:center;padding:2rem;">${U.escapeHtml(msg)}</p>`;
  }
  function setModalMsg_(text, type) {
    const el = document.getElementById('modalMsg');
    if (el) { el.textContent = text || ''; el.className = `form-msg ${type || ''}`.trim(); }
  }
  function setCatMsg_(text, type) {
    const el = document.getElementById('catMsg');
    if (el) { el.textContent = text || ''; el.className = `form-msg ${type || ''}`.trim(); }
  }
})();
