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
    const jsonp = (window.Utils && window.Utils.jsonpRequest) || window.jsonpRequest;
    const [data, cfg] = await Promise.all([
      jsonp(CONFIG.SCRIPT_URL),
      jsonp(CONFIG.SCRIPT_URL + '?action=config')
    ]);

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
    renderStatusBars_(tickets, (cfg && cfg.estados) || []);

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

// Actividad reciente (tabla en Home)
function renderRecent_(tickets) {
  const tbody = document.getElementById('recentBody');
  if (!tbody) return;

  const toMillis = (v) => {
    if (!v) return 0;
    // Acepta Date, string ISO, o "dd/mm/yyyy, hh:mm:ss"
    if (v instanceof Date) return v.getTime();
    const s = String(v);
    const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      const dd = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const yy = Number(m[3]);
      const hh = Number(m[4] || 0);
      const mi = Number(m[5] || 0);
      const ss = Number(m[6] || 0);
      return new Date(yy, mm, dd, hh, mi, ss).getTime();
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  };

  const escape = (window.Utils && window.Utils.escapeHtml) || escapeHtml_;

  const list = Array.isArray(tickets) ? tickets : [];
  const recent = [...list]
    .sort((a, b) => toMillis(b['Fecha de ingreso'] || b.fechaIngreso) - toMillis(a['Fecha de ingreso'] || a.fechaIngreso))
    .slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Sin datos.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(t => {
    const codigo = escape(t.codigo || '');
    const tipo = escape(t.tipo || '');
    const area = escape(t.area || '');
    const estado = escape(t.estado || '');
    const prioridad = escape(t.prioridad || '');
    return `
      <tr class="row-click" data-codigo="${codigo}">
        <td><strong>${codigo}</strong></td>
        <td>${tipo}</td>
        <td>${area}</td>
        <td>${estado}</td>
        <td>${prioridad}</td>
      </tr>
    `;
  }).join('');

  // Navega al detalle.
  tbody.querySelectorAll('tr[data-codigo]').forEach(tr => {
    tr.addEventListener('click', () => {
      const code = tr.getAttribute('data-codigo');
      if (code) window.location.href = `ticket.html?codigo=${encodeURIComponent(code)}`;
    });
  });
}

/**
 * Panel “Resumen por estado” (barras)
 * - Ayuda a entender el volumen rápido sin abrir el dashboard.
 */
function renderStatusBars_(tickets, estadosConfig) {
  const container = document.getElementById('statusBars');
  if (!container) return;

  const normalize = (window.Utils && window.Utils.normalizeClass) || normalizeClass_;
  const escape = (window.Utils && window.Utils.escapeHtml) || escapeHtml_;

  const list = Array.isArray(tickets) ? tickets : [];

  // Conteos por estado (normalizado).
  const counts = {};
  for (const t of list) {
    const k = normalize(t.estado || '');
    if (!k) continue;
    counts[k] = (counts[k] || 0) + 1;
  }

  // Estados base: usa Config si existe, si no, deduce de tickets.
  let estados = Array.isArray(estadosConfig) ? estadosConfig.filter(Boolean) : [];
  if (estados.length === 0) {
    const seen = new Set();
    for (const t of list) {
      const raw = String(t.estado || '').trim();
      const k = normalize(raw);
      if (!raw || !k || seen.has(k)) continue;
      seen.add(k);
      estados.push(raw);
    }
  }

  // Unificar duplicados por normalización (p.ej. En atención / EN ATENCION).
  const unique = [];
  const seen = new Set();
  for (const e of estados) {
    const k = normalize(e);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    unique.push(e);
  }
  estados = unique;

  const max = Math.max(1, ...estados.map(e => counts[normalize(e)] || 0));

  container.innerHTML = estados
    .map((estado) => {
      const key = normalize(estado);
      const count = counts[key] || 0;
      const pct = Math.round((count / max) * 100);
      return `
        <div class="status-row">
          <span class="label">${escape(estado)}<\/span>
          <div class="bar">
            <div class="bar-fill" style="width:${pct}%"><\/div>
          <\/div>
          <span class="count">${count}<\/span>
        <\/div>`;
    })
    .join('');
}

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