/**
 * ============================================================
 * MÓDULO REGISTRO DE CELULARES — añadido al backend AVANZADO
 * ============================================================
 * Pega este archivo como un NUEVO archivo .gs dentro del MISMO proyecto
 * Apps Script donde está backend-apps-script.gs (Extensiones → Apps Script →
 * ícono + → Secuencia de comandos → nómbralo "celulares").
 *
 * Reutiliza los helpers del backend avanzado: ensureSheet_, nextSeqId_,
 * findRowByKey_, colIndexMap_, rowFromMap_, sheetToObjects_.
 *
 * Luego aplica el PARCHE de 4 líneas en backend-apps-script.gs (ver
 * INTEGRACION-CELULARES.md) para enchufar config, AUTHZ, router y setup().
 * ============================================================
 */

// ── Hoja y columnas ───────────────────────────────────────
const SHEET_CELULARES = "Registro_Celulares";
const COLS_CELULARES = [
  "Codigo", "Marca", "Modelo", "IMEI", "Numero de linea", "Operador", "Plan",
  "Asignado a", "Area", "Estado", "Fecha asignacion", "Observaciones",
];

// ── Listas para selects del frontend (config) ─────────────
const OPERADORES_DEFAULT      = ["Claro", "Movistar", "Entel", "Bitel", "Otro"];
const ESTADOS_CELULAR_DEFAULT = ["Activo", "En stock", "En reparación", "Suspendido", "De baja"];

// ── Listar ────────────────────────────────────────────────
function listCelulares_() {
  const { sheet } = ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
  return sheetToObjects_(sheet);
}

// ── Crear ─────────────────────────────────────────────────
function crearCelular_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { sheet, headers } = ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
    const asignado = String(params.asignado || "").trim();
    const id = nextSeqId_(sheet, headers.indexOf("Codigo") + 1, "CEL");
    sheet.appendRow(rowFromMap_(headers, {
      "Codigo": id, "Marca": String(params.marca || "").trim(),
      "Modelo": String(params.modelo || "").trim(), "IMEI": String(params.imei || "").trim(),
      "Numero de linea": String(params.numero || "").trim(), "Operador": String(params.operador || "").trim(),
      "Plan": String(params.plan || "").trim(), "Asignado a": asignado,
      "Area": String(params.area || "").trim(),
      "Estado": String(params.estado || (asignado ? "Activo" : "En stock")).trim(),
      "Fecha asignacion": asignado ? new Date() : "",
      "Observaciones": String(params.observaciones || "").trim(),
    }));
    return { ok: true, id };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ── Actualizar ────────────────────────────────────────────
function actualizarCelular_(params) {
  const { sheet, headers } = ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
  const id = String(params.codigo || params.id || "").trim();
  if (!id) return { ok: false, error: "Falta el código del celular." };
  const rowNum = findRowByKey_(sheet, headers.indexOf("Codigo") + 1, id);
  if (rowNum === -1) return { ok: false, error: `Celular "${id}" no encontrado.` };

  const col = colIndexMap_(headers, COLS_CELULARES);
  const setIf = (campo, key) => {
    if (params[key] !== undefined && col[campo])
      sheet.getRange(rowNum, col[campo]).setValue(String(params[key]));
  };
  setIf("Marca", "marca"); setIf("Modelo", "modelo"); setIf("IMEI", "imei");
  setIf("Numero de linea", "numero"); setIf("Operador", "operador"); setIf("Plan", "plan");
  setIf("Area", "area"); setIf("Estado", "estado"); setIf("Observaciones", "observaciones");
  if (params.asignado !== undefined && col["Asignado a"]) {
    const prev = String(sheet.getRange(rowNum, col["Asignado a"]).getValue() || "").trim();
    const nuevo = String(params.asignado).trim();
    sheet.getRange(rowNum, col["Asignado a"]).setValue(nuevo);
    if (nuevo && nuevo !== prev) sheet.getRange(rowNum, col["Fecha asignacion"]).setValue(new Date());
  }
  return { ok: true, id };
}

/** Crea la hoja Registro_Celulares (llámala desde setup() o ejecútala suelta). */
function setupCelulares() {
  ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
  return "Hoja Registro_Celulares lista.";
}
