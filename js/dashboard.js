const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec"; // Asegúrate de usar la última URL generada

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosDashboard();
});

async function cargarDatosDashboard() {
    const tableBody = document.getElementById("ticketsTableBody");
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando datos reales...</td></tr>';

    try {
        const response = await fetch(SCRIPT_URL);
        const tickets = await response.json();

        if (!tickets || tickets.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay datos disponibles.</td></tr>';
            return;
        }

        // 1. Renderizar la Tabla (Últimos 10 tickets)
        renderTable(tickets.slice(-10).reverse());

        // 2. Procesar datos para Gráfico por Área
        const conteoAreas = {};
        tickets.forEach(t => {
            conteoAreas[t.Área] = (conteoAreas[t.Área] || 0) + 1;
        });

        // 3. Procesar datos para Gráfico por Tipo
        const conteoTipos = { "Incidencia": 0, "Requerimiento": 0, "Evento": 0 };
        tickets.forEach(t => {
            if (conteoTipos.hasOwnProperty(t.Tipo)) {
                conteoTipos[t.Tipo]++;
            }
        });

        // 4. Crear los Gráficos
        generarGraficoArea(Object.keys(conteoAreas), Object.values(conteoAreas));
        generarGraficoTipo(Object.keys(conteoTipos), Object.values(conteoTipos));

    } catch (error) {
        console.error("Error en Dashboard:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">❌ Error al conectar con la base de datos.</td></tr>';
    }
}

function generarGraficoArea(labels, data) {
    new Chart(document.getElementById('chartArea'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tickets por Área',
                data: data,
                backgroundColor: '#4a90e2'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
}

function generarGraficoTipo(labels, data) {
    new Chart(document.getElementById('chartType'), {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function renderTable(tickets) {
    const tableBody = document.getElementById("ticketsTableBody");
    tableBody.innerHTML = tickets.map(t => `
        <tr>
            <td><strong>${t.CÓDIGO}</strong></td>
            <td>${t.Nombre}</td>
            <td>${t.Área}</td>
            <td>${t.Tipo}</td>
            <td>${t.Prioridad}</td>
            <td><span class="badge ${t.Estado.replace(/\s+/g, '-').toLowerCase()}">${t.Estado}</span></td>
        </tr>
    `).join('');
}
