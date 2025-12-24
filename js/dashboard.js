// Datos simulados para el dashboard
const ticketsSimulados = [
    { CODIGO: "REQ-001", Nombre: "RENZO", "Área / Departamento": "RR.HH", "Título del requerimiento": "Error en correo", Descripción: "No recibo correos entrantes.", Prioridad: "Media", Tipo: "Requerimiento", Estado: "En Proceso", Fecha: "2025-12-24" },
    { CODIGO: "INC-001", Nombre: "ERICK", "Área / Departamento": "CONTABILIDAD", "Título del requerimiento": "PC no enciende", Descripción: "La computadora no responde al encender.", Prioridad: "Alta", Tipo: "Incidencia", Estado: "Resuelto", Fecha: "2025-12-23" },
    { CODIGO: "EVE-001", Nombre: "ALEC", "Área / Departamento": "MARKETING", "Título del requerimiento": "Actualización de software", Descripción: "Se actualizó Adobe Creative Cloud.", Prioridad: "Baja", Tipo: "Evento", Estado: "Cerrado", Fecha: "2025-12-22" },
    { CODIGO: "REQ-002", Nombre: "CLARA", "Área / Departamento": "RR.HH", "Título del requerimiento": "Acceso a sistema", Descripción: "Necesito acceso al sistema de nómina.", Prioridad: "Media", Tipo: "Requerimiento", Estado: "En Proceso", Fecha: "2025-12-24" },
    { CODIGO: "INC-002", Nombre: "JOSUE", "Área / Departamento": "PRODUCCION", "Título del requerimiento": "Impresora no imprime", Descripción: "La impresora no responde.", Prioridad: "Alta", Tipo: "Incidencia", Estado: "En Proceso", Fecha: "2025-12-23" }
];

// Función para renderizar gráficos
function renderCharts() {
    // Gráfico por Área
    const areas = [...new Set(ticketsSimulados.map(t => t["Área / Departamento"]))];
    const counts = areas.map(area => ticketsSimulados.filter(t => t["Área / Departamento"] === area).length);

    new Chart(document.getElementById('chartArea'), {
        type: 'bar',
        data: {
            labels: areas,
            datasets: [{
                label: 'Tickets por Área',
                data: counts,
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw}` } }
            }
        }
    });

    // Gráfico por Tipo
    const tipos = ['Requerimiento', 'Incidencia', 'Evento'];
    const countsTipo = tipos.map(tipo => ticketsSimulados.filter(t => t.Tipo === tipo).length);

    new Chart(document.getElementById('chartType'), {
        type: 'pie',
        data: {
            labels: tipos,
            datasets: [{
                label: 'Tickets por Tipo',
                data: countsTipo,
                backgroundColor: ['#4BC0C0', '#FF6384', '#FFCE56']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw}` } }
            }
        }
    });
}

// Función para llenar la tabla
function renderTable() {
    const tableBody = document.getElementById("ticketsTableBody");
    let html = '';

    ticketsSimulados.forEach(ticket => {
        html += `
        <tr>
            <td>${ticket.CODIGO}</td>
            <td>${ticket.Nombre}</td>
            <td>${ticket["Área / Departamento"]}</td>
            <td>${ticket.Tipo}</td>
            <td>${ticket.Prioridad}</td>
            <td>${ticket.Estado}</td>
        </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Ejecutar al cargar
document.addEventListener('DOMContentLoaded', () => {
    renderCharts();
    renderTable();
});
