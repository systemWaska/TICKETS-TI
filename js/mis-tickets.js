// Datos simulados de tickets (en producción, estos vienen de Google Sheets)
let ticketsSimulados = [
    { CODIGO: "REQ-001", Nombre: "RENZO", "Área / Departamento": "RR.HH", "Título del requerimiento": "Error en correo", Descripción: "No recibo correos entrantes.", Prioridad: "Media", Tipo: "Requerimiento", Estado: "En Proceso", Fecha: "2025-12-24" },
    { CODIGO: "INC-001", Nombre: "ERICK", "Área / Departamento": "CONTABILIDAD", "Título del requerimiento": "PC no enciende", Descripción: "La computadora no responde al encender.", Prioridad: "Alta", Tipo: "Incidencia", Estado: "Resuelto", Fecha: "2025-12-23" },
    { CODIGO: "EVE-001", Nombre: "ALEC", "Área / Departamento": "MARKETING", "Título del requerimiento": "Actualización de software", Descripción: "Se actualizó Adobe Creative Cloud.", Prioridad: "Baja", Tipo: "Evento", Estado: "Cerrado", Fecha: "2025-12-22" }
];

function buscarTickets() {
    const nombreInput = document.getElementById("searchName").value.trim().toUpperCase();
    const ticketsList = document.getElementById("ticketsList");

    if (!nombreInput) {
        ticketsList.innerHTML = '<p class="empty-state">Ingresa tu nombre arriba para ver tus tickets.</p>';
        return;
    }

    const filtered = ticketsSimulados.filter(ticket => 
        ticket.Nombre.toUpperCase().includes(nombreInput)
    );

    if (filtered.length === 0) {
        ticketsList.innerHTML = '<p class="empty-state">No se encontraron tickets para este nombre.</p>';
        return;
    }

    let html = '';
    filtered.forEach(ticket => {
        html += `
        <div class="ticket-card">
            <h4>${ticket.CODIGO} - ${ticket["Título del requerimiento"]}</h4>
            <p><strong>Área:</strong> ${ticket["Área / Departamento"]}</p>
            <p><strong>Tipo:</strong> ${ticket.Tipo}</p>
            <p><strong>Prioridad:</strong> ${ticket.Prioridad}</p>
            <p><strong>Estado:</strong> ${ticket.Estado}</p>
            <p><strong>Fecha:</strong> ${ticket.Fecha}</p>
        </div>
        `;
    });

    ticketsList.innerHTML = html;
}
