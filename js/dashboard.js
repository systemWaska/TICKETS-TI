/**
 * dashboard.js
 */
document.addEventListener("DOMContentLoaded", async () => {
    const tableBody = document.getElementById("ticketsTableBody");
    const cardsContainer = document.getElementById("ticketsCards");
    const u = window.Utils; // Requiere utils.js

    try {
        const data = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=tickets`);
        const tickets = Array.isArray(data) ? data : [];

        // 1. Generar Gráficos (Si existe Chart.js)
        if (typeof Chart !== 'undefined') {
            renderCharts(tickets);
        }

        // 2. Renderizar Tabla (Solo Desktop)
        if (tableBody) {
            tableBody.innerHTML = tickets.slice(0, 15).map(t => `
                <tr>
                    <td><a href="ticket.html?codigo=${t.codigo || t.CODIGO}" style="font-weight:bold; color:#4a90e2;">${t.codigo || t.CODIGO}</a></td>
                    <td>${u.escapeHtml(t.Nombre)}</td>
                    <td>${u.escapeHtml(t.Area || t["Área"])}</td>
                    <td>${u.escapeHtml(t.Tipo)}</td>
                    <td>${u.renderBadges(null, t.Prioridad)}</td>
                    <td>${u.renderBadges(t.Estado)}</td>
                </tr>
            `).join("");
        }

        // 3. Renderizar Tarjetas (Solo Mobile - Responsive)
        if (cardsContainer) {
            cardsContainer.innerHTML = tickets.slice(0, 10).map(t => `
                <a href="ticket.html?codigo=${t.codigo || t.CODIGO}" class="ticket-card">
                    <div class="ticket-header">
                        <span class="ticket-id">${t.codigo || t.CODIGO}</span>
                        <div class="ticket-badges">${u.renderBadges(t.Estado, t.Prioridad)}</div>
                    </div>
                    <div class="ticket-body">
                        <p><strong>${u.escapeHtml(t.Nombre)}</strong> (${u.escapeHtml(t.Area || t["Área"])})</p>
                        <p>${u.escapeHtml(t.Tipo)}</p>
                    </div>
                </a>
            `).join("");
        }

    } catch (e) {
        console.error("Error dashboard", e);
    }
});

function renderCharts(tickets) {
    // Agrupación simple
    const countBy = (key) => {
        const counts = {};
        tickets.forEach(t => {
            const val = t[key] || t[key.toLowerCase()] || "Otro";
            counts[val] = (counts[val] || 0) + 1;
        });
        return counts;
    };

    const areaData = countBy("Area");
    const typeData = countBy("Tipo");

    // Gráfico de Barras
    const ctxArea = document.getElementById('chartArea');
    if (ctxArea) {
        new Chart(ctxArea, {
            type: 'bar',
            data: {
                labels: Object.keys(areaData),
                datasets: [{ label: 'Tickets', data: Object.values(areaData), backgroundColor: '#4a90e2' }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // Gráfico de Dona
    const ctxType = document.getElementById('chartType');
    if (ctxType) {
        new Chart(ctxType, {
            type: 'doughnut',
            data: {
                labels: Object.keys(typeData),
                datasets: [{ data: Object.values(typeData), backgroundColor: ['#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}
