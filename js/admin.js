// Admin panel logic (update status + solution)
// Depends on js/config.js which defines window.CONFIG.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const form = $('adminForm');
  // PIN deshabilitado por ahora (modo sin contraseña)
  const pinInput = null;
  const codigoInput = $('codigo');
  const estadoSelect = $('estado');
  const fechaCierreInput = $('fechaCierre');
  const solucionInput = $('solucion');
  const detalleInput = $('detalle');
  const msgBox = $('msg');
  const btnClear = $('btnClear');

  function setMsg(text, type) {
    if (!msgBox) return;
    msgBox.textContent = text || '';
    msgBox.className = `form-msg ${type || ''}`.trim();
  }

  function populateEstados(estados) {
    if (!estadoSelect) return;
    estadoSelect.innerHTML = '';

    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = 'Seleccione estado...';
    estadoSelect.appendChild(opt0);

    (estados || []).forEach((s) => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      estadoSelect.appendChild(opt);
    });
  }

  async function loadConfigEstados() {
    const fallback = ['Pendiente', 'En atención', 'Bloqueado', 'Pausado', 'Atendido', 'Anulado'];
    try {
      const res = await ((window.CONFIG && typeof window.CONFIG.jsonpRequest === 'function')
      ? window.CONFIG.jsonpRequest({ action: 'config' })
      : window.jsonpRequest({ action: 'config' }));
      const cfg = res?.data || {};
      const estados = Array.isArray(cfg.estados) && cfg.estados.length ? cfg.estados : fallback;
      populateEstados(estados);
    } catch (e) {
      populateEstados(fallback);
    }
  }

  function getFechaCierreValue() {
    if (!fechaCierreInput) return '';
    
    // Si hay fecha manual, usarla
    if (fechaCierreInput.value) {
      const v = fechaCierreInput.value;
      if (v.includes('T')) {
        const [d, t] = v.split('T');
        return `${d} ${t}:00`;
      }
      return v;
    }
    
    // Si no hay fecha, devolver vacío (el backend usará la fecha actual)
    return '';
  }

  async function onSubmit(e) {
    e.preventDefault();
    setMsg('', '');

    const pin = '';
    const codigo = (codigoInput?.value || '').trim();
    const estado = (estadoSelect?.value || '').trim();
    const solucion = (solucionInput?.value || '').trim();
    const detalle = (detalleInput?.value || '').trim();
    const fechaCierre = getFechaCierreValue();

    // Validación mejorada
    if (!codigo) return setMsg('Ingresa el código del ticket (ej: INC-001).', 'error');
    if (!estado) return setMsg('Selecciona un estado.', 'error');
    
    // Validación para estados finales
    const estadosFinales = ['Atendido', 'Anulado'];
    if (estadosFinales.includes(estado) && !solucion) {
      return setMsg('La solución es obligatoria para cerrar un ticket.', 'error');
    }

    try {
      setMsg('Guardando cambios...', 'info');
      const jsonpRequest = (window.Utils && typeof window.Utils.jsonpRequest === 'function')
        ? window.Utils.jsonpRequest
        : (window.CONFIG && typeof window.CONFIG.jsonpRequest === 'function')
          ? window.CONFIG.jsonpRequest
          : null;

      if (!jsonpRequest) {
        throw new Error('No se encontró jsonpRequest (utils.js).');
      }

      // CORRECCIÓN: Pasar la URL base como primer parámetro
      const res = await jsonpRequest(
        window.CONFIG.SCRIPT_URL,  // URL base
        {
          action: 'update',
          // pin, // (deshabilitado)
          codigo,
          estado,
          solucion,
          detalle,
          fechaCierre,
        }
      );

      if (res?.ok === true) {
        setMsg('✅ Ticket actualizado correctamente.', 'success');
        // Limpiar formulario si fue exitoso
        if (btnClear) btnClear.click();
      } else {
        setMsg(`❌ No se pudo actualizar: ${res?.message || res?.error || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      console.error(err);
      setMsg('❌ Error de conexión con el servidor. Verifica tu internet o el Apps Script.', 'error');
    }
  }

  function onClear() {
    if (codigoInput) codigoInput.value = '';
    if (estadoSelect) estadoSelect.value = '';
    if (fechaCierreInput) fechaCierreInput.value = '';
    if (solucionInput) solucionInput.value = '';
    if (detalleInput) detalleInput.value = '';
    setMsg('', '');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (form) form.addEventListener('submit', onSubmit);
    if (btnClear) btnClear.addEventListener('click', onClear);
    await loadConfigEstados();
  });
})();
