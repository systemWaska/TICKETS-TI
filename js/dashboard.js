document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=tickets`);
    const tickets = Array.isArray(data) ? data : [];
    const u = window.Utils;

    // 1. Gráficos (Lógica existente simplificada)
    processAndRenderCharts(tickets);

    // 2. Tabla (Desktop)
    const tbody = document.getElementById("ticketsTableBody");
    if (tbody) {
      tbody.innerHTML = tickets.slice(0, 20).map(t => `
        <tr>
          <td><a href="ticket.html?codigo=${t.codigo}" style="font-weight:bold; color:#4a90e2;">${t.codigo}</a></td>
          <td>${u.escapeHtml(t.Nombre)}</td>
          <td>${u.escapeHtml(t.Area)}</td>
          <td>${u.escapeHtml(t.Tipo)}</td>
          <td>${u.renderBadges("-", t.Prioridad)}</td> <td>${u.renderBadges(t.Estado)}</td>
        </tr>
      `).join("");
    }

    // 3. Cards (Mobile)
    const cards = document.getElementById("ticketsCards");
    if (cards) {
      cards.innerHTML = tickets.slice(0, 10).map(t => `
        <div class="ticket-row-card">
          <div class="ticket-row-top">
             <a href="ticket.html?codigo=${t.codigo}" class="ticket-row-id">${t.codigo}</a>
             ${u.renderBadges(t.Estado, t.Prioridad)}
          </div>
          <p>${u.escapeHtml(t.Nombre)} <span class="muted">(${u.escapeHtml(t.Area)})</span></p>
        </div>
      `).join("");
    }

  } catch (e) {
    console.error(e);
  }
});

function processAndRenderCharts(tickets) {
  // Si tienes Chart.js cargado en el HTML
  if (typeof Chart === 'undefined') return;

  const countBy = (key) => {
    return tickets.reduce((acc, t) => {
      const k = t[key] || t[key.toLowerCase()] || "Otros";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  };

  const areaData = countBy("Area");
  const typeData = countBy("Tipo");

  const ctxArea = document.getElementById('chartArea');
  const ctxType = document.getElementById('chartType');

  if (ctxArea) {
    new Chart(ctxArea, {
      type: 'bar',
      data: {
        labels: Object.keys(areaData),
        datasets: [{ label: 'Tickets', data: Object.values(areaData), backgroundColor: '#4a90e2' }]
      }
    });
  }
  
  if (ctxType) {
    new Chart(ctxType, {
      type: 'doughnut',
      data: {
        labels: Object.keys(typeData),
        datasets: [{ data: Object.values(typeData), backgroundColor: ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6'] }]
      }
    });
  }
}
