// Admin panel logic (update status + solution)
// Depends on js/config.js which defines window.CONFIG.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // Elementos del DOM
  const form = $('adminForm');
  const ticketSelect = $('ticketSelect');
  const filterArea = $('filterArea');
  const filterEstado = $('filterEstado');
  const filterTipo = $('filterTipo');
  const btnFilter = $('btnFilter');
  const btnClearFilters = $('btnClearFilters');
  const ticketDetails = $('ticketDetails');
  const estadoSelect = $('estado');
  const fechaCierreInput = $('fechaCierre');
  const solucionInput = $('solucion');
  const detalleInput = $('detalle');
  const msgBox = $('msg');
  const btnClear = $('btnClear');

  // Tickets cargados
  let allTickets = [];
  let filteredTickets = [];

  function setMsg(text, type) {
    if (!msgBox) return;
    msgBox.textContent = text || '';
    msgBox.className = `form-msg ${type || ''}`.trim();
  }

  // Cargar tickets desde el backend
  async function loadTickets() {
    try {
      setMsg('Cargando tickets...', 'info');
      
      const jsonpRequest = window.Utils?.jsonpRequest || window.jsonpRequest;
      if (!jsonpRequest) throw new Error('jsonpRequest no disponible');
      
      const tickets = await jsonpRequest(window.CONFIG.SCRIPT_URL);
      
      if (!tickets || tickets.error) {
        throw new Error(tickets?.message || 'Error al cargar tickets');
      }
      
      allTickets = Array.isArray(tickets) ? tickets.map(t => window.Utils.normalizeTicket(t)) : [];
      filteredTickets = [...allTickets];
      
      // Poblar el dropdown
      populateTicketSelect(filteredTickets);
      
      // Cargar catálogos para filtros
      await loadConfigCatalogs();
      
      setMsg('', '');
    } catch (err) {
      console.error('Error cargando tickets:', err);
      setMsg(`❌ Error: ${err.message}`, 'error');
    }
  }

  // Poblar el dropdown de tickets
  function populateTicketSelect(tickets) {
    if (!ticketSelect) return;
    
    ticketSelect.innerHTML = '<option value="">Seleccione un ticket...</option>';
    
    // Ordenar por fecha (más recientes primero)
    const sorted = [...tickets].sort((a, b) => {
      const da = new Date(a.fechaIngreso || 0).getTime();
      const db = new Date(b.fechaIngreso || 0).getTime();
      return db - da;
    });
    
    sorted.forEach(ticket => {
      const option = document.createElement('option');
      option.value = ticket.codigo;
      option.textContent = `${ticket.codigo} - ${ticket.titulo?.substring(0, 50) || 'Sin título'}`;
      option.dataset.estado = ticket.estado;
      option.dataset.prioridad = ticket.prioridad;
      ticketSelect.appendChild(option);
    });
  }

  // Cargar catálogos para filtros
  async function loadConfigCatalogs() {
    try {
      const jsonpRequest = window.Utils?.jsonpRequest || window.jsonpRequest;
      const config = await jsonpRequest(`${window.CONFIG.SCRIPT_URL}?action=config`);
      
      if (config?.status === 'success') {
        // Áreas
        if (filterArea && config.areas) {
          filterArea.innerHTML = '<option value="">Todas las áreas</option>';
          config.areas.forEach(area => {
            const opt = document.createElement('option');
            opt.value = area;
            opt.textContent = area;
            filterArea.appendChild(opt);
          });
        }
        
        // Estados
        if (filterEstado && config.estados) {
          filterEstado.innerHTML = '<option value="">Todos los estados</option>';
          config.estados.forEach(estado => {
            const opt = document.createElement('option');
            opt.value = estado;
            opt.textContent = estado;
            filterEstado.appendChild(opt);
          });
        }
        
        // Tipos
        if (filterTipo && config.tipos) {
          filterTipo.innerHTML = '<option value="">Todos los tipos</option>';
          config.tipos.forEach(tipo => {
            const opt = document.createElement('option');
            opt.value = tipo;
            opt.textContent = tipo;
            filterTipo.appendChild(opt);
          });
        }
        
        // Estados para el select de actualización
        if (estadoSelect && config.estados) {
          estadoSelect.innerHTML = '<option value="">Seleccione estado...</option>';
          config.estados.forEach(estado => {
            const opt = document.createElement('option');
            opt.value = estado;
            opt.textContent = estado;
            estadoSelect.appendChild(opt);
          });
        }
      }
    } catch (err) {
      console.error('Error cargando catálogos:', err);
    }
  }

  // Aplicar filtros
  function applyFilters() {
    const areaFilter = filterArea?.value.trim() || '';
    const estadoFilter = filterEstado?.value.trim() || '';
    const tipoFilter = filterTipo?.value.trim() || '';
    
    filteredTickets = allTickets.filter(ticket => {
      const areaMatch = !areaFilter || (ticket.area || '').toLowerCase() === areaFilter.toLowerCase();
      const estadoMatch = !estadoFilter || (ticket.estado || '').toLowerCase() === estadoFilter.toLowerCase();
      const tipoMatch = !tipoFilter || (ticket.tipo || '').toLowerCase() === tipoFilter.toLowerCase();
      
      return areaMatch && estadoMatch && tipoMatch;
    });
    
    populateTicketSelect(filteredTickets);
    
    // Si el ticket seleccionado no está en los filtrados, limpiar
    if (ticketSelect.value && !filteredTickets.some(t => t.codigo === ticketSelect.value)) {
      ticketSelect.value = '';
      clearTicketDetails();
    }
    
    setMsg(`Mostrando ${filteredTickets.length} de ${allTickets.length} tickets`, 'info');
  }

  // Limpiar filtros
  function clearFilters() {
    if (filterArea) filterArea.value = '';
    if (filterEstado) filterEstado.value = '';
    if (filterTipo) filterTipo.value = '';
    applyFilters();
  }

  // Mostrar detalles del ticket seleccionado
  function showTicketDetails(codigo) {
    if (!codigo) {
      clearTicketDetails();
      return;
    }
    
    const ticket = allTickets.find(t => t.codigo === codigo);
    if (!ticket) {
      clearTicketDetails();
      return;
    }
    
    // Mostrar detalles en el panel
    if (ticketDetails) {
      ticketDetails.innerHTML = `
        <div class="ticket-preview">
          <h4>${ticket.codigo} - ${ticket.titulo || 'Sin título'}</h4>
          <div class="ticket-meta-preview">
            <div><strong>👤 Solicitante:</strong> ${ticket.nombre || '---'}</div>
            <div><strong>🏢 Área:</strong> ${ticket.area || '---'}</div>
            <div><strong>📝 Tipo:</strong> ${ticket.tipo || '---'}</div>
            <div><strong>📅 Ingreso:</strong> ${ticket.fechaIngreso ? window.Utils.formatDate(ticket.fechaIngreso) : '---'}</div>
            <div><strong>⏱️ Estado:</strong> <span class="badge ${window.Utils.normalizeClass(ticket.estado)}">${ticket.estado}</span></div>
            ${ticket.prioridad ? `<div><strong>❗ Prioridad:</strong> <span class="badge ${window.Utils.normalizeClass(ticket.prioridad)}">${ticket.prioridad}</span></div>` : ''}
          </div>
          <div class="ticket-desc-preview">
            <strong>Descripción:</strong>
            <p>${ticket.descripcion || 'Sin descripción'}</p>
          </div>
          ${ticket.solucion ? `
            <div class="ticket-sol-preview">
              <strong>Solución actual:</strong>
              <p>${ticket.solucion}</p>
              ${ticket.detalleSolucion ? `<p class="detail">${ticket.detalleSolucion}</p>` : ''}
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Pre-poblar campos del formulario
    if (estadoSelect) estadoSelect.value = ticket.estado || '';
    if (solucionInput) solucionInput.value = ticket.solucion || '';
    if (detalleInput) detalleInput.value = ticket.detalleSolucion || '';
    if (fechaCierreInput) fechaCierreInput.value = '';
  }

  // Limpiar detalles del ticket
  function clearTicketDetails() {
    if (ticketDetails) ticketDetails.innerHTML = '<p class="muted">Selecciona un ticket para ver detalles</p>';
    if (estadoSelect) estadoSelect.value = '';
    if (solucionInput) solucionInput.value = '';
    if (detalleInput) detalleInput.value = '';
    if (fechaCierreInput) fechaCierreInput.value = '';
  }

  // Obtener fecha de cierre (opcional)
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

  // Actualizar ticket
  async function updateTicket(e) {
    e.preventDefault();
    setMsg('', '');

    const codigo = ticketSelect?.value.trim();
    const estado = estadoSelect?.value.trim();
    const solucion = solucionInput?.value.trim();
    const detalle = detalleInput?.value.trim();
    const fechaCierre = getFechaCierreValue();

    // Validación
    if (!codigo) return setMsg('Selecciona un ticket primero.', 'error');
    if (!estado) return setMsg('Selecciona un estado.', 'error');
    
    // Validación para estados finales
    const estadosFinales = ['Atendido', 'Anulado'];
    if (estadosFinales.includes(estado) && !solucion) {
      return setMsg('La solución es obligatoria para cerrar un ticket.', 'error');
    }

    try {
      setMsg('Guardando cambios...', 'info');
      
      const jsonpRequest = window.Utils?.jsonpRequest || window.CONFIG?.jsonpRequest || window.jsonpRequest;
      if (!jsonpRequest) throw new Error('jsonpRequest no disponible');

      const res = await jsonpRequest(
        window.CONFIG.SCRIPT_URL,
        {
          action: 'update',
          codigo,
          estado,
          solucion,
          detalle,
          fechaCierre,
        }
      );

      if (res?.ok === true) {
        setMsg('✅ Ticket actualizado correctamente.', 'success');
        
        // Recargar tickets para reflejar cambios
        await loadTickets();
        
        // Mantener el ticket seleccionado
        setTimeout(() => {
          ticketSelect.value = codigo;
          showTicketDetails(codigo);
        }, 500);
      } else {
        setMsg(`❌ No se pudo actualizar: ${res?.message || res?.error || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      console.error('Error actualizando ticket:', err);
      setMsg(`❌ Error: ${err.message}`, 'error');
    }
  }

  // Limpiar formulario
  function clearForm() {
    ticketSelect.value = '';
    clearTicketDetails();
    setMsg('', '');
  }

  // Event listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Cargar tickets al iniciar
    loadTickets();
    
    // Evento al seleccionar ticket
    ticketSelect?.addEventListener('change', (e) => {
      showTicketDetails(e.target.value);
    });
    
    // Eventos de filtros
    btnFilter?.addEventListener('click', applyFilters);
    btnClearFilters?.addEventListener('click', clearFilters);
    filterArea?.addEventListener('change', applyFilters);
    filterEstado?.addEventListener('change', applyFilters);
    filterTipo?.addEventListener('change', applyFilters);
    
    // Evento de submit
    form?.addEventListener('submit', updateTicket);
    
    // Evento de limpiar
    btnClear?.addEventListener('click', clearForm);
  });
})();
