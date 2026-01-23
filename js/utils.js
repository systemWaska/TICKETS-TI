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
