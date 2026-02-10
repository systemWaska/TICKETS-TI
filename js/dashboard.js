/**
 * dashboard.js
 * ============================================================
 * Página: todos-los-tickets.html (Dashboard)
 *
 * Requisitos (UI/UX)
 * - Desktop: mantener tabla.
 * - Mobile: NO mostrar tabla, mostrar cards (CSS .desktop-only/.mobile-only).
 * - Todo responsive (no se rompe al reducir pantalla).
 *
 * Datos
 * - Lee TODOS los tickets del Apps Script (CONFIG.SCRIPT_URL)
 * - Renderiza:
 *   1) Gráfico por Área
 *   2) Gráfico por Tipo
 *   3) Resumen (últimos 10): tabla (desktop) + cards (mobile)
 *
 * Nota importante
 * - Destruimos instancias previas de Chart.js antes de recrear,
 *   para evitar duplicados si el usuario vuelve con BFCache.
 * ============================================================
 */

// Guardamos instancias de Chart.js para poder destruirlas (evita duplicados)
let CHART_AREA_INSTANCE = null;
let CHART_TYPE_INSTANCE = null;

// Guardar tickets para re-filtrar sin recargar
let ALL_TICKETS = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Inicializar filtros
  await initFilters_();
  
  // Cargar datos
  await cargarDatosDashboard_();
  
  // Eventos de filtros
  setupFilterEvents_();
});

// Si el usuario vuelve con el botón "atrás", a veces el navegador
// re-usa la página (BFCache). Esto asegura data fresca.
window.addEventListener("pageshow", (ev) => {
  if (ev.persisted) cargarDatosDashboard_(/*silent=*/true);
});

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
      }
      
      // Llenar tipos
      const tipoSelect = document.getElementById('filterTipo');
      if (tipoSelect) {
        tipoSelect.innerHTML = '<option value="">Todos</option>';
        catalogos.tipos.forEach(tipo => {
          const opt = document.createElement('option');
          opt.value = tipo;
          opt.textContent = tipo;
          tipoSelect.appendChild(opt);
        });
      }
      
      // Llenar estados
      const estadoSelect = document.getElementById('filterEstado');
      if (estadoSelect) {
        estadoSelect.innerHTML = '<option value="">Todos</option>';
        catalogos.estados.forEach(estado => {
          const opt = document.createElement('option');
          opt.value = estado;
          opt.textContent = estado;
          estadoSelect.appendChild(opt);
        });
      }
      
      // Llenar prioridades
      const prioridadSelect = document.getElementById('filterPrioridad');
      if (prioridadSelect) {
        prioridadSelect.innerHTML = '<option value="">Todas</option>';
        catalogos.prioridades.forEach(prioridad => {
          const opt = document.createElement('option');
          opt.value = prioridad;
          opt.textContent = prioridad;
          prioridadSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Error cargando catálogos:', err);
  }
}

function setupFilterEvents_() {
  // Evento para cada filtro
  document.getElementById('filterArea')?.addEventListener('change', applyFilters_);
  document.getElementById('filterTipo')?.addEventListener('change', applyFilters_);
  document.getElementById('filterEstado')?.addEventListener('change', applyFilters_);
  document.getElementById('filterPrioridad')?.addEventListener('change', applyFilters_);
  document.getElementById('filterMostrar')?.addEventListener('change', applyFilters_);
  document.getElementById('btnLimpiarFiltros')?.addEventListener('click', limpiarFiltros_);
}

async function cargarDatosDashboard_(silent = false) {
  const escapeHtml_ = (s) => (window.Utils ? window.Utils.escapeHtml(s) : String(s));
  
  const tableBody = document.getElementById("ticketsTableBody");
  const cardsWrap = document.getElementById("ticketsCards");

  // Mensaje de carga (sin romper si algún contenedor no existe)
  if (!silent) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>`;
    if (cardsWrap) cardsWrap.innerHTML = `<p class="muted">Cargando...</p>`;
  }

  try {
    // IMPORTANTE (CORS): usamos JSONP helper (config.js)
    const tickets = await window.jsonpRequest(window.CONFIG.SCRIPT_URL);

    if (!tickets || (tickets && tickets.error) || (tickets && tickets.status === "error")) {
      const msg = (tickets && tickets.message) ? String(tickets.message) : "No hay datos disponibles.";
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${escapeHtml_(msg)}</td></tr>`;
      if (cardsWrap) cardsWrap.innerHTML = `<p class="empty-state">${escapeHtml_(msg)}</p>`;
      return;
    }

    const arr = Array.isArray(tickets) ? tickets : [];
    ALL_TICKETS = arr; // Guardar todos los tickets para filtrar
    
    if (arr.length === 0) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay tickets aún.</td></tr>`;
      if (cardsWrap) cardsWrap.innerHTML = `<p class="empty-state">No hay tickets aún.</p>`;
      return;
    }

    // Orden: más recientes primero (por fecha de ingreso)
    const sorted = [...arr].sort((a, b) => {
      const da = new Date(a["Fecha de ingreso de ticket"] || a.Fecha || 0).getTime();
      const db = new Date(b["Fecha de ingreso de ticket"] || b.Fecha || 0).getTime();
      return db - da;
    });

    // 1) Resumen: últimos 10
    const last10 = sorted.slice(0, 10);
    renderTable_(last10);
    renderCards_(last10);

    // 2) Conteos para gráficos
    const conteoAreas = {};
    const conteoTipos = { "Incidencia": 0, "Requerimiento": 0, "Evento": 0 };

    for (const t of arr) {
      const area = String(t["Área"] || t.Area || t.area || "Otros").trim() || "Otros";
      conteoAreas[area] = (conteoAreas[area] || 0) + 1;

      const tipo = String(t.Tipo || t.tipo || "").trim();
      if (Object.prototype.hasOwnProperty.call(conteoTipos, tipo)) {
        conteoTipos[tipo] += 1;
      }
    }

    generarGraficoArea_(Object.keys(conteoAreas), Object.values(conteoAreas));
    generarGraficoTipo_(Object.keys(conteoTipos), Object.values(conteoTipos));

  } catch (error) {
    console.error("Error en Dashboard:", error);
    const msg = "❌ Error de conexión. Revisa la URL en config.js y que el script esté publicado.";
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">${msg}</td></tr>`;
    if (cardsWrap) cardsWrap.innerHTML = `<p class="empty-state" style="color:#e74c3c;">${msg}</p>`;
  }
}

function applyFilters_() {
  const tableBody = document.getElementById("ticketsTableBody");
  const cardsWrap = document.getElementById("ticketsCards");
  
  const tableWrapper = document.querySelector('.table-wrapper');
  const cardsSection = document.getElementById('ticketsCards');
  
  const limit = parseInt(document.getElementById('filterMostrar')?.value || '10', 10);
  
  const limitValue = limit === 'all' ? ALL_TICKETS.length : limit;

  if (!tableBody || !cardsWrap) return;

  // Aplicar filtros
  const filtered = ALL_TICKETS.filter(t => {
    const area = String(t["Área"] || t.Area || t.area || "").trim().toLowerCase();
    const tipo = String(t.Tipo || t.tipo || "").trim().toLowerCase();
    const estado = String(t.Estado || t.estado || "").trim().toLowerCase();
    const prioridad = String(t.Prioridad || t.prioridad || "").trim().toLowerCase();
    
    const filterArea = document.getElementById('filterArea')?.value.trim().toLowerCase() || '';
    const filterTipo = document.getElementById('filterTipo')?.value.trim().toLowerCase() || '';
    const filterEstado = document.getElementById('filterEstado')?.value.trim().toLowerCase() || '';
    const filterPrioridad = document.getElementById('filterPrioridad')?.value.trim().toLowerCase() || '';
    
    if (filterArea && area !== filterArea) return false;
    if (filterTipo && tipo !== filterTipo) return false;
    if (filterEstado && estado !== filterEstado) return false;
    if (filterPrioridad && prioridad !== filterPrioridad) return false;
    
    return true;
  });

  // Aplicar límite
  const ticketsToShow = limit === 'all' ? filtered : filtered.slice(0, limitValue);
  
  // Renderizar según el modo
  if (window.innerWidth >= 768) {
    // Desktop: tabla
    tableWrapper.classList.remove('hidden');
    cardsSection.classList.add('hidden');
    renderTable_(ticketsToShow);
  } else {
    // Mobile: cards
    tableWrapper.classList.add('hidden');
    cardsSection.classList.remove('hidden');
    renderCards_(ticketsToShow);
  }
}

function limpiarFiltros_() {
  // Limpiar filtros
  document.getElementById('filterArea')?.value = '';
  document.getElementById('filterTipo')?.value = '';
  document.getElementById('filterEstado')?.value = '';
  document.getElementById('filterPrioridad')?.value = '';
  
  // Aplicar filtros (sin límite)
  applyFilters_();
}

function generarGraficoArea_(labels, data) {
  const canvas = document.getElementById("chartArea");
  if (!canvas) return;

  // Evita duplicados si se recarga
  if (CHART_AREA_INSTANCE) {
    CHART_AREA_INSTANCE.destroy();
    CHART_AREA_INSTANCE = null;
  }

  CHART_AREA_INSTANCE = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Tickets por Área",
        data,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // Evita decimales en el eje Y (en tickets siempre son enteros)
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

function generarGraficoTipo_(labels, data) {
  const canvas = document.getElementById("chartType");
  if (!canvas) return;

  if (CHART_TYPE_INSTANCE) {
    CHART_TYPE_INSTANCE.destroy();
    CHART_TYPE_INSTANCE = null;
  }

  CHART_TYPE_INSTANCE = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

function renderTable_(tickets) {
  const tableBody = document.getElementById("ticketsTableBody");
  if (!tableBody) return;

  const escapeHtml_ = (s) => (window.Utils ? window.Utils.escapeHtml(s) : String(s));
  const normalizeClass_ = (s) => (window.Utils ? window.Utils.normalizeClass(s) : '');

  tableBody.innerHTML = tickets.map((t) => {
    const id = escapeHtml_(t.CODIGO || t.codigo || "---");
    const nombre = escapeHtml_(t.Nombre || t.nombre || "---");
    const area = escapeHtml_(t["Área"] || t.Area || "---");
    const tipo = escapeHtml_(t.Tipo || t.tipo || "---");
    const prioridad = escapeHtml_(t.Prioridad || t.prioridad || "---");
    const estado = escapeHtml_(t.Estado || t.estado || "Pendiente");
    const estadoClass = normalizeClass_(estado);
    const prioridadClass = normalizeClass_(prioridad);

    return `
      <tr>
        <td><strong>${id}</strong></td>
        <td>${nombre}</td>
        <td>${area}</td>
        <td>${tipo}</td>
        <td>${prioridad !== "---" ? `<span class="badge ${prioridadClass}">${prioridad}</span>` : "---"}</td>
        <td><span class="badge ${estadoClass}">${estado}</span></td>
      </tr>
    `;
  }).join("");
}

function renderCards_(tickets) {
  const wrap = document.getElementById("ticketsCards");
  if (!wrap) return;

  const escapeHtml_ = (s) => (window.Utils ? window.Utils.escapeHtml(s) : String(s));
  const normalizeClass_ = (s) => (window.Utils ? window.Utils.normalizeClass(s) : '');

  wrap.innerHTML = tickets.map((t) => {
    const id = escapeHtml_(t.CODIGO || t.codigo || "---");
    const nombre = escapeHtml_(t.Nombre || t.nombre || "---");
    const area = escapeHtml_(t["Área"] || t.Area || "---");
    const tipo = escapeHtml_(t.Tipo || t.tipo || "---");
    const prioridad = escapeHtml_(t.Prioridad || t.prioridad || "---");
    const estado = escapeHtml_(t.Estado || t.estado || "Pendiente");
    const estadoClass = normalizeClass_(estado);
    const prioridadClass = normalizeClass_(prioridad);

    return `
      <div class="ticket-card">
        <div class="ticket-header">
          <div class="ticket-id">${id}</div>
          <div class="ticket-badges">
            <span class="badge ${estadoClass}">${estado}</span>
            ${prioridad !== "---" ? `<span class="badge ${prioridadClass}">${prioridad}</span>` : ""}
          </div>
        </div>
        <div class="ticket-meta">
          <div><strong>👤</strong> ${nombre}</div>
          <div><strong>🏢</strong> ${area}</div>
          <div><strong>📝</strong> ${tipo}</div>
        </div>
      </div>
    `;
  }).join("");
}
