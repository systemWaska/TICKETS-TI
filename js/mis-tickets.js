document.addEventListener('DOMContentLoaded', () => mostrarUltimos3());

async function mostrarUltimos3() {
    const list = document.getElementById("ticketsList");
    list.innerHTML = '<div class="loading">Cargando...</div>';
    try {
        const res = await fetch(CONFIG.SCRIPT_URL);
        const data = await res.json();
        const ultimos = data.slice(-3).reverse();
        renderTickets(ultimos, "📌 Últimos Tickets");
    } catch (e) { list.innerHTML = "<p>Error de conexión</p>"; }
}

async function buscarTickets() {
    const input = document.getElementById("searchName").value.trim().toUpperCase();
    if (!input) { mostrarUltimos3(); return; }
    try {
        const res = await fetch(CONFIG.SCRIPT_URL);
        const data = await res.json();
        const filtrados = data.filter(t => t.CODIGO.includes(input));
        renderTickets(filtrados, `🔍 Resultados para: ${input}`);
    } catch (e) { console.error(e); }
}

function renderTickets(tickets, titulo) {
    const list = document.getElementById("ticketsList");
    let html = `<h3>${titulo}</h3>`;
    tickets.forEach(t => {
        html += `
        <div class="ticket-card">
            <div class="ticket-header">
                <span class="ticket-id">${t.CODIGO}</span>
                <span class="badge ${t.Estado.toLowerCase().replace(/ /g,'-')}">${t.Estado}</span>
            </div>
            <p><strong>${t.Nombre}</strong> - ${t.Área}</p>
            <p><em>${t.Tipo}: ${t.Título}</em></p>
        </div>`;
    });
    list.innerHTML = html || "<p>No se encontraron tickets.</p>";
}
