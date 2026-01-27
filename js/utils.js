/**
 * ============================================================
 * utils.js
 * ------------------------------------------------------------
 * Funciones auxiliares para todo el sistema.
 * Mejoras aplicadas:
 * - escapeHtml: ahora escapa comillas simples (seguridad)
 * - normalizeClass: consistente con el backend
 * - normalizeTicket: busca campos SIN acentos (compatibilidad)
 * - JSONP: versión única y consolidada
 * ============================================================
 */

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

window.Utils = {
  // ==================================================================
  // Limpieza de texto para evitar XSS (Cross-Site Scripting)
  // ==================================================================
  escapeHtml: (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;"); // ← Escapa comillas simples (importante para atributos)
  },

  // ==================================================================
  // Convierte texto a clase CSS (ej: "En Proceso" -> "en-proceso")
  // ==================================================================
  normalizeClass: (text) => {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "")
      .trim();
  },

  // ==================================================================
  // Normaliza un ticket proveniente del Apps Script a un shape consistente
  // EVITA romper vistas cuando cambian headers o mayúsculas
  // NOTA: Busca campos SIN acentos para compatibilidad con backend
  // ==================================================================
  normalizeTicket: (t) => {
    const o = t && typeof t === 'object' ? t : {};
    const pick = (keys) => {
      for (const k of keys) {
        if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== "") return o[k];
      }
      return "";
    };

    // Campos SIN acentos (compatibilidad con backend Apps Script)
    const codigo = String(pick(["CODIGO","Codigo","codigo","ID","Id","id"]) || "").trim();
    const nombre = String(pick(["Nombre","nombre","Usuario","usuario"]) || "").trim();
    const area = String(pick(["Area","area"]) || "").trim(); // Sin acento
    const tipo = String(pick(["Tipo","tipo"]) || "").trim();
    const titulo = String(pick(["Titulo del requerimiento","Título del requerimiento","Titulo","titulo"]) || "").trim(); // Sin acento en clave principal
    const descripcion = String(pick(["Descripcion","Descripcion","descripcion"]) || "").trim(); // Sin acento
    const prioridad = String(pick(["Prioridad","prioridad"]) || "").trim();
    const estado = String(pick(["Estado","estado"]) || "").trim();
    const evidencia = String(pick(["Evidencia","evidencia"]) || "").trim();
    const solucion = String(pick(["Solucion","Solución","solucion","solución"]) || "").trim(); // Sin acento
    const detalleSolucion = String(pick(["Detalle de la solucion","Detalle de la solución","detalle","detalleSolucion","detalle_solucion"]) || "").trim(); // Sin acento
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

  // ==================================================================
  // Formatea fechas ISO a formato local legible
  // ==================================================================
  formatDate: (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
  },

  // ==================================================================
  // Genera las etiquetas de colores (badges) para estado y prioridad
  // ==================================================================
  renderBadges: (estado, prioridad) => {
    const u = window.Utils;
    let html = `<span class="badge ${u.normalizeClass(estado)}">${u.escapeHtml(estado)}</span>`;
    if (prioridad && prioridad !== "-" && prioridad !== "---") {
      html += ` <span class="badge ${u.normalizeClass(prioridad)}">${u.escapeHtml(prioridad)}</span>`;
    }
    return html;
  }
};

// ==================================================================
// Compatibilidad (evita errores por cache u orden de carga)
// ==================================================================
window.normalizeTicket = window.Utils.normalizeTicket;
window.normalizeTicketClass = window.Utils.normalizeTicketClass || normalizeClass_;
window.Utils.normalizeTicketClass = window.normalizeTicketClass;

/**
 * JSONP request helper - Versión ÚNICA y CONSOLIDADA
 * @param {string} url - URL base del endpoint
 * @param {object} params - Parámetros para enviar
 * @param {number} timeoutMs - Timeout en milisegundos (default: 12000)
 * @returns {Promise<any>}
 */
window.Utils.jsonpRequest = function jsonpRequest(url, params = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const cbName = `cb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement("script");
    
    // Construir URL con parámetros
    const fullUrl = new URL(url);
    Object.keys(params).forEach(k => {
      const val = params[k];
      if (val !== undefined && val !== null && val !== "") {
        fullUrl.searchParams.append(k, String(val));
      }
    });
    fullUrl.searchParams.append('callback', cbName);
    
    script.src = fullUrl.toString();
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
    }, timeoutMs);
    
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
      reject(new Error("Error al cargar script JSONP"));
    };
    
    document.head.appendChild(script);
  });
};

// Mantener compatibilidad: algunos archivos llaman window.jsonpRequest(url)
window.jsonpRequest = (url, params, timeoutMs) => window.Utils.jsonpRequest(url, params || {}, timeoutMs);

// ==================================================================
// Compatibilidad por cache (GitHub Pages):
// Algunas versiones antiguas del frontend referencian escapeHtml_1()
// o escapeHtml_(). Creamos alias globales para evitar ReferenceError.
// ==================================================================
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
