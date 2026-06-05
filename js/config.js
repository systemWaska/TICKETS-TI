/**
 * config.js - Sistema de Tickets, Tareas y Equipos
 * ════════════════════════════════════════════════════════
 *  INSTRUCCIONES:
 *  1. MODO DEMO (local, sin desplegar): deja DEMO en true. La app usa datos
 *     de prueba en tu navegador. Entra con  admin / 1234  (o tecnico, lider,
 *     usuario — todos con PIN 1234).
 *  2. MODO REAL (producción): pon DEMO en false y reemplaza SCRIPT_URL con la
 *     URL /exec de tu WebApp de Apps Script ya desplegada.
 *
 *  La autenticación es por LOGIN con roles (hoja USUARIOS) y tokens de
 *  sesión validados en el backend. Ya NO hay PIN en el cliente.
 * ════════════════════════════════════════════════════════
 */
window.CONFIG = {
  // ⚠️ Cambia a false cuando despliegues el backend real.
  DEMO: true,
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzqDVk9TkLwbjz_zJVzYCm9BsS-OWrzDgWxkvnXns0siv5iMLyueGUulNoYdXWvyGHe/exec",
};
