/*
  Vista: ticket.html?codigo=INC-001
  Muestra el detalle completo de un ticket (read-only).
  MEJORAS:
  - Usa normalizeTicket para consistencia
  - Mejora manejo de errores
  - Mensajes más claros para el usuario
*/

// Helper local para escape (fallback si Utils no está disponible)
const escapeHtml_ = (v) => (window.Utils && typeof window.Utils.escapeHtml === 'function') 
  ? window.Utils.escapeHtml(v) 
  : String(v ?? '');

document.addEventListener('DOMContentLoaded', async () => {
  const titleEl = document.getElementById('ticketTitle');
  const detailEl = document.getElementById('ticketDetail');

  const params = new URLSearchParams(window.location.search);
  const codigo = (params.get('codigo') || '').trim().toUpperCase();

  if (!codigo) {
    titleEl.textContent = '⚠️ Falta el código del ticket';
    detailEl.innerHTML = `
      <div class="alert error">
        <p>Abre esta página con <code>?codigo=INC-001</code></p>
        <p><a href="mis-tickets.html" class="link">← Revisa tus tickets</a></p>
      </div>`;
    return;
  }

  if (!window.CONFIG || !window.CONFIG.SCRIPT_URL) {
    titleEl.textContent = '❌ No se pudo conectar';
    detailEl.innerHTML = `
      <div class="alert error">
        <p>Revisa <code>js/config.js</code> (SCRIPT_URL) y permisos del WebApp.</p>
      </div>`;
    return;
  }

  try {
    const jsonpRequest = (window.Utils && typeof window.Utils.jsonpRequest === 'function')
      ? window.Utils.jsonpRequest
      : null;
      
    if (!jsonpRequest) throw new Error('jsonpRequest no está disponible. Revisa js/utils.js');
    
    titleEl.textContent = `Cargando ticket ${codigo}...`;
    detailEl.innerHTML = '<p class="muted">Conectando con el servidor...</p>';
    
    const tickets = await jsonpRequest(window.CONFIG.SCRIPT_URL, { action: 'tickets' });

    // Normalizar todos los tickets para consistencia
    const normalizedTickets = Array.isArray(tickets) 
      ? tickets.map(t => window.Utils.normalizeTicket(t)) 
      : [];
      
    const found = normalizedTickets.find(t => t.codigo.toUpperCase() === codigo);

    if (!found) {
      titleEl.textContent = `🎫 Ticket ${escapeHtml_(codigo)} no encontrado`;
      detailEl.innerHTML = `
        <div class="alert error">
          <p>⚠️ El ticket <strong>${escapeHtml_(codigo)}</strong> no existe en el sistema.</p>
          <p><a href="mis-tickets.html" class="link">← Revisa tus tickets</a></p>
        </div>`;
      return;
    }

    // Construir título con código y título del ticket
    const titulo = found.titulo || '';
    titleEl.textContent = `${codigo}${titulo ? ' · ' + titulo : ''}`;
    
    // Renderizar detalle
    detailEl.innerHTML = renderTicketDetail_(found);
    
  } catch (err) {
    console.error('[tickets.js] Error:', err);
    titleEl.textContent = '❌ Error al cargar ticket';
    detailEl.innerHTML = `
      <div class="alert error">
        <p>${escapeHtml_(String(err?.message || err))}</p>
        <p><a href="javascript:location.reload()" class="link">↻ Intentar nuevamente</a></p>
      </div>`;
  }
});

/**
 * Renderiza el detalle completo del ticket en formato KV (key-value)
 * @param {object} t - Ticket normalizado
 */
function renderTicketDetail_(t) {
  // Usar campos normalizados directamente (sin múltiples checks)
  const rows = [
    ['Código', t.codigo],
    ['Tipo', t.tipo],
    ['Área', t.area],
    ['Solicitante', t.nombre],
    ['Estado', t.estado],
    ['Prioridad', t.prioridad],
    ['Fecha de ingreso', t.fechaIngreso ? window.Utils.formatDate(t.fechaIngreso) : ''],
    ['Fecha de cierre', t.fechaCierre ? window.Utils.formatDate(t.fechaCierre) : ''],
  ]
    .filter(([, v]) => v && String(v).trim() !== '')
    .map(([k, v]) => 
      `<div class="kv-row">
        <div class="kv-key">${escapeHtml_(k)}</div>
        <div class="kv-val">${escapeHtml_(String(v))}</div>
      </div>`
    )
    .join('');

  const blocks = [];
  
  // Descripción
  if (t.descripcion) {
    blocks.push(`
      <div class="kv-block">
        <div class="kv-key">Descripción</div>
        <div class="kv-val">${escapeHtml_(t.descripcion)}</div>
      </div>
    `);
  }
  
  // Solución (resumen)
  if (t.solucion) {
    blocks.push(`
      <div class="kv-block">
        <div class="kv-key">Solución (resumen)</div>
        <div class="kv-val">${escapeHtml_(t.solucion)}</div>
      </div>
    `);
  }
  
  // Detalle de la solución
  if (t.detalleSolucion) {
    blocks.push(`
      <div class="kv-block">
        <div class="kv-key">Detalle de la solución</div>
        <div class="kv-val">${escapeHtml_(t.detalleSolucion).replace(/\n/g,'<br>')}</div>
      </div>
    `);
  }

  return `<div class="kv">${rows}${blocks.join('')}</div>`;
}
