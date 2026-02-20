/**
 * registrar.js v2.0
 */
let _configCache = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfig();
  applyUrlPresets_();
  actualizarBoton();
});

function applyUrlPresets_() {
  const params = new URLSearchParams(window.location.search || "");
  const urgent = params.get("urgent");
  const tipoEl = document.getElementById("tipo");
  const prioEl = document.getElementById("prioridad");
  if (!tipoEl || !prioEl) return;
  if (urgent === "1") {
    if ([...tipoEl.options].some(o => o.value === "Incidencia")) tipoEl.value = "Incidencia";
    if ([...prioEl.options].some(o => o.value === "Alta")) prioEl.value = "Alta";
    actualizarBoton();
  }
}

async function cargarConfig() {
  const tipoEl = document.getElementById("tipo");
  const areaEl = document.getElementById("area");
  const nombreEl = document.getElementById("nombre");
  const prioEl = document.getElementById("prioridad");
  if (!tipoEl || !areaEl || !nombreEl || !prioEl) return;

  try {
    const cfg = await window.Utils.jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=config`);
    if (!cfg || cfg.status !== "success") throw new Error(cfg?.message || "Error Config");
    _configCache = cfg;

    const tipos = cfg.tipos?.length ? cfg.tipos : ["Incidencia","Requerimiento","Evento"];
    tipoEl.innerHTML = `<option value="">Seleccione...</option>` + tipos.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');

    const areas = cfg.areas?.length ? cfg.areas : [];
    areaEl.innerHTML = `<option value="">Seleccione área...</option>` + areas.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');

    const prios = cfg.prioridades?.length ? cfg.prioridades : ["Baja","Media","Alta"];
    prioEl.innerHTML = `<option value="">Seleccione prioridad...</option>` + prios.map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');

    nombreEl.disabled = true;
    nombreEl.innerHTML = `<option value="">Seleccione primero el área...</option>`;
  } catch (err) {
    console.error("Error config:", err);
    tipoEl.innerHTML = `<option value="">Seleccione...</option><option value="Incidencia">Incidencia</option><option value="Requerimiento">Requerimiento</option><option value="Evento">Evento</option>`;
    prioEl.innerHTML = `<option value="">Seleccione...</option><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option>`;
    areaEl.innerHTML = `<option value="">No se pudo cargar áreas</option>`;
  }
}

function cargarPersonal() {
  const areaEl   = document.getElementById("area");
  const nombreEl = document.getElementById("nombre");
  if (!areaEl || !nombreEl) return;
  const area = areaEl.value.trim();
  if (!area) { nombreEl.disabled = true; nombreEl.innerHTML = `<option value="">Seleccione primero el área...</option>`; return; }
  if (!_configCache?.raw) { nombreEl.disabled = true; nombreEl.innerHTML = `<option value="">Config no disponible</option>`; return; }
  const usuarios = _configCache.raw
    .filter(r => String(r.Area||r.area||'').trim() === area)
    .map(r => String(r.Usuario||r.usuario||'').trim()).filter(Boolean);
  const unique = [...new Set(usuarios)];
  if (!unique.length) { nombreEl.disabled = true; nombreEl.innerHTML = `<option value="">Sin usuarios para esta área</option>`; return; }
  nombreEl.disabled = false;
  nombreEl.innerHTML = `<option value="">Seleccione personal...</option>` + unique.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');
}

function actualizarBoton() {
  const tipoEl = document.getElementById("tipo");
  const btn = document.getElementById("btnEnviar");
  const label = document.getElementById("tituloLabel");
  if (!tipoEl || !btn) return;
  const tipo = tipoEl.value;
  btn.textContent = tipo ? `Enviar ${tipo}` : "Enviar Ticket";
  if (label) {
    const art = {Incidencia:"de la",Requerimiento:"del",Evento:"del"}[tipo] || "de";
    label.textContent = tipo ? `Título ${art} ${tipo} *` : "Título *";
  }
}

function esc(str) { return window.Utils ? window.Utils.escapeHtml(str) : String(str).replace(/[&<>"']/g,''); }

// Submit
const form = document.getElementById("ticketForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const msgEl = document.getElementById("formMsg");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Registrando...";
    if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-msg'; }

    try {
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const fd = new FormData(form);
      fd.set("estado","Pendiente");
      fd.delete("evidencia");
      const params = {};
      fd.forEach((v,k) => { if(k!=="evidencia") params[k]=v; });

      const data = await window.Utils.jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=create`, params);

      if (data.status !== "success") throw new Error(data.message || "Error al registrar");

      // Éxito
      if (window.Swal) {
        await Swal.fire({ title:`¡${data.tipo} Registrado!`, icon:"success",
          html:`Código: <b>${data.id}</b><br>Usuario: <b>${data.usuario}</b>`, confirmButtonText:"Aceptar" });
      } else {
        if (msgEl) { msgEl.textContent = `✅ Ticket registrado: ${data.id}`; msgEl.className = 'form-msg success'; }
        window.Utils.toast(`✅ Ticket ${data.id} registrado correctamente`, 'success');
      }

      form.reset(); actualizarBoton();
      const nombreEl = document.getElementById("nombre");
      if (nombreEl) { nombreEl.disabled=true; nombreEl.innerHTML=`<option value="">Seleccione primero el área...</option>`; }
    } catch (err) {
      console.error(err);
      if (msgEl) { msgEl.textContent = '❌ ' + err.message; msgEl.className = 'form-msg error'; }
      if (window.Swal) Swal.fire({ title:"Error", icon:"error", text:err.message });
    } finally {
      btn.disabled = false; actualizarBoton();
    }
  });
}
