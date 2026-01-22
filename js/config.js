/**
 * ============================================================
 * config.js
 * ------------------------------------------------------------
 * 1) Centraliza la URL del backend (Apps Script WebApp)
 * 2) Incluye un helper JSONP para evitar errores CORS cuando
 *    el frontend se hospeda en GitHub Pages / servidor externo.
 *
 * IMPORTANTE:
 * - A Apps Script (ContentService) no se le pueden agregar headers
 *   CORS fácilmente.
 * - JSONP funciona inyectando un <script> y por eso el navegador
 *   sí permite “leer” la respuesta.
 * ============================================================
 */

// CENTRALIZACIÓN DE LA URL DEL BACKEND
const CONFIG = {
  // Pega aquí tu URL de implementación más reciente (/exec)
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzrRHvRztFxPDWD7evVT86hXEAvPoTCwWVgMQ2ROYMLGqoFHavCdwQTWRKYyCJHutf5Eg/exec",
};

/**
 * JSONP helper (evita CORS)
 * @param {string} url - URL completa SIN callback
 * @param {number} timeoutMs - tiempo máximo antes de fallar
 * @returns {Promise<any>}
 */
window.jsonpRequest = function jsonpRequest(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const cbName = `__jsonp_cb_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    // Si ya tiene ?, usamos &, si no usamos ?
    const sep = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${sep}callback=${encodeURIComponent(cbName)}`;

    const script = document.createElement("script");
    script.src = finalUrl;
    script.async = true;

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado (JSONP)"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      if (script && script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo cargar el script JSONP"));
    };

    document.head.appendChild(script);
  });
};

/**
 * ============================================================
 * Indicador global de conexión (PILL)
 * ------------------------------------------------------------
 * Objetivo:
 * - Mostrar en TODAS las páginas si el frontend ya se conectó
 *   al Apps Script / Google Sheet.
 * - Evita confusiones cuando el usuario está en mobile y no ve
 *   logs o mensajes de consola.
 *
 * Cómo funciona:
 * - Se inyecta un elemento flotante (.connection-pill).
 * - Se hace una llamada JSONP a ?action=config.
 * - Si responde: "Conectado".
 * - Si falla: "Sin conexión".
 * ============================================================
 */

function ensureConnectionPill_() {
  if (document.getElementById("connectionPill")) return;

  // Algunas páginas (como el Inicio) ya muestran un bloque “Conectado” dentro del layout.
  // Para evitar que aparezca duplicado, no inyectamos el pill flotante si existe el statusStrip.
  if (document.getElementById("statusStrip")) return;

  const pill = document.createElement("div");
  pill.id = "connectionPill";
  pill.className = "connection-pill loading";
  pill.innerHTML = `
    <span class="connection-dot" aria-hidden="true"></span>
    <span class="connection-text" id="connectionText">Conectando...</span>
  `;
  document.body.appendChild(pill);

  // Agregamos una clase al body para dar padding inferior y evitar que el pill tape contenido en mobile.
  document.body.classList.add("has-connection-pill");
}

function setConnectionPill_(state, text) {
  const pill = document.getElementById("connectionPill");
  const t = document.getElementById("connectionText");
  if (!pill || !t) return;

  pill.classList.remove("loading", "ok", "error");
  pill.classList.add(state);
  t.textContent = text;
}

async function checkBackendConnection_() {
  try {
    setConnectionPill_("loading", "Conectando...");
    const cfg = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=config`, 12000);
    if (cfg && cfg.status === "success") {
      setConnectionPill_("ok", "Conectado");
      return;
    }
    // Respuesta inesperada
    setConnectionPill_("error", "Sin conexión");
  } catch (err) {
    setConnectionPill_("error", "Sin conexión");
  }
}

// Auto-init en todas las páginas
document.addEventListener("DOMContentLoaded", () => {
  ensureConnectionPill_();
  checkBackendConnection_();
});
