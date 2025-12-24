const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrRHvRztFxPDWD7evVT86hXEAvPoTCwWVgMQ2ROYMLGqoFHavCdwQTWRKYyCJHutf5Eg/exec";

document.addEventListener('DOMContentLoaded', () => mostrarUltimos3());

async function mostrarUltimos3() {
    const list = document.getElementById("ticketsList");
    list.innerHTML = "<p>Cargando tickets recientes...</p>";
    try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        // Tomar los últimos 3 y mostrarlos
        renderTickets(data.slice(-3).reverse(), "📌 Últimos Tickets Registrados");
    } catch (e) { list.innerHTML = "Error al cargar datos."; }
}

async function buscarTickets() {
    const busqueda = document.getElementById("searchName").value.trim().toUpperCase();
    if (!busqueda) { mostrarUltimos3(); return; }

    try {
        const res = await fetch(SCRIPT_URL);
        const data = await res.json();
        // Filtrar estrictamente por CÓDIGO
        const filtrados = data.filter(t => t.CODIGO && t.CODIGO.toString().includes(busqueda));
        renderTickets(filtrados, `🔍 Resultados para: ${busqueda}`);
    } catch (e) { console.error(e); }
}

function renderTickets(tickets, titulo) {
    const list = document.getElementById("ticketsList");
    let html = `<h3>${titulo}</h3>`;
    tickets.forEach(t => {
        html += `
        <div class="ticket-card">
            <h4>${t.CODIGO} - ${t.Estado}</h4>
            <p><strong>Usuario:</strong> ${t.Nombre} | <strong>Tipo:</strong> ${t.Tipo}</p>
            <p><strong>Asunto:</strong> ${t.Título}</p>
        </div>`;
    });
    list.innerHTML = html;
}
