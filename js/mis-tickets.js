// Usa la misma URL que generaste para el registro
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec";

async function buscarTickets() {
    const nombreInput = document.getElementById("searchName").value.trim().toUpperCase();
    const ticketsList = document.getElementById("ticketsList");

    // Si el campo está vacío, limpiar la lista
    if (!nombreInput) {
        ticketsList.innerHTML = '<p class="empty-state">Ingresa tu nombre arriba para ver tus tickets.</p>';
        return;
    }

    // Mostrar estado de carga
    ticketsList.innerHTML = '<p class="empty-state">Buscando en la base de datos...</p>';

    try {
        // Llamada a Google Apps Script (ejecuta el doGet)
        const response = await fetch(SCRIPT_URL);
        const todosLosTickets = await response.json();

        // Filtrar los tickets por el nombre ingresado
        // Importante: "Nombre" debe coincidir con el encabezado de tu Sheet
        const misTickets = todosLosTickets.filter(t => 
            t.Nombre && t.Nombre.toString().toUpperCase().includes(nombreInput)
        );

        if (misTickets.length === 0) {
            ticketsList.innerHTML = `<p class="empty-state">No se encontraron tickets para: <strong>${nombreInput}</strong></p>`;
            return;
        }

        // Construir el HTML de las tarjetas
        let html = '';
        misTickets.reverse().forEach(ticket => { // reverse() para ver los más nuevos primero
            html += `
            <div class="ticket-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4>${ticket.CÓDIGO}</h4>
                    <span class="badge ${ticket.Estado.replace(/\s+/g, '-').toLowerCase()}">${ticket.Estado}</span>
                </div>
                <p><strong>Título:</strong> ${ticket.Título}</p>
                <p><strong>Área:</strong> ${ticket.Área}</p>
                <p><strong>Prioridad:</strong> ${ticket.Prioridad}</p>
                <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">
                    📅 Fecha: ${new Date(ticket.Fecha).toLocaleDateString()}
                </p>
            </div>
            `;
        });
        
        ticketsList.innerHTML = html;

    } catch (error) {
        console.error("Error al obtener tickets:", error);
        ticketsList.innerHTML = '<p class="empty-state" style="color: red;">❌ Error al conectar con la base de datos.</p>';
    }
}
