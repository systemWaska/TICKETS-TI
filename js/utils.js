
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
    const cbName = "cb_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";
    script.src = url + sep + "callback=" + cbName;
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
