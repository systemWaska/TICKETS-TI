const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyXdV2cveu1ECWhi-3HMODJxKLIrEHmk1dA-15vAq1N8X-X_PRIR8t43i6-ulc_J5Dwxg/exec";

function renderTickets(tickets, titulo) {
    const list = document.getElementById("ticketsList");
    let html = `<h3>${titulo}</h3>`;
    
    tickets.forEach(t => {
        // Sincronizado con los nombres de columna de tu imagen
        const cod = t.CODIGO || "S/N";
        const est = t.Estado || "Pendiente";
        const tit = t["Título del requer"] || t.Título || "Sin Asunto";
        const fec = t["Fecha de ingres"] || t.Fecha || "";

        html += `
        <div class="ticket-card">
            <h4>${cod} - ${est}</h4>
            <p><strong>Usuario:</strong> ${t.Nombre} | <strong>Tipo:</strong> ${t.Tipo}</p>
            <p><strong>Asunto:</strong> ${tit}</p>
            <p><small>📅 Registrado: ${fec}</small></p>
        </div>`;
    });
    list.innerHTML = html;
}

// ... resto de funciones buscarTickets y mostrarUltimos3 ...
