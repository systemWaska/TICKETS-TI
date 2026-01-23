/*
  Vista: ticket.html?codigo=INC-001
  Muestra el detalle completo de un ticket (read-only).
*/

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
    const tickets = await fetchJsonp_(window.CONFIG.SCRIPT_URL, { action: 'getTickets' });
    const found = Array.isArray(tickets)
      ? tickets.find(t => String(t.codigo || '').trim().toUpperCase() === codigo)
      : null;

    if (!found) {
      titleEl.textContent = `Ticket ${escapeHtml_(codigo)} no encontrado`;
      detailEl.innerHTML = '<p class="muted">Verifica el código o intenta más tarde.</p>';
      return;
    }

    titleEl.textContent = `${found.codigo || codigo} · ${found.titulo || ''}`;
    detailEl.innerHTML = renderTicketDetail_(found);
  } catch (err) {
    console.error(err);
    titleEl.textContent = 'Error al cargar ticket';
    detailEl.innerHTML = `<p class="muted">${escapeHtml_(String(err?.message || err))}</p>`;
  }
});

function renderTicketDetail_(t) {
  const fields = [
    ['Código', t.codigo],
    ['Tipo', t.tipo],
    ['Área', t.area],
    ['Solicitante', t.nombre],
    ['Estado', t.estado],
    ['Prioridad', t.prioridad],
    ['Fecha de ingreso', t.fechaIngreso],
    ['Fecha de cierre', t.fechaCierre],
  ];

  const rows = fields
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => `<div class="kv-row"><div class="kv-key">${escapeHtml_(k)}</div><div class="kv-val">${escapeHtml_(String(v))}</div></div>`)
    .join('');

  const desc = t.descripcion ? `<div class="kv-block"><div class="kv-key">Descripción</div><div class="kv-val">${escapeHtml_(String(t.descripcion))}</div></div>` : '';

  const sol = t.solucion ? `<div class="kv-block"><div class="kv-key">Solución (resumen)</div><div class="kv-val">${escapeHtml_(String(t.solucion))}</div></div>` : '';
  const det = t.detalleSolucion ? `<div class="kv-block"><div class="kv-key">Detalle de la solución</div><div class="kv-val">${escapeHtml_(String(t.detalleSolucion)).replace(/\n/g,'<br>')}</div></div>` : '';

  return `
    <div class="kv">
      ${rows}
      ${desc}
      ${sol}
      ${det}
    </div>
  `;
}

function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fetchJsonp_(baseUrl, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `cb_${Date.now()}_${Math.floor(Math.random()*100000)}`;
    const script = document.createElement('script');

    const url = new URL(baseUrl);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('callback', callbackName);

    let timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout al cargar datos'));
    }, 15000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    function cleanup() {
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
      if (timeout) clearTimeout(timeout);
    }

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo cargar el script JSONP'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}
