const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec";

async function buscarTickets() {
    const busqueda = document.getElementById("searchName").value.trim().toUpperCase();
    const ticketsList = document.getElementById("ticketsList");

    if (!busqueda) return;

    try {
        const response = await fetch(SCRIPT_URL);
        const datos = await response.json();

        // Filtramos buscando coincidencias en la columna CÓDIGO
        const resultados = datos.filter(t => 
            t.CÓDIGO && t.CÓDIGO.toString().toUpperCase().includes(busqueda)
        );

        if (resultados.length === 0) {
            ticketsList.innerHTML = "<p>No se encontró el código.</p>";
            return;
        }

        ticketsList.innerHTML = resultados.map(t => `
            <div class="ticket-card">
                <h4>${t.CÓDIGO}</h4>
                <p><strong>Tipo:</strong> ${t.Tipo}</p>
                <p><strong>Estado:</strong> ${t.Estado}</p>
                <p><strong>Título:</strong> ${t.Título}</p>
            </div>
        `).join('');

    } catch (e) { console.error(e); }
}
