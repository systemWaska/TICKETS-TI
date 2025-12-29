document.addEventListener('DOMContentLoaded', () => cargarDatosDashboard());

async function cargarDatosDashboard() {
    const tableBody = document.getElementById("ticketsTableBody");
    try {
        const response = await fetch(CONFIG.SCRIPT_URL);
        const tickets = await response.json();

        if (!tickets || tickets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No hay datos disponibles.</td></tr>';
            return;
        }

        renderTable(tickets.slice(-10).reverse());

        // Procesar Áreas
        const conteoAreas = {};
        tickets.forEach(t => {
            const area = t.Área || t.Area || "Otros";
            conteoAreas[area] = (conteoAreas[area] || 0) + 1;
        });

        // Procesar Tipos
        const conteoTipos = { "Incidencia": 0, "Requerimiento": 0, "Evento": 0 };
        tickets.forEach(t => {
            if (conteoTipos.hasOwnProperty(t.Tipo)) conteoTipos[t.Tipo]++;
        });

        generarGraficoArea(Object.keys(conteoAreas), Object.values(conteoAreas));
        generarGraficoTipo(Object.keys(conteoTipos), Object.values(conteoTipos));

    } catch (error) {
        tableBody.innerHTML = '<tr><td colspan="6">Error de conexión.</td></tr>';
    }
}

function renderTable(tickets) {
    const tableBody = document.getElementById("ticketsTableBody");
    tableBody.innerHTML = tickets.map(t => `
        <tr>
            <td><strong>${t.CODIGO}</strong></td>
            <td>${t.Nombre}</td>
            <td>${t.Área || t.Area}</td>
            <td>${t.Tipo}</td>
            <td>${t.Prioridad}</td>
            <td><span class="badge ${t.Estado.toLowerCase().replace(/ /g,'-')}">${t.Estado}</span></td>
        </tr>
    `).join('');
}

function generarGraficoArea(labels, data) {
    new Chart(document.getElementById('chartArea'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ label: 'Tickets por Área', data: data, backgroundColor: '#4a90e2' }]
        }
    });
}

function generarGraficoTipo(labels, data) {
    new Chart(document.getElementById('chartType'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'] }]
        }
    });
}
