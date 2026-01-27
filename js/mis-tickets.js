/**
 * mis-tickets.js
 * ============================================================
 * Página: mis-tickets.html
 *
 * Funcionalidad:
 * - Carga tickets desde Apps Script
 * - Muestra en formato cards (responsive)
 * - Filtros por área, usuario, estado y código
 * - Modal para ver detalle completo del ticket
 * - Botón para abrir en nueva pestaña
 *
 * Requisitos:
 * - js/config.js (SCRIPT_URL)
 * - js/utils.js (jsonpRequest, normalizeTicket, escapeHtml)
 * ============================================================
 */

(function initMisTickets() {
  document.addEventListener("DOMContentLoaded", () => {
    // Inicializar filtros
    initFilters_();
    
    // Cargar datos
    cargarMisTickets_();
    
    // Eventos de botones
    document.getElementById('btnBuscar')?.addEventListener('click', cargarMisTickets_);
    document.getElementById('btnLimpiar')?.addEventListener('click', limpiarFiltros_);
  });
})();

// Guardar tickets para re-filtrar sin recargar
let TODOS_LOS_TICKETS = [];

/**
 * Inicializa los selectores de filtros
 */
async function initFilters_() {
  try {
    // Cargar catálogos desde Config
    const configUrl = `${window.CONFIG.SCRIPT_URL}?action=config`;
    const catalogos = await window.jsonpRequest(configUrl);
    
    if (catalogos && catalogos.status === "success") {
      // Llenar áreas
      const areaSelect = document.getElementById('filterArea');
      if (areaSelect) {
        areaSelect.innerHTML = '<option value="">Todas</option>';
        catalogos.areas.forEach(area => {
          const opt = document.createElement('option');
          opt.value = area;
          opt.textContent = area;
          areaSelect.appendChild(opt);
        });
        
        // Habilitar select de área
        areaSelect.disabled = false;
      }
      
      // Llenar usuarios (inicialmente vacío, se llena según área)
      const userSelect = document.getElementById('filterUser');
      if (userSelect) {
        userSelect.innerHTML = '<option value="">Todos</option>';
        catalogos.usuarios.forEach(usuario => {
          const opt = document.createElement('option');
          opt.value = usuario;
          opt.textContent = usuario;
          userSelect.appendChild(opt);
        });
        userSelect.disabled = false;
      }
      
      // Llenar estados
      const estadoSelect = document.getElementById('filterEstado');
      if (estadoSelect && catalogos.estados) {
        estadoSelect.innerHTML = '<option value="">Todos</option>';
        catalogos.estados.forEach(estado => {
          const opt = document.createElement('option');
          opt.value = estado;
          opt.textContent = estado;
          estadoSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Error cargando catálogos:', err);
  }
}

/**
 * Limpia todos los filtros
 */
function limpiarFiltros_() {
  document.getElementById('filterArea')?.value = '';
  document.getElementById('filterUser')?.value = '';
  document.getElementById('filterEstado')?.value = '';
  document.getElementById('filterCode')?.value = '';
  
  // Recargar con filtros limpios
  cargarMisTickets_();
}

/**
 * Carga y muestra los tickets
 */
async function cargarMisTickets_() {
  const container = document.getElementById('ticketsList');
  const btnBuscar = document.getElementById('btnBuscar');
  
  if (!container) return;
  
  // Deshabilitar botón durante carga
  if (btnBuscar) {
    btnBuscar.disabled = true;
    btnBuscar.textContent = 'Cargando...';
  }
  
  try {
    // Verificar dependencias
    if (typeof window.jsonpRequest !== 'function') {
      throw new Error("jsonpRequest no está disponible. Revisa js/utils.js");
    }
    
    if (!window.CONFIG || !window.CONFIG.SCRIPT_URL) {
      throw new Error("CONFIG no está definido. Revisa js/config.js");
    }
    
    // Mostrar mensaje de carga
    container.innerHTML = '<p class="empty-state">Cargando tickets...</p>';
    
    // Obtener tickets
    const tickets = await window.jsonpRequest(window.CONFIG.SCRIPT_URL);
    
    if (!tickets || tickets.error) {
      const msg = tickets?.message || "No se pudieron cargar los tickets";
      container.innerHTML = `
        <div class="alert error">
          <p>❌ ${msg}</p>
        </div>
      `;
      return;
    }
    
    const arr = Array.isArray(tickets) ? tickets : [];
    
    if (arr.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📭 No hay tickets registrados aún.</p>
          <p style="margin-top: 10px;">
            <a href="registrar.html" class="btn btn-primary" style="display: inline-block; padding: 10px 20px;">
              ➕ Registrar primer ticket
            </a>
          </p>
        </div>
      `;
      TODOS_LOS_TICKETS = [];
      return;
    }
    
    // Guardar todos los tickets para filtrar
    TODOS_LOS_TICKETS = arr;
    
    // Aplicar filtros
    const ticketsFiltrados = aplicarFiltros_(arr);
    
    if (ticketsFiltrados.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>🔍 No se encontraron tickets con los filtros aplicados.</p>
          <button id="btnLimpiarFiltros" class="btn btn-secondary" style="margin-top: 15px;">
            Limpiar filtros
          </button>
        </div>
      `;
      document.getElementById('btnLimpiarFiltros')?.addEventListener('click', limpiarFiltros_);
      return;
    }
    
    // Renderizar tickets
    renderizarTickets_(ticketsFiltrados);
    
  } catch (error) {
    console.error('Error cargando tickets:', error);
    const container = document.getElementById('ticketsList');
    if (container) {
      container.innerHTML = `
        <div class="alert error">
          <p>❌ Error al cargar tickets: ${error.message}</p>
          <p style="margin-top: 10px;">
            <button onclick="location.reload()" class="btn btn-secondary">
              ↻ Reintentar
            </button>
          </p>
        </div>
      `;
    }
  } finally {
    // Habilitar botón
    const btnBuscar = document.getElementById('btnBuscar');
    if (btnBuscar) {
      btnBuscar.disabled = false;
      btnBuscar.textContent = 'Buscar';
    }
  }
}

/**
 * Aplica los filtros seleccionados
 */
function aplicarFiltros_(tickets) {
  const filterArea = document.getElementById('filterArea')?.value.trim() || '';
  const filterUser = document.getElementById('filterUser')?.value.trim() || '';
  const filterEstado = document.getElementById('filterEstado')?.value.trim() || '';
  const filterCode = document.getElementById('filterCode')?.value.trim() || '';
  
  return tickets.filter(t => {
    const area = String(t.Area || t["Área"] || t.area || '').trim().toLowerCase();
    const nombre = String(t.Nombre || t.nombre || '').trim().toLowerCase();
    const estado = String(t.Estado || t.estado || '').trim().toLowerCase();
    const codigo = String(t.CODIGO || t.codigo || '').trim().toLowerCase();
    
    // Filtro por área
    if (filterArea && area !== filterArea.toLowerCase()) {
      return false;
    }
    
    // Filtro por usuario
    if (filterUser && nombre !== filterUser.toLowerCase()) {
      return false;
    }
    
    // Filtro por estado
    if (filterEstado && estado !== filterEstado.toLowerCase()) {
      return false;
    }
    
    // Filtro por código (búsqueda parcial)
    if (filterCode && !codigo.includes(filterCode.toLowerCase())) {
      return false;
    }
    
    return true;
  });
}

/**
 * Renderiza los tickets en formato cards
 */
function renderizarTickets_(tickets) {
  const container = document.getElementById('ticketsList');
  if (!container) return;
  
  // Ordenar: más recientes primero
  const sorted = [...tickets].sort((a, b) => {
    const da = new Date(a["Fecha de ingreso de ticket"] || a.Fecha || 0).getTime();
    const db = new Date(b["Fecha de ingreso de ticket"] || b.Fecha || 0).getTime();
    return db - da;
  });
  
  // Generar HTML
  const html = `
    <div class="tickets-cards">
      ${sorted.map(ticket => renderizarTicketCard_(ticket)).join('')}
    </div>
  `;
  
  container.innerHTML = html;
  
  // Vincular eventos de clic
  document.querySelectorAll('.ticket-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const codigo = e.currentTarget.dataset.codigo;
      const ticket = sorted.find(t => 
        String(t.CODIGO || t.codigo || '').trim() === codigo
      );
      if (ticket) {
        openTicketModal(ticket);
      }
    });
  });
}

/**
 * Renderiza una tarjeta de ticket individual
 */
function renderizarTicketCard_(ticket) {
  const t = window.Utils.normalizeTicket(ticket);
  
  const escapeHtml = window.Utils.escapeHtml || ((s) => String(s || ''));
  const normalizeClass = window.Utils.normalizeClass || ((s) => String(s || '').toLowerCase());
  
  const estado = t.estado || 'Pendiente';
  const prioridad = t.prioridad || '';
  const estadoClass = normalizeClass(estado);
  const prioridadClass = normalizeClass(prioridad);
  
  // Construir badges
  let badgesHtml = `<span class="badge ${estadoClass}">${escapeHtml(estado)}</span>`;
  if (prioridad && prioridad !== '-' && prioridad !== '---') {
    badgesHtml += ` <span class="badge ${prioridadClass}">${escapeHtml(prioridad)}</span>`;
  }
  
  return `
    <button class="ticket-card ticket-card-btn" data-codigo="${escapeHtml(t.codigo)}" type="button">
      <div class="ticket-header">
        <div class="ticket-id">${escapeHtml(t.codigo)}</div>
        <div class="ticket-badges">
          ${badgesHtml}
        </div>
      </div>
      
      <h4>${escapeHtml(t.titulo || t['Titulo del requerimiento'] || 'Sin título')}</h4>
      
      <p><strong>👤</strong> ${escapeHtml(t.nombre || '---')}</p>
      <p><strong>🏢</strong> ${escapeHtml(t.area || '---')}</p>
      <p><strong>📝</strong> ${escapeHtml(t.tipo || '---')}</p>
      
      ${t.descripcion ? `
        <div class="ticket-details">
          <details>
            <summary>Ver descripción</summary>
            <p>${escapeHtml(t.descripcion.substring(0, 100))}${t.descripcion.length > 100 ? '...' : ''}</p>
          </details>
        </div>
      ` : ''}
      
      ${t.fechaCierre ? `
        <p style="margin-top: 10px; font-size: 0.85rem; color: #666;">
          <strong>📅 Cerrado:</strong> ${window.Utils.formatDate(t.fechaCierre)}
        </p>
      ` : ''}
    </button>
  `;
}

/**
 * Renderiza el contenido del modal con datos del ticket
 */
function renderModalContent(ticket) {
  // Normalizar el ticket primero
  const t = window.Utils.normalizeTicket(ticket);
  
  // Helper local para escape (seguro)
  const escapeHtml = window.Utils.escapeHtml || ((s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
  const normalizeClass = window.Utils.normalizeClass || ((s) => String(s || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  
  // Normalizar campos para badges
  const estado = t.estado || "Pendiente";
  const prioridad = t.prioridad || "";
  const estadoClass = normalizeClass(estado);
  const prioridadClass = normalizeClass(prioridad);
  
  // Construir badges de forma segura
  let badgesHtml = `<span class="badge ${estadoClass}">${escapeHtml(estado)}</span>`;
  if (prioridad && prioridad !== "-" && prioridad !== "---") {
    badgesHtml += ` <span class="badge ${prioridadClass}">${escapeHtml(prioridad)}</span>`;
  }
  
  // Renderizar campos clave-valor
  const kvRows = [
    { label: "Código", value: t.codigo },
    { label: "Área", value: t.area },
    { label: "Tipo", value: t.tipo },
    { label: "Solicitante", value: t.nombre },
    { label: "Prioridad", value: prioridad !== "-" && prioridad !== "---" ? prioridad : null },
    { label: "Fecha de ingreso", value: t.fechaIngreso ? window.Utils.formatDate(t.fechaIngreso) : "-" },
    { label: "Fecha de cierre", value: t.fechaCierre ? window.Utils.formatDate(t.fechaCierre) : "-" }
  ]
    .filter(item => item.value && String(item.value).trim() !== "")
    .map(item => `
      <div class="kv-row">
        <div class="kv-key">${escapeHtml(item.label)}</div>
        <div class="kv-val">${escapeHtml(String(item.value))}</div>
      </div>
    `)
    .join('');
  
  // Bloques de texto largos
  const blocks = [];
  if (t.descripcion) {
    blocks.push(`
      <div class="kv-block">
        <div class="kv-key">Descripción</div>
        <div class="kv-val">${escapeHtml(t.descripcion)}</div>
      </div>
    `);
  }
  if (t.solucion) {
    blocks.push(`
      <div class="kv-block">
        <div class="kv-key">Solución (resumen)</div>
        <div class="kv-val">${escapeHtml(t.solucion)}</div>
      </div>
    `);
  }
  if (t.detalleSolucion) {
    blocks.push(`
      <div class="kv-block">
        <div class="kv-key">Detalle de la solución</div>
        <div class="kv-val">${escapeHtml(t.detalleSolucion).replace(/\n/g, '<br>')}</div>
      </div>
    `);
  }
  
  // HTML completo del modal
  return `
    <div class="modal-grid">
      <div class="kv">
        ${kvRows}
      </div>
      <div class="kv">
        ${blocks.join('')}
      </div>
    </div>
    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eef2f7; text-align: center;">
      ${badgesHtml}
    </div>
  `;
}

/**
 * Abre el modal con un ticket específico
 */
function openTicketModal(ticket) {
  const modal = document.getElementById('ticketModal');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');
  const modalOpenTab = document.getElementById('modalOpenTab');
  
  if (!modal || !modalBody || !modalTitle) {
    console.error('Modal elements not found');
    return;
  }
  
  // Normalizar ticket
  const t = window.Utils.normalizeTicket(ticket);
  const codigo = t.codigo || 'SIN-CODIGO';
  
  // Título del modal
  modalTitle.textContent = `${codigo}${t.titulo ? ' · ' + t.titulo : ''}`;
  
  // Enlace para abrir en nueva pestaña
  if (modalOpenTab) {
    modalOpenTab.href = `ticket.html?codigo=${encodeURIComponent(codigo)}`;
  }
  
  // Renderizar contenido
  modalBody.innerHTML = renderModalContent(ticket);
  
  // Mostrar modal
  modal.classList.add('open');
  document.body.classList.add('modal-open');
  
  // Cerrar al hacer clic en backdrop
  const backdrop = modal.querySelector('.modal-backdrop');
  if (backdrop) {
    backdrop.onclick = closeTicketModal;
  }
  
  // Cerrar con botones
  document.getElementById('modalClose')?.addEventListener('click', closeTicketModal);
  document.getElementById('modalOk')?.addEventListener('click', closeTicketModal);
}

/**
 * Cierra el modal
 */
function closeTicketModal() {
  const modal = document.getElementById('ticketModal');
  if (!modal) return;
  
  modal.classList.remove('open');
  document.body.classList.remove('modal-open');
  
  // Limpiar eventos
  document.getElementById('modalClose')?.removeEventListener('click', closeTicketModal);
  document.getElementById('modalOk')?.removeEventListener('click', closeTicketModal);
}
