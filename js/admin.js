/**
 * admin.js v4 - Panel Administrativo
 * PIN guard + búsqueda tiempo real + log de sesión
 */
(function () {
  'use strict';
  const U = window.Utils;
  let allTickets = [], filteredTickets = [], selectedCodigo = null;
  const sessionChanges = [];

  /* ════════════════════════════════════════
     PIN SCREEN
  ════════════════════════════════════════ */
  window.initPinScreen_ = function () {
    const pinScreen    = document.getElementById('pinScreen');
    const adminContent = document.getElementById('adminContent');
    const pinInput     = document.getElementById('pinInput');
    const pinBtn       = document.getElementById('pinBtn');
    const pinMsg       = document.getElementById('pinMsg');

    if (!pinScreen || !adminContent) {
      console.warn('[admin.js] No se encontraron #pinScreen o #adminContent');
      return;
    }

    function tryPin() {
      const entered = String(pinInput?.value || '').trim();
      const correct = String(window.CONFIG?.ADMIN_PIN || '1234');
      if (entered === correct) {
        pinScreen.style.display = 'none';
        adminContent.style.display = 'block';
        loadAll_();
      } else {
        if (pinMsg) {
          pinMsg.textContent = '❌ PIN incorrecto. Inténtalo nuevamente.';
          pinMsg.className = 'form-msg error';
        }
        if (pinInput) { pinInput.value = ''; pinInput.focus(); }
        // Shake animation
        pinInput?.classList.add('shake');
        setTimeout(() => pinInput?.classList.remove('shake'), 500);
      }
    }

    pinBtn?.addEventListener('click', tryPin);
    pinInput?.addEventListener('keydown', e => { if (e.key === 'Enter') tryPin(); });

    document.getElementById('btnLogout')?.addEventListener('click', () => {
      adminContent.style.display = 'none';
      pinScreen.style.display    = 'flex';
      if (pinInput) { pinInput.value = ''; pinInput.focus(); }
      if (pinMsg)   { pinMsg.textContent = ''; pinMsg.className = 'form-msg'; }
    });

    // Foco automático al PIN
    setTimeout(() => pinInput?.focus(), 100);
  };

  /* ════════════════════════════════════════
     CARGA DE DATOS
  ════════════════════════════════════════ */
  async function loadAll_() {
    setDropdownMsg_('⏳ Cargando tickets...');
    try {
      const [tickets, config] = await Promise.all([
        U.jsonpCached(window.CONFIG.SCRIPT_URL, {}, 'tickets_all', 90),
        U.jsonpCached(window.CONFIG.SCRIPT_URL + '?action=config', {}, 'config', 300),
      ]);
      allTickets = Array.isArray(tickets) ? tickets.map(t => U.normalizeTicket(t)) : [];
      filteredTickets = [...allTickets];
      renderList_(filteredTickets);

      if (config?.status === 'success') {
        fillSelect_('filterArea',   config.areas,    'Todas las áreas');
        fillSelect_('filterEstado', config.estados,  'Todos los estados');
        fillSelect_('estado',       config.estados,  'Seleccione estado...');
      }
      const countEl = document.getElementById('ticketListCount');
      if (countEl) countEl.textContent = `${allTickets.length} tickets cargados`;
    } catch (err) {
      setDropdownMsg_(`❌ Error: ${err.message}`);
    }
  }

  function fillSelect_(id, items, defaultLabel) {
    const sel = document.getElementById(id);
    if (!sel || !Array.isArray(items)) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${defaultLabel}</option>` +
      items.map(i => `<option value="${U.escapeHtml(i)}">${U.escapeHtml(i)}</option>`).join('');
    if (cur) sel.value = cur;
  }

  /* ════════════════════════════════════════
     RENDERIZAR LISTA
  ════════════════════════════════════════ */
  function renderList_(tickets) {
    const container = document.getElementById('ticketListDropdown');
    if (!container) return;

    if (!tickets.length) {
      container.innerHTML = '<p class="list-empty">Sin resultados para los filtros aplicados</p>';
      const countEl = document.getElementById('ticketListCount');
      if (countEl) countEl.textContent = 'Sin resultados';
      return;
    }

    const orderEstado = { 'Pendiente':0, 'Bloqueado':1, 'En atención':2, 'Pausado':3, 'Atendido':4, 'Anulado':5 };
    const sorted = [...tickets].sort((a,b) => {
      const ea = orderEstado[a.estado] ?? 9;
      const eb = orderEstado[b.estado] ?? 9;
      if (ea !== eb) return ea - eb;
      return new Date(b.fechaIngreso) - new Date(a.fechaIngreso);
    });

    container.innerHTML = sorted.map(t => `
      <div class="ticket-list-item${selectedCodigo === t.codigo ? ' selected' : ''}"
           data-codigo="${U.escapeHtml(t.codigo)}">
        <span class="tl-code">${U.escapeHtml(t.codigo)}</span>
        <span class="tl-title">${U.escapeHtml(t.titulo || t.nombre || '-')}</span>
        <span class="tl-badges">
          <span class="badge ${U.normalizeClass(t.estado)}">${U.escapeHtml(t.estado)}</span>
          ${t.prioridad ? `<span class="badge ${U.normalizeClass(t.prioridad)}">${U.escapeHtml(t.prioridad)}</span>` : ''}
        </span>
      </div>`).join('');

    // Event delegation
    container.onclick = e => {
      const item = e.target.closest('.ticket-list-item');
      if (item?.dataset.codigo) selectTicket_(item.dataset.codigo);
    };

    const countEl = document.getElementById('ticketListCount');
    if (countEl) countEl.textContent = `Mostrando ${sorted.length} de ${allTickets.length} tickets`;
  }

  /* ════════════════════════════════════════
     SELECCIONAR TICKET
  ════════════════════════════════════════ */
  function selectTicket_(codigo) {
    selectedCodigo = codigo;
    const t = allTickets.find(x => x.codigo === codigo);
    if (!t) return;

    // Resaltar en lista
    document.querySelectorAll('.ticket-list-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.codigo === codigo);
    });

    // Panel detalle
    const panelDetalle = document.getElementById('panelDetalle');
    if (panelDetalle) panelDetalle.style.display = 'block';

    document.getElementById('detalleCodigo').textContent = t.codigo;
    document.getElementById('detalleBadges').innerHTML   = U.renderBadges(t.estado, t.prioridad, t.tipo);

    document.getElementById('detalleGrid').innerHTML = `
      <div class="detail-item"><label>Solicitante</label><p>${U.escapeHtml(t.nombre||'-')}</p></div>
      <div class="detail-item"><label>Área</label><p>${U.escapeHtml(t.area||'-')}</p></div>
      <div class="detail-item"><label>Tipo</label><p>${U.escapeHtml(t.tipo||'-')}</p></div>
      <div class="detail-item"><label>Prioridad</label><p>${U.escapeHtml(t.prioridad||'-')}</p></div>
      <div class="detail-item"><label>Ingreso</label><p>${U.formatDate(t.fechaIngreso)}</p></div>
      <div class="detail-item"><label>Cierre</label><p>${t.fechaCierre ? U.formatDate(t.fechaCierre) : 'Abierto'}</p></div>`;

    document.getElementById('detalleDesc').innerHTML =
      `<strong>Descripción:</strong><br>${U.escapeHtml(t.descripcion||'Sin descripción')}`;

    const solPanel = document.getElementById('detalleSolucionActual');
    if (t.solucion) {
      solPanel.style.display = 'block';
      document.getElementById('detalleSolucionTxt').textContent = t.solucion;
      document.getElementById('detalleDetalleTxt').textContent  = t.detalleSolucion || '';
    } else {
      solPanel.style.display = 'none';
    }

    // Prellenar formulario
    document.getElementById('noTicketMsg').style.display = 'none';
    document.getElementById('adminForm').style.display   = 'block';
    const estadoSel = document.getElementById('estado');
    if (estadoSel) estadoSel.value = t.estado || '';
    document.getElementById('solucion').value    = t.solucion        || '';
    document.getElementById('detalle').value     = t.detalleSolucion || '';
    document.getElementById('fechaCierre').value = '';
    setMsg_('', '');
  }

  /* ════════════════════════════════════════
     FILTROS
  ════════════════════════════════════════ */
  function applyFilters_() {
    const q      = (document.getElementById('ticketSearchInput')?.value || '').toLowerCase().trim();
    const area   = document.getElementById('filterArea')?.value   || '';
    const estado = document.getElementById('filterEstado')?.value || '';

    filteredTickets = allTickets.filter(t =>
      (!q     || t.codigo.toLowerCase().includes(q)  ||
                 t.titulo.toLowerCase().includes(q)   ||
                 t.nombre.toLowerCase().includes(q)   ||
                 t.descripcion.toLowerCase().includes(q)) &&
      (!area  || t.area   === area) &&
      (!estado|| t.estado === estado)
    );
    renderList_(filteredTickets);
  }

  /* ════════════════════════════════════════
     GUARDAR CAMBIOS
  ════════════════════════════════════════ */
  async function updateTicket_(e) {
    e.preventDefault();
    if (!selectedCodigo) return setMsg_('Selecciona un ticket primero.', 'error');

    const nuevoEstado = document.getElementById('estado')?.value.trim();
    const solucion    = document.getElementById('solucion')?.value.trim();
    const detalle     = document.getElementById('detalle')?.value.trim();
    const fechaRaw    = document.getElementById('fechaCierre')?.value || '';

    if (!nuevoEstado) return setMsg_('Selecciona un estado.', 'error');
    if (['Atendido','Anulado'].includes(nuevoEstado) && !solucion)
      return setMsg_('La solución es obligatoria para cerrar el ticket.', 'error');

    let fechaCierre = '';
    if (fechaRaw) {
      const [d, t2] = fechaRaw.split('T');
      fechaCierre = `${d} ${t2}:00`;
    }

    const btn = document.querySelector('#adminForm [type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }
    setMsg_('Guardando cambios...', 'info');

    try {
      const res = await U.jsonpRequest(window.CONFIG.SCRIPT_URL, {
        action: 'update', codigo: selectedCodigo,
        estado: nuevoEstado, solucion, detalle, fechaCierre,
      });

      if (res?.ok === true) {
        setMsg_('✅ Ticket actualizado correctamente.', 'success');
        U.toast(`${selectedCodigo} → ${nuevoEstado}`, 'success');

        // Invalidar cache para que la próxima carga traiga datos frescos
        window.Utils.clearCache('tickets_all');
        // Actualizar en memoria
        const idx = allTickets.findIndex(x => x.codigo === selectedCodigo);
        if (idx !== -1) {
          allTickets[idx].estado         = nuevoEstado;
          allTickets[idx].solucion       = solucion;
          allTickets[idx].detalleSolucion = detalle;
        }
        // Log de sesión
        sessionChanges.unshift({
          codigo: selectedCodigo, estado: nuevoEstado,
          ts: new Date().toLocaleTimeString('es-PE')
        });
        renderSessionLog_();
        applyFilters_();
        selectTicket_(selectedCodigo);
      } else {
        const err = res?.error || res?.message || 'Respuesta inesperada del servidor';
        setMsg_(`❌ ${err}`, 'error');
        U.toast(`Error al actualizar: ${err}`, 'error');
      }
    } catch (err) {
      setMsg_(`❌ Error de red: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✅ Guardar Cambios'; }
    }
  }

  function renderSessionLog_() {
    const log = document.getElementById('sessionLog');
    if (!log) return;
    if (!sessionChanges.length) {
      log.innerHTML = '<p class="list-empty">Sin cambios en esta sesión</p>';
      return;
    }
    log.innerHTML = sessionChanges.map(c => `
      <div class="session-log-item">
        <span>
          <strong class="mono-code">${c.codigo}</strong>
          → <span class="badge ${window.Utils.normalizeClass(c.estado)}">${c.estado}</span>
        </span>
        <span class="muted">${c.ts}</span>
      </div>`).join('');
  }

  function setMsg_(text, type) {
    const el = document.getElementById('msg');
    if (!el) return;
    el.textContent  = text || '';
    el.className    = `form-msg ${type||''}`.trim();
  }

  function setDropdownMsg_(msg) {
    const el = document.getElementById('ticketListDropdown');
    if (el) el.innerHTML = `<p class="list-loading">${msg}</p>`;
  }

  /* ════════════════════════════════════════
     INIT
  ════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ticketSearchInput')?.addEventListener('input', applyFilters_);
    document.getElementById('filterArea')?.addEventListener('change', applyFilters_);
    document.getElementById('filterEstado')?.addEventListener('change', applyFilters_);
    document.getElementById('adminForm')?.addEventListener('submit', updateTicket_);

    document.getElementById('btnClear')?.addEventListener('click', () => {
      selectedCodigo = null;
      document.getElementById('adminForm').style.display   = 'none';
      document.getElementById('noTicketMsg').style.display = 'block';
      const pd = document.getElementById('panelDetalle');
      if (pd) pd.style.display = 'none';
      document.querySelectorAll('.ticket-list-item').forEach(el => el.classList.remove('selected'));
      setMsg_('', '');
    });
  });
})();
