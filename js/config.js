/**
 * config.js - Sistema de Tickets, Tareas y Equipos
 * ════════════════════════════════════════════════════════
 *  MODO automático:
 *   - En LOCAL (localhost / abrir el archivo): usa el modo DEMO con datos de
 *     prueba en tu navegador. Entra con  admin / 1234  (o tecnico, lider, usuario).
 *   - En cualquier HOSTING (ej. github.io): usa el BACKEND REAL (Google Sheets)
 *     a través de SCRIPT_URL. Aquí los cambios SÍ se guardan en el Sheet.
 *
 *  Para forzar un modo, reemplaza la línea DEMO por  DEMO: true  o  DEMO: false.
 * ════════════════════════════════════════════════════════
 */
(function () {
  const host = location.hostname;
  const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || location.protocol === 'file:';
  window.CONFIG = {
    // Auto: demo en local, backend real en github.io u otro hosting.
    DEMO: esLocal,
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzqDVk9TkLwbjz_zJVzYCm9BsS-OWrzDgWxkvnXns0siv5iMLyueGUulNoYdXWvyGHe/exec",
  };
})();
