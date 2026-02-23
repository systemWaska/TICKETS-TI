/**
 * registrar.js v4
 * Restaura alerta SweetAlert2 al registrar + subida de evidencia
 */
let _configCache = null;

document.addEventListener('DOMContentLoaded', async () => {
  await cargarConfig_();
  applyUrlPresets_();
  actualizarBoton_();

  document.getElementById('descripcion')?.addEventListener('input', e => {
    const c = document.getElementById('descCount');
    if (c) c.textContent = e.target.value.length;
  });
  document.getElementById('area')?.addEventListener('change', cargarPersonal_);
  document.getElementById('tipo')?.addEventListener('change', actualizarBoton_);
  document.getElementById('ticketForm')?.addEventListener('submit', submitTicket_);

  // Preview de evidencia
  const fileInput = document.getElementById('evidenciaFile');
  const preview   = document.getElementById('evidenciaPreview');
  const previewImg= document.getElementById('evidenciaImg');
  const clearBtn  = document.getElementById('evidenciaClear');

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) { preview.style.display = 'none'; return; }
    if (file.size > 5 * 1024 * 1024) {
      window.Utils.toast('⚠️ La imagen supera 5MB', 'warning');
      fileInput.value = ''; preview.style.display = 'none'; return;
    }
    const reader = new FileReader();
    reader.onload = ev => { previewImg.src = ev.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  });
  clearBtn?.addEventListener('click', () => {
    fileInput.value = ''; preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
  });
});

async function cargarConfig_() {
  try {
    const cfg = await window.Utils.jsonpRequest(window.CONFIG.SCRIPT_URL + '?action=config');
    if (!cfg || cfg.status !== 'success') throw new Error(cfg?.message || 'Error config');
    _configCache = cfg;

    fillSelect_('tipo',      cfg.tipos      || ['Incidencia','Requerimiento','Evento'], 'Seleccione tipo...');
    fillSelect_('area',      cfg.areas      || [],                                      'Seleccione área...');
    fillSelect_('prioridad', cfg.prioridades|| ['Baja','Media','Alta'],                 'Seleccione prioridad...');

    const nombreEl = document.getElementById('nombre');
    if (nombreEl) { nombreEl.disabled = true; nombreEl.innerHTML = '<option value="">Seleccione primero el área</option>'; }
  } catch (err) {
    console.error('Error config:', err);
    fillSelect_('tipo',      ['Incidencia','Requerimiento','Evento'], 'Seleccione tipo...');
    fillSelect_('prioridad', ['Baja','Media','Alta'],                 'Seleccione prioridad...');
    showMsg_('⚠️ Sin conexión al servidor. Verifica la URL en config.js', 'warning');
  }
}

function fillSelect_(id, items, defaultLabel) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = `<option value="">${defaultLabel}</option>` +
    items.map(i => `<option value="${esc_(i)}">${esc_(i)}</option>`).join('');
}

function cargarPersonal_() {
  const areaEl   = document.getElementById('area');
  const nombreEl = document.getElementById('nombre');
  if (!areaEl || !nombreEl) return;
  const area = areaEl.value.trim();
  if (!area) {
    nombreEl.disabled = true;
    nombreEl.innerHTML = '<option value="">Seleccione primero el área</option>';
    return;
  }
  if (!_configCache?.raw) {
    nombreEl.disabled = true;
    nombreEl.innerHTML = '<option value="">Config no disponible</option>';
    return;
  }
  const unique = [...new Set(
    _configCache.raw
      .filter(r => String(r.Area || r.area || '').trim() === area)
      .map(r => String(r.Usuario || r.usuario || '').trim())
      .filter(Boolean)
  )].sort();

  if (!unique.length) {
    nombreEl.disabled = true;
    nombreEl.innerHTML = '<option value="">Sin usuarios en esta área</option>';
    return;
  }
  nombreEl.disabled = false;
  nombreEl.innerHTML = `<option value="">Seleccione personal...</option>` +
    unique.map(u => `<option value="${esc_(u)}">${esc_(u)}</option>`).join('');
}

function applyUrlPresets_() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('urgent') !== '1') return;
  const tipoEl = document.getElementById('tipo');
  const prioEl = document.getElementById('prioridad');
  if (tipoEl && [...tipoEl.options].some(o => o.value === 'Incidencia')) tipoEl.value = 'Incidencia';
  if (prioEl && [...prioEl.options].some(o => o.value === 'Alta'))       prioEl.value = 'Alta';
  actualizarBoton_();
}

function actualizarBoton_() {
  const tipoEl = document.getElementById('tipo');
  const btn    = document.getElementById('btnEnviar');
  const label  = document.getElementById('tituloLabel');
  if (!tipoEl || !btn) return;
  const tipo = tipoEl.value;
  btn.textContent = tipo ? `Enviar ${tipo}` : 'Enviar Ticket';
  if (label) {
    const map = { Incidencia:'de la Incidencia', Requerimiento:'del Requerimiento', Evento:'del Evento' };
    label.textContent = tipo ? `Título ${map[tipo] || 'del Ticket'} *` : 'Título *';
  }
}

async function submitTicket_(e) {
  e.preventDefault();
  const form = e.target;
  const btn  = document.getElementById('btnEnviar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Registrando...'; }
  showMsg_('', '');

  try {
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    const params = {};
    fd.forEach((v, k) => { if (k !== 'evidenciaFile') params[k] = v; });
    params.estado = 'Pendiente';

    const data = await window.Utils.jsonpRequest(window.CONFIG.SCRIPT_URL + '?action=create', params);
    if (data.status !== 'success') throw new Error(data.message || 'Error al registrar');

    // Subir evidencia si hay imagen
    const fileInput = document.getElementById('evidenciaFile');
    let evidenciaUrl = null;
    if (fileInput?.files?.[0]) {
      showMsg_(`⏳ Ticket ${data.id} creado. Subiendo imagen...`, 'info');
      evidenciaUrl = await uploadEvidencia_(fileInput.files[0], data.id);
    }

    // ── ALERTA SWEETALERT2 ──────────────────────────────────────────
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        icon:             'success',
        title:            '¡Ticket Registrado!',
        html: `
          <p style="font-size:.95rem;margin-bottom:.5rem;">
            Tu solicitud fue enviada exitosamente.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:.75rem 1rem;margin:.5rem 0;">
            <span style="font-family:monospace;font-size:1.1rem;font-weight:700;color:#065f46;">
              ${data.id}
            </span>
          </div>
          <p style="font-size:.82rem;color:#6b7280;margin-top:.5rem;">
            Guarda este código para hacer seguimiento en "Mis Tickets".
            ${evidenciaUrl ? '<br>📎 Evidencia adjuntada correctamente.' : ''}
          </p>`,
        confirmButtonText: '✅ Entendido',
        confirmButtonColor: '#2563eb',
        showConfirmButton: true,
        timer: 8000,
        timerProgressBar: true,
      });
    } else {
      // Fallback sin SweetAlert
      showMsg_(`✅ Ticket ${data.id} registrado exitosamente.${evidenciaUrl ? ' Evidencia adjunta.' : ''}`, 'success');
    }

    window.Utils.toast(`✅ ${data.id} registrado`, 'success');

    // Reset
    form.reset();
    actualizarBoton_();
    const nombreEl = document.getElementById('nombre');
    if (nombreEl) { nombreEl.disabled = true; nombreEl.innerHTML = '<option value="">Seleccione primero el área</option>'; }
    const descCount = document.getElementById('descCount');
    if (descCount) descCount.textContent = '0';
    const preview = document.getElementById('evidenciaPreview');
    if (preview) preview.style.display = 'none';

  } catch (err) {
    console.error(err);
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon:'error', title:'Error al registrar', text: err.message, confirmButtonColor:'#ef4444' });
    } else {
      showMsg_('❌ ' + err.message, 'error');
    }
  } finally {
    if (btn) { btn.disabled = false; actualizarBoton_(); }
  }
}

/* ── UPLOAD EVIDENCIA ──────────────────────────────────── */
async function uploadEvidencia_(file, codigo) {
  const progress = document.getElementById('uploadProgress');
  const bar      = document.getElementById('uploadBar');
  const text     = document.getElementById('uploadText');
  if (progress) progress.style.display = 'block';
  if (bar)  bar.style.width  = '30%';
  if (text) text.textContent = 'Leyendo imagen...';

  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        if (bar)  bar.style.width  = '60%';
        if (text) text.textContent = 'Subiendo a Drive...';
        const dataUrl  = ev.target.result;
        const comma    = dataUrl.indexOf(',');
        const mimeType = dataUrl.substring(5, dataUrl.indexOf(';'));
        const base64   = dataUrl.substring(comma + 1);

        const res = await window.Utils.jsonpRequest(
          window.CONFIG.SCRIPT_URL + '?action=uploadEvidencia',
          { imageData: base64, mimeType, codigo }
        );
        if (bar)  bar.style.width  = '100%';
        if (text) text.textContent = res.ok ? '✅ Imagen subida' : '⚠️ Sin imagen (el ticket se creó igual)';
        setTimeout(() => { if (progress) progress.style.display = 'none'; }, 2000);
        resolve(res.ok ? res.viewUrl : null);
      } catch {
        if (text) text.textContent = '⚠️ Error al subir imagen';
        setTimeout(() => { if (progress) progress.style.display = 'none'; }, 2500);
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function showMsg_(text, type) {
  const el = document.getElementById('formMsg');
  if (!el) return;
  el.textContent = text || '';
  el.className   = `form-msg ${type||''}`.trim();
  if (text) el.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function esc_(str) {
  return window.Utils ? window.Utils.escapeHtml(str) : String(str).replace(/[&<>"']/g, '');
}
