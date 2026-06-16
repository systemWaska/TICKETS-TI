/**
 * ============================================================
 * SINCRONIZACIÓN  "IT: Control Tasks Flow"  →  Sistema TI (hoja TAREAS)
 * ============================================================
 * Este script va ENLAZADO a tu hoja de tareas (la que tiene las pestañas
 * "Tasks - <persona>"):  Extensiones → Apps Script  dentro de ESE Sheet.
 *
 * Qué hace:
 *  - Lee cada pestaña "Tasks - <persona>" y vuelca sus filas a la hoja TAREAS
 *    del Sistema (otro spreadsheet).  El nombre de la pestaña (lo que sigue a
 *    "Tasks - ") se usa como "Asignado a".
 *  - Mapea las columnas POR NOMBRE (no por orden): lee la fila de encabezados
 *    de cada pestaña, así puedes mover/insertar columnas sin romper nada.
 *  - Cada fila origen recibe un SyncID único (columna técnica al final) para
 *    no duplicar: si ya existe en TAREAS se ACTUALIZA, si no, se INSERTA.
 *
 * Cómo usarlo:
 *  1) Pega este código en el Apps Script enlazado a tu hoja de tareas.
 *  2) Completa SISTEMA_SHEET_ID (abajo) con el ID del Sheet del Sistema
 *     (el que tiene la pestaña TAREAS). El ID está en su URL:
 *     docs.google.com/spreadsheets/d/<ESTE_ES_EL_ID>/edit
 *  3) Revisa que MAP coincida con los nombres EXACTOS de tus encabezados.
 *  4) Ejecuta  sincronizarTodo()  una vez (autoriza permisos) → carga inicial.
 *  5) Ejecuta  instalarTrigger()  una vez → de ahí en adelante, cada edición
 *     en el sheet se sincroniza sola.
 *
 * Es sincronización de UNA vía: Sheet → Sistema (lo que pediste).
 * ============================================================
 */

// ── CONFIGURACIÓN ─────────────────────────────────────────
const SISTEMA_SHEET_ID = "PEGA_AQUI_EL_ID_DEL_SHEET_DEL_SISTEMA";
const SISTEMA_TAB      = "TAREAS";        // pestaña destino en el Sistema
const TAB_PREFIX       = "Tasks - ";      // pestañas de tareas por persona
const HEADER_ROW       = 1;               // fila de encabezados en tus pestañas
const SYNC_COL_NAME    = "SyncID";        // columna técnica (se crea sola al final)

// Mapeo POR NOMBRE:  encabezado en TU hoja  →  columna en TAREAS del Sistema.
// Si tu encabezado se llama distinto (p. ej. "Registro" en vez de "Registry"),
// cámbialo SOLO aquí (la izquierda es tu hoja, la derecha es el Sistema).
const MAP = {
  "Tarea":         "Categoria",
  "Sub Tareas":    "Titulo",
  "Estado":        "Estado",
  "Prioridad":     "Prioridad",
  "Observaciones": "Observaciones",
  "Registry":      "Fecha inicio",
};
// "Asignado a" (Sistema) se toma del nombre de la pestaña.
const COL_ASIGNADO_SISTEMA = "Asignado a";
const COL_ID_SISTEMA       = "ID";        // columna clave en TAREAS (usamos el SyncID)

// ── HELPERS ───────────────────────────────────────────────
/** Mapa nombre→columna(1-based) leyendo la fila de encabezados. */
function headerMap_(sheet, headerRow) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { const n = String(h).trim(); if (n) map[n] = i + 1; });
  return map;
}

/** Garantiza la columna SyncID en una pestaña origen; devuelve su índice. */
function ensureSyncCol_(sheet) {
  const hm = headerMap_(sheet, HEADER_ROW);
  if (hm[SYNC_COL_NAME]) return hm[SYNC_COL_NAME];
  const col = Math.max(1, sheet.getLastColumn()) + 1;
  sheet.getRange(HEADER_ROW, col).setValue(SYNC_COL_NAME);
  return col;
}

function sistemaSheet_() {
  const ss = SpreadsheetApp.openById(SISTEMA_SHEET_ID);
  const sh = ss.getSheetByName(SISTEMA_TAB);
  if (!sh) throw new Error('No existe la pestaña "' + SISTEMA_TAB + '" en el Sheet del Sistema.');
  return sh;
}

/** Inserta o actualiza una fila en TAREAS, identificando por ID (= SyncID). */
function upsertSistema_(destSheet, destHeaders, syncId, valoresPorNombre) {
  const idCol = destHeaders[COL_ID_SISTEMA];
  if (!idCol) throw new Error('La pestaña TAREAS no tiene columna "' + COL_ID_SISTEMA + '".');
  const lastRow = destSheet.getLastRow();
  let rowNum = -1;
  if (lastRow >= 2) {
    const ids = destSheet.getRange(2, idCol, lastRow - 1, 1).getValues().flat().map(v => String(v).trim());
    const idx = ids.indexOf(String(syncId));
    if (idx !== -1) rowNum = idx + 2;
  }
  if (rowNum === -1) {                       // INSERTAR
    const row = new Array(Object.keys(destHeaders).length).fill('');
    rowNum = destSheet.getLastRow() + 1;
    destSheet.getRange(rowNum, 1, 1, row.length).setValues([row]);
    destSheet.getRange(rowNum, idCol).setValue(syncId);
  }
  Object.keys(valoresPorNombre).forEach(nombre => {     // ACTUALIZAR celdas mapeadas
    const c = destHeaders[nombre];
    if (c) destSheet.getRange(rowNum, c).setValue(valoresPorNombre[nombre]);
  });
}

/** Construye {colSistema: valor} a partir de una fila origen y el MAP. */
function valoresDesdeFila_(srcHeaders, fila, persona) {
  const out = {};
  Object.keys(MAP).forEach(srcName => {
    const c = srcHeaders[srcName];
    if (c) out[MAP[srcName]] = fila[c - 1];
  });
  out[COL_ASIGNADO_SISTEMA] = persona;
  return out;
}

// ── SINCRONIZACIÓN COMPLETA ───────────────────────────────
function sincronizarTodo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dest = sistemaSheet_();
  const destHeaders = headerMap_(dest, 1);
  let total = 0;

  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (name.indexOf(TAB_PREFIX) !== 0) return;       // solo "Tasks - ..."
    const persona = name.substring(TAB_PREFIX.length).trim();
    const syncCol = ensureSyncCol_(sheet);
    const srcHeaders = headerMap_(sheet, HEADER_ROW);
    const lastRow = sheet.getLastRow();
    if (lastRow <= HEADER_ROW) return;

    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    for (let r = HEADER_ROW; r < lastRow; r++) {       // filas de datos (0-based en data)
      const fila = data[r];
      // Saltar filas vacías (sin Sub Tareas ni Tarea)
      const tieneContenido = (srcHeaders["Sub Tareas"] && String(fila[srcHeaders["Sub Tareas"] - 1]).trim()) ||
                             (srcHeaders["Tarea"] && String(fila[srcHeaders["Tarea"] - 1]).trim());
      if (!tieneContenido) continue;

      let syncId = String(fila[syncCol - 1] || "").trim();
      if (!syncId) {                                   // generar y guardar SyncID en la fila origen
        syncId = "SYNC-" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
        sheet.getRange(r + 1, syncCol).setValue(syncId);
      }
      upsertSistema_(dest, destHeaders, syncId, valoresDesdeFila_(srcHeaders, fila, persona));
      total++;
    }
  });
  SpreadsheetApp.getActive().toast("Sincronizadas " + total + " tareas al Sistema.", "Sync", 5);
  return "OK: " + total + " tareas sincronizadas.";
}

// ── SINCRONIZACIÓN POR EDICIÓN (trigger instalable) ───────
function onEditSync(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    if (name.indexOf(TAB_PREFIX) !== 0) return;
    const row = e.range.getRow();
    if (row <= HEADER_ROW) return;

    const persona = name.substring(TAB_PREFIX.length).trim();
    const syncCol = ensureSyncCol_(sheet);
    const srcHeaders = headerMap_(sheet, HEADER_ROW);
    const fila = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    const tieneContenido = (srcHeaders["Sub Tareas"] && String(fila[srcHeaders["Sub Tareas"] - 1]).trim()) ||
                           (srcHeaders["Tarea"] && String(fila[srcHeaders["Tarea"] - 1]).trim());
    if (!tieneContenido) return;

    let syncId = String(fila[syncCol - 1] || "").trim();
    if (!syncId) {
      syncId = "SYNC-" + Utilities.getUuid().replace(/-/g, "").substring(0, 12);
      sheet.getRange(row, syncCol).setValue(syncId);
      fila[syncCol - 1] = syncId;
    }
    const dest = sistemaSheet_();
    upsertSistema_(dest, headerMap_(dest, 1), syncId, valoresDesdeFila_(srcHeaders, fila, persona));
  } catch (err) {
    console.error("[onEditSync]", err);
  }
}

/** Crea el trigger instalable de edición (ejecutar UNA vez, autorizar). */
function instalarTrigger() {
  const ss = SpreadsheetApp.getActive();
  // Evitar duplicados
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "onEditSync") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("onEditSync").forSpreadsheet(ss).onEdit().create();
  return "Trigger instalado: cada edición se sincronizará con el Sistema.";
}
