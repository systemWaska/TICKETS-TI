/**
 * index.js
 * ============================================================
 * Página: index.html
 *
 * Objetivo
 * - Convertir el home en un “tablero” útil (menos vacío):
 *   1) Métricas rápidas
 *   2) Tabla de actividad reciente
 *   3) Indicador de conexión
 *
 * Fuente de datos
 * - Google Apps Script (WebApp) conectado al Google Sheet.
 * - Se consume por JSONP (config.js) para evitar CORS en GitHub Pages.
 * ============================================================
 */

(function initHome() {
  document.addEventListener("DOMContentLoaded", async () => {
    await hydrateHome_();
  });
})();

/**
 * Carga tickets y renderiza métricas + recientes.
 */
async function hydrateHome_() {
  const statusStrip = document.getElementById("statusStrip");
  const statusText = document.getElementById("statusText");

  try {
    setStatus_("Conectando con el sistema...", "loading");

    // Trae TODOS los tickets.
    const data = await window.jsonpRequest(CONFIG.SCRIPT_URL);

    if (data && data.status === "error") {
      throw new Error(data.message || "Backend devolvió error");
    }

    const tickets = Array.isArray(data) ? data : [];

    // Render métricas y tabla
    renderMetrics_(tickets);
    renderRecent_(tickets);

    setStatus_("Conectado", "ok");
  } catch (err) {
    console.error(err);
    setStatus_("No se pudo conectar. Revisa js/config.js (SCRIPT_URL /exec) y permisos del WebApp.", "error");
  }

  /**
   * Actualiza indicador visual de estado.
   */
  function setStatus_(text, kind) {
    if (!statusStrip || !statusText) return;
    statusText.textContent = text;

    // Clases: status-ok / status-error / status-loading
    statusStrip.classList.remove("status-ok", "status-error", "status-loading");
    if (kind === "ok") statusStrip.classList.add("status-ok");
    else if (kind === "error") statusStrip.classList.add("status-error");
    else statusStrip.classList.add("status-loading");
  }
}

/**
 * Calcula y muestra métricas principales.
 */
function renderMetrics_(tickets) {
  const mPendientes = document.getElementById("mPendientes");
  const mProceso = document.getElementById("mProceso");
  const mHoy = document.getElementById("mHoy");
  const mAlta = document.getElementById("mAlta");

  if (!mPendientes || !mProceso || !mHoy || !mAlta) return;

  const norm = (s) => String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const isToday = (d) => {
    if (!d) return false;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return false;
    const now = new Date();
    return dt.getFullYear() === now.getFullYear() &&
      dt.getMonth() === now.getMonth() &&
      dt.getDate() === now.getDate();
  };

  const pendientes = tickets.filter(t => norm(t.Estado || t.estado) === "pendiente").length;

  const proceso = tickets.filter(t => {
    const e = norm(t.Estado || t.estado);
    return e === "en proceso" || e === "en-proceso" || e === "pausado";
  }).length;

  const finalizadosHoy = tickets.filter(t => {
    const e = norm(t.Estado || t.estado);
    if (e !== "finalizado" && e !== "resuelto") return false;
    return isToday(t["Fecha de cierre"] || t["Fecha de cierre "] || t.FechaCierre);
  }).length;

  const alta = tickets.filter(t => norm(t.Prioridad || t.prioridad) === "alta").length;

  mPendientes.textContent = String(pendientes);
  mProceso.textContent = String(proceso);
  mHoy.textContent = String(finalizadosHoy);
  mAlta.textContent = String(alta);
}

/**
 * Tabla de actividad reciente (últimos 5 tickets).
 */
function renderRecent_(tickets) {
  const table = document.getElementById("recentTable");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // Ordenamos por fecha de ingreso (desc)
  const sorted = [...tickets].sort((a, b) => {
    const da = new Date(a["Fecha de ingreso de ticket"] || a.Fecha || 0).getTime();
    const db = new Date(b["Fecha de ingreso de ticket"] || b.Fecha || 0).getTime();
    return db - da;
  });

  const recent = sorted.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No hay tickets aún.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(t => {
    const codigo = escapeHtml_(t.CODIGO || t.codigo || "-");
    const tipo = escapeHtml_(t.Tipo || t.tipo || "-");
    const area = escapeHtml_(t["Área"] || t.Area || "-");
    const estado = escapeHtml_(t.Estado || t.estado || "Pendiente");
    const prioridad = escapeHtml_(t.Prioridad || t.prioridad || "-");

    // Badge classes
    const estadoClass = normalizeClass_(t.Estado || t.estado);
    const prioridadClass = normalizeClass_(t.Prioridad || t.prioridad);

    return `
      <tr>
        <td>${codigo}</td>
        <td>${tipo}</td>
        <td>${area}</td>
        <td><span class="badge ${estadoClass}">${estado}</span></td>
        <td>${prioridad !== "-" ? `<span class="badge ${prioridadClass}">${prioridad}</span>` : "-"}</td>
      </tr>
    `;
  }).join("");
}

/**
 * Utilidades (mismas reglas que en mis-tickets.js)
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

function escapeHtml_(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
