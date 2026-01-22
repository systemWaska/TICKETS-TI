/*
  Admin (fase 1)
  - Permite actualizar Estado / Solución / Detalle de la solución
  - Protegido con PIN (Script Property: ADMIN_PIN)
  - Envía correo solo si el usuario tiene Email en Config y el estado cambió
*/

(function () {
  const pinInput = document.getElementById('adminPin');
  const codigoInput = document.getElementById('codigoTicket');
  const estadoSelect = document.getElementById('estadoNuevo');
  const solucionInput = document.getElementById('solucion');
  const detalleInput = document.getElementById('detalle');
  const fechaCierreInput = document.getElementById('fechaCierre');
  const form = document.getElementById('adminForm');
  const btn = document.getElementById('btnActualizar');
  const msgBox = document.getElementById('adminMsg');
  const badge = document.getElementById('badgeConectado');
  const badgeSync = document.getElementById('badgeSync');

  function showMsg(text, type) {
    msgBox.className = `alert ${type}`;
    msgBox.textContent = text;
    msgBox.style.display = 'block';
  }

  // ===== Cargar estados desde Config =====
  async function loadConfig() {
    try {
      const data = await fetchJSONP(`${APPS_SCRIPT_URL}?action=config`);
      (data.estados || []).forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        estadoSelect.appendChild(opt);
      });
      // Conexión OK
      badge.classList.add('connected');
      badge.textContent = 'Conectado';
      badgeSync.textContent = `Última sync: ${new Date().toLocaleString()}`;
    } catch (err) {
      badge.classList.remove('connected');
      badge.textContent = 'Sin conexión';
      badgeSync.textContent = '';
      showMsg('No se pudo conectar con el Sheet (Config). Revisa el Apps Script URL.', 'error');
    }
  }

  let isSubmitting = false;
  async function onSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const pin = (pinInput.value || '').trim();
    const codigo = (codigoInput.value || '').trim().toUpperCase();
    const estado = (estadoSelect.value || '').trim();
    const solucion = (solucionInput.value || '').trim();
    const detalle = (detalleInput.value || '').trim();
    const fechaCierreRaw = (fechaCierreInput && fechaCierreInput.value) ? fechaCierreInput.value.trim() : '';
    // datetime-local retorna "YYYY-MM-DDTHH:mm" (sin zona). Lo enviamos como "YYYY-MM-DD HH:mm:ss"
    // para que Apps Script lo pueda registrar en la zona horaria del Spreadsheet.
    const fechaCierre = fechaCierreRaw ? `${fechaCierreRaw.replace('T', ' ')}:00` : '';

    if (!pin) return showMsg('Ingresa tu PIN.', 'error');
    if (!codigo) return showMsg('Ingresa el código del ticket.', 'error');
    if (!estado) return showMsg('Selecciona un estado.', 'error');

    isSubmitting = true;
    btn.disabled = true;
    btn.textContent = 'Actualizando...';

    try {
      const qs = new URLSearchParams({
        action: 'update',
        pin,
        codigo,
        estado,
        solucion,
        detalle,
      });

      // Si se ingresa una fecha/hora de cierre, se usa en lugar de "ahora".
      if (fechaCierre) qs.append('fecha_cierre', fechaCierre);

      // Si se define una fecha/hora manual, se actualiza la columna "Fecha de cierre" con ese valor.
      // Si queda en blanco, el sistema usará la fecha/hora actual cuando el estado sea de cierre.
      if (fechaCierre) qs.set('fecha_cierre', fechaCierre);

      const res = await fetchJSONP(`${APPS_SCRIPT_URL}?${qs.toString()}`);
      if (res && res.ok) {
        showMsg(`Listo: ${res.message || 'Ticket actualizado.'}`, 'success');
      } else {
        showMsg(`Error: ${res && res.message ? res.message : 'No se pudo actualizar.'}`, 'error');
      }
    } catch (err) {
      showMsg('Error de red al actualizar. Intenta nuevamente.', 'error');
    } finally {
      isSubmitting = false;
      btn.disabled = false;
      btn.textContent = 'Actualizar estado';
    }
  }

  form.addEventListener('submit', onSubmit);
  loadConfig();
})();
