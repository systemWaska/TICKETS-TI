/**
 * config.js v3.0
 * ============================================================
 * IMPORTANTE: Actualiza SCRIPT_URL con tu URL de Apps Script
 * y ADMIN_PIN con el PIN que quieras para el panel admin.
 * ============================================================
 */
const CONFIG = {
  // ⚠️ Pega aquí tu URL /exec de Apps Script (sin espacios al final)
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzqDVk9TkLwbjz_zJVzYCm9BsS-OWrzDgWxkvnXns0siv5iMLyueGUulNoYdXWvyGHe/exec",

  // 🔐 PIN para acceder al Panel Admin (cámbialo a uno tuyo)
  ADMIN_PIN: "1234",
};

window.CONFIG = CONFIG;
// NOTA: La verificación de conexión la maneja utils.js → checkBackendConnection_()
// No se crea ningún pill adicional aquí para evitar duplicados.
