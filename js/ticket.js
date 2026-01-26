/*
  Vista: ticket.html?codigo=INC-001
  Muestra el detalle completo de un ticket (read-only).
*/

const escapeHtml_ = (v) => (window.Utils && typeof window.Utils.escapeHtml === 'function') ? window.Utils.escapeHtml(v) : String(v ?? '');

document.addEventListener('DOMContentLoaded', async () => {
  const titleEl = document.getElementById('ticketTitle');
  const detailEl = document.getElementById('ticketDetail');

  const params = new URLSearchParams(window.location.search);
  const codigo = (params.get('codigo') || '').trim().toUpperCase();

  if (!codigo) {
    titleEl.textContent = 'Falta el código del ticket';
    detailEl.innerHTML = '<p class="muted">Abre esta página con ?codigo=INC-001</p>';
    return;
  }

  if (!window.CONFIG || !window.CONFIG.SCRIPT_URL) {
    titleEl.textContent = 'No se pudo conectar';
    detailEl.innerHTML = '<p class="muted">Revisa js/config.js (SCRIPT_URL) y permisos del WebApp.</p>';
    return;
  }

  try {
    const jsonpRequest = (window.Utils && typeof window.Utils.jsonpRequest === 'function')
      ? window.Utils.jsonpRequest
      : null;
    if (!jsonpRequest) throw new Error('jsonpRequest no está disponible. Revisa js/utils.js');
    const tickets = await jsonpRequest({ action: 'tickets' });

    const found = Array.isArray(tickets)
      ? tickets.find(t => String(t.codigo || t.CODIGO || t['CODIGO'] || '').trim().toUpperCase() === codigo)
      : null;

    if (!found) {
      titleEl.textContent = `Ticket ${escapeHtml_(codigo)} no encontrado`;
      detailEl.innerHTML = '<p class="muted">Verifica el código o intenta más tarde.</p>';
      return;
    }

    const titulo = found.titulo || found['Título del requerimiento'] || found['Titulo del requerimiento'] || found.Título || found.Titulo || '';
    titleEl.textContent = `${codigo}${titulo ? ' · ' + titulo : ''}`;
    detailEl.innerHTML = renderTicketDetail_(found);
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Error al cargar ticket';
    detailEl.innerHTML = `<p class="muted">${escapeHtml_(String(err?.message || err))}</p>`;
  }
});

function renderTicketDetail_(t) {
  const get = (k) => t[k] ?? t[k.toUpperCase()] ?? t[k.toLowerCase()];

  const codigo = t.codigo || t.CODIGO || t['CODIGO'] || '';
  const tipo = t.tipo || t.Tipo || '';
  const area = t.area || t.Area || '';
  const nombre = t.nombre || t.Nombre || '';
  const estado = t.estado || t.Estado || '';
  const prioridad = t.prioridad || t.Prioridad || '';
  const descripcion = t.descripcion || t['Descripción'] || t.Descripcion || '';
  const fechaIngreso = t['Fecha de ingreso de ticket'] || t.fechaIngreso || '';
  const fechaCierre = t['Fecha de cierre'] || t.fechaCierre || '';
  const solucion = t.solucion || t.Solucion || t['Solución'] || t['Solucion'] || '';
  const detalle = t.detalle || t['Detalle de la solucion'] || t['Detalle de la solución'] || '';

  const rows = [
    ['Código', codigo],
    ['Tipo', tipo],
    ['Área', area],
    ['Solicitante', nombre],
    ['Estado', estado],
    ['Prioridad', prioridad],
    ['Fecha de ingreso', fechaIngreso],
    ['Fecha de cierre', fechaCierre],
  ]
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `<div class="kv-row"><div class="kv-key">${escapeHtml_(k)}</div><div class="kv-val">${escapeHtml_(String(v))}</div></div>`)
    .join('');

  const blocks = [];
  if (descripcion) blocks.push(`<div class="kv-block"><div class="kv-key">Descripción</div><div class="kv-val">${escapeHtml_(String(descripcion))}</div></div>`);
  if (solucion) blocks.push(`<div class="kv-block"><div class="kv-key">Solución (resumen)</div><div class="kv-val">${escapeHtml_(String(solucion))}</div></div>`);
  if (detalle) blocks.push(`<div class="kv-block"><div class="kv-key">Detalle de la solución</div><div class="kv-val">${escapeHtml_(String(detalle)).replace(/\n/g,'<br>')}</div></div>`);

  return `<div class="kv">${rows}${blocks.join('')}</div>`;
}
