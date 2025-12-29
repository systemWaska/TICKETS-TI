document.addEventListener('DOMContentLoaded', () => {
    cargarDatosDashboard();
});

async function cargarDatosDashboard() {
    const tableBody = document.getElementById("ticketsTableBody");
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando datos reales...</td></tr>';

    try {
        // IMPORTANTE: Usamos CONFIG.SCRIPT_URL de config.js
        const response = await fetch(CONFIG.SCRIPT_URL);
        const tickets = await response.json();

        if (!tickets || tickets.length === 0 || tickets.error) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay datos disponibles en el sistema.</td></tr>';
            return;
        }

        // 1. Renderizar la Tabla (Últimos 10)
        renderTable(tickets.slice(-10).reverse());

        // 2. Procesar datos para Gráfico por Área
        const conteoAreas = {};
        tickets.forEach(t => {
            // Maneja tildes automáticamente
            const area = t.Área || t.Area || "Otros";
            conteoAreas[area] = (conteoAreas[area] || 0) + 1;
        });

        // 3. Procesar datos para Gráfico por Tipo
        const conteoTipos = { "Incidencia": 0, "Requerimiento": 0, "Evento": 0 };
        tickets.forEach(t => {
            const tipo = t.Tipo || t.tipo;
            if (conteoTipos.hasOwnProperty(tipo)) {
                conteoTipos[tipo]++;
            }
        });

        // 4. Crear los Gráficos
        generarGraficoArea(Object.keys(conteoAreas), Object.values(conteoAreas));
        generarGraficoTipo(Object.keys(conteoTipos), Object.values(conteoTipos));

    } catch (error) {
        console.error("Error en Dashboard:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">❌ Error de conexión. Revisa la URL en config.js y que el script esté publicado.</td></tr>';
    }
}

function generarGraficoArea(labels, data) {
    const ctx = document.getElementById('chartArea');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tickets por Área',
                data: data,
                backgroundColor: '#4a90e2'
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
    });
}

function generarGraficoTipo(labels, data) {
    const ctx = document.getElementById('chartType');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderTable(tickets) {
    const tableBody = document.getElementById("ticketsTableBody");
    tableBody.innerHTML = tickets.map(t => {
        const id = t.CODIGO || t.codigo || "---";
        const estado = t.Estado || "En Proceso";
        return `
            <tr>
                <td><strong>${id}</strong></td>
                <td>${t.Nombre || "---"}</td>
                <td>${t.Área || t.Area || "---"}</td>
                <td>${t.Tipo || "---"}</td>
                <td>${t.Prioridad || "---"}</td>
                <td><span class="badge ${estado.toLowerCase().replace(/\s+/g, '-')}">${estado}</span></td>
            </tr>
        `;
    }).join('');
}
