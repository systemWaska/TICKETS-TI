document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=tickets`);
    const tickets = Array.isArray(data) ? data : [];

    // 1. Gráficos
    renderCharts(tickets);
    
    // 2. Tabla (Desktop) y Cards (Mobile)
    const tbody = document.getElementById("ticketsTableBody");
    const cards = document.getElementById("ticketsCards");
    const u = window.Utils;

    const htmlRows = tickets.slice(0, 20).map(t => `
      <tr>
        <td><a href="ticket.html?codigo=${t.codigo}">${t.codigo}</a></td>
        <td>${u.escapeHtml(t.Nombre)}</td>
        <td>${u.escapeHtml(t.Area)}</td>
        <td>${u.escapeHtml(t.Tipo)}</td>
        <td>${u.renderBadges(t.Estado, t.Prioridad)}</td>
      </tr>
    `).join("");

    const htmlCards = tickets.slice(0, 10).map(t => `
      <div class="ticket-card">
        <div class="top">
           <strong>${t.codigo}</strong>
           ${u.renderBadges(t.Estado, t.Prioridad)}
        </div>
        <p>${u.escapeHtml(t.Nombre)} - ${u.escapeHtml(t.Area)}</p>
        <a href="ticket.html?codigo=${t.codigo}" class="btn-sm">Ver</a>
      </div>
    `).join("");

    if(tbody) tbody.innerHTML = htmlRows;
    if(cards) cards.innerHTML = htmlCards;

  } catch (e) {
    console.error(e);
  }
});

function renderCharts(tickets) {
  // Lógica de Chart.js simplificada aquí...
  // (Usa la misma lógica que tenías, pero asegúrate de que Chart.js esté cargado)
}
