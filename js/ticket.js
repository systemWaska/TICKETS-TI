document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get("codigo");
  const elTitle = document.getElementById("ticketTitle");
  const elDetail = document.getElementById("ticketDetail");

  if (!codigo) {
    elTitle.textContent = "Error";
    elDetail.innerHTML = "<p>Falta el código del ticket.</p>";
    return;
  }

  elTitle.textContent = `Cargando ${codigo}...`;

  try {
    // LLAMADA OPTIMIZADA: Solo pide 1 ticket al backend
    const ticket = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=getTicket&codigo=${codigo}`);
    
    if (ticket.error || !ticket.codigo) {
      elTitle.textContent = "No encontrado";
      elDetail.innerHTML = "<p>El ticket no existe.</p>";
      return;
    }

    // Renderizado usando Utils
    const u = window.Utils;
    elTitle.textContent = `${ticket.codigo} - ${ticket.Tipo}`;
    
    elDetail.innerHTML = `
      <div class="ticket-header-badges">
        ${u.renderBadges(ticket.Estado, ticket.Prioridad)}
      </div>
      <div class="ticket-grid">
        <p><strong>Solicitante:</strong> ${u.escapeHtml(ticket.Nombre)} (${u.escapeHtml(ticket.Area)})</p>
        <p><strong>Fecha:</strong> ${u.formatDate(ticket["Fecha de ingreso de ticket"])}</p>
        <hr>
        <h3>${u.escapeHtml(ticket["Título del requerimiento"] || ticket.Titulo)}</h3>
        <p>${u.escapeHtml(ticket.Descripción || ticket.Descripcion).replace(/\n/g, "<br>")}</p>
        
        ${ticket.Solucion ? `
          <div class="solucion-box">
            <h4>Solución</h4>
            <p>${u.escapeHtml(ticket.Solucion)}</p>
            <small>${u.escapeHtml(ticket["Detalle de la solucion"])}</small>
            <p><strong>Cierre:</strong> ${u.formatDate(ticket["Fecha de cierre"])}</p>
          </div>
        ` : ''}
      </div>
    `;

  } catch (err) {
    elTitle.textContent = "Error de conexión";
    elDetail.textContent = err.message;
  }
});
