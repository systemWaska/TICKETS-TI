/**
 * admin.js v3.0
 * - PIN guard
 * - Búsqueda tiempo real
 * - Log de sesión
 * - Fix event listeners (compatibles con initLayout v3)
 */
(function () {
  'use strict';
  const U = window.Utils;
  let allTickets = [], filteredTickets = [], selectedCodigo = null;
  const sessionChanges = [];

  /* ── PIN ────────────────────────────────────────────── */
  window.initPinScreen_ = function() {
    const pinScreen  = document.getElementById('pinScreen');
    const adminContent = document.getElementById('adminContent');
    const pinInput   = document.getElementById('pinInput');
    const pinBtn     = document.getElementById('pinBtn');
    const pinMsg     = document.getElementById('pinMsg');

    function tryPin() {
      const entered = (pinInput?.value || '').trim();
      const correct = String(window.CONFIG?.ADMIN_PIN || '1234');
      if (entered === correct) {
        if (pinScreen)   pinScreen.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
        loadAll();
      } else {
        if (pinMsg) { pinMsg.textContent = '❌ PIN incorrecto. Intenta nuevamente.'; pinMsg.className = 'form-msg error'; }
        if (pinInput) { pinInput.value = ''; pinInput.focus(); }
      }
    }

    pinBtn?.addEventListener('click', tryPin);
    pinInput?.addEventListener('keydown', e => { if (e.key === 'Enter') tryPin(); });
    pinInput?.focus();

    document.getElementById('btnLogout')?.addEventListener('click', () => {
      if (adminContent) adminContent.style.display = 'none';
      if (pinScreen)   pinScreen.style.display = 'flex';
      if (pinInput)    { pinInput.value = ''; pinInput.focus(); }
      if (pinMsg)      { pinMsg.textContent = ''; pinMsg.className = 'form-msg'; }
    });
  };

  /* ── LOAD ───────────────────────────────────────────── */
  async function loadAll() {
    setMsg('Cargando tickets...', 'info');
    try {
      const [tickets, config] = await Promise.all([
        U.jsonpRequest(window.CONFIG.SCRIPT_URL),
        U.jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=config`)
      ]);
      allTickets = Array.isArray(tickets) ? tickets.map(t => U.normalizeTicket(t)) : [];
      filteredTickets = [...allTickets];
      renderTicketList(filteredTickets);
      setMsg('', '');
      if (config?.status === 'success') {
        populateFilterSelect('filterArea',   config.areas,    'Todas las áreas');
        populateFilterSelect('filterEstado', config.estados,  'Todos los estados');
        populateUpdateEstados(config.estados);
      }
      document.getElementById('ticketListCount').textContent = `${allTickets.length} tickets cargados`;
    } catch (err) {
      setMsg('❌ Error: ' + err.message, 'error');
    }
  }

  function populateFilterSelect(id, items, def) {
    const sel = document.getElementById(id);
    if (!sel || !items) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${def}</option>` + items.map(i => `<option value="${U.escapeHtml(i)}">${U.escapeHtml(i)}</option>`).join('');
    sel.value = cur;
  }

  function populateUpdateEstados(estados) {
    const sel = document.getElementById('estado');
    if (!sel || !estados) return;
    sel.innerHTML = '<option value="">Seleccione estado...</option>' + estados.map(e => `<option value="${U.escapeHtml(e)}">${U.escapeHtml(e)}</option>`).join('');
  }

  /* ── RENDER LISTA ───────────────────────────────────── */
  function renderTicketList(tickets) {
    const container = document.getElementById('ticketListDropdown');
    if (!container) return;
    if (!tickets.length) {
      container.innerHTML = '<p style="padding:1rem;text-align:center;color:var(--muted);font-size:.83rem;">Sin resultados</p>';
      return;
    }
    const order = { 'Pendiente':0,'En atención':1,'Bloqueado':1,'Pausado':2,'Atendido':3,'Anulado':4 };
    const sorted = [...tickets].sort((a,b) => {
      const ea = order[a.estado]??5, eb = order[b.estado]??5;
      if (ea !== eb) return ea - eb;
      return new Date(b.fechaIngreso) - new Date(a.fechaIngreso);
    });
    container.innerHTML = sorted.map(t => `
      <div class="ticket-list-item${selectedCodigo===t.codigo?' selected':''}" data-codigo="${U.escapeHtml(t.codigo)}">
        <span class="tl-code">${U.escapeHtml(t.codigo)}</span>
        <span class="tl-title">${U.escapeHtml(t.titulo||t.nombre)}</span>
        <span class="tl-badges">
          <span class="badge ${U.normalizeClass(t.estado)}">${U.escapeHtml(t.estado)}</span>
          <span class="badge ${U.normalizeClass(t.prioridad)}">${U.escapeHtml(t.prioridad)}</span>
        </span>
      </div>`).join('');

    // Event delegation (sobrevive a rerenders)
    container.onclick = e => {
      const item = e.target.closest('.ticket-list-item');
      if (item?.dataset.codigo) selectTicket(item.dataset.codigo);
    };
    document.getElementById('ticketListCount').textContent = `Mostrando ${sorted.length} de ${allTickets.length} tickets`;
  }

  /* ── SELECT TICKET ──────────────────────────────────── */
  function selectTicket(codigo) {
    selectedCodigo = codigo;
    const t = allTickets.find(x => x.codigo === codigo);
    if (!t) return;
    document.querySelectorAll('.ticket-list-item').forEach(el => el.classList.toggle('selected', el.dataset.codigo === codigo));
    const panelDetalle = document.getElementById('panelDetalle');
    if (panelDetalle) panelDetalle.style.display = 'block';
    document.getElementById('detalleCodigo').textContent = t.codigo;
    document.getElementById('detalleBadges').innerHTML = U.renderBadges(t.estado, t.prioridad);
    document.getElementById('detalleGrid').innerHTML = `
      <div class="detail-item"><label>Solicitante</label><p>${U.escapeHtml(t.nombre||'-')}</p></div>
      <div class="detail-item"><label>Área</label><p>${U.escapeHtml(t.area||'-')}</p></div>
      <div class="detail-item"><label>Tipo</label><p>${U.escapeHtml(t.tipo||'-')}</p></div>
      <div class="detail-item"><label>Prioridad</label><p>${U.escapeHtml(t.prioridad||'-')}</p></div>
      <div class="detail-item"><label>Ingreso</label><p>${U.formatDate(t.fechaIngreso)}</p></div>
      <div class="detail-item"><label>Cierre</label><p>${t.fechaCierre ? U.formatDate(t.fechaCierre) : 'Abierto'}</p></div>`;
    document.getElementById('detalleDesc').innerHTML = `<strong>Descripción:</strong><br>${U.escapeHtml(t.descripcion||'Sin descripción')}`;
    const solPanel = document.getElementById('detalleSolucionActual');
    if (t.solucion) {
      solPanel.style.display = 'block';
      document.getElementById('detalleSolucionTxt').textContent = t.solucion;
      document.getElementById('detalleDetalleTxt').textContent  = t.detalleSolucion || '';
    } else { solPanel.style.display = 'none'; }
    document.getElementById('noTicketMsg').style.display = 'none';
    document.getElementById('adminForm').style.display   = 'block';
    const estadoSel = document.getElementById('estado');
    if (estadoSel) estadoSel.value = t.estado || '';
    document.getElementById('solucion').value = t.solucion || '';
    document.getElementById('detalle').value  = t.detalleSolucion || '';
    document.getElementById('fechaCierre').value = '';
    setMsg('', '');
  }

  /* ── FILTROS ────────────────────────────────────────── */
  function applyFilters() {
    const q     = (document.getElementById('ticketSearchInput')?.value || '').trim().toLowerCase();
    const area  = (document.getElementById('filterArea')?.value  || '').trim();
    const estado= (document.getElementById('filterEstado')?.value|| '').trim();
    filteredTickets = allTickets.filter(t =>
      (!q     || t.codigo.toLowerCase().includes(q) || t.titulo.toLowerCase().includes(q) || t.nombre.toLowerCase().includes(q) || t.descripcion.toLowerCase().includes(q)) &&
      (!area  || t.area   === area) &&
      (!estado|| t.estado === estado)
    );
    renderTicketList(filteredTickets);
  }

  /* ── UPDATE ─────────────────────────────────────────── */
  async function updateTicket(e) {
    e.preventDefault();
    if (!selectedCodigo) return setMsg('Selecciona un ticket primero.', 'error');
    const estado    = document.getElementById('estado')?.value.trim();
    const solucion  = document.getElementById('solucion')?.value.trim();
    const detalle   = document.getElementById('detalle')?.value.trim();
    const fechaRaw  = document.getElementById('fechaCierre')?.value || '';
    if (!estado) return setMsg('Selecciona un estado.', 'error');
    if (['Atendido','Anulado'].includes(estado) && !solucion) return setMsg('La solución es obligatoria para cerrar un ticket.', 'error');
    let fechaCierre = '';
    if (fechaRaw) { const [d,t2]=fechaRaw.split('T'); fechaCierre=`${d} ${t2}:00`; }
    const btn = document.querySelector('#adminForm [type=submit]');
    if (btn) { btn.disabled=true; btn.textContent='Guardando...'; }
    setMsg('Guardando...', 'info');
    try {
      const res = await U.jsonpRequest(window.CONFIG.SCRIPT_URL, { action:'update', codigo:selectedCodigo, estado, solucion, detalle, fechaCierre });
      if (res?.ok === true) {
        setMsg('✅ Actualizado correctamente.', 'success');
        U.toast(`✅ ${selectedCodigo} → ${estado}`, 'success');
        sessionChanges.unshift({ codigo:selectedCodigo, estado, ts: new Date().toLocaleTimeString('es-PE') });
        renderSessionLog();
        const idx = allTickets.findIndex(t => t.codigo === selectedCodigo);
        if (idx !== -1) { allTickets[idx].estado=estado; allTickets[idx].solucion=solucion; allTickets[idx].detalleSolucion=detalle; }
        applyFilters();
        selectTicket(selectedCodigo);
      } else {
        setMsg(`❌ Error: ${res?.error||res?.message||'Respuesta inesperada'}`, 'error');
        U.toast(`Error al actualizar ${selectedCodigo}`, 'error');
      }
    } catch (err) {
      setMsg(`❌ Error de red: ${err.message}`, 'error');
    } finally {
      if (btn) { btn.disabled=false; btn.textContent='✅ Guardar Cambios'; }
    }
  }

  function renderSessionLog() {
    const log = document.getElementById('sessionLog');
    if (!log) return;
    log.innerHTML = !sessionChanges.length
      ? '<p class="muted" style="text-align:center;padding:1rem;font-size:.8rem;">Sin cambios aún</p>'
      : sessionChanges.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .5rem;border-bottom:1px solid var(--border);font-size:.8rem;">
          <span><strong style="font-family:var(--mono);color:var(--primary)">${c.codigo}</strong> → <span class="badge ${U.normalizeClass(c.estado)}">${c.estado}</span></span>
          <span class="muted">${c.ts}</span>
        </div>`).join('');
  }

  function setMsg(text, type) {
    const el = document.getElementById('msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = `form-msg ${type||''}`.trim();
  }

  /* ── INIT ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('ticketSearchInput')?.addEventListener('input', applyFilters);
    document.getElementById('filterArea')?.addEventListener('change', applyFilters);
    document.getElementById('filterEstado')?.addEventListener('change', applyFilters);
    document.getElementById('adminForm')?.addEventListener('submit', updateTicket);
    document.getElementById('btnClear')?.addEventListener('click', () => {
      selectedCodigo = null;
      document.getElementById('adminForm').style.display   = 'none';
      document.getElementById('noTicketMsg').style.display = 'block';
      document.getElementById('panelDetalle').style.display= 'none';
      document.querySelectorAll('.ticket-list-item').forEach(el => el.classList.remove('selected'));
      setMsg('', '');
    });
  });
})();
