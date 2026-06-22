/**
 * dashboard.js v2.0 - Dashboard de tickets con KPIs, gráficos y filtros
 */
(function () {
  let allTickets = [];
  let filteredTickets = [];
  let CHART_AREA = null, CHART_TYPE = null;
  let sortCol = 'fechaIngreso', sortDir = 'desc';

  const U = window.Utils;

  document.addEventListener('DOMContentLoaded', loadDashboard_);
  window.addEventListener('pageshow', ev => { if (ev.persisted) loadDashboard_(true); });

  async function loadDashboard_(silent = false) {
    try {
      const [tickets, config] = await Promise.all([
        U.jsonpRequest(window.CONFIG.SCRIPT_URL),
        window.Utils.jsonpCached(window.CONFIG.SCRIPT_URL + '?action=config', {}, 'config', 300)
      ]);

      allTickets = Array.isArray(tickets) ? tickets.map(t => U.normalizeTicket(t)) : [];
      filteredTickets = [...allTickets];

      // Poblar selects filtros
      if (config?.status === 'success') {
        populateSelect('filterArea',      config.areas,    'Todas las áreas');
        populateSelect('filterTipo',      config.tipos,    'Todos');
        populateSelect('filterEstado',    config.estados,  'Todos');
        populateSelect('filterPrioridad', config.prioridades, 'Todas');
      }

      renderKPIs(allTickets);
      renderCharts(allTickets);
      renderTable(filteredTickets);
    } catch (err) {
      console.error('Dashboard error:', err);
      document.getElementById('ticketsTableBody').innerHTML =
        `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--muted)">❌ Error al cargar datos: ${err.message}</td></tr>`;
    }
  }

  function populateSelect(id, items, def) {
    const sel = document.getElementById(id);
    if (!sel || !items) return;
    sel.innerHTML = `<option value="">${def}</option>` +
      items.map(i => `<option value="${U.escapeHtml(i)}">${U.escapeHtml(i)}</option>`).join('');
  }

  // ── KPIs ─────────────────────────────────────
  function renderKPIs(tickets) {
    const now = new Date();
    const thisMonth = tickets.filter(t => {
      const d = new Date(t.fechaIngreso);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const atendidos = tickets.filter(t => t.estado === 'Atendido');
    const tiempos = atendidos.map(t => {
      const a = new Date(t.fechaIngreso), b = new Date(t.fechaCierre);
      if (!isNaN(a) && !isNaN(b) && b > a) return (b - a) / (1000 * 60 * 60 * 24);
      return null;
    }).filter(x => x !== null);

    const prom = tiempos.length ? (tiempos.reduce((a,b)=>a+b,0)/tiempos.length).toFixed(1) : '-';
    const tasa = tickets.length ? Math.round((atendidos.length / tickets.length) * 100) : 0;
    const criticos = tickets.filter(t => t.prioridad==='Alta' && !['Atendido','Anulado'].includes(t.estado));

    setEl('dPromResolucion', prom !== '-' ? `${prom}d` : '-');
    setEl('dTasaResolucion', `${tasa}%`);
    setEl('dEstesMes', thisMonth.length);
    setEl('dCriticos', criticos.length);

    const mes = now.toLocaleDateString('es-PE', {month:'long',year:'numeric'});
    setEl('dEstesMesLabel', `en ${mes}`);
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ── CHARTS ───────────────────────────────────
  function renderCharts(tickets) {
    const conteoAreas = {};
    const conteoTipos = {};
    for (const t of tickets) {
      const area = t.area || 'Sin área';
      const tipo = t.tipo || 'Sin tipo';
      conteoAreas[area] = (conteoAreas[area]||0) + 1;
      conteoTipos[tipo] = (conteoTipos[tipo]||0) + 1;
    }

    const paleta = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#0ea5e9','#ec4899','#14b8a6'];

    // Si Chart.js no cargó (CDN bloqueado/offline), degradar sin perder KPIs ni tabla.
    if (typeof Chart === 'undefined') {
      const aviso = '<p class="muted" style="text-align:center;padding:1.5rem;">Gráficos no disponibles</p>';
      ['chartArea','chartType'].forEach(id => {
        const c = document.getElementById(id);
        if (c && c.parentElement) c.parentElement.innerHTML = aviso;
      });
      return;
    }

    if (CHART_AREA) CHART_AREA.destroy();
    const ctxA = document.getElementById('chartArea');
    if (ctxA) {
      CHART_AREA = new Chart(ctxA, {
        type: 'bar',
        data: {
          labels: Object.keys(conteoAreas),
          datasets: [{ data: Object.values(conteoAreas), backgroundColor: paleta, borderRadius: 6, borderSkipped: false }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } }
        }
      });
    }

    if (CHART_TYPE) CHART_TYPE.destroy();
    const ctxT = document.getElementById('chartType');
    if (ctxT) {
      CHART_TYPE = new Chart(ctxT, {
        type: 'doughnut',
        data: {
          labels: Object.keys(conteoTipos),
          datasets: [{ data: Object.values(conteoTipos), backgroundColor: paleta, borderWidth: 0, hoverOffset: 6 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } } },
          cutout: '60%'
        }
      });
    }
  }

  // ── TABLE ────────────────────────────────────
  function renderTable(tickets) {
    const limit = parseInt(document.getElementById('filterLimit')?.value || '25');
    const data  = limit > 0 ? tickets.slice(0, limit) : tickets;

    const tbody = document.getElementById('ticketsTableBody');
    const cardsEl = document.getElementById('ticketsCards');

    if (!data.length) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2.5rem;color:var(--muted)">Sin resultados para los filtros actuales</td></tr>`;
      if (cardsEl) cardsEl.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><h3>Sin resultados</h3><p>Ajusta los filtros</p></div>';
      return;
    }

    if (tbody) {
      tbody.innerHTML = data.map(t => `
        <tr>
          <td class="code">${U.escapeHtml(t.codigo)}</td>
          <td>${U.escapeHtml(t.nombre)}</td>
          <td>${U.escapeHtml(t.area)}</td>
          <td><span class="badge ${U.normalizeClass(t.tipo)}">${U.escapeHtml(t.tipo)}</span></td>
          <td class="title" title="${U.escapeHtml(t.titulo)}">${U.escapeHtml(t.titulo)}</td>
          <td><span class="badge ${U.normalizeClass(t.prioridad)}">${U.escapeHtml(t.prioridad)}</span></td>
          <td><span class="badge ${U.normalizeClass(t.estado)}">${U.escapeHtml(t.estado)}</span></td>
          <td class="muted" style="font-size:.78rem;">${U.formatDateShort(t.fechaIngreso)}</td>
        </tr>`).join('');
    }

    if (cardsEl) {
      cardsEl.innerHTML = data.map(t => `
        <div class="ticket-card">
          <div class="ticket-card-head">
            <span class="ticket-card-code">${U.escapeHtml(t.codigo)}</span>
            ${U.renderBadges(t.estado,t.prioridad)}
          </div>
          <div class="ticket-card-title">${U.escapeHtml(t.titulo||'Sin título')}</div>
          <div class="ticket-card-meta">${U.escapeHtml(t.area)} · ${U.escapeHtml(t.nombre)} · <span class="badge ${U.normalizeClass(t.tipo)}" style="font-size:.65rem">${U.escapeHtml(t.tipo)}</span></div>
        </div>`).join('');
    }

    const footer = document.getElementById('tableFooter');
    if (footer) footer.textContent = `Mostrando ${data.length} de ${tickets.length} tickets`;
  }

  // ── FILTERS ──────────────────────────────────
  function applyFilters_() {
    const area  = document.getElementById('filterArea')?.value || '';
    const tipo  = document.getElementById('filterTipo')?.value || '';
    const estado= document.getElementById('filterEstado')?.value || '';
    const prio  = document.getElementById('filterPrioridad')?.value || '';
    const q     = (document.getElementById('filterSearch')?.value || '').toLowerCase().trim();

    filteredTickets = allTickets.filter(t => {
      return (!area   || t.area     === area)
          && (!tipo   || t.tipo     === tipo)
          && (!estado || t.estado   === estado)
          && (!prio   || t.prioridad === prio)
          && (!q      || t.codigo.toLowerCase().includes(q) || t.nombre.toLowerCase().includes(q) || t.titulo.toLowerCase().includes(q));
    });

    renderCharts(filteredTickets);
    renderTable(filteredTickets);
  }

  // ── EVENTS ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
      const panel = document.getElementById('filtersPanel');
      if (!panel) return;
      const isHidden = panel.style.display === 'none' || !panel.style.display;
      panel.style.display = isHidden ? 'block' : 'none';
      const btn = document.getElementById('btnToggleFilters');
      if (btn) btn.textContent = isHidden ? '🔼 Filtros' : '🔽 Filtros';
    });

    document.getElementById('btnApplyFilters')?.addEventListener('click', applyFilters_);
    document.getElementById('filterLimit')?.addEventListener('change', () => renderTable(filteredTickets));

    document.getElementById('btnClearFilters')?.addEventListener('click', () => {
      ['filterArea','filterTipo','filterEstado','filterPrioridad','filterSearch'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      filteredTickets = [...allTickets];
      renderCharts(allTickets);
      renderTable(allTickets);
    });

    document.getElementById('btnExportar')?.addEventListener('click', () => {
      if (!filteredTickets.length) return U.toast('No hay datos para exportar', 'info');
      U.exportCSV(filteredTickets, `tickets_${new Date().toISOString().slice(0,10)}.csv`);
      U.toast(`✅ Exportados ${filteredTickets.length} tickets`, 'success');
    });
  });
})();
