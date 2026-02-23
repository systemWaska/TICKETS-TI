document.addEventListener('DOMContentLoaded', async () => {
  const wrap = document.getElementById('ticketDetailWrap');
  if (!wrap) return;
  const U = window.Utils;
  const params = new URLSearchParams(window.location.search);
  const codigo = (params.get('id') || params.get('codigo') || '').trim().toUpperCase();

  if (!codigo) {
    wrap.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><h3>Código no especificado</h3><p>Abre esta página con <code>?id=INC-001</code></p><a href="mis-tickets.html" class="btn btn-secondary" style="margin-top:1rem">← Mis Tickets</a></div>`;
    return;
  }
  if (!window.CONFIG?.SCRIPT_URL) {
    wrap.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>Config no disponible</h3><p>Revisa js/config.js</p></div>`;
    return;
  }
  wrap.innerHTML = `<p class="muted" style="text-align:center;padding:3rem;">Buscando ticket <strong>${U.escapeHtml(codigo)}</strong>...</p>`;

  try {
    const tickets = await U.jsonpRequest(window.CONFIG.SCRIPT_URL);
    const all = Array.isArray(tickets) ? tickets.map(t=>U.normalizeTicket(t)) : [];
    const t = all.find(x => x.codigo.toUpperCase() === codigo);

    if (!t) {
      wrap.innerHTML = `<div class="empty-state"><span class="empty-icon">🔍</span><h3>Ticket ${U.escapeHtml(codigo)} no encontrado</h3><p>Verifica el código o regresa a la lista.</p><a href="mis-tickets.html" class="btn btn-secondary" style="margin-top:1rem">← Mis Tickets</a></div>`;
      return;
    }

    const tiempoRes = t.fechaCierre ? U.tiempoResolucion(t.fechaIngreso, t.fechaCierre) : null;
    const titleEl = document.querySelector('.topbar-title');
    if (titleEl) titleEl.textContent = `Ticket ${t.codigo}`;

    wrap.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <div>
            <span style="font-family:monospace;font-size:.8rem;font-weight:600;color:#2563eb;">${U.escapeHtml(t.codigo)}</span>
            <h2 style="font-size:1rem;font-weight:700;color:#111827;margin-top:.2rem;">${U.escapeHtml(t.titulo||'Sin título')}</h2>
          </div>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;">${U.renderBadges(t.estado,t.prioridad,t.tipo)}</div>
        </div>
        <div class="panel-body">
          <div class="detail-grid" style="grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem;">
            <div class="detail-item"><label>Solicitante</label><p>${U.escapeHtml(t.nombre||'-')}</p></div>
            <div class="detail-item"><label>Área</label><p>${U.escapeHtml(t.area||'-')}</p></div>
            <div class="detail-item"><label>Tipo</label><p>${U.escapeHtml(t.tipo||'-')}</p></div>
            <div class="detail-item"><label>Prioridad</label><p>${U.escapeHtml(t.prioridad||'-')}</p></div>
            <div class="detail-item"><label>Fecha ingreso</label><p>${U.formatDate(t.fechaIngreso)}</p></div>
            <div class="detail-item"><label>Fecha cierre</label><p>${t.fechaCierre?U.formatDate(t.fechaCierre)+' '+(tiempoRes?`(${tiempoRes})`:''):'Abierto'}</p></div>
          </div>
          <div class="divider"></div>
          <div style="margin-top:1rem;">
            <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:.4rem;">Descripción</p>
            <p style="font-size:.9rem;line-height:1.6;white-space:pre-wrap;">${U.escapeHtml(t.descripcion||'Sin descripción')}</p>
          </div>
          ${t.solucion ? `<div class="divider"></div>
          <div style="margin-top:1rem;">
            <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:.4rem;">Solución</p>
            <p style="font-size:.9rem;">${U.escapeHtml(t.solucion)}</p>
            ${t.detalleSolucion?`<p style="font-size:.82rem;color:#6b7280;margin-top:.4rem;">${U.escapeHtml(t.detalleSolucion)}</p>`:''}
          </div>` : ''}
          ${t.evidencia ? `<div class="divider"></div>
          <div style="margin-top:1rem;">
            <p style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin-bottom:.4rem;">Evidencia</p>
            <a href="${U.escapeHtml(t.evidencia)}" target="_blank" class="btn btn-secondary btn-sm">📎 Ver evidencia adjunta</a>
          </div>` : ''}
          <div style="margin-top:1.5rem;">
            <a href="mis-tickets.html" class="btn btn-secondary btn-sm">← Volver a Mis Tickets</a>
          </div>
        </div>
      </div>`;
  } catch(err) {
    console.error('[ticket.js]', err);
    wrap.innerHTML = `<div class="empty-state"><span class="empty-icon">❌</span><h3>Error al cargar</h3><p>${U.escapeHtml(err.message)}</p><button onclick="location.reload()" class="btn btn-secondary" style="margin-top:1rem">↻ Reintentar</button></div>`;
  }
});
