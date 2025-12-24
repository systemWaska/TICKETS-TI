const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzrRHvRztFxPDWD7evVT86hXEAvPoTCwWVgMQ2ROYMLGqoFHavCdwQTWRKYyCJHutf5Eg/exec";

document.addEventListener('DOMContentLoaded', () => {
    mostrarUltimos3();
});

// 1. Función para mostrar los 3 más recientes al cargar
async function mostrarUltimos3() {
    const list = document.getElementById("ticketsList");
    list.innerHTML = '<div class="loading">Cargando tickets recientes...</div>';

    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();

        if (!data || data.length === 0) {
            list.innerHTML = "<p>No hay tickets registrados aún.</p>";
            return;
        }

        // Tomamos los últimos 3 registros y los invertimos para que el más nuevo esté arriba
        const ultimos3 = data.slice(-3).reverse();
        renderTickets(ultimos3, "📌 Últimos Tickets Registrados");

    } catch (error) {
        console.error("Error:", error);
        list.innerHTML = "<p>Error al conectar con el servidor.</p>";
    }
}

// 2. Función para buscar por Código
async function buscarTickets() {
    const input = document.getElementById("searchName").value.trim().toUpperCase();
    const list = document.getElementById("ticketsList");

    if (!input) {
        mostrarUltimos3();
        return;
    }

    list.innerHTML = '<div class="loading">Buscando ticket...</div>';

    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();

        // Filtramos buscando coincidencia exacta con la columna CODIGO
        const filtrados = data.filter(t => 
            t.CODIGO && t.CODIGO.toString().toUpperCase().includes(input)
        );

        if (filtrados.length > 0) {
            renderTickets(filtrados, `🔍 Resultados para: ${input}`);
        } else {
            list.innerHTML = `<p>No se encontró ningún ticket con el código <strong>${input}</strong>.</p>`;
        }

    } catch (error) {
        list.innerHTML = "<p>Error al realizar la búsqueda.</p>";
    }
}

// 3. Función principal de dibujado (Render)
function renderTickets(tickets, titulo) {
    const list = document.getElementById("ticketsList");
    let html = `<h3>${titulo}</h3>`;
    
    tickets.forEach(t => {
        // Mapeo exacto según las columnas de tu Google Sheet (image_b4853f.png)
        const cod = t.CODIGO || "S/N";
        const est = t.Estado || "Pendiente";
        const nom = t.Nombre || "Anónimo";
        const tip = t.Tipo || "General";
        const tit = t["Título"] || t["Título del requer"] || "Sin Asunto";
        const fec = t.Fecha || t["Fecha de ingres"] || "";

        // Formatear fecha si es un objeto de fecha
        const fechaFormateada = fec.toString().split('T')[0];

        html += `
        <div class="ticket-card">
            <div class="ticket-header">
                <span class="ticket-id">${cod}</span>
                <span class="badge ${est.toLowerCase().replace(/\s+/g, '-')}">${est.toUpperCase()}</span>
            </div>
            <div class="ticket-info">
                <p><strong>Usuario:</strong> ${nom} | <strong>Tipo:</strong> ${tip}</p>
                <p><strong>Asunto:</strong> ${tit}</p>
                <p class="fecha-text"><small>📅 Registrado: ${fechaFormateada}</small></p>
            </div>
        </div>`;
    });
    list.innerHTML = html;
}
