/**
 * mis-tickets.js
 * ------------------------------------------------------------
 * Busca tickets por CODIGO (ej: INC-001) y los muestra en cards.
 *
 * Nota:
 * - El backend devuelve llaves según el encabezado del Sheet.
 * - Aquí somos tolerantes con tildes/cambios de nombre.
 */

async function buscarTickets() {
  const inputEl = document.getElementById("searchName");
  const list = document.getElementById("ticketsList");

  if (!inputEl || !list) return;

  const input = inputEl.value.trim().toUpperCase();
  if (!input) return;

  list.innerHTML = "Buscando...";

  try {
    const res = await fetch(CONFIG.SCRIPT_URL);
    const data = await res.json();

    // Filtra por código exacto o parcial
    const filtrados = (data || []).filter((t) =>
      String(t.CODIGO || t.codigo || "").toUpperCase().includes(input)
    );

    if (filtrados.length === 0) {
      list.innerHTML = "<p>No se encontró ningún ticket con ese código.</p>";
      return;
    }

    list.innerHTML = filtrados
      .map((t) => {
        const codigo = t.CODIGO || t.codigo || "---";
        const estado = t.Estado || t.estado || "Pendiente";
        const titulo =
          t["Título del requerimiento"] ||
          t["Titulo del requerimiento"] ||
          t.Título ||
          t.Titulo ||
          "-";
        const solucion = t.Solución || t.Solucion || t["Detalle de la solución"] || t["Detalle de la solucion"] || "";
        const fechaIngreso = t["Fecha de ingreso de ticket"] || t["Fecha"] || t.Fecha || "";
        const fechaTxt = fechaIngreso ? new Date(fechaIngreso).toLocaleString() : "-";

        return `
          <div class="ticket-card">
            <div class="ticket-header">
              <span class="ticket-id">${codigo}</span>
              <span class="badge ${String(estado).toLowerCase().replace(/\s+/g, '-')}">${estado}</span>
            </div>
            <p><strong>Solicitante:</strong> ${t.Nombre || t.nombre || "-"}</p>
            <p><strong>Área:</strong> ${t.Área || t.Area || "-"}</p>
            <p><strong>Tipo:</strong> ${t.Tipo || t.tipo || "-"}</p>
            <p><strong>Título:</strong> ${titulo}</p>
            ${solucion ? `<p><strong>Solución:</strong> ${solucion}</p>` : ""}
            <small>Fecha de ingreso: ${fechaTxt}</small>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    console.error(e);
    list.innerHTML = "Error al buscar tickets.";
  }
}
