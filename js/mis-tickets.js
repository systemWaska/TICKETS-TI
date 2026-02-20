/**
 * mis-tickets.js v3.0
 * Fix: event delegation para modal (sobrevive a initLayout)
 */
(function () {
  'use strict';
  const U = window.Utils;
  let allTickets = [], filteredTickets = [];

  document.addEventListener('DOMContentLoaded', () => {
    initFilters_();
    cargarMisTickets_();

    document.getElementById('btnBuscar')?.addEventListener('click', applyFilters_);
    document.getElementById('btnLimpiar')?.addEventListener('click', limpiarFiltros_);
    document.getElementById('filterLimit')?.addEventListener('change', applyFilters_);
    document.getElementById('filterCode')?.addEventListener('keydown', e => { if (e.key==='Enter') applyFilters_(); });
    document.getElementById('btnExportar')?.addEventListener('click', () => {
      if (!filteredTickets.length) return U.toast('Sin datos para exportar','info');
      U.exportCSV(filteredTickets, `tickets_${new Date().toISOString().slice(0,10)}.csv`);
      U.toast(`✅ Exportados ${filteredTickets.length} tickets`,'success');
    });

    // ── Modal: event delegation en document (sobrevive a cualquier reestructuración del DOM)
    document.addEventListener('click', e => {
      // Cerrar con .modal-close, .modal-close-btn, .modal-backdrop o tecla Escape
      if (e.target.closest('.modal-close') || e.target.closest('.modal-close-btn') || e.target.classList.contains('modal-backdrop')) {
        closeModal_();
      }
    });
    document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal_(); });
  });

  async function initFilters_() {
    try {
      const cfg = await U.jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=config`);
      if (cfg?.status !== 'success') return;
      populate_('filterArea',   cfg.areas,   'Todas las áreas');
      populate_('filterEstado', cfg.estados, 'Todos los estados');
      populate_('filterTipo',   cfg.tipos,   'Todos los tipos');
      document.getElementById('filterArea')?.addEventListener('change', filterUsersByArea_);
      window._configCache = cfg;
    } catch {}
  }

  function populate_(id, items, def) {
    const sel = document.getElementById(id);
    if (!sel || !items) return;
    sel.innerHTML = `<option value="">${def}</option>` + items.map(i => `<option value="${U.escapeHtml(i)}">${U.escapeHtml(i)}</option>`).join('');
  }

  function filterUsersByArea_() {
    const area = document.getElementById('filterArea')?.value || '';
    const userSel = document.getElementById('filterUser');
    if (!userSel || !window._configCache) return;
    const usuarios = (window._configCache.raw || [])
      .filter(r => !area || String(r.Area||r.area||'').trim() === area)
      .map(r => String(r.Usuario||r.usuario||'').trim()).filter(Boolean);
    const unique = [...new Set(usuarios)];
    userSel.innerHTML = '<option value="">Todos</option>' + unique.map(u => `<option value="${U.escapeHtml(u)}">${U.escapeHtml(u)}</option>`).join('');
  }

  async function cargarMisTickets_() {
    setListMsg_('Cargando...');
    try {
      const tickets = await U.jsonpRequest(window.CONFIG.SCRIPT_URL);
      if (!Array.isArray(tickets)) throw new Error('Respuesta inválida del servidor');
      allTickets = tickets.map(t => U.normalizeTicket(t));
      filteredTickets = [...allTickets];
      applyFilters_();
    } catch (err) {
      setListMsg_(`❌ Error al cargar: ${err.message}`);
    }
  }

  function applyFilters_() {
    const area   = document.getElementById('filterArea')?.value   || '';
    const user   = document.getElementById('filterUser')?.value   || '';
    const estado = document.getElementById('filterEstado')?.value || '';
    const tipo   = document.getElementById('filterTipo')?.value   || '';
    const q      = (document.getElementById('filterCode')?.value || '').trim().toLowerCase();
    const limit  = parseInt(document.getElementById('filterLimit')?.value || '10');

    filteredTickets = allTickets.filter(t =>
      (!area  || t.area   === area) &&
      (!user  || t.nombre === user) &&
      (!estado|| t.estado === estado) &&
      (!tipo  || t.tipo   === tipo) &&
      (!q     || t.codigo.toLowerCase().includes(q) || t.titulo.toLowerCase().includes(q) || t.nombre.toLowerCase().includes(q))
    ).sort((a,b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso));

    const limited = limit > 0 ? filteredTickets.slice(0, limit) : filteredTickets;
    const info = document.getElementById('filterInfo');
    if (info) info.textContent = `Mostrando ${limited.length} de ${filteredTickets.length} tickets encontrados`;
    renderList_(limited);
  }

  function limpiarFiltros_() {
    ['filterArea','filterUser','filterEstado','filterTipo','filterCode'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const us = document.getElementById('filterUser');
    if (us) us.innerHTML = '<option value="">Todos</option>';
    applyFilters_();
  }

  function renderList_(tickets) {
    const container = document.getElementById('ticketsList');
    if (!container) return;
    if (!tickets.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>Sin tickets</h3><p>No hay resultados para los filtros seleccionados.</p></div>`;
      return;
    }
    container.innerHTML = tickets.map(t => {
      const diasAbierto = !['Atendido','Anulado'].includes(t.estado)
        ? Math.floor((Date.now()-new Date(t.fechaIngreso))/(1000*60*60*24)) : null;
      const tiempoRes = t.fechaCierre ? U.tiempoResolucion(t.fechaIngreso, t.fechaCierre) : null;
      return `<div class="ticket-card" data-open-modal="${U.escapeHtml(t.codigo)}">
        <div class="ticket-card-head">
          <span class="ticket-card-code">${U.escapeHtml(t.codigo)}</span>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap;">${U.renderBadges(t.estado,t.prioridad)}</div>
        </div>
        <div class="ticket-card-title">${U.escapeHtml(t.titulo||'Sin título')}</div>
        <div class="ticket-card-meta">
          <span>👤 ${U.escapeHtml(t.nombre)}</span> · <span>🏢 ${U.escapeHtml(t.area)}</span>
          · <span class="badge ${U.normalizeClass(t.tipo)}" style="font-size:.65rem">${U.escapeHtml(t.tipo)}</span>
          ${diasAbierto!==null ? `<span>· ⏳ ${diasAbierto}d abierto</span>` : ''}
          ${tiempoRes ? `<span>· ✅ Resuelto en ${tiempoRes}</span>` : ''}
        </div>
        <div class="muted" style="margin-top:.3rem;font-size:.73rem;">Ingreso: ${U.formatDate(t.fechaIngreso)}</div>
      </div>`;
    }).join('');

    // Event delegation para abrir modal
    container.onclick = e => {
      const card = e.target.closest('[data-open-modal]');
      if (card) openModal_(card.dataset.openModal);
    };
  }

  function openModal_(codigo) {
    const t = allTickets.find(x => x.codigo === codigo);
    if (!t) return;
    const modal = document.getElementById('ticketModal');
    if (!modal) return;
    document.getElementById('modalTitle').textContent = `${t.codigo} · ${t.titulo||'Sin título'}`;
    document.getElementById('modalOpenTab').href = `ticket.html?id=${encodeURIComponent(t.codigo)}`;
    const tiempoRes = t.fechaCierre ? U.tiempoResolucion(t.fechaIngreso, t.fechaCierre) : null;
    document.getElementById('modalBody').innerHTML = `
      <div style="margin-bottom:.75rem;">${U.renderBadges(t.estado,t.prioridad)} <span class="badge ${U.normalizeClass(t.tipo)}">${U.escapeHtml(t.tipo)}</span></div>
      <div class="modal-field"><span class="modal-field-label">Solicitante</span><span class="modal-field-val">${U.escapeHtml(t.nombre)}</span></div>
      <div class="modal-field"><span class="modal-field-label">Área</span><span class="modal-field-val">${U.escapeHtml(t.area)}</span></div>
      <div class="modal-field"><span class="modal-field-label">Ingreso</span><span class="modal-field-val">${U.formatDate(t.fechaIngreso)}</span></div>
      ${t.fechaCierre?`<div class="modal-field"><span class="modal-field-label">Cierre</span><span class="modal-field-val">${U.formatDate(t.fechaCierre)}${tiempoRes?` <span class="muted">(${tiempoRes})</span>`:''}</span></div>`:''}
      <div class="divider"></div>
      <div class="modal-field"><span class="modal-field-label">Descripción</span><span class="modal-field-val">${U.escapeHtml(t.descripcion||'-')}</span></div>
      ${t.solucion?`<div class="divider"></div>
        <div class="modal-field"><span class="modal-field-label">Solución</span><span class="modal-field-val">${U.escapeHtml(t.solucion)}</span></div>
        ${t.detalleSolucion?`<div class="modal-field"><span class="modal-field-label">Detalle</span><span class="modal-field-val">${U.escapeHtml(t.detalleSolucion)}</span></div>`:''}`:''} `;
    modal.classList.add('open');
  }

  function closeModal_() {
    document.getElementById('ticketModal')?.classList.remove('open');
  }

  function setListMsg_(msg) {
    const el = document.getElementById('ticketsList');
    if (el) el.innerHTML = `<p class="muted" style="padding:2rem;text-align:center;">${msg}</p>`;
  }
})();
