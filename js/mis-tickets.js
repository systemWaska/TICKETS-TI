/**
 * mis-tickets.js — Vista "Mis Tickets".
 * Propósito: listar tickets, filtrarlos y mostrar su detalle en un modal.
 * Fuente de datos: la acción `tickets` del backend (jsonpCached 'tickets_all'),
 *   normalizada con U.normalizeTicket.
 * Roles: para el rol Usuario (no elevado) la lista se restringe a los tickets
 *   cuyo dueño (t.nombre) coincide con el usuario en sesión; Administrador,
 *   Técnico TI y Líder de equipo ven todos.
 */
(function () {
  'use strict';
  const U = window.Utils;
  let allTickets = [], filteredTickets = [];

  document.addEventListener('DOMContentLoaded', () => {
    initFilters_();
    loadTickets_();

    document.getElementById('btnBuscar')?.addEventListener('click', applyFilters_);
    document.getElementById('btnLimpiar')?.addEventListener('click', clearFilters_);
    document.getElementById('fLimit')?.addEventListener('change', applyFilters_);
    document.getElementById('fCode')?.addEventListener('keydown', e => { if(e.key==='Enter') applyFilters_(); });
    document.getElementById('btnExport')?.addEventListener('click', () => {
      if (!filteredTickets.length) return U.toast('Sin datos para exportar','info');
      U.exportCSV(filteredTickets, `mis-tickets-${new Date().toISOString().slice(0,10)}.csv`);
      U.toast(`✅ ${filteredTickets.length} tickets exportados`,'success');
    });

    // Modal: event delegation en document
    document.addEventListener('click', e => {
      if (e.target.closest('.modal-close') || e.target.closest('.modal-close-btn') || e.target.classList.contains('modal-backdrop'))
        closeModal_();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal_(); });
  });

  async function initFilters_() {
    try {
      const cfg = await U.jsonpCached(window.CONFIG.SCRIPT_URL + '?action=config', {}, 'config', 300);
      if (cfg?.status !== 'success') return;
      fill_('fArea',   cfg.areas,   'Todas las áreas');
      fill_('fEstado', cfg.estados, 'Todos los estados');
      fill_('fTipo',   cfg.tipos,   'Todos los tipos');
      window._cfg = cfg;
      document.getElementById('fArea')?.addEventListener('change', () => {
        const area = document.getElementById('fArea')?.value || '';
        const sel  = document.getElementById('fNombre');
        if (!sel) return;
        if (!area) { sel.innerHTML = '<option value="">Todos</option>'; return; }
        const users = [...new Set((cfg.raw||[]).filter(r=>String(r.Area||r.area||'').trim()===area).map(r=>String(r.Usuario||r.usuario||'').trim()).filter(Boolean))].sort();
        sel.innerHTML = '<option value="">Todos</option>' + users.map(u=>`<option value="${U.escapeHtml(u)}">${U.escapeHtml(u)}</option>`).join('');
      });
    } catch {}
  }

  function fill_(id, items, def) {
    const sel = document.getElementById(id);
    if (!sel || !items) return;
    sel.innerHTML = `<option value="">${def}</option>` + items.map(i=>`<option value="${U.escapeHtml(i)}">${U.escapeHtml(i)}</option>`).join('');
  }

  async function loadTickets_() {
    try {
      const tickets = await U.jsonpCached(window.CONFIG.SCRIPT_URL, {}, 'tickets_all', 90);
      if (!Array.isArray(tickets)) throw new Error('Respuesta inválida');
      allTickets = tickets.map(t => U.normalizeTicket(t));
      // Rol Usuario (no elevado): solo ve sus propios tickets (por dueño t.nombre).
      const elevado = ['Administrador','Técnico TI','Líder de equipo'].includes(window.Session.rol());
      if (!elevado) {
        allTickets = allTickets.filter(t => String(t.nombre||'').trim().toLowerCase() === String(window.Session.nombre()||'').trim().toLowerCase());
      }
      filteredTickets = [...allTickets];
      applyFilters_();
    } catch(err) {
      const el = document.getElementById('ticketsList');
      if (el) el.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>Error al cargar</h3><p>${U.escapeHtml(err.message)}</p></div>`;
    }
  }

  function applyFilters_() {
    const area   = document.getElementById('fArea')?.value   || '';
    const nombre = document.getElementById('fNombre')?.value || '';
    const estado = document.getElementById('fEstado')?.value || '';
    const tipo   = document.getElementById('fTipo')?.value   || '';
    const q      = (document.getElementById('fCode')?.value  || '').trim().toLowerCase();
    const limit  = parseInt(document.getElementById('fLimit')?.value || '10');

    filteredTickets = allTickets.filter(t =>
      (!area   || t.area   === area)   &&
      (!nombre || t.nombre === nombre) &&
      (!estado || t.estado === estado) &&
      (!tipo   || t.tipo   === tipo)   &&
      (!q      || t.codigo.toLowerCase().includes(q) || t.titulo.toLowerCase().includes(q) || t.nombre.toLowerCase().includes(q))
    ).sort((a,b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso));

    const shown = limit > 0 ? filteredTickets.slice(0,limit) : filteredTickets;
    const info  = document.getElementById('filterInfo');
    if (info) info.textContent = `Mostrando ${shown.length} de ${filteredTickets.length} tickets`;
    renderList_(shown);
  }

  function clearFilters_() {
    ['fArea','fNombre','fEstado','fTipo','fCode'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const n = document.getElementById('fNombre');
    if (n) n.innerHTML = '<option value="">Todos</option>';
    applyFilters_();
  }

  function renderList_(tickets) {
    const container = document.getElementById('ticketsList');
    if (!container) return;
    if (!tickets.length) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><h3>Sin resultados</h3><p>No hay tickets que coincidan con los filtros.</p></div>`;
      return;
    }
    container.innerHTML = tickets.map(t => {
      const diasAbierto = !['Atendido','Anulado'].includes(t.estado)
        ? Math.floor((Date.now() - new Date(t.fechaIngreso)) / (1000*60*60*24)) : null;
      const tiempoRes = t.fechaCierre ? U.tiempoResolucion(t.fechaIngreso, t.fechaCierre) : null;
      return `<div class="ticket-card" data-open-modal="${U.escapeHtml(t.codigo)}">
        <div class="ticket-card-head">
          <span class="ticket-card-code">${U.escapeHtml(t.codigo)}</span>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap;">${U.renderBadges(t.estado,t.prioridad,t.tipo)}</div>
        </div>
        <div class="ticket-card-title">${U.escapeHtml(t.titulo||'Sin título')}</div>
        <div class="ticket-card-meta">
          <span>👤 ${U.escapeHtml(t.nombre)}</span>
          <span>·</span><span>🏢 ${U.escapeHtml(t.area)}</span>
          ${diasAbierto !== null ? `<span>·</span><span>⏳ ${diasAbierto}d abierto</span>` : ''}
          ${tiempoRes ? `<span>·</span><span style="color:#065f46">✅ Resuelto en ${tiempoRes}</span>` : ''}
        </div>
        <p class="muted" style="margin-top:.3rem;font-size:.72rem;">Ingreso: ${U.formatDate(t.fechaIngreso)}</p>
      </div>`;
    }).join('');

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
      <div style="margin-bottom:.75rem;">${U.renderBadges(t.estado,t.prioridad,t.tipo)}</div>
      <div class="modal-field"><span class="modal-field-label">Solicitante</span><span class="modal-field-val">${U.escapeHtml(t.nombre)}</span></div>
      <div class="modal-field"><span class="modal-field-label">Área</span><span class="modal-field-val">${U.escapeHtml(t.area)}</span></div>
      <div class="modal-field"><span class="modal-field-label">Ingreso</span><span class="modal-field-val">${U.formatDate(t.fechaIngreso)}</span></div>
      ${t.fechaCierre ? `<div class="modal-field"><span class="modal-field-label">Cierre</span><span class="modal-field-val">${U.formatDate(t.fechaCierre)}${tiempoRes?` <span class="muted">(${tiempoRes})</span>`:''}</span></div>` : ''}
      <div class="divider"></div>
      <div class="modal-field"><span class="modal-field-label">Descripción</span><span class="modal-field-val" style="white-space:pre-wrap;">${U.escapeHtml(t.descripcion||'-')}</span></div>
      ${t.solucion ? `<div class="divider"></div>
        <div class="modal-field"><span class="modal-field-label">Solución</span><span class="modal-field-val">${U.escapeHtml(t.solucion)}</span></div>
        ${t.detalleSolucion ? `<div class="modal-field"><span class="modal-field-label">Detalle</span><span class="modal-field-val">${U.escapeHtml(t.detalleSolucion)}</span></div>` : ''}` : ''}
      ${t.evidencia ? `<div class="divider"></div><div class="modal-field"><span class="modal-field-label">Evidencia</span><span class="modal-field-val"><a href="${U.escapeHtml(U.safeUrl(t.evidencia))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">📎 Ver archivo</a></span></div>` : ''}`;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal_() {
    document.getElementById('ticketModal')?.classList.remove('open');
    document.body.style.overflow = '';
  }
})();
