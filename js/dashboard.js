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

(function initDashboard() {
  document.addEventListener("DOMContentLoaded", () => {
    cargarDatosDashboard_();
  });

  // Si el usuario vuelve con el botón "atrás", a veces el navegador
  // re-usa la página (BFCache). Esto asegura data fresca.
  window.addEventListener("pageshow", (ev) => {
    if (ev.persisted) cargarDatosDashboard_(/*silent=*/true);
  });
})();

// Guardamos instancias de Chart.js para poder destruirlas (evita duplicados)
let CHART_AREA_INSTANCE = null;
let CHART_TYPE_INSTANCE = null;

async function cargarDatosDashboard_(silent = false) {
  const tableBody = document.getElementById("ticketsTableBody");
  const cardsWrap = document.getElementById("ticketsCards");

  // Mensaje de carga (sin romper si algún contenedor no existe)
  if (!silent) {
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>`;
    if (cardsWrap) cardsWrap.innerHTML = `<p class="muted">Cargando...</p>`;
  }

  try {
    // IMPORTANTE (CORS): usamos JSONP helper (config.js)
    const tickets = await window.jsonpRequest(CONFIG.SCRIPT_URL);

    if (!tickets || (tickets && tickets.error) || (tickets && tickets.status === "error")) {
      const msg = (tickets && tickets.message) ? String(tickets.message) : "No hay datos disponibles.";
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">${escapeHtml_(msg)}</td></tr>`;
      if (cardsWrap) cardsWrap.innerHTML = `<p class="empty-state">${escapeHtml_(msg)}</p>`;
      return;
    }

    const arr = Array.isArray(tickets) ? tickets : [];
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
      <div class="ticket-row-card">
        <div class="ticket-row-top">
          <div>
            <div class="ticket-row-id">${id}</div>
            <div class="muted" style="margin-top:4px;">${nombre}</div>
          </div>
          <div class="badges-inline">
            <span class="badge ${estadoClass}">${estado}</span>
            ${prioridad !== "---" ? `<span class="badge ${prioridadClass}">${prioridad}</span>` : ""}
          </div>
        </div>
        <div class="ticket-row-meta">
          <div><strong>Área:</strong> ${area}</div>
          <div><strong>Tipo:</strong> ${tipo}</div>
        </div>
      </div>
    `;
  }).join("");
}

// Helpers
function normalizeClass_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .trim();
}

function escapeHtml_(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function uniqSorted(list) {
  return [...new Set(list.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
}

function hydrateDashboardFilters(tickets) {
  const areas = uniqSorted(tickets.map(t => String(t.Area || t["Área"] || t.area || "").trim()));
  const tipos = uniqSorted(tickets.map(t => String(t.Tipo || t.tipo || "").trim()));
  const estados = uniqSorted(tickets.map(t => String(t.Estado || t.estado || "").trim()));
  const prioridades = uniqSorted(tickets.map(t => String(t.Prioridad || t.prioridad || "").trim()));

  fillSelect("filterArea", areas, "Todas");
  fillSelect("filterTipo", tipos, "Todos");
  fillSelect("filterEstado", estados, "Todos");
  fillSelect("filterPrioridad", prioridades, "Todas");
}

function fillSelect(id, values, labelAll) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = el.value;
  el.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = labelAll;
  el.appendChild(optAll);

  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    el.appendChild(o);
  });
  if (current) el.value = current;
}

function applyDashboardFilters() {
  const tickets = window.__ALL_TICKETS__ || [];
  const area = (document.getElementById("filterArea")?.value || "").trim();
  const tipo = (document.getElementById("filterTipo")?.value || "").trim();
  const estado = (document.getElementById("filterEstado")?.value || "").trim();
  const prioridad = (document.getElementById("filterPrioridad")?.value || "").trim();
  const limitRaw = document.getElementById("filterLimit")?.value || "10";
  const limit = parseInt(limitRaw, 10);

  const filtered = tickets.filter(t => {
    const a = String(t.Area || t["Área"] || t.area || "").trim();
    const ti = String(t.Tipo || t.tipo || "").trim();
    const e = String(t.Estado || t.estado || "").trim();
    const p = String(t.Prioridad || t.prioridad || "").trim();
    if (area && a !== area) return false;
    if (tipo && ti !== tipo) return false;
    if (estado && e !== estado) return false;
    if (prioridad && p !== prioridad) return false;
    return true;
  });

  // Tabla: últimos N del resultado (para que sea "lo más reciente")
  const tableData = (limit && limit > 0) ? filtered.slice(-limit) : filtered;

  renderTable(tableData);
  renderCharts(filtered);
  renderSummary(filtered);
}
