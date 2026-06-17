/**
 * config.js - Sistema de Tickets, Tareas y Equipos
 * ════════════════════════════════════════════════════════
 *  MODO automático:
 *   - En LOCAL (localhost / abrir el archivo): usa el modo DEMO con datos de
 *     prueba en tu navegador. Entra con  admin / 1234.
 *   - En cualquier HOSTING (ej. github.io): usa el BACKEND REAL (Google Sheets)
 *     a través de SCRIPT_URL. Aquí los cambios SÍ se guardan en el Sheet.
 *
  *  SCRIPT_URL apunta al despliegue PÚBLICO del backend AVANZADO (acceso
 *  "Cualquiera", verificado: responde JSON sin login). Si re-despliegas y cambia
 *  la URL, actualízala aquí.
 * ════════════════════════════════════════════════════════
 */
(function () {
  const host = location.hostname;
  const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || location.protocol === 'file:';
  window.CONFIG = {
    DEMO: esLocal, // demo en local; backend real en hosting
    SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxtiOZGp5ZvjYgkpjwnqbAsz6vA9ovqXrVKjeRY-0jt_1H0FThT71o1w0RPCreYxBbJeA/exec",
  };
})();
