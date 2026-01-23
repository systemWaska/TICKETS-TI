let CONFIG_CACHE = null;

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("ticketForm");
  const msg = document.getElementById("mensaje");

  try {
    // Cargar config y llenar selects
    const res = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=config`);
    CONFIG_CACHE = res.raw; 
    
    const fill = (id, list) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.innerHTML = `<option value="">Seleccione...</option>` + 
                     list.map(x => `<option value="${x}">${x}</option>`).join("");
    };

    fill("area", res.areas);
    fill("tipo", res.tipos);
    fill("prioridad", res.prioridades);
    
    document.getElementById("btnEnviar").disabled = false;

  } catch (e) {
    if(msg) { msg.textContent = "Error conectando al sistema."; msg.style.display="block"; msg.className="alert error"; }
  }

  // Manejo del envío
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    btn.disabled = true;
    btn.textContent = "Enviando...";

    try {
      const fd = new FormData(form);
      const params = new URLSearchParams();
      // Excluir archivo real, Apps Script no lo recibe así por GET
      for (const [k, v] of fd.entries()) {
        if(k !== 'evidencia') params.append(k, v);
      }

      const resp = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=create&${params.toString()}`);
      
      if (resp.status === "success") {
        if(msg) { 
           msg.textContent = `¡Ticket ${resp.id} creado con éxito!`; 
           msg.className = "alert success"; 
           msg.style.display = "block"; 
        }
        form.reset();
      } else {
        throw new Error(resp.message);
      }
    } catch (err) {
      if(msg) { msg.textContent = err.message; msg.className="alert error"; msg.style.display="block"; }
    } finally {
      btn.disabled = false;
      btn.textContent = "Enviar Requerimiento";
    }
  });
});

// Lógica para filtrar personal por área
document.getElementById("area").addEventListener("change", (e) => {
  const area = e.target.value;
  const userSelect = document.getElementById("nombre");
  userSelect.disabled = !area;
  userSelect.innerHTML = '<option value="">Seleccione...</option>';
  
  if (CONFIG_CACHE && area) {
    const users = CONFIG_CACHE.filter(r => r.Area === area).map(r => r.Usuario);
    // Eliminar duplicados
    [...new Set(users)].forEach(u => {
        const opt = document.createElement("option");
        opt.value = u; 
        opt.textContent = u;
        userSelect.appendChild(opt);
    });
  }
});
