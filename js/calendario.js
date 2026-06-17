/**
 * calendario.js v1 - Vista de CALENDARIO semanal de tareas
 * - Muestra las tareas por día (Lun–Dom) según su fecha (límite o inicio).
 * - Gestor (Admin/Líder): ve todas + filtro por persona. Técnico/Usuario: las suyas.
 * - Navegación por semanas; chips coloreados por estado; modal de detalle.
 * Usa la data de TAREAS existente (no requiere backend extra).
 */
(function () {
  'use strict';
  const U = window.Utils;
  const SCRIPT = () => window.CONFIG.SCRIPT_URL;
  const sesion = window.Session.get() || {};
  const esGestor = ['Administrador', 'Líder de equipo'].includes(sesion.rol);

  const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const COLOR = { 'pendiente': '#f59e0b', 'en-desarrollo': '#2563eb', 'terminado': '#10b981', 'cancelada': '#9ca3af' };

  let tareas = [], weekOffset = 0, campo = 'Fecha limite', persona = '';

  window.initCalendario_ = async function () {
    if (esGestor) document.getElementById('calPersonaWrap').style.display = '';
    wire();
    await load();
  };

  async function load() {
    setGrid_('<p class="muted" style="text-align:center;padding:2rem;">Cargando tareas...</p>');
    try {
      const params = esGestor ? { action: 'tareas' } : { action: 'tareas', asignado: sesion.nombre };
      const lista = await U.jsonpRequest(SCRIPT(), params);
      tareas = Array.isArray(lista) ? lista : [];
      fillPersona_();
      render_();
    } catch (err) {
      setGrid_(`<p class="muted" style="text-align:center;padding:2rem;">❌ ${U.escapeHtml(err.message)}</p>`);
    }
  }

  /* ── Fechas ────────────────────────────────────────── */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dow = (x.getDay() + 6) % 7; // 0 = lunes
    return addDays(x, -dow);
  }
  function ymdDe(v) {
    if (!v) return '';
    const d = new Date(v);
    if (!isNaN(d.getTime())) return ymd(d);
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  }
  function taskYmd(t) { return ymdDe(t[campo] || t['Fecha limite'] || t['Fecha inicio']); }

  // Alerta por fecha LÍMITE: 'venc' (vencida), 'hoy', o '' (estados abiertos).
  function alertaDe(t) {
    const est = U.normalizeClass(t.Estado || '');
    if (est === 'terminado' || est === 'completada' || est === 'cancelada') return '';
    const ys = ymdDe(t['Fecha limite']);
    if (!ys) return '';
    const hoy = ymd(new Date());
    return ys < hoy ? 'venc' : (ys === hoy ? 'hoy' : '');
  }

  function fillPersona_() {
    const sel = document.getElementById('calPersona');
    if (!sel) return;
    const nombres = [...new Set(tareas.map(t => String(t['Asignado a'] || '').trim()).filter(Boolean))].sort();
    const cur = sel.value;
    sel.innerHTML = `<option value="">Todas las personas</option>` +
      nombres.map(n => `<option value="${U.escapeHtml(n)}">${U.escapeHtml(n)}</option>`).join('');
    sel.value = cur;
  }

  /* ── Render ────────────────────────────────────────── */
  function render_() {
    const monday = addDays(mondayOf(new Date()), weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const hoyYmd = ymd(new Date());

    const filtro = t => (!persona || String(t['Asignado a'] || '') === persona);
    const visibles = tareas.filter(filtro);
    const conFecha = visibles.filter(t => taskYmd(t));
    const sinFecha = visibles.length - conFecha.length;

    // Etiqueta de semana
    const fmt = d => d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    document.getElementById('calLabel').textContent =
      `${fmt(days[0])} – ${fmt(days[6])} ${days[6].getFullYear()}` + (weekOffset === 0 ? ' (esta semana)' : '');

    const grid = document.getElementById('calGrid');
    grid.innerHTML = days.map(d => {
      const dy = ymd(d);
      const delDia = conFecha.filter(t => taskYmd(t) === dy);
      const chips = delDia.map(t => {
        const est = U.normalizeClass(t.Estado || 'pendiente');
        const al = alertaDe(t);
        const col = al === 'venc' ? '#ef4444' : (COLOR[est] || '#9ca3af');
        const pre = al === 'venc' ? '⚠️ ' : (al === 'hoy' ? '⏰ ' : '');
        const asign = esGestor && t['Asignado a'] ? ` · ${U.escapeHtml(t['Asignado a'])}` : '';
        return `<div class="cal-task${al ? ' cal-' + al : ''}" style="border-left-color:${col};" data-id="${U.escapeHtml(t.ID)}" title="${U.escapeHtml((t.Categoria ? t.Categoria + ' · ' : '') + (t.Titulo || ''))}">
                  <div class="ct-title">${pre}${U.escapeHtml(t.Titulo || t.Categoria || 'Tarea')}</div>
                  <div class="ct-meta">${U.escapeHtml(t.Estado || '')}${asign}</div>
                </div>`;
      }).join('') || `<div class="cal-empty">—</div>`;
      return `<div class="cal-day${dy === hoyYmd ? ' hoy' : ''}">
                <div class="cal-day-head"><span>${DIAS[(d.getDay() + 6) % 7].slice(0, 3)}</span><span class="cal-day-num">${d.getDate()}</span></div>
                ${chips}
              </div>`;
    }).join('');

    grid.querySelectorAll('.cal-task').forEach(el =>
      el.addEventListener('click', () => openDetail_(el.dataset.id)));

    const vencN = visibles.filter(t => alertaDe(t) === 'venc').length;
    const hoyN  = visibles.filter(t => alertaDe(t) === 'hoy').length;
    document.getElementById('calInfo').textContent =
      `${conFecha.length} con fecha · ⚠️ ${vencN} vencida(s) · ⏰ ${hoyN} hoy` +
      (sinFecha ? ` · ${sinFecha} sin fecha` : '');
  }

  /* ── Detalle ───────────────────────────────────────── */
  function openDetail_(id) {
    const t = tareas.find(x => x.ID === id);
    if (!t) return;
    const row = (lbl, val) => val ? `<div class="modal-field"><span class="modal-field-label">${lbl}</span><span class="modal-field-val">${U.escapeHtml(val)}</span></div>` : '';
    document.getElementById('calDetTitle').textContent = `${t.ID} — ${t.Titulo || ''}`;
    document.getElementById('calDetBody').innerHTML =
      row('Categoría', t.Categoria) +
      row('Sub-tarea', t.Titulo) +
      row('Descripción', t.Descripcion) +
      row('Observaciones', t.Observaciones) +
      row('Asignado a', t['Asignado a']) +
      row('Prioridad', t.Prioridad) +
      row('Estado', t.Estado) +
      row('Inicio', t['Fecha inicio'] ? U.formatDateShort(t['Fecha inicio']) : '') +
      row('Límite', t['Fecha limite'] ? U.formatDateShort(t['Fecha limite']) : '');
    document.getElementById('calModal').classList.add('open');
  }

  /* ── UI ────────────────────────────────────────────── */
  function wire() {
    document.getElementById('calPrev').addEventListener('click', () => { weekOffset--; render_(); });
    document.getElementById('calNext').addEventListener('click', () => { weekOffset++; render_(); });
    document.getElementById('calHoy').addEventListener('click', () => { weekOffset = 0; render_(); });
    document.getElementById('calCampo').addEventListener('change', e => { campo = e.target.value; render_(); });
    document.getElementById('calPersona')?.addEventListener('change', e => { persona = e.target.value; render_(); });
    document.querySelectorAll('#calModal .modal-close, #calModal .modal-close-btn, #calModal .modal-backdrop')
      .forEach(el => el.addEventListener('click', () => document.getElementById('calModal').classList.remove('open')));
  }

  function setGrid_(html) { const g = document.getElementById('calGrid'); if (g) g.innerHTML = html; }
})();
