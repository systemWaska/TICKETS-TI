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
  const lastSync = document.getElementById("lastSync");

  try {
    setStatus_("Conectando con el sistema...", "loading");

    // Trae TODOS los tickets.
    const data = await window.jsonpRequest(CONFIG.SCRIPT_URL);

    if (data && data.status === "error") {
      throw new Error(data.message || "Backend devolvió error");
    }

    const tickets = Array.isArray(data) ? data : [];

    // Última sincronización (solo UI)
    if (lastSync) {
      lastSync.textContent = `Última sync: ${new Date().toLocaleString()}`;
    }

    // Render métricas y tabla
    renderMetrics_(tickets);
    renderRecent_(tickets);
    renderStatusBars_(tickets);

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
    return e === "en proceso" || e === "en-atencion" || e === "pausado";
  }).length;

  const atendidosHoy = tickets.filter(t => {
    const e = norm(t.Estado || t.estado);
    if (e !== "atendido" && e !== "resuelto") return false;
    return isToday(t["Fecha de cierre"] || t["Fecha de cierre "] || t.FechaCierre);
  }).length;

  const alta = tickets.filter(t => norm(t.Prioridad || t.prioridad) === "alta").length;

  mPendientes.textContent = String(pendientes);
  mProceso.textContent = String(proceso);
  mHoy.textContent = String(atendidosHoy);
  mAlta.textContent = String(alta);
}

/**
 * Panel “Resumen por estado” (barras)
 * - Ayuda a entender el volumen rápido sin abrir el dashboard.
 */
function renderStatusBars_(tickets) {
  const $ = (id) => document.getElementById(id);
  const bars = {
    pendiente: { fill: $("barPendiente"), val: $("barPendienteVal") },
    enAtencion: { fill: $("barEnAtencion"), val: $("barEnAtencionVal") },
    pausado: { fill: $("barPausado"), val: $("barPausadoVal") },
    bloqueado: { fill: $("barBloqueado"), val: $("barBloqueadoVal") },
    atendido: { fill: $("barAtendido"), val: $("barAtendidoVal") },
    anulado: { fill: $("barAnulado"), val: $("barAnuladoVal") },
  };

  // Si el panel no está en la página, no hacemos nada.
  if (!bars.pendiente.fill || !bars.pendiente.val) return;

  const norm = (s) => String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const total = tickets.length || 1; // evita división entre cero

  const getEstado = (t) => norm(t.Estado || t.estado);
  const count = (list) => tickets.filter(t => list.includes(getEstado(t))).length;

  const counts = {
    pendiente: count(["pendiente"]),
    enAtencion: count(["en atencion", "en proceso"]),
    pausado: count(["pausado"]),
    bloqueado: count(["bloqueado"]),
    atendido: count(["atendido", "resuelto", "finalizado"]),
    anulado: count(["anulado", "cancelado"]),
  };

  const apply = (key) => {
    const b = bars[key];
    if (!b || !b.fill || !b.val) return;
    const n = counts[key] || 0;
    b.val.textContent = String(n);
    b.fill.style.width = `${Math.round((n / total) * 100)}%`;
  };

  apply("pendiente");
  apply("enAtencion");
  apply("pausado");
  apply("bloqueado");
  apply("atendido");
  apply("anulado");
}

/**
 * Tabla de actividad reciente (últimos 5 tickets).
 */
function renderRecent_(tickets) {
  const table = document.getElementById("recentTable");
  const cards = document.getElementById("recentCards");
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
    if (cards) cards.innerHTML = `<p class="empty-state">No hay tickets aún.</p>`;
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

  // Mobile: cards
  if (cards) {
    cards.innerHTML = recent.map(t => {
      const codigo = escapeHtml_(t.CODIGO || t.codigo || "-");
      const tipo = escapeHtml_(t.Tipo || t.tipo || "-");
      const area = escapeHtml_(t["Área"] || t.Area || "-");
      const estado = escapeHtml_(t.Estado || t.estado || "Pendiente");
      const prioridad = escapeHtml_(t.Prioridad || t.prioridad || "-");
      const estadoClass = normalizeClass_(t.Estado || t.estado);
      const prioridadClass = normalizeClass_(t.Prioridad || t.prioridad);

      return `
        <div class="ticket-row-card">
          <div class="ticket-row-top">
            <div class="ticket-row-id">${codigo}</div>
            <div class="badges-inline">
              <span class="badge ${estadoClass}">${estado}</span>
              ${prioridad !== "-" ? `<span class="badge ${prioridadClass}">${prioridad}</span>` : ""}
            </div>
          </div>
          <div class="ticket-row-meta">
            <div><strong>Tipo:</strong> ${tipo}</div>
            <div><strong>Área:</strong> ${area}</div>
          </div>
        </div>
      `;
    }).join("");
  }
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
// Compatibilidad
window.renderRecent_ = renderRecent_;
