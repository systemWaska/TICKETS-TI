async function cargarDatosDashboard() {
    const tableBody = document.getElementById("ticketsTableBody");
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando datos reales...</td></tr>';

    try {
        // CAMBIO 1: Usar CONFIG.SCRIPT_URL (que viene de config.js)
        const response = await fetch(CONFIG.SCRIPT_URL);
        const tickets = await response.json();

        if (!tickets || tickets.length === 0 || tickets.error) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay datos disponibles.</td></tr>';
            return;
        }

        // 1. Renderizar la Tabla (Últimos 10 tickets)
        renderTable(tickets.slice(-10).reverse());

        // 2. Procesar datos para Gráfico por Área
        const conteoAreas = {};
        tickets.forEach(t => {
            // CAMBIO 2: Asegurar que lea "Área" o "Area" sin errores
            const area = t.Área || t.Area || "Sin Área";
            conteoAreas[area] = (conteoAreas[area] || 0) + 1;
        });

        // 3. Procesar datos para Gráfico por Tipo
        const conteoTipos = { "Incidencia": 0, "Requerimiento": 0, "Evento": 0 };
        tickets.forEach(t => {
            const tipo = t.Tipo || t.tipo;
            if (conteoTipos.hasOwnProperty(tipo)) {
                conteoTipos[tipo]++;
            }
        });

        // 4. Crear los Gráficos
        generarGraficoArea(Object.keys(conteoAreas), Object.values(conteoAreas));
        generarGraficoTipo(Object.keys(conteoTipos), Object.values(conteoTipos));

    } catch (error) {
        console.error("Error en Dashboard:", error);
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">❌ Error al conectar con la base de datos.</td></tr>';
    }
}
