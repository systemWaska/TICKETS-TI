const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec";

async function buscarTickets() {
    const codigoInput = document.getElementById("searchName").value.trim().toUpperCase();
    const ticketsList = document.getElementById("ticketsList");

    if (!codigoInput) {
        ticketsList.innerHTML = '<p class="empty-state">Ingresa el código del ticket para consultar.</p>';
        return;
    }

    ticketsList.innerHTML = '<p class="empty-state">Buscando ticket...</p>';

    try {
        const response = await fetch(SCRIPT_URL);
        const todosLosTickets = await response.json();

        // FILTRAR POR CÓDIGO
        const ticketEncontrado = todosLosTickets.filter(t => 
            t.CÓDIGO && t.CÓDIGO.toString().toUpperCase().includes(codigoInput)
        );

        if (ticketEncontrado.length === 0) {
            ticketsList.innerHTML = `<p class="empty-state">No se encontró ningún ticket con el código: <strong>${codigoInput}</strong></p>`;
            return;
        }

        let html = '';
        ticketEncontrado.forEach(ticket => {
            html += `
            <div class="ticket-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <h4 style="color: #4a90e2;">${ticket.CÓDIGO}</h4>
                    <span class="badge ${ticket.Estado.replace(/\s+/g, '-').toLowerCase()}">${ticket.Estado}</span>
                </div>
                <hr style="margin: 10px 0; border: 0; border-top: 1px solid #eee;">
                <p><strong>Usuario:</strong> ${ticket.Nombre}</p>
                <p><strong>Asunto:</strong> ${ticket.Título}</p>
                <p><strong>Prioridad:</strong> ${ticket.Prioridad}</p>
                <p><strong>Tipo:</strong> ${ticket.Tipo}</p>
                <p style="font-size: 0.8rem; color: #666; margin-top: 10px;">
                    📅 Registrado el: ${new Date(ticket.Fecha).toLocaleString()}
                </p>
            </div>
            `;
        });
        
        ticketsList.innerHTML = html;

    } catch (error) {
        console.error("Error:", error);
        ticketsList.innerHTML = '<p class="empty-state" style="color: red;">❌ Error al conectar con la base de datos.</p>';
    }
}
