/**
 * inventory-module.js — Módulo de inventario REUTILIZABLE (CRUD: tabla + filtros + stats + modal)
 * ════════════════════════════════════════════════════════════════════════
 * Principios SOLID:
 *  - Responsabilidad única: renderizar y gestionar un inventario a partir de un
 *    DESCRIPTOR. No sabe qué es "equipo" ni "celular".
 *  - Abierto/cerrado: para un inventario nuevo se crea un descriptor; este archivo
 *    no se modifica.
 *  - Inversión de dependencias: depende de abstracciones (window.Utils.jsonpRequest,
 *    que en modo demo apunta al backend simulado) y del descriptor, no de detalles.
 *
 * Uso:
 *   InventoryModule(descriptor).mount('#root');
 *
 * Descriptor:
 * {
 *   listAction, createAction, updateAction,        // acciones del backend
 *   idField,                                        // columna clave (ej. "Codigo")
 *   newButtonLabel, modalTitleNew, searchPlaceholder, emptyIcon, emptyText,
 *   searchFields: ["Codigo","Marca",...],
 *   configLists: ["tiposEquipo","estadosEquipo"],   // listas a traer de /config
 *   needsUsuarios: true,                            // carga usuarios para datalist
 *   columns: [ { header, value(row), cls?, badge? } ],
 *   filters: [ { col, label, source } ],            // source: "config:KEY" | [..] | "data:Col"
 *   fields:  [ { param, col, label, type, source?, required? } ], // type: text|textarea|select|date|datalist
 *   stats:   [ { label, value(rows) } ],
 * }
 */
window.InventoryModule = function InventoryModule(desc) {
  'use strict';
  const U = window.Utils;
  const SCRIPT = () => window.CONFIG.SCRIPT_URL;
  const norm = s => U.normalizeClass(s || '');

  let rows = [], config = {}, usuarios = [], rootEl = null;

  // ── Resolución de listas de opciones ──────────────────────────────
  function resolveSource(source) {
    if (Array.isArray(source)) return source;
    if (typeof source === 'string' && source.startsWith('config:')) return config[source.slice(7)] || [];
    if (typeof source === 'string' && source.startsWith('data:')) {
      const col = source.slice(5);
      return [...new Set(rows.map(r => String(r[col] || '').trim()).filter(Boolean))].sort();
    }
    if (source === 'usuarios') return usuarios.map(u => String(u.Nombre || '').trim()).filter(Boolean);
    return [];
  }
  const opts = arr => arr.map(v => `<option value="${U.escapeHtml(v)}">${U.escapeHtml(v)}</option>`).join('');

  // ── Construcción del DOM (una sola vez) ───────────────────────────
  function buildSkeleton() {
    rootEl.innerHTML = `
      <div class="stat-row" data-inv="stats"></div>
      <div class="panel">
        <div class="panel-head">
          <span class="panel-title">${U.escapeHtml(desc.title || 'Inventario')}</span>
          <div style="display:flex;gap:.4rem;">
            <button type="button" class="btn btn-secondary btn-sm" data-inv="import">📥 Importar</button>
            <button type="button" class="btn btn-primary btn-sm" data-inv="new">${U.escapeHtml(desc.newButtonLabel || '➕ Nuevo')}</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="toolbar">
            <div class="grow"><input type="text" data-inv="search" placeholder="${U.escapeHtml(desc.searchPlaceholder || '🔎 Buscar...')}"></div>
            ${(desc.filters || []).map((f, i) => `<select class="filter-select" data-inv="filter" data-col="${U.escapeHtml(f.col)}" data-i="${i}"><option value="">${U.escapeHtml(f.label)}</option></select>`).join('')}
          </div>
          <div data-inv="list"><p class="muted" style="text-align:center;padding:2rem;">Cargando...</p></div>
        </div>
      </div>
      ${buildModal()}
      ${buildImportModal()}`;
  }

  // Modal de carga masiva (pegar desde Excel/Sheets o subir CSV).
  function buildImportModal() {
    const cols = (desc.fields || []).map(f => f.label.replace('*', '').trim());
    return `
      <div class="modal" data-inv="importModal">
        <div class="modal-backdrop" data-inv="closeImport"></div>
        <div class="modal-dialog">
          <div class="modal-header">
            <h3>📥 Carga masiva</h3>
            <button class="modal-close" type="button" data-inv="closeImport" aria-label="Cerrar">×</button>
          </div>
          <div class="modal-content">
            <p style="font-size:.82rem;color:var(--muted);margin-bottom:.5rem;">
              Pega filas (una por línea) copiadas de Excel/Google Sheets, o sube un CSV.
              Columnas <b>en este orden</b> (separadas por TAB o coma):
            </p>
            <p style="font-size:.76rem;background:var(--bg);border-radius:8px;padding:.5rem .7rem;margin-bottom:.7rem;">
              ${cols.map((c, i) => `<b>${i + 1}.</b> ${U.escapeHtml(c)}`).join(' &nbsp;·&nbsp; ')}
            </p>
            <div class="form-group">
              <label>Subir CSV</label>
              <input type="file" accept=".csv,text/csv" data-inv="importFile"
                style="padding:.45rem .6rem;border:1.5px dashed var(--border);border-radius:8px;width:100%;cursor:pointer;background:#fafafa;">
            </div>
            <div class="form-group">
              <label>...o pegar filas aquí</label>
              <textarea data-inv="importText" rows="6" placeholder="Dell&#9;Latitude&#9;...&#10;HP&#9;ProBook&#9;..." style="font-family:var(--mono);font-size:.8rem;"></textarea>
            </div>
            <div class="form-msg" data-inv="importMsg"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" type="button" data-inv="closeImport">Cancelar</button>
            <button class="btn btn-primary btn-sm" type="button" data-inv="importRun">⬆ Importar filas</button>
          </div>
        </div>
      </div>`;
  }

  function buildModal() {
    const fieldHtml = (desc.fields || []).map(f => {
      const id = `inv_${f.param}`;
      let input;
      if (f.type === 'textarea') {
        input = `<textarea id="${id}" rows="2"></textarea>`;
      } else if (f.type === 'select') {
        input = `<select id="${id}"${f.required ? ' required' : ''}></select>`;
      } else if (f.type === 'datalist') {
        input = `<input type="text" id="${id}" list="${id}_dl"><datalist id="${id}_dl"></datalist>`;
      } else {
        input = `<input type="${f.type === 'date' ? 'date' : 'text'}" id="${id}"${f.required ? ' required' : ''}>`;
      }
      return `<div class="form-group"><label for="${id}">${U.escapeHtml(f.label)}</label>${input}</div>`;
    }).join('');
    return `
      <div class="modal" data-inv="modal">
        <div class="modal-backdrop" data-inv="close"></div>
        <div class="modal-dialog">
          <div class="modal-header">
            <h3 data-inv="modalTitle">${U.escapeHtml(desc.modalTitleNew || 'Nuevo')}</h3>
            <button class="modal-close" type="button" data-inv="close" aria-label="Cerrar">×</button>
          </div>
          <form class="modal-content" data-inv="form" autocomplete="off">
            <input type="hidden" data-inv="editId">
            ${fieldHtml}
            <div class="form-msg" data-inv="msg"></div>
          </form>
          <div class="modal-footer">
            <button class="btn btn-secondary btn-sm" type="button" data-inv="close">Cancelar</button>
            <button class="btn btn-primary btn-sm" type="button" data-inv="save">💾 Guardar</button>
          </div>
        </div>
      </div>`;
  }

  const $ = sel => rootEl.querySelector(`[data-inv="${sel}"]`);

  // ── Carga de datos ────────────────────────────────────────────────
  async function load() {
    setListMsg('Cargando...');
    try {
      const reqs = [
        U.jsonpRequest(SCRIPT(), { action: desc.listAction }),
        U.jsonpCached(SCRIPT() + '?action=config', {}, 'config', 300),
      ];
      if (desc.needsUsuarios) reqs.push(U.jsonpRequest(SCRIPT(), { action: 'usuarios' }).catch(() => []));
      const [list, cfg, users] = await Promise.all(reqs);
      rows = Array.isArray(list) ? list : [];
      config = cfg || {};
      usuarios = Array.isArray(users) ? users : [];
      fillStaticSelects();
      render();
    } catch (err) {
      setListMsg(`❌ Error al cargar: ${err.message}`);
    }
  }

  function fillStaticSelects() {
    // Filtros
    (desc.filters || []).forEach((f, i) => {
      const sel = rootEl.querySelector(`[data-inv="filter"][data-i="${i}"]`);
      if (sel) { const cur = sel.value; sel.innerHTML = `<option value="">${U.escapeHtml(f.label)}</option>` + opts(resolveSource(f.source)); sel.value = cur; }
    });
    // Selects y datalists del modal
    (desc.fields || []).forEach(f => {
      if (f.type === 'select') {
        const el = rootEl.querySelector(`#inv_${f.param}`);
        if (el) el.innerHTML = (f.required ? '' : `<option value=""></option>`) + opts(resolveSource(f.source));
      } else if (f.type === 'datalist') {
        const dl = rootEl.querySelector(`#inv_${f.param}_dl`);
        if (dl) dl.innerHTML = opts(resolveSource(f.source));
      }
    });
  }

  // ── Render ────────────────────────────────────────────────────────
  function filtered() {
    const q = ($('search')?.value || '').toLowerCase().trim();
    const activeFilters = (desc.filters || []).map((f, i) => ({ col: f.col, val: rootEl.querySelector(`[data-inv="filter"][data-i="${i}"]`)?.value || '' }));
    return rows.filter(r =>
      (!q || (desc.searchFields || []).some(c => String(r[c] || '').toLowerCase().includes(q))) &&
      activeFilters.every(f => !f.val || String(r[f.col] || '') === f.val));
  }

  function render() {
    renderStats();
    const data = filtered();
    const cont = $('list');
    if (!data.length) {
      cont.innerHTML = `<div class="empty-state"><span class="es-icon">${desc.emptyIcon || '📦'}</span><p>${U.escapeHtml(desc.emptyText || 'Sin registros para los filtros aplicados.')}</p></div>`;
      return;
    }
    const ths = desc.columns.map(c => `<th>${U.escapeHtml(c.header)}</th>`).join('') + '<th></th>';
    const trs = data.map(r => {
      const tds = desc.columns.map(c => {
        if (c.badge) { const v = c.badge(r); return `<td><span class="badge ${norm(v)}">${U.escapeHtml(v || '-')}</span></td>`; }
        const v = c.value(r);
        return `<td${c.cls ? ` class="${c.cls}"` : ''}>${U.escapeHtml(v == null || v === '' ? '—' : v)}</td>`;
      }).join('');
      return `<tr>${tds}<td class="actions"><button class="row-btn" data-edit="${U.escapeHtml(r[desc.idField])}">✏️ Editar</button></td></tr>`;
    }).join('');
    cont.innerHTML = `<table class="tickets-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    cont.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openModal(b.dataset.edit)));
  }

  function renderStats() {
    const el = $('stats');
    if (!el || !desc.stats) return;
    el.innerHTML = desc.stats.map(s =>
      `<div class="stat-card"><div class="sc-num">${s.value(rows)}</div><div class="sc-label">${U.escapeHtml(s.label)}</div></div>`).join('');
  }

  // ── Modal ─────────────────────────────────────────────────────────
  function openModal(id) {
    const r = id ? rows.find(x => String(x[desc.idField]) === String(id)) : null;
    $('modalTitle').textContent = r ? `Editar — ${r[desc.idField]}` : (desc.modalTitleNew || 'Nuevo');
    $('editId').value = r ? r[desc.idField] : '';
    (desc.fields || []).forEach(f => {
      const el = rootEl.querySelector(`#inv_${f.param}`);
      if (el) el.value = r ? (r[f.col] != null ? r[f.col] : '') : '';
    });
    setMsg('', '');
    toggleModal(true);
  }
  function toggleModal(open) { $('modal').classList.toggle('open', open); }

  async function save(e) {
    e.preventDefault();
    const id = $('editId').value.trim();
    const params = { action: id ? desc.updateAction : desc.createAction };
    if (id) params.codigo = id;
    let firstRequiredMissing = null;
    (desc.fields || []).forEach(f => {
      const v = (rootEl.querySelector(`#inv_${f.param}`)?.value || '').trim();
      if (f.required && !v && !firstRequiredMissing) firstRequiredMissing = f.label;
      params[f.param] = v;
    });
    if (firstRequiredMissing) return setMsg(`Falta: ${firstRequiredMissing.replace('*', '').trim()}`, 'error');

    const btn = $('save');
    btn.disabled = true; btn.textContent = '⏳ Guardando...';
    try {
      const res = await U.jsonpRequest(SCRIPT(), params);
      if (res?.ok) {
        U.toast(id ? 'Registro actualizado' : 'Registro creado', 'success');
        toggleModal(false);
        await load();
      } else setMsg(`❌ ${res?.error || 'No se pudo guardar.'}`, 'error');
    } catch (err) {
      setMsg(`❌ Error de red: ${err.message}`, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '💾 Guardar';
    }
  }

  // ── Carga masiva ──────────────────────────────────────────────────
  function toggleImport(open) { $('importModal').classList.toggle('open', open); }
  function setImportMsg(t, type) { const el = $('importMsg'); if (el) { el.textContent = t || ''; el.className = `form-msg ${type || ''}`.trim(); } }

  function parseRows(text) {
    return text.split(/\r?\n/).map(l => l.replace(/\s+$/, '')).filter(l => l.trim())
      .map(line => (line.indexOf('\t') >= 0 ? line.split('\t') : line.split(',')).map(c => c.trim()));
  }

  async function runImport() {
    const text = ($('importText')?.value || '').trim();
    if (!text) return setImportMsg('Pega filas o sube un CSV primero.', 'error');
    const rowsIn = parseRows(text);
    const fieldParams = (desc.fields || []).map(f => f.param);
    const btn = $('importRun');
    btn.disabled = true; btn.textContent = '⏳ Importando...';
    let okN = 0, errN = 0; const errores = [];
    for (let i = 0; i < rowsIn.length; i++) {
      const cells = rowsIn[i];
      const params = { action: desc.createAction };
      fieldParams.forEach((p, j) => { params[p] = cells[j] != null ? cells[j] : ''; });
      try {
        const res = await U.jsonpRequest(SCRIPT(), params);
        if (res?.ok) okN++; else { errN++; errores.push(`Fila ${i + 1}: ${res?.error || 'error'}`); }
      } catch (e) { errN++; errores.push(`Fila ${i + 1}: ${e.message}`); }
    }
    btn.disabled = false; btn.textContent = '⬆ Importar filas';
    U.toast(`Importadas ${okN} de ${rowsIn.length}`, errN ? 'warning' : 'success');
    setImportMsg(`✅ ${okN} importadas${errN ? ` · ❌ ${errN} con error: ${errores.slice(0, 3).join(' | ')}` : ''}`, errN ? 'error' : 'success');
    await load();
    if (!errN) { $('importText').value = ''; setTimeout(() => toggleImport(false), 900); }
  }

  function readCsvFile(file) {
    const reader = new FileReader();
    reader.onload = () => { const ta = $('importText'); if (ta) ta.value = String(reader.result || '').replace(/^﻿/, ''); };
    reader.readAsText(file);
  }

  // ── Helpers UI ────────────────────────────────────────────────────
  function setListMsg(m) { const el = $('list'); if (el) el.innerHTML = `<p class="muted" style="text-align:center;padding:2rem;">${U.escapeHtml(m)}</p>`; }
  function setMsg(t, type) { const el = $('msg'); if (el) { el.textContent = t || ''; el.className = `form-msg ${type || ''}`.trim(); } }

  function wire() {
    $('new').addEventListener('click', () => openModal(null));
    $('search').addEventListener('input', render);
    rootEl.querySelectorAll('[data-inv="filter"]').forEach(s => s.addEventListener('change', render));
    $('form').addEventListener('submit', save);
    // El botón Guardar está en el footer (fuera del <form>): disparamos el submit manualmente.
    $('save').addEventListener('click', () => $('form').requestSubmit());
    rootEl.querySelectorAll('[data-inv="close"]').forEach(el => el.addEventListener('click', () => toggleModal(false)));
    // Carga masiva
    $('import').addEventListener('click', () => { setImportMsg('', ''); toggleImport(true); });
    $('importRun').addEventListener('click', runImport);
    $('importFile').addEventListener('change', e => { if (e.target.files?.[0]) readCsvFile(e.target.files[0]); });
    rootEl.querySelectorAll('[data-inv="closeImport"]').forEach(el => el.addEventListener('click', () => toggleImport(false)));
  }

  // ── API pública ───────────────────────────────────────────────────
  return {
    mount(rootSelector) {
      rootEl = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
      if (!rootEl) { console.error('[InventoryModule] root no encontrado:', rootSelector); return; }
      buildSkeleton();
      wire();
      load();
      return this;
    },
    reload: load,
  };
};
