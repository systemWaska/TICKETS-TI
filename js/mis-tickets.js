const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec"; // Asegúrate de que sea la última URL generada

// Ejecutar automáticamente al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    mostrarUltimosTickets();
});

// Función para mostrar los últimos 3 tickets al entrar
async function mostrarUltimosTickets() {
    const ticketsList = document.getElementById("ticketsList");
    ticketsList.innerHTML = '<p class="empty-state">Cargando tickets recientes...</p>';

    try {
        const response = await fetch(SCRIPT_URL);
        const todosLosTickets = await response.json();

        if (!todosLosTickets || todosLosTickets.length === 0) {
            ticketsList.innerHTML = '<p class="empty-state">No hay tickets registrados aún.</p>';
            return;
        }

        // Tomar los últimos 3 (el final del array son los más nuevos)
        const ultimos3 = todosLosTickets.slice(-3).reverse();

        renderizarTickets(ultimos3, "📌 Tickets Recientes");

    } catch (error) {
        console.error("Error:", error);
        ticketsList.innerHTML = '<p class="empty-state" style="color: red;">❌ No se pudieron cargar los tickets recientes.</p>';
    }
}

// Función de búsqueda (mantiene tu lógica actual pero optimizada)
async function buscarTickets() {
    const busqueda = document.getElementById("searchName").value.trim().toUpperCase();
    const ticketsList = document.getElementById("ticketsList");

    // Si el usuario borra la búsqueda, volvemos a mostrar los últimos 3
    if (!busqueda) {
        mostrarUltimosTickets();
        return;
    }

    ticketsList.innerHTML = '<p class="empty-state">Buscando ticket...</p>';

    try {
        const response = await fetch(SCRIPT_URL);
        const todosLosTickets = await response.json();

        const resultados = todosLosTickets.filter(t => 
            (t.CÓDIGO && t.CÓDIGO.toString().toUpperCase().includes(busqueda)) ||
            (t.Nombre && t.Nombre.toString().toUpperCase().includes(busqueda))
        );

        if (resultados.length === 0) {
            ticketsList.innerHTML = `<p class="empty-state">No se encontró: <strong>${busqueda}</strong></p>`;
            return;
        }

        renderizarTickets(resultados.reverse(), `🔍 Resultados para: ${busqueda}`);

    } catch (error) {
        ticketsList.innerHTML = '<p class="empty-state">❌ Error en la búsqueda.</p>';
    }
}

// Función auxiliar para dibujar los tickets en pantalla
function renderizarTickets(lista, tituloHeader) {
    const ticketsList = document.getElementById("ticketsList");
    
    let html = `<h3 style="margin-bottom: 15px; color: #2c3e50; font-size: 1.1rem;">${tituloHeader}</h3>`;
    
    lista.forEach(t => {
        // Formatear la fecha
        const fechaDoc = t.Fecha ? new Date(t.Fecha).toLocaleDateString() : 'Sin fecha';
        
        html += `
        <div class="ticket-card" style="border-left: 5px solid #4a90e2;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h4 style="color: #4a90e2; margin: 0;">${t.CÓDIGO}</h4>
                <span class="badge ${t.Estado.replace(/\s+/g, '-').toLowerCase()}">${t.Estado}</span>
            </div>
            <p style="margin-top: 8px;"><strong>Título:</strong> ${t.Título}</p>
            <p><strong>Usuario:</strong> ${t.Nombre}</p>
            <p><strong>Tipo:</strong> ${t.Tipo} | <strong>Prioridad:</strong> ${t.Prioridad}</p>
            <p style="font-size: 0.8rem; color: #888; margin-top: 8px;">📅 ${fechaDoc}</p>
        </div>
        `;
    });

    ticketsList.innerHTML = html;
}
