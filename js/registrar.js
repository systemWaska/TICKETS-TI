/**
 * registrar.js v3.0
 * Fix: usa event delegation compatible con initLayout v3
 */
let _configCache = null;

document.addEventListener("DOMContentLoaded", async () => {
  await cargarConfig();
  applyUrlPresets_();
  actualizarBoton();
  // Contador de descripción
  document.getElementById('descripcion')?.addEventListener('input', e => {
    const c = document.getElementById('descCount');
    if (c) c.textContent = e.target.value.length;
  });
  // Submit via event delegation en el form
  document.getElementById('ticketForm')?.addEventListener('submit', submitTicket_);
});

function applyUrlPresets_() {
  const params = new URLSearchParams(window.location.search || "");
  const urgent = params.get("urgent");
  const tipoEl = document.getElementById("tipo");
  const prioEl = document.getElementById("prioridad");
  if (!tipoEl || !prioEl || urgent !== "1") return;
  if ([...tipoEl.options].some(o => o.value==="Incidencia")) tipoEl.value = "Incidencia";
  if ([...prioEl.options].some(o => o.value==="Alta"))     prioEl.value = "Alta";
  actualizarBoton();
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
    showMsg('','');
  } catch (err) {
    console.error("Error config:", err);
    tipoEl.innerHTML = `<option value="">Seleccione...</option><option value="Incidencia">Incidencia</option><option value="Requerimiento">Requerimiento</option><option value="Evento">Evento</option>`;
    prioEl.innerHTML = `<option value="">Seleccione...</option><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option>`;
    areaEl.innerHTML = `<option value="">No se pudo cargar áreas (sin conexión)</option>`;
    showMsg('⚠️ No se pudo conectar al servidor. Verifica la URL en config.js.', 'error');
  }
}

function cargarPersonal() {
  const areaEl   = document.getElementById("area");
  const nombreEl = document.getElementById("nombre");
  if (!areaEl || !nombreEl) return;
  const area = areaEl.value.trim();
  if (!area) { nombreEl.disabled=true; nombreEl.innerHTML=`<option value="">Seleccione primero el área...</option>`; return; }
  if (!_configCache?.raw) { nombreEl.disabled=true; nombreEl.innerHTML=`<option value="">Config no disponible</option>`; return; }
  const unique = [...new Set(
    _configCache.raw
      .filter(r => String(r.Area||r.area||'').trim()===area)
      .map(r => String(r.Usuario||r.usuario||'').trim()).filter(Boolean)
  )];
  if (!unique.length) { nombreEl.disabled=true; nombreEl.innerHTML=`<option value="">Sin usuarios para esta área</option>`; return; }
  nombreEl.disabled = false;
  nombreEl.innerHTML = `<option value="">Seleccione personal...</option>` + unique.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');
}

function actualizarBoton() {
  const tipoEl = document.getElementById("tipo");
  const btn    = document.getElementById("btnEnviar");
  const label  = document.getElementById("tituloLabel");
  if (!tipoEl || !btn) return;
  const tipo = tipoEl.value;
  btn.textContent = tipo ? `Enviar ${tipo}` : "Enviar Ticket";
  if (label) {
    const art = {Incidencia:"de la",Requerimiento:"del",Evento:"del"}[tipo]||"de";
    label.textContent = tipo ? `Título ${art} ${tipo} *` : "Título *";
  }
}

async function submitTicket_(e) {
  e.preventDefault();
  const form = e.target;
  const btn  = document.getElementById("btnEnviar");
  if (btn) { btn.disabled=true; btn.textContent="Registrando..."; }
  showMsg('', '');
  try {
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    fd.set("estado","Pendiente");
    const params = {};
    fd.forEach((v,k) => { if(k!=="evidenciaFile") params[k]=v; });
    // 1. Crear el ticket
    const data = await window.Utils.jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=create`, params);
    if (data.status !== "success") throw new Error(data.message || "Error al registrar");
    // 2. Subir imagen si hay archivo (asíncrono, no bloquea el éxito)
    const fileInput = document.getElementById('evidenciaFile');
    if (fileInput?.files?.[0]) {
      showMsg(`⏳ Ticket ${data.id} creado. Subiendo imagen...`, 'info');
      const url = await uploadEvidencia_(fileInput.files[0], data.id);
      if (url) {
        showMsg(`✅ Ticket ${data.id} registrado con evidencia.`, 'success');
      } else {
        showMsg(`✅ Ticket ${data.id} registrado (sin imagen adjunta).`, 'success');
      }
    } else {
      showMsg(`✅ Ticket registrado exitosamente. Código: ${data.id}`, 'success');
    }
    window.Utils.toast(`✅ ${data.id} registrado`, 'success');
    form.reset(); actualizarBoton();
    const nombreEl = document.getElementById("nombre");
    if (nombreEl) { nombreEl.disabled=true; nombreEl.innerHTML=`<option value="">Seleccione primero el área...</option>`; }
    const descCount = document.getElementById('descCount');
    if (descCount) descCount.textContent = '0';
    const preview = document.getElementById('evidenciaPreview');
    if (preview) preview.style.display = 'none';
  } catch (err) {
    console.error(err);
    showMsg('❌ ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled=false; actualizarBoton(); }
  }
}

function showMsg(text, type) {
  const el = document.getElementById('formMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className = `form-msg ${type||''}`.trim();
  if (text) el.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function esc(str) { return window.Utils ? window.Utils.escapeHtml(str) : String(str).replace(/[&<>"']/g,''); }

/* ── UPLOAD DE EVIDENCIA ────────────────────────────────── */
async function uploadEvidencia_(file, codigo) {
  return new Promise((resolve) => {
    const progress = document.getElementById('uploadProgress');
    const bar      = document.getElementById('uploadBar');
    const text     = document.getElementById('uploadText');

    if (progress) progress.style.display = 'block';
    if (bar)  bar.style.width  = '30%';
    if (text) text.textContent = 'Leyendo imagen...';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        if (bar)  bar.style.width  = '60%';
        if (text) text.textContent = 'Subiendo a Drive...';

        // Separar el base64 del data:URL
        const dataUrl  = ev.target.result;
        const comma    = dataUrl.indexOf(',');
        const mimeType = dataUrl.substring(5, dataUrl.indexOf(';'));
        const base64   = dataUrl.substring(comma+1);

        const res = await window.Utils.jsonpRequest(
          `${window.CONFIG.SCRIPT_URL}?action=uploadEvidencia`,
          { imageData: base64, mimeType, codigo }
        );

        if (bar)  bar.style.width  = '100%';
        if (text) text.textContent = res.ok ? '✅ Imagen subida' : '⚠️ Sin imagen (continuando sin ella)';

        setTimeout(() => { if (progress) progress.style.display='none'; }, 2000);
        resolve(res.ok ? res.viewUrl : null);
      } catch (err) {
        if (text) text.textContent = '⚠️ Error al subir imagen – el ticket se registrará sin ella';
        setTimeout(() => { if (progress) progress.style.display='none'; }, 2500);
        resolve(null);
      }
    };
    reader.onerror = () => {
      if (text) text.textContent = '⚠️ Error al leer imagen';
      resolve(null);
    };
    reader.readAsDataURL(file);
  });
}
