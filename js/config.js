/**
 * config.js - Sistema de Tickets, Tareas y Equipos
 * ════════════════════════════════════════════════════════
 *  MODO automático:
 *   - En LOCAL (localhost / abrir el archivo): usa el modo DEMO con datos de
 *     prueba en tu navegador. Entra con  admin / 1234.
 *   - En cualquier HOSTING (ej. github.io): usa el BACKEND REAL (Google Sheets)
 *     a través de SCRIPT_URL. Aquí los cambios SÍ se guardan en el Sheet.
 *
 *  SCRIPT_URL apunta al despliegue del backend AVANZADO (cuenta corporativa).
 *  ⚠️ IMPORTANTE: ese despliegue debe tener acceso "Cualquier persona" para que
 *  el frontend público (github.io) pueda llamarlo; si está restringido al
 *  dominio armsofandes.com, rebota al login y falla.
 * ════════════════════════════════════════════════════════
 */
(function () {
  const host = location.hostname;
  const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || location.protocol === 'file:';
  window.CONFIG = {
    DEMO: esLocal, // demo en local; backend real en hosting
    SCRIPT_URL: "https://script.google.com/a/macros/armsofandes.com/s/AKfycbzijD2s9YyrM3lQzmx2eK3rINgk3Fasv2nWfjVanDu1O-dVNbNaEmlEJPN7SzRaUuc4wg/exec",
  };
})();
