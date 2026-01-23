let CONFIG_CACHE = null;

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("ticketForm");
  const msg = document.getElementById("mensaje");

  // Cargar selects
  try {
    const res = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=config`);
    CONFIG_CACHE = res.raw; // Guardamos raw para filtrar usuarios si quieres
    
    // Función helper para llenar select
    const fill = (id, list) => {
      const el = document.getElementById(id);
      el.innerHTML = `<option value="">Seleccione...</option>` + 
                     list.map(x => `<option value="${x}">${x}</option>`).join("");
    };

    fill("area", res.areas);
    fill("tipo", res.tipos);
    fill("prioridad", res.prioridades);
    
    // Habilitar formulario
    document.getElementById("btnEnviar").disabled = false;

  } catch (e) {
    msg.textContent = "Error cargando configuración. Recarga la página.";
    msg.style.display = "block";
    msg.className = "alert error";
  }

  // Envío
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    try {
      // Convertir FormData a URL Params para GET (JSONP)
      const fd = new FormData(form);
      const params = new URLSearchParams();
      for (const [k, v] of fd.entries()) params.append(k, v);

      const resp = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=create&${params.toString()}`);
      
      if (resp.status === "success") {
        msg.textContent = `Ticket creado: ${resp.id}`;
        msg.className = "alert success";
        msg.style.display = "block";
        form.reset();
      } else {
        throw new Error(resp.message);
      }
    } catch (err) {
      msg.textContent = "Error: " + err.message;
      msg.className = "alert error";
      msg.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar Requerimiento";
    }
  });
});
