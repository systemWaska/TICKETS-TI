async function buscarTickets() {
    const input = document.getElementById("searchName").value.trim().toUpperCase();
    const list = document.getElementById("ticketsList");
    
    if (!input) return;
    list.innerHTML = "Buscando...";

    try {
        const res = await fetch(CONFIG.SCRIPT_URL);
        const data = await res.json();
        
        // Filtra por código exacto o parcial
        const filtrados = data.filter(t => t.CODIGO.toString().toUpperCase().includes(input));
        
        if (filtrados.length === 0) {
            list.innerHTML = "<p>No se encontró ningún ticket con ese código.</p>";
            return;
        }

        list.innerHTML = filtrados.map(t => `
            <div class="ticket-card">
                <div class="ticket-header">
                    <span class="ticket-id">${t.CODIGO}</span>
                    <span class="badge ${t.Estado.toLowerCase().replace(/ /g,'-')}">${t.Estado}</span>
                </div>
                <p><strong>Solicitante:</strong> ${t.Nombre}</p>
                <p><strong>Título:</strong> ${t.Título || t.Titulo}</p>
                <p><strong>Tipo:</strong> ${t.Tipo}</p>
                <small>Fecha: ${new Date(t.Fecha).toLocaleDateString()}</small>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = "Error al buscar tickets.";
    }
}
