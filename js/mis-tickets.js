/**
 * mis-tickets.js
 * ============================================================
 * Página: mis-tickets.html
 *
 * Objetivo
 * - Mostrar tickets del usuario seleccionado (Área + Usuario), con
 *   opción de filtrar adicionalmente por código.
 *
 * Por qué antes “no funcionaba”
 * - La UI decía “Ingresa tu nombre…” pero el input pedía “código”.
 * - No había un selector real de usuario y muchos usuarios esperan
 *   ver *sus* tickets, no buscar por código.
 *
 * Solución
 * 1) Cargamos catálogos desde Config (Apps Script) usando JSONP.
 * 2) El usuario selecciona Área y Usuario.
 * 3) Consultamos tickets (Apps Script) y filtramos en el frontend.
 *
 * Importante
 * - Usamos JSONP (config.js) para evitar CORS en GitHub Pages.
 * ============================================================
 */

(function initMisTicketsPage() {
  // Esperamos al DOM para poder capturar elementos.
  document.addEventListener("DOMContentLoaded", async () => {
    bindUIEvents_();
    await loadConfigAndHydrateFilters_();
  });

  // Si el usuario vuelve desde otra página (ej: Registrar) en mobile,
  // el navegador puede re-usar la página (BFCache) y dejar info “pegada”.
  // El usuario pidió que al entrar NO haya filtros preseleccionados,
  // así que en pageshow reiniciamos los filtros y el listado.
  window.addEventListener("pageshow", (ev) => {
    // Reinicia filtros y deja la página "limpia" (sin valores pegados).
    resetFiltersOnEntry_();
  });
})();

/**
 * Reinicia filtros al entrar / volver a la página.
 * - Evita que el navegador restaure valores anteriores.
 * - Mantiene el catálogo cargado (no borra opciones).
 */
function resetFiltersOnEntry_() {
  const areaEl = document.getElementById("filterArea");
  const userEl = document.getElementById("filterUser");
  const estadoEl = document.getElementById("filterEstado");
  const codeEl = document.getElementById("filterCode");
  const listEl = document.getElementById("ticketsList");

  if (areaEl) areaEl.value = "";
  if (userEl) {
    userEl.value = "";
    userEl.disabled = true;
    // Si ya hay opciones cargadas, no las borramos; solo volvemos a "Todos".
    if (userEl.options && userEl.options.length) {
      userEl.selectedIndex = 0;
    } else {
      userEl.innerHTML = `<option value="">Todos (del área)</option>`;
    }
  }
  if (estadoEl) estadoEl.value = "";
  if (codeEl) codeEl.value = "";
  if (listEl) {
    listEl.innerHTML = `<p class="empty-state">Selecciona un área (opcional) para ver tickets. Puedes filtrar por personal/estado/código.</p>`;
  }
}

/**
 * Conecta eventos de UI.
 */
function bindUIEvents_() {
  const areaEl = document.getElementById("filterArea");
  const userEl = document.getElementById("filterUser");
  const estadoEl = document.getElementById("filterEstado");
  const codeEl = document.getElementById("filterCode");
  const btnBuscar = document.getElementById("btnBuscar");
  const btnLimpiar = document.getElementById("btnLimpiar");

  if (areaEl) {
    areaEl.addEventListener("change", () => {
      // Cuando cambia el área, actualizamos la lista de usuarios.
      populateUsersFromSelectedArea_();

      // UX: al cambiar el área, mostramos tickets automáticamente
      // (sin obligar a presionar "Buscar").
      buscarTickets_(/*silent=*/true);
    });
  }

  // UX: si el usuario cambia "Personal", auto-recarga.
  if (userEl) {
    userEl.addEventListener("change", () => buscarTickets_(/*silent=*/true));
  }

  // UX: si cambia estado, auto-recarga.
  if (estadoEl) {
    estadoEl.addEventListener("change", () => buscarTickets_(/*silent=*/true));
  }

  if (btnBuscar) {
    btnBuscar.addEventListener("click", () => buscarTickets_());
  }

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", () => limpiarFiltros_());
  }

  // Enter en el filtro de código dispara búsqueda (más rápido).
  if (codeEl) {
    codeEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") buscarTickets_();
    });
  }
}

// Guardamos aquí el payload raw de Config (para filtrar usuarios por área)
let CONFIG_RAW_ROWS = [];

/**
 * Carga Config desde Apps Script y llena Área/Usuario.
 * Nota:
 * - NO guardamos selecciones en localStorage porque el usuario pidió
 *   que al entrar no haya valores preseleccionados.
 */
async function loadConfigAndHydrateFilters_() {
  const areaEl = document.getElementById("filterArea");
  const userEl = document.getElementById("filterUser");
  const estadoEl = document.getElementById("filterEstado");
  const listEl = document.getElementById("ticketsList");

  if (!areaEl || !userEl || !estadoEl || !listEl) return;

  try {
    // 1) Pedimos catálogos desde el backend
    const cfg = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=config`);

    if (!cfg || cfg.status !== "success") {
      areaEl.innerHTML = `<option value="">No se pudo cargar áreas (revisa Apps Script)</option>`;
      return;
    }

    // 2) Guardamos raw para filtrar usuarios por área
    CONFIG_RAW_ROWS = Array.isArray(cfg.raw) ? cfg.raw : [];

    // 3) Llenamos áreas
    const areas = Array.isArray(cfg.areas) ? cfg.areas : [];
    areaEl.innerHTML = `<option value="">Seleccione área...</option>` +
      areas.map(a => `<option value="${escapeHtml_(a)}">${escapeHtml_(a)}</option>`).join("");

    // 4.1) Estados (opcional). Si Config trae lista, la usamos.
    const estados = Array.isArray(cfg.estados) ? cfg.estados : [];
    estadoEl.innerHTML = `<option value="">Todos</option>` +
      estados.map(s => `<option value="${escapeHtml_(s)}">${escapeHtml_(s)}</option>`).join("");

    // Importante: dejamos todo sin selección al cargar.
    // El usuario puede filtrar por área/personal/estado cuando quiera.
    userEl.disabled = true;
    userEl.innerHTML = `<option value="">Todos (del área)</option>`;
    listEl.innerHTML = `<p class="empty-state">Selecciona un área (opcional) para ver tickets. Puedes filtrar por personal/estado/código.</p>`;

  } catch (err) {
    console.error(err);
    areaEl.innerHTML = `<option value="">No se pudo cargar áreas (error de conexión)</option>`;
  }
}

/**
 * Llena el select de usuarios según el área seleccionada.
 */
function populateUsersFromSelectedArea_() {
  const areaEl = document.getElementById("filterArea");
  const userEl = document.getElementById("filterUser");
  if (!areaEl || !userEl) return;

  const area = String(areaEl.value || "").trim();
  if (!area) {
    userEl.disabled = true;
    userEl.innerHTML = `<option value="">Todos (del área)</option>`;
    return;
  }

  // Filtramos usuarios por área usando el raw de Config
  const users = CONFIG_RAW_ROWS
    .filter(r => String(r.Area || r["Área"] || "").trim() === area)
    .map(r => String(r.Usuario || "").trim())
    .filter(Boolean);

  // Únicos + orden
  const unique = [...new Set(users)].sort((a, b) => a.localeCompare(b));

  // Nota UX: permitimos "Todos" sin obligar a escoger personal.
  userEl.disabled = unique.length === 0;
  userEl.innerHTML = `<option value="">Todos (del área)</option>` +
    unique.map(u => `<option value="${escapeHtml_(u)}">${escapeHtml_(u)}</option>`).join("");

  // No guardamos en localStorage (sin preselección al entrar).
}

/**
 * Búsqueda principal.
 * - Requiere Área + Usuario
 * - Código es opcional
 */
// Simple debounce para no disparar muchas llamadas mientras el usuario cambia filtros.
let SEARCH_DEBOUNCE = null;

async function buscarTickets_(silent = false) {
  const areaEl = document.getElementById("filterArea");
  const userEl = document.getElementById("filterUser");
  const estadoEl = document.getElementById("filterEstado");
  const codeEl = document.getElementById("filterCode");
  const listEl = document.getElementById("ticketsList");

  if (!areaEl || !userEl || !estadoEl || !listEl || !codeEl) return;

  // Reglas:
  // - Área es opcional. Si no hay área, no listamos y mostramos mensaje.
  // - Personal es opcional ("Todos" = vacío).
  // - Estado es opcional.

  // Si silent=true, esperamos un poquito para agrupar cambios.
  if (silent) {
    if (SEARCH_DEBOUNCE) clearTimeout(SEARCH_DEBOUNCE);
    SEARCH_DEBOUNCE = setTimeout(() => buscarTickets_(false), 180);
    return;
  }

  const area = String(areaEl.value || "").trim();
  const user = String(userEl.value || "").trim(); // opcional
  const estadoFilter = String(estadoEl.value || "").trim();
  const codeFilter = String(codeEl.value || "").trim().toUpperCase();

  // Si no hay área seleccionada, no consultamos tickets.
  if (!area) {
    listEl.innerHTML = `<p class="empty-state">Selecciona un área para ver los tickets (opcionalmente filtra por personal/estado/código).</p>`;
    return;
  }

  listEl.innerHTML = `<p>Cargando tickets...</p>`;

  try {
    const data = await window.jsonpRequest(CONFIG.SCRIPT_URL);

    // Si el backend devolviera un error, lo mostramos
    if (data && data.status === "error") {
      listEl.innerHTML = `<p>Error: ${escapeHtml_(data.message || "No se pudo cargar")}</p>`;
      return;
    }

    const tickets = Array.isArray(data) ? data : [];

    // Filtro por área (obligatorio) y usuario (opcional).
    let filtered = tickets.filter(t => {
      const tUser = String(t.Nombre || t.nombre || "").trim();
      const tArea = String(t["Área"] || t.Area || t.area || "").trim();
      return user ? (tUser === user && tArea === area) : (tArea === area);
    });

    // Filtro opcional por estado
    if (estadoFilter) {
      filtered = filtered.filter(t => String(t.Estado || t.estado || "").trim() === estadoFilter);
    }

    // Filtro opcional por código (parcial)
    if (codeFilter) {
      filtered = filtered.filter(t => String(t.CODIGO || t.codigo || "")
        .toUpperCase()
        .includes(codeFilter));
    }

    // Orden: más recientes primero (si hay fecha)
    filtered.sort((a, b) => {
      const da = new Date(a["Fecha de ingreso de ticket"] || a.Fecha || 0).getTime();
      const db = new Date(b["Fecha de ingreso de ticket"] || b.Fecha || 0).getTime();
      return db - da;
    });

    if (filtered.length === 0) {
      const who = user ? `para <strong>${escapeHtml_(user)}</strong>` : "para el área";
      listEl.innerHTML = `<p class="empty-state">No hay tickets ${who} <strong>${escapeHtml_(area)}</strong> con los filtros actuales.</p>`;
      return;
    }

    // Pintamos cards
    listEl.innerHTML = filtered.map(renderTicketCard_).join("");

  } catch (err) {
    console.error(err);
    listEl.innerHTML = `<p>Error al cargar tickets. Verifica tu URL de Apps Script (/exec) en js/config.js.</p>`;
  }
}

/**
 * Limpia filtros (sin borrar Config).
 */
function limpiarFiltros_() {
  const areaEl = document.getElementById("filterArea");
  const userEl = document.getElementById("filterUser");
  const estadoEl = document.getElementById("filterEstado");
  const codeEl = document.getElementById("filterCode");
  const listEl = document.getElementById("ticketsList");

  if (areaEl) areaEl.value = "";
  if (userEl) {
    userEl.disabled = true;
    userEl.innerHTML = `<option value="">Todos (del área)</option>`;
  }
  if (estadoEl) estadoEl.value = "";
  if (codeEl) codeEl.value = "";
  if (listEl) listEl.innerHTML = `<p class="empty-state">Selecciona tu área para ver los tickets (puedes filtrar por personal/estado/código).</p>`;

  // No usamos localStorage para recordar selecciones.
}

/**
 * Render de un ticket en formato card.
 */
function renderTicketCard_(t) {
  const codigo = t.CODIGO || t.codigo || "---";
  const estado = t.Estado || t.estado || "Pendiente";
  const prioridad = t.Prioridad || t.prioridad || "-";

  const tipo = t.Tipo || t.tipo || "-";
  const titulo = t["Título del requerimiento"] || t["Titulo del requerimiento"] || t.Título || t.Titulo || "-";
  const desc = t.Descripción || t.Descripcion || "";
  const solucion = t["Detalle de la solución"] || t["Detalle de la solucion"] || t.Solución || t.Solucion || "";

  const fechaIngresoRaw = t["Fecha de ingreso de ticket"] || t.Fecha || "";
  const fechaIngreso = fechaIngresoRaw ? new Date(fechaIngresoRaw).toLocaleString() : "-";

  // Badge classes: normalizamos para CSS
  const estadoClass = normalizeClass_(estado);
  const prioridadClass = normalizeClass_(prioridad);

  return `
    <div class="ticket-card">
      <div class="ticket-header">
        <span class="ticket-id">${escapeHtml_(codigo)}</span>
        <div class="ticket-badges">
          <span class="badge ${estadoClass}">${escapeHtml_(estado)}</span>
          ${prioridad !== "-" ? `<span class="badge ${prioridadClass}">${escapeHtml_(prioridad)}</span>` : ""}
        </div>
      </div>

      <p><strong>Tipo:</strong> ${escapeHtml_(tipo)}</p>
      <p><strong>Título:</strong> ${escapeHtml_(titulo)}</p>
      ${desc ? `<p><strong>Descripción:</strong> ${escapeHtml_(desc)}</p>` : ""}
      ${solucion ? `<p><strong>Solución:</strong> ${escapeHtml_(solucion)}</p>` : ""}
      <small>Fecha de ingreso: ${escapeHtml_(fechaIngreso)}</small>
    </div>
  `;
}

/**
 * Normaliza textos a clases CSS (minúsculas, sin tildes, sin espacios).
 */
function normalizeClass_(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .trim();
}

/**
 * Escape básico para evitar inyección HTML.
 */
function escapeHtml_(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
