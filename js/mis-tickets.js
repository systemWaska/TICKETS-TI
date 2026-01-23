/**
 * mis-tickets.js - Versión Robusta
 */
(function () {
  let LAST_TICKETS = []; // Almacena los tickets cargados para el modal

  document.addEventListener("DOMContentLoaded", async () => {
    await initPage();
  });

  async function initPage() {
    // 1. Cargar configuración de áreas
    await loadAreas();
    
    // 2. Escuchar eventos de filtro
    bindEvents();
    
    // 3. Cargar tickets iniciales (si hay filtros guardados o por defecto)
    buscarTickets(true);
  }

  // Carga las áreas en el select
  async function loadAreas() {
    const areaEl = document.getElementById("filterArea");
    if (!areaEl) return;

    try {
      const cfg = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=config`);
      if (cfg && cfg.areas) {
        areaEl.innerHTML = `<option value="">Seleccione área...</option>` +
          cfg.areas.map(a => `<option value="${a}">${a}</option>`).join("");
        
        // Restaurar selección previa
        const savedArea = localStorage.getItem("last_area");
        if (savedArea) areaEl.value = savedArea;
      }
    } catch (e) {
      console.error("Error cargando config", e);
      areaEl.innerHTML = `<option value="">Error cargando áreas</option>`;
    }
  }

  function bindEvents() {
    document.getElementById("btnBuscar")?.addEventListener("click", () => buscarTickets(false));
    document.getElementById("btnLimpiar")?.addEventListener("click", limpiarFiltros);
    document.getElementById("filterArea")?.addEventListener("change", (e) => {
      localStorage.setItem("last_area", e.target.value);
    });
  }

  async function buscarTickets(silent = false) {
    const listEl = document.getElementById("ticketsList");
    const area = document.getElementById("filterArea")?.value || "";
    const codigo = document.getElementById("filterCode")?.value.trim().toUpperCase() || "";

    if (!listEl) return;
    if (!silent) listEl.innerHTML = '<p class="empty-state">Cargando tickets...</p>';

    try {
      // Descargamos datos
      const data = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=tickets`);
      let tickets = Array.isArray(data) ? data : [];

      // Filtrado en Cliente (Frontend)
      if (area) {
        tickets = tickets.filter(t => String(t.Area || t["Área"] || "").trim() === area);
      }
      if (codigo) {
        tickets = tickets.filter(t => String(t.CODIGO || t.codigo).toUpperCase().includes(codigo));
      }

      // Ordenar por fecha (más reciente arriba)
      tickets.sort((a, b) => new Date(b["Fecha de ingreso de ticket"]) - new Date(a["Fecha de ingreso de ticket"]));

      LAST_TICKETS = tickets; // Guardar referencia para el modal
      renderList(tickets, listEl);

    } catch (e) {
      listEl.innerHTML = `<p class="empty-state error">Error de conexión: ${e.message}</p>`;
    }
  }

  function renderList(tickets, container) {
    if (tickets.length === 0) {
      container.innerHTML = '<p class="empty-state">No se encontraron tickets con esos filtros.</p>';
      return;
    }

    const u = window.Utils;
    
    // Generamos el HTML usando botones para que sean clicables y accesibles
    container.innerHTML = tickets.map((t, index) => `
      <button class="ticket-card" onclick="openTicketModal(${index})">
        <div class="ticket-header">
          <span class="ticket-id">${t.CODIGO || t.codigo}</span>
          <div class="ticket-badges">
            ${u.renderBadges(t.Estado, t.Prioridad)}
          </div>
        </div>
        <div class="ticket-body">
          <p><strong>Tipo:</strong> ${u.escapeHtml(t.Tipo)}</p>
          <p><strong>Título:</strong> ${u.escapeHtml(t["Título del requerimiento"] || t.Titulo)}</p>
          <p><strong>Solicitante:</strong> ${u.escapeHtml(t.Nombre)}</p>
        </div>
        <div class="ticket-footer">
          Fecha: ${u.formatDate(t["Fecha de ingreso de ticket"])}
        </div>
      </button>
    `).join("");
  }

  function limpiarFiltros() {
    document.getElementById("filterArea").value = "";
    document.getElementById("filterCode").value = "";
    localStorage.removeItem("last_area");
    buscarTickets();
  }

  // Función global para abrir el modal desde el onclick
  window.openTicketModal = (index) => {
    const t = LAST_TICKETS[index];
    if (!t) return;
    
    const u = window.Utils;
    const modal = document.getElementById("ticketModal");
    const body = document.getElementById("modalBody");
    const title = document.getElementById("modalTitle");
    const btnOpen = document.getElementById("modalOpenTab");

    title.textContent = `Ticket ${t.CODIGO || t.codigo}`;
    
    body.innerHTML = `
      <div style="display:grid; gap:10px;">
        <p><strong>Estado:</strong> ${u.renderBadges(t.Estado, t.Prioridad)}</p>
        <p><strong>Área:</strong> ${u.escapeHtml(t.Area || t["Área"])}</p>
        <p><strong>Solicitante:</strong> ${u.escapeHtml(t.Nombre)}</p>
        <hr style="border:0; border-top:1px solid #eee;">
        <p><strong>Título:</strong> ${u.escapeHtml(t["Título del requerimiento"] || t.Titulo)}</p>
        <p><strong>Descripción:</strong><br>${u.escapeHtml(t.Descripción || t.Descripcion)}</p>
        ${t.Solucion ? `<div style="background:#f0f9ff; padding:10px; border-radius:8px; margin-top:10px;">
           <strong>Solución:</strong> ${u.escapeHtml(t.Solucion)}
        </div>` : ''}
      </div>
    `;

    // Botón para abrir en pestaña nueva
    btnOpen.href = `ticket.html?codigo=${t.CODIGO || t.codigo}`;
    
    // Mostrar modal
    modal.classList.add("is-open");
    
    // Eventos para cerrar
    document.getElementById("modalClose").onclick = closeModal;
    document.getElementById("modalOk").onclick = closeModal;
    document.querySelector(".modal-backdrop").onclick = closeModal;
  };

  function closeModal() {
    document.getElementById("ticketModal").classList.remove("is-open");
  }
})();
