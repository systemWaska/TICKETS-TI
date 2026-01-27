
/** Normaliza texto para usarlo como clase CSS (sin tildes/espacios). */
function normalizeClass_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // quita tildes
    .replace(/[^a-z0-9]+/g, '-')        // espacios y símbolos -> guion
    .replace(/(^-|-$)/g, '');           // quita guiones extremos
}

/**
 * utils.js
 * Funciones auxiliares para todo el sistema.
 */
window.Utils = {
  // Limpieza de texto para evitar errores HTML
  escapeHtml: (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  // Convierte texto a clase CSS (ej: "En Proceso" -> "en-proceso")
  normalizeClass: (text) => {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")
      .trim();
  },

  // Normaliza un ticket proveniente del Apps Script a un shape consistente
  // (Evita romper vistas cuando cambian headers o mayúsculas)
  normalizeTicket: (t) => {
    const o = t && typeof t === 'object' ? t : {};
    const pick = (keys) => {
      for (const k of keys) {
        if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "") return o[k];
      }
      return "";
    };

    const codigo = String(pick(["CODIGO","Codigo","codigo","ID","Id","id"]) || "").trim();
    const nombre = String(pick(["Nombre","nombre","Usuario","usuario"]) || "").trim();
    const area = String(pick(["Area","Área","area","área"]) || "").trim();
    const tipo = String(pick(["Tipo","tipo"]) || "").trim();
    const titulo = String(pick(["Título del requerimiento","Titulo del requerimiento","Título","Titulo","titulo"]) || "").trim();
    const descripcion = String(pick(["Descripción","Descripcion","descripcion"]) || "").trim();
    const prioridad = String(pick(["Prioridad","prioridad"]) || "").trim();
    const estado = String(pick(["Estado","estado"]) || "").trim();
    const evidencia = String(pick(["Evidencia","evidencia"]) || "").trim();
    const solucion = String(pick(["Solucion","Solución","solucion","solución"]) || "").trim();
    const detalleSolucion = String(pick(["Detalle de la solucion","Detalle de la solución","detalle","detalleSolucion","detalle_solucion"]) || "").trim();
    const fechaIngreso = pick(["Fecha de ingreso de ticket","Fecha ingreso","fechaIngreso","fecha_ingreso","Fecha"]) || "";
    const fechaCierre = pick(["Fecha de cierre","fechaCierre","fecha_cierre"]) || "";

    return {
      codigo,
      nombre,
      area,
      tipo,
      titulo,
      descripcion,
      prioridad,
      estado,
      evidencia,
      solucion,
      detalleSolucion,
      fechaIngreso,
      fechaCierre,
      _raw: o,
    };
  },

  // Formatea fechas
  formatDate: (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  },

  // Genera las etiquetas de colores
  renderBadges: (estado, prioridad) => {
    const u = window.Utils;
    let html = `<span class="badge ${u.normalizeClass(estado)}">${u.escapeHtml(estado)}</span>`;
    if (prioridad && prioridad !== "-" && prioridad !== "---") {
      html += ` <span class="badge ${u.normalizeClass(prioridad)}">${u.escapeHtml(prioridad)}</span>`;
    }
    return html;
  }
};


/**
 * JSONP request helper
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<any>}
 */
function jsonpRequest_(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = String(url || "");
    if (!u) {
      reject(new Error("URL inválida"));
      return;
    }
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");
    const sep = u.includes("?") ? "&" : "?";
    script.src = u + sep + "callback=" + cbName;
    script.async = true;

    let done = false;
    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
    };

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error("Timeout JSONP"));
    }, timeoutMs || (window.CONFIG && window.CONFIG.JSONP_TIMEOUT) || 12000);

    window[cbName] = (data) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error("No se pudo cargar el script JSONP"));
    };

    document.head.appendChild(script);
  });
}

// Exponer helpers globales
window.jsonpRequest = jsonpRequest_;
if (window.CONFIG) window.CONFIG.jsonpRequest = jsonpRequest_;

// ------------------------------------------------------------------
// Compatibilidad por cache (GitHub Pages):
// Algunas versiones antiguas del frontend referencian escapeHtml_1()
// o escapeHtml_(). Creamos alias globales para evitar ReferenceError.
// ------------------------------------------------------------------
try {
  if (window.Utils && typeof window.Utils.escapeHtml === 'function') {
    window.escapeHtml = window.Utils.escapeHtml;
    window.escapeHtml_ = window.Utils.escapeHtml;
    window.escapeHtml_1 = window.Utils.escapeHtml;
  }
} catch (e) {
  // No-op
}


// Exponer helpers globales (por compatibilidad)
window.normalizeClass_ = normalizeClass_;
