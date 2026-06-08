/**
 * ============================================================
 * SISTEMA DE TICKETS, TAREAS Y EQUIPOS — Google Apps Script v5.1
 * ============================================================
 * NOVEDADES v5 (transformación del sistema de tickets):
 * - USUARIOS con ROLES (Administrador, Técnico TI, Líder de equipo, Usuario)
 * - Login real validado en backend contra la hoja USUARIOS
 * - EQUIPOS: inventario de equipos informáticos asignados a usuarios
 * - TAREAS: tareas asignadas por persona, con catálogo PARAMETRIZADO
 * - Flujo "Tomar ticket": el técnico que lo coge queda como ASIGNADO
 *   y el ticket pasa a "En atención" automáticamente
 * - Base lista para integración futura con Google Calendar (agendarTarea_)
 *
 * SEGURIDAD v5.1 (resuelve las vulnerabilidades del README v4):
 * - PIN guardado con HASH SHA-256 + sal (ya no en texto plano); migración
 *   transparente de PINs antiguos al primer login.
 * - TOKENS de sesión emitidos en login (CacheService, 6 h). Toda acción de
 *   escritura y la lista de usuarios exigen token válido + rol (ver AUTHZ).
 *   La URL pública ya no permite modificar datos sin autenticarse.
 *
 * Hereda de v3/v4:
 * - ensureXxxHeaders_(): crea columnas/hojas faltantes AUTOMÁTICAMENTE
 * - Subida de evidencia a Google Drive (DRIVE_FOLDER_ID)
 * ============================================================
 *
 * CONFIGURACIÓN INICIAL (Script Properties):
 *   ADMIN_EMAIL      = correo del administrador (notificaciones)
 *   DRIVE_FOLDER_ID  = ID de carpeta en Drive para evidencias
 *   PIN_SALT         = sal secreta para el hash de PINs (recomendado cambiarla)
 *   CALENDAR_ENABLED = "true" para activar el volcado a Google Calendar (opcional)
 *   CALENDAR_ID      = ID del calendario destino (default: calendario principal)
 *
 * Despliega como WebApp: "Ejecutar como: yo" · "Acceso: Cualquier persona".
 * ============================================================
 */

// ── NOMBRES DE HOJAS ──────────────────────────────────────
const SHEET_TICKETS   = "TICKETS";
const SHEET_CONFIG    = "Config";
const SHEET_HISTORIAL = "HISTORIAL";
const SHEET_USUARIOS  = "USUARIOS";
const SHEET_EQUIPOS   = "EQUIPOS";
const SHEET_TAREAS    = "TAREAS";
const SHEET_CATALOGO  = "CATALOGO_TAREAS";
const SHEET_CELULARES = "Registro_Celulares";

// ── COLUMNAS REQUERIDAS POR HOJA (se crean automáticamente) ──
const COLS_TICKETS = [
  "CODIGO", "Nombre", "Area", "Tipo", "Titulo del requerimiento", "Descripcion",
  "Prioridad", "Evidencia", "Estado", "Fecha de ingreso de ticket", "Fecha de cierre",
  "Solucion", "Detalle de la solucion", "Ultimo cambio de estado",
  "Tecnico asignado",        // quién atiende / a quién quedó asignado
  "Fecha de asignacion",     // cuándo lo tomó el técnico
  "Cambio de estado count",
];

const COLS_USUARIOS = [
  "ID", "Nombre", "Email", "PIN", "Rol", "Equipo", "Activo", "Fecha alta",
];

const COLS_EQUIPOS = [
  "Codigo", "Tipo", "Marca", "Modelo", "N Serie", "Asignado a", "Area",
  "Ubicacion", "Estado", "Fecha asignacion", "Observaciones",
];

const COLS_TAREAS = [
  "ID", "Titulo", "Descripcion", "Tipo", "Asignado a", "Asignado por",
  "Estado", "Prioridad", "Fecha inicio", "Fecha limite",
  "Ticket relacionado", "Fecha completada", "En calendario", "Event ID",
];

const COLS_CATALOGO = [
  "ID", "Nombre", "Descripcion", "Categoria", "Duracion estimada (h)",
  "Rol sugerido", "Activo",
];

const COLS_CELULARES = [
  "Codigo", "Marca", "Modelo", "IMEI", "Numero de linea", "Operador", "Plan",
  "Asignado a", "Area", "Estado", "Fecha asignacion", "Observaciones",
];

// ── PARÁMETROS / LISTAS POR DEFECTO ───────────────────────
const ROLES_DEFAULT = ["Administrador", "Técnico TI", "Líder de equipo", "Usuario"];

const ESTADOS_DEFAULT = [
  "Pendiente",
  "En atención",
  "Bloqueado por recursos",  // hardware/presupuesto pendiente
  "Pausado",
  "Bloqueado",               // bloqueado por terceros/dependencia externa
  "Atendido",
  "Anulado",
];

const ESTADOS_TAREA_DEFAULT = ["Pendiente", "En progreso", "En revisión", "Completada", "Cancelada"];

const TIPOS_EQUIPO_DEFAULT  = ["PC de escritorio", "Laptop", "Monitor", "Impresora",
                               "Servidor", "Teléfono IP", "Tablet", "Periférico", "Red", "Otro"];
const ESTADOS_EQUIPO_DEFAULT = ["Operativo", "En stock", "En reparación", "Asignado", "De baja"];

const OPERADORES_DEFAULT       = ["Claro", "Movistar", "Entel", "Bitel", "Otro"];
const ESTADOS_CELULAR_DEFAULT  = ["Activo", "En stock", "En reparación", "Suspendido", "De baja"];

// ════════════════════════════════════════════════════════
// SETUP / INICIALIZACIÓN MANUAL
// ════════════════════════════════════════════════════════
/**
 * Crea TODAS las hojas necesarias de una sola vez y siembra el admin por defecto.
 * Ejecútala UNA VEZ desde el editor de Apps Script:
 *   1) Selecciona "setup" en el menú de funciones (junto a ▶ Ejecutar).
 *   2) Pulsa ▶ Ejecutar y autoriza los permisos cuando lo pida.
 * Crea: TICKETS, HISTORIAL, USUARIOS (con admin/1234), EQUIPOS, TAREAS, CATALOGO_TAREAS.
 */
function setup() {
  ensureSheet_(SHEET_TICKETS,  COLS_TICKETS);
  ensureHistorialSheet_();
  ensureUsuariosSheet_();                       // crea USUARIOS + siembra admin (PIN 1234 hasheado)
  ensureSheet_(SHEET_EQUIPOS,   COLS_EQUIPOS);
  ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
  ensureSheet_(SHEET_TAREAS,    COLS_TAREAS);
  ensureSheet_(SHEET_CATALOGO,  COLS_CATALOGO);
  const msg = "Setup OK → hojas: TICKETS, HISTORIAL, USUARIOS, EQUIPOS, Registro_Celulares, TAREAS, CATALOGO_TAREAS. Admin: admin / 1234";
  console.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════
// HELPERS GENÉRICOS
// ════════════════════════════════════════════════════════
function jsonOutput_(obj, callback) {
  const payload = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${payload});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(payload)
    .setMimeType(ContentService.MimeType.JSON);
}

function getAdminEmail_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL")
    || Session.getEffectiveUser().getEmail();
}

function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .filter(row => row.some(c => c !== "" && c !== null))
    .map(row => {
      const o = {};
      headers.forEach((h, i) => {
        let val = row[i];
        o[h] = (val instanceof Date) ? val.toISOString() : val;
      });
      return o;
    });
}

/**
 * Garantiza que una hoja exista con TODAS las columnas requeridas.
 * Crea la hoja si falta y agrega columnas faltantes sin reordenar.
 * Devuelve { sheet, headers }.
 */
function ensureSheet_(name, requiredCols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, requiredCols.length).setValues([requiredCols]);
    styleHeader_(sheet, requiredCols.length);
    sheet.setFrozenRows(1);
    return { sheet, headers: requiredCols.slice() };
  }
  const lastCol = Math.max(1, sheet.getLastColumn());
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  let colCount = headers.length;
  const added = [];
  requiredCols.forEach(req => {
    if (!headers.includes(req)) {
      colCount++;
      sheet.getRange(1, colCount).setValue(req);
      styleHeaderCell_(sheet.getRange(1, colCount));
      headers.push(req);
      added.push(req);
    }
  });
  if (added.length) console.log(`[ensureSheet:${name}] columnas agregadas: ${added.join(", ")}`);
  return { sheet, headers };
}

function styleHeader_(sheet, n) {
  const r = sheet.getRange(1, 1, 1, n);
  r.setFontWeight("bold").setBackground("#111827").setFontColor("#ffffff");
}
function styleHeaderCell_(cell) {
  cell.setFontWeight("bold").setBackground("#111827").setFontColor("#ffffff");
}

function colIndexMap_(headers, names) {
  const m = {};
  names.forEach(n => { m[n] = headers.indexOf(n) + 1; }); // 1-based, 0 = no existe
  return m;
}

/** Siguiente ID secuencial tipo PREFIX-001 leyendo la columna idCol. */
function nextSeqId_(sheet, idColIndex, prefix) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return `${prefix}-001`;
  const codes = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues().flat()
    .map(c => String(c || "").trim());
  const re = new RegExp(`^${prefix}[-](\\d+)$`, "i");
  let max = 0;
  codes.forEach(c => { const m = c.match(re); if (m) { const n = parseInt(m[1]); if (n > max) max = n; } });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

/** Construye una fila alineada a headers a partir de un objeto {Columna: valor}. */
function rowFromMap_(headers, map) {
  const row = new Array(headers.length).fill("");
  headers.forEach((h, i) => { if (Object.prototype.hasOwnProperty.call(map, h)) row[i] = map[h]; });
  return row;
}

/** Encuentra el número de fila (1-based, incl. cabecera) cuyo valor en keyCol == keyValue. */
function findRowByKey_(sheet, keyColIndex, keyValue) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const vals = sheet.getRange(2, keyColIndex, lastRow - 1, 1).getValues().flat()
    .map(c => String(c || "").trim());
  const idx = vals.findIndex(v => v === String(keyValue).trim());
  return idx === -1 ? -1 : idx + 2;
}

// ════════════════════════════════════════════════════════
// SEGURIDAD: hash de PIN + tokens de sesión + autorización
// ════════════════════════════════════════════════════════
const SESSION_TTL = 21600; // 6 h (máximo de CacheService)

// Qué rol puede ejecutar cada acción. [] = cualquier usuario autenticado.
// Administrador SIEMPRE está permitido. Las acciones que NO están aquí son
// lecturas públicas (config, historial, tickets, tareas, equipos, catálogo).
const AUTHZ = {
  create:             [],                                // crear ticket: autenticado
  update:             ["Técnico TI", "Líder de equipo"],
  tomarTicket:        ["Técnico TI", "Líder de equipo"],
  uploadEvidencia:    [],
  crearUsuario:       ["Administrador"],
  actualizarUsuario:  ["Administrador"],
  usuarios:           ["Técnico TI", "Líder de equipo"], // lista de personal (PII)
  crearEquipo:        ["Técnico TI", "Líder de equipo"],
  actualizarEquipo:   ["Técnico TI", "Líder de equipo"],
  crearCelular:       ["Técnico TI", "Líder de equipo"],
  actualizarCelular:  ["Técnico TI", "Líder de equipo"],
  crearTarea:         ["Líder de equipo"],
  actualizarTarea:    [],                                // autenticado (avanza su tarea)
  crearCatalogoTarea: ["Líder de equipo"],
};

function pinSalt_() {
  return PropertiesService.getScriptProperties().getProperty("PIN_SALT") || "ti-sistema-salt-v5";
}
function hashPin_(pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pinSalt_() + String(pin));
  return bytes.map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");
}
function isHash_(s) { return /^[0-9a-f]{64}$/i.test(String(s || "")); }
/** Compara un PIN en claro contra el valor guardado (hash o, por compatibilidad, texto). */
function pinMatches_(pin, stored) {
  const s = String(stored || "");
  return isHash_(s) ? (s.toLowerCase() === hashPin_(pin)) : (s === String(pin));
}

function makeToken_() {
  return Utilities.getUuid().replace(/-/g, "") + Math.random().toString(36).slice(2, 10);
}
function saveSession_(token, sess) {
  CacheService.getScriptCache().put("sess_" + token, JSON.stringify(sess), SESSION_TTL);
}
function validateToken_(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get("sess_" + String(token));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
/**
 * Verifica token y rol. Devuelve { sess } si pasa, o { fail } con el JSON de error.
 * roles vacío/undefined = cualquier usuario autenticado. Administrador siempre pasa.
 */
function requireAuth_(p, roles) {
  const sess = validateToken_(p.token);
  if (!sess) return { fail: { ok: false, error: "Sesión no válida o expirada. Vuelve a iniciar sesión.", authError: true } };
  if (roles && roles.length && sess.rol !== "Administrador" && roles.indexOf(sess.rol) === -1)
    return { fail: { ok: false, error: "No tienes permiso para esta acción.", authError: true } };
  return { sess };
}

// ════════════════════════════════════════════════════════
// HISTORIAL
// ════════════════════════════════════════════════════════
function ensureHistorialSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_HISTORIAL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORIAL);
    sheet.getRange(1, 1, 1, 7)
      .setValues([["Fecha", "CODIGO", "Estado anterior", "Estado nuevo", "Solucion", "Tecnico", "Detalle"]]);
    styleHeader_(sheet, 7);
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 7, 150);
  }
  return sheet;
}

function logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle, tecnicoOverride) {
  try {
    const sheet = ensureHistorialSheet_();
    const tecnico = tecnicoOverride || Session.getEffectiveUser().getEmail() || "sistema";
    sheet.appendRow([new Date(), codigo, oldEstado || "", nuevoEstado, solucion || "", tecnico, detalle || ""]);
  } catch (err) { console.error("[logHistorial]", err); }
}

// ════════════════════════════════════════════════════════
// CONFIG PAYLOAD (parámetros para el frontend)
// ════════════════════════════════════════════════════════
function buildConfigPayload_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_CONFIG);
  let areas = [], tipos = [], prios = [], raw = [];
  if (configSheet) {
    raw   = sheetToObjects_(configSheet);
    areas = uniqSorted_(raw.map(r => r.Area || r["Área"]));
    tipos = uniqSorted_(raw.map(r => r.Tipo));
    prios = uniqSorted_(raw.map(r => r.Prioridad));
  }
  return {
    status: "success",
    areas, tipos, prioridades: prios,
    estados: ESTADOS_DEFAULT,
    roles: ROLES_DEFAULT,
    estadosTarea: ESTADOS_TAREA_DEFAULT,
    tiposEquipo: TIPOS_EQUIPO_DEFAULT,
    estadosEquipo: ESTADOS_EQUIPO_DEFAULT,
    operadores: OPERADORES_DEFAULT,
    estadosCelular: ESTADOS_CELULAR_DEFAULT,
    raw,
  };
}
function uniqSorted_(arr) {
  return [...new Set(arr.map(x => String(x || "").trim()).filter(Boolean))].sort();
}

// ════════════════════════════════════════════════════════
// TICKETS  (lógica heredada v3/v4 + asignación)
// ════════════════════════════════════════════════════════
function prefixFromTipo_(tipo) {
  const t = String(tipo || "").trim().toLowerCase();
  if (t === "requerimiento") return "REQ";
  if (t === "incidencia")    return "INC";
  if (t === "evento")        return "EVE";
  return "REQ";
}

function nextCode_(prefix, sheet, headers) {
  const codeCol = headers.indexOf("CODIGO") + 1;
  if (codeCol === 0) return `${prefix}-001`;
  return nextSeqId_(sheet, codeCol, prefix);
}

function findRecentDuplicate_(sheet, headers, fields, windowSeconds) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const idx = {
    codigo: headers.indexOf("CODIGO"), nombre: headers.indexOf("Nombre"),
    area: headers.indexOf("Area"), tipo: headers.indexOf("Tipo"),
    titulo: headers.indexOf("Titulo del requerimiento"), desc: headers.indexOf("Descripcion"),
    fecha: headers.indexOf("Fecha de ingreso de ticket"),
  };
  const start = Math.max(2, lastRow - 150 + 1);
  const values = sheet.getRange(start, 1, lastRow - start + 1, headers.length).getValues();
  const now = Date.now(), limitMs = windowSeconds * 1000;
  const norm = s => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const d = row[idx.fecha];
    const t = d instanceof Date ? d.getTime() : NaN;
    if (!t || (now - t) > limitMs) continue;
    if (norm(row[idx.nombre]) === norm(fields.nombre) &&
        norm(row[idx.area])   === norm(fields.area) &&
        norm(row[idx.tipo])   === norm(fields.tipo) &&
        norm(row[idx.titulo]) === norm(fields.titulo) &&
        norm(row[idx.desc])   === norm(fields.descripcion))
      return String(row[idx.codigo] || "").trim() || null;
  }
  return null;
}

function createTicket_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
    ensureHistorialSheet_();

    const nombre      = String(data.nombre      || data.Nombre || "").trim();
    const area        = String(data.area        || data.Area   || "").trim();
    const tipo        = String(data.tipo        || data.Tipo   || "").trim();
    const titulo      = String(data.titulo      || data["Titulo del requerimiento"] || "").trim();
    const descripcion = String(data.descripcion || data.Descripcion || "").trim();
    const prioridad   = String(data.prioridad   || data.Prioridad   || "").trim();

    const errors = [];
    if (!nombre) errors.push("nombre");
    if (!area) errors.push("área");
    if (!tipo) errors.push("tipo");
    if (!titulo) errors.push("título");
    if (!descripcion) errors.push("descripción");
    if (!prioridad) errors.push("prioridad");
    if (errors.length) return { status: "error", message: `Campos requeridos faltantes: ${errors.join(", ")}` };
    if (titulo.length > 200) return { status: "error", message: "Título demasiado largo (máx 200)" };
    if (descripcion.length > 2000) return { status: "error", message: "Descripción demasiado larga (máx 2000)" };

    const dup = findRecentDuplicate_(sheet, headers, { nombre, area, tipo, titulo, descripcion }, 90);
    if (dup) return { status: "success", id: dup, usuario: nombre, tipo, titulo, duplicated: true };

    const codigo = nextCode_(prefixFromTipo_(tipo), sheet, headers);
    const ahora = new Date();
    sheet.appendRow(rowFromMap_(headers, {
      "CODIGO": codigo, "Nombre": nombre, "Area": area, "Tipo": tipo,
      "Titulo del requerimiento": titulo, "Descripcion": descripcion,
      "Prioridad": prioridad, "Evidencia": "", "Estado": "Pendiente",
      "Fecha de ingreso de ticket": ahora, "Ultimo cambio de estado": ahora,
      "Cambio de estado count": 0,
    }));

    logHistorial_(codigo, "", "Pendiente", "", "Ticket creado");

    try {
      const adminEmail = getAdminEmail_();
      if (adminEmail) MailApp.sendEmail(adminEmail,
        `[${codigo}] Nuevo ticket — ${tipo}: ${titulo}`,
        `Ticket: ${codigo}\nUsuario: ${nombre}\nÁrea: ${area}\nTipo: ${tipo}\nPrioridad: ${prioridad}\n\nTítulo: ${titulo}\n\nDescripción:\n${descripcion}`);
    } catch (e) { console.warn("[createTicket] email:", e); }

    return { status: "success", id: codigo, usuario: nombre, tipo, titulo };
  } catch (err) {
    console.error("[createTicket]", err);
    return { status: "error", message: `Error interno: ${err.message}` };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function parseLocalDateTime_(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0, +m[6] || 0);
}

function updateTicket_(params) {
  const codigo      = String(params.codigo || "").trim();
  const nuevoEstado = String(params.estado || "").trim();
  const solucion    = String(params.solucion || "").trim();
  const detalle     = String(params.detalle || "").trim();
  const tecnico     = String(params.tecnico || "").trim();
  const fechaRaw    = String(params.fechaCierre || params.fecha_cierre || "").trim();

  if (!codigo) return { ok: false, error: "Falta el código del ticket." };
  if (!nuevoEstado) return { ok: false, error: "Falta el nuevo estado." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Nombre", "Area", "Estado", "Fecha de cierre",
    "Solucion", "Detalle de la solucion", "Ultimo cambio de estado", "Tecnico asignado",
    "Fecha de asignacion", "Cambio de estado count"]);
  if (!col["CODIGO"] || !col["Estado"]) return { ok: false, error: "Estructura de hoja incorrecta." };

  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  const oldEstado = String(sheet.getRange(rowNum, col["Estado"]).getValue() || "").trim();
  const changed = oldEstado !== nuevoEstado;

  sheet.getRange(rowNum, col["Estado"]).setValue(nuevoEstado);
  if (col["Solucion"]) sheet.getRange(rowNum, col["Solucion"]).setValue(solucion);
  if (col["Detalle de la solucion"]) sheet.getRange(rowNum, col["Detalle de la solucion"]).setValue(detalle);
  if (col["Ultimo cambio de estado"]) sheet.getRange(rowNum, col["Ultimo cambio de estado"]).setValue(new Date());
  if (col["Tecnico asignado"] && tecnico) {
    sheet.getRange(rowNum, col["Tecnico asignado"]).setValue(tecnico);
    if (col["Fecha de asignacion"] && !String(sheet.getRange(rowNum, col["Fecha de asignacion"]).getValue() || "").trim())
      sheet.getRange(rowNum, col["Fecha de asignacion"]).setValue(new Date());
  }
  if (col["Cambio de estado count"]) {
    const current = parseInt(sheet.getRange(rowNum, col["Cambio de estado count"]).getValue() || "0") || 0;
    sheet.getRange(rowNum, col["Cambio de estado count"]).setValue(current + 1);
  }

  const esCierre = ["atendido", "anulado"].includes(nuevoEstado.toLowerCase());
  if (col["Fecha de cierre"] && esCierre) {
    const fechaCierre = fechaRaw ? parseLocalDateTime_(fechaRaw) : new Date();
    sheet.getRange(rowNum, col["Fecha de cierre"]).setValue(fechaCierre || new Date());
  }

  if (changed) logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle, tecnico);

  if (changed && nuevoEstado.toLowerCase() === "atendido") {
    try {
      const nombre = col["Nombre"] ? String(sheet.getRange(rowNum, col["Nombre"]).getValue() || "") : "";
      const area   = col["Area"]   ? String(sheet.getRange(rowNum, col["Area"]).getValue() || "")   : "";
      const email  = findEmailForUser_(area.trim(), nombre.trim());
      if (email) sendStatusEmail_(email, { codigo, nombre, area, nuevoEstado, oldEstado, solucion, detalle });
    } catch (e) { console.warn("[updateTicket] email:", e); }
  }

  return { ok: true, codigo, oldEstado, nuevoEstado, timestamp: new Date().toISOString() };
}

/**
 * "Tomar ticket": un técnico se asigna el ticket. Queda como ASIGNADO a él
 * y el ticket pasa a "En atención" (si estaba Pendiente/Bloqueado/Pausado).
 */
function tomarTicket_(params) {
  const codigo  = String(params.codigo || "").trim();
  const tecnico = String(params.tecnico || "").trim();
  if (!codigo)  return { ok: false, error: "Falta el código del ticket." };
  if (!tecnico) return { ok: false, error: "Falta el técnico que toma el ticket." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Estado", "Tecnico asignado",
    "Fecha de asignacion", "Ultimo cambio de estado"]);
  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  const yaAsignado = String(sheet.getRange(rowNum, col["Tecnico asignado"]).getValue() || "").trim();
  if (yaAsignado && yaAsignado !== tecnico && !params.forzar)
    return { ok: false, error: `Ya está siendo atendido por ${yaAsignado}.`, asignadoA: yaAsignado };

  const oldEstado = String(sheet.getRange(rowNum, col["Estado"]).getValue() || "").trim();
  sheet.getRange(rowNum, col["Tecnico asignado"]).setValue(tecnico);
  sheet.getRange(rowNum, col["Fecha de asignacion"]).setValue(new Date());

  const reabrir = ["pendiente", "bloqueado", "bloqueado por recursos", "pausado", ""].includes(oldEstado.toLowerCase());
  const nuevoEstado = reabrir ? "En atención" : oldEstado;
  if (nuevoEstado !== oldEstado) sheet.getRange(rowNum, col["Estado"]).setValue(nuevoEstado);
  sheet.getRange(rowNum, col["Ultimo cambio de estado"]).setValue(new Date());

  logHistorial_(codigo, oldEstado, nuevoEstado, "", `Ticket tomado por ${tecnico}`, tecnico);
  return { ok: true, codigo, asignadoA: tecnico, estado: nuevoEstado };
}

// ── UPLOAD EVIDENCIA (Drive) ──────────────────────────────
function uploadEvidencia_(params) {
  const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) return { ok: false, error: "DRIVE_FOLDER_ID no configurado en Script Properties." };

  const base64   = String(params.imageData || "");
  const mimeType = String(params.mimeType || "image/jpeg");
  const codigo   = String(params.codigo || "SIN-CODIGO");
  const ext      = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : mimeType.includes("webp") ? "webp" : "jpg";
  const fileName = `evidencia_${codigo}_${Date.now()}.${ext}`;

  if (!base64) return { ok: false, error: "No se recibió la imagen." };
  if (base64.length > 6 * 1024 * 1024) return { ok: false, error: "Imagen demasiado grande (máx 5MB)." };

  try {
    const folder = DriveApp.getFolderById(folderId);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const viewUrl = `https://drive.google.com/file/d/${fileId}/view`;

    if (codigo !== "SIN-CODIGO") {
      const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
      const codCol = headers.indexOf("CODIGO") + 1, evidCol = headers.indexOf("Evidencia") + 1;
      if (codCol && evidCol) {
        const rowNum = findRowByKey_(sheet, codCol, codigo);
        if (rowNum !== -1) sheet.getRange(rowNum, evidCol).setValue(viewUrl);
      }
    }
    return { ok: true, viewUrl, directUrl: `https://lh3.googleusercontent.com/d/${fileId}`, fileName };
  } catch (err) {
    console.error("[uploadEvidencia]", err);
    return { ok: false, error: `Error al subir imagen: ${err.message}` };
  }
}

// ── EMAIL HELPERS ─────────────────────────────────────────
function findEmailForUser_(area, nombre) {
  // 1) intentar en USUARIOS
  const u = findUsuarioByNombre_(nombre);
  if (u && u.Email) return u.Email;
  // 2) fallback a la hoja Config (compatibilidad v4)
  const ss = SpreadsheetApp.getActive();
  const cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg) return "";
  const values = cfg.getDataRange().getValues();
  if (values.length < 2) return "";
  const headers = values[0].map(h => String(h).trim());
  const iArea = headers.indexOf("Area"), iUser = headers.indexOf("Usuario"), iEmail = headers.indexOf("Email");
  if (iEmail === -1 || iUser === -1) return "";
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[iEmail] || "").trim() &&
        (iArea < 0 || String(row[iArea] || "").trim() === area) &&
        String(row[iUser] || "").trim() === nombre) return String(row[iEmail]).trim();
  }
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (String(row[iUser] || "").trim() === nombre && String(row[iEmail] || "").trim())
      return String(row[iEmail]).trim();
  }
  return "";
}

function sendStatusEmail_(toEmail, info) {
  try {
    MailApp.sendEmail(toEmail, `[Tickets TI] ${info.codigo} — ${info.nuevoEstado}`,
      `Hola ${info.nombre || ""},\n\nTu ticket ${info.codigo} ha sido ATENDIDO.\n\nSolución: ${info.solucion || "—"}\nDetalle: ${info.detalle || "—"}\n\nGracias por usar el sistema de Tickets TI.`);
  } catch (err) { console.error("[sendStatusEmail]", err); }
}

// ════════════════════════════════════════════════════════
// USUARIOS + LOGIN (roles)
// ════════════════════════════════════════════════════════
/** Crea la hoja USUARIOS y siembra un Administrador por defecto la primera vez. */
function ensureUsuariosSheet_() {
  const res = ensureSheet_(SHEET_USUARIOS, COLS_USUARIOS);
  if (res.sheet.getLastRow() < 2) {
    res.sheet.appendRow(rowFromMap_(res.headers, {
      "ID": "USR-001", "Nombre": "Administrador", "Email": "admin",
      "PIN": hashPin_("1234"), "Rol": "Administrador", "Equipo": "TI",
      "Activo": "Sí", "Fecha alta": new Date(),
    }));
  }
  return res;
}

function listUsuarios_() {
  const { sheet } = ensureUsuariosSheet_();
  // No exponer el PIN en el listado general
  return sheetToObjects_(sheet).map(u => { const o = Object.assign({}, u); delete o.PIN; return o; });
}

function findUsuarioByNombre_(nombre) {
  const { sheet } = ensureUsuariosSheet_();
  const n = String(nombre || "").trim().toLowerCase();
  return sheetToObjects_(sheet).find(u => String(u.Nombre || "").trim().toLowerCase() === n) || null;
}

function login_(params) {
  const email = String(params.email || params.usuario || "").trim().toLowerCase();
  const pin   = String(params.pin || "").trim();
  if (!email || !pin) return { ok: false, error: "Ingresa correo/usuario y PIN." };

  const { sheet, headers } = ensureUsuariosSheet_();
  const rows = sheetToObjects_(sheet);
  const u = rows.find(r =>
    (String(r.Email || "").trim().toLowerCase() === email ||
     String(r.Nombre || "").trim().toLowerCase() === email));
  if (!u) return { ok: false, error: "Usuario no encontrado." };
  if (String(u.Activo || "").trim().toLowerCase() === "no") return { ok: false, error: "Usuario inactivo." };
  if (!pinMatches_(pin, u.PIN)) return { ok: false, error: "PIN incorrecto." };

  // Migrar a hash si el PIN estaba guardado en texto plano (transparente para el usuario).
  if (!isHash_(u.PIN)) {
    const rowNum = findRowByKey_(sheet, headers.indexOf("ID") + 1, u.ID);
    if (rowNum !== -1) sheet.getRange(rowNum, headers.indexOf("PIN") + 1).setValue(hashPin_(pin));
  }

  const usuario = {
    id: u.ID, nombre: u.Nombre, email: u.Email,
    rol: u.Rol || "Usuario", equipo: u.Equipo || "",
  };
  const token = makeToken_();
  saveSession_(token, { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol });
  return { ok: true, usuario, token, ttl: SESSION_TTL };
}

function crearUsuario_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { sheet, headers } = ensureUsuariosSheet_();
    const nombre = String(params.nombre || "").trim();
    const email  = String(params.email || "").trim();
    const rol    = String(params.rol || "Usuario").trim();
    const equipo = String(params.equipo || "").trim();
    const pin    = String(params.pin || "").trim();
    const activo = String(params.activo || "Sí").trim();
    if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
    if (!pin)    return { ok: false, error: "El PIN es obligatorio." };

    // Email único (si se indicó)
    if (email) {
      const dup = sheetToObjects_(sheet).some(u => String(u.Email || "").trim().toLowerCase() === email.toLowerCase());
      if (dup) return { ok: false, error: `Ya existe un usuario con el correo ${email}.` };
    }
    const idCol = headers.indexOf("ID") + 1;
    const id = nextSeqId_(sheet, idCol, "USR");
    sheet.appendRow(rowFromMap_(headers, {
      "ID": id, "Nombre": nombre, "Email": email, "PIN": hashPin_(pin),
      "Rol": rol, "Equipo": equipo, "Activo": activo, "Fecha alta": new Date(),
    }));
    return { ok: true, id, nombre };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

function actualizarUsuario_(params) {
  const { sheet, headers } = ensureUsuariosSheet_();
  const id = String(params.id || "").trim();
  if (!id) return { ok: false, error: "Falta el ID del usuario." };
  const rowNum = findRowByKey_(sheet, headers.indexOf("ID") + 1, id);
  if (rowNum === -1) return { ok: false, error: `Usuario "${id}" no encontrado.` };

  const col = colIndexMap_(headers, COLS_USUARIOS);
  const setIf = (campo, key) => {
    if (params[key] !== undefined && params[key] !== "" && col[campo])
      sheet.getRange(rowNum, col[campo]).setValue(String(params[key]));
  };
  setIf("Nombre", "nombre");
  setIf("Email", "email");
  setIf("Rol", "rol");
  setIf("Equipo", "equipo");
  setIf("Activo", "activo");
  if (params.pin !== undefined && String(params.pin).trim() !== "" && col["PIN"])
    sheet.getRange(rowNum, col["PIN"]).setValue(hashPin_(String(params.pin).trim()));
  return { ok: true, id };
}

// ════════════════════════════════════════════════════════
// EQUIPOS (inventario informático)
// ════════════════════════════════════════════════════════
function listEquipos_() {
  const { sheet } = ensureSheet_(SHEET_EQUIPOS, COLS_EQUIPOS);
  return sheetToObjects_(sheet);
}

function crearEquipo_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { sheet, headers } = ensureSheet_(SHEET_EQUIPOS, COLS_EQUIPOS);
    const tipo = String(params.tipo || "").trim();
    if (!tipo) return { ok: false, error: "El tipo de equipo es obligatorio." };
    const asignado = String(params.asignado || "").trim();
    const estado = String(params.estado || (asignado ? "Asignado" : "En stock")).trim();
    const id = nextSeqId_(sheet, headers.indexOf("Codigo") + 1, "EQ");
    sheet.appendRow(rowFromMap_(headers, {
      "Codigo": id, "Tipo": tipo, "Marca": String(params.marca || "").trim(),
      "Modelo": String(params.modelo || "").trim(), "N Serie": String(params.serie || "").trim(),
      "Asignado a": asignado, "Area": String(params.area || "").trim(),
      "Ubicacion": String(params.ubicacion || "").trim(), "Estado": estado,
      "Fecha asignacion": asignado ? new Date() : "",
      "Observaciones": String(params.observaciones || "").trim(),
    }));
    return { ok: true, id };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

function actualizarEquipo_(params) {
  const { sheet, headers } = ensureSheet_(SHEET_EQUIPOS, COLS_EQUIPOS);
  const id = String(params.codigo || params.id || "").trim();
  if (!id) return { ok: false, error: "Falta el código del equipo." };
  const rowNum = findRowByKey_(sheet, headers.indexOf("Codigo") + 1, id);
  if (rowNum === -1) return { ok: false, error: `Equipo "${id}" no encontrado.` };

  const col = colIndexMap_(headers, COLS_EQUIPOS);
  const setIf = (campo, key) => {
    if (params[key] !== undefined && col[campo])
      sheet.getRange(rowNum, col[campo]).setValue(String(params[key]));
  };
  setIf("Tipo", "tipo"); setIf("Marca", "marca"); setIf("Modelo", "modelo");
  setIf("N Serie", "serie"); setIf("Area", "area"); setIf("Ubicacion", "ubicacion");
  setIf("Estado", "estado"); setIf("Observaciones", "observaciones");
  if (params.asignado !== undefined && col["Asignado a"]) {
    const prev = String(sheet.getRange(rowNum, col["Asignado a"]).getValue() || "").trim();
    const nuevo = String(params.asignado).trim();
    sheet.getRange(rowNum, col["Asignado a"]).setValue(nuevo);
    if (nuevo && nuevo !== prev) sheet.getRange(rowNum, col["Fecha asignacion"]).setValue(new Date());
  }
  return { ok: true, id };
}

// ════════════════════════════════════════════════════════
// REGISTRO DE CELULARES (inventario de líneas/equipos móviles)
// ════════════════════════════════════════════════════════
function listCelulares_() {
  const { sheet } = ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
  return sheetToObjects_(sheet);
}

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

// ════════════════════════════════════════════════════════
// TAREAS + CATÁLOGO PARAMETRIZADO
// ════════════════════════════════════════════════════════
function listCatalogoTareas_() {
  const { sheet } = ensureSheet_(SHEET_CATALOGO, COLS_CATALOGO);
  return sheetToObjects_(sheet);
}

function crearCatalogoTarea_(params) {
  const { sheet, headers } = ensureSheet_(SHEET_CATALOGO, COLS_CATALOGO);
  const nombre = String(params.nombre || "").trim();
  if (!nombre) return { ok: false, error: "El nombre de la tarea es obligatorio." };
  const id = nextSeqId_(sheet, headers.indexOf("ID") + 1, "CAT");
  sheet.appendRow(rowFromMap_(headers, {
    "ID": id, "Nombre": nombre, "Descripcion": String(params.descripcion || "").trim(),
    "Categoria": String(params.categoria || "").trim(),
    "Duracion estimada (h)": String(params.duracion || "").trim(),
    "Rol sugerido": String(params.rol || "").trim(), "Activo": String(params.activo || "Sí").trim(),
  }));
  return { ok: true, id };
}

function listTareas_(params) {
  const { sheet } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
  let rows = sheetToObjects_(sheet);
  const asignado = String((params && params.asignado) || "").trim().toLowerCase();
  if (asignado) rows = rows.filter(t => String(t["Asignado a"] || "").trim().toLowerCase() === asignado);
  return rows;
}

function crearTarea_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { sheet, headers } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
    const titulo = String(params.titulo || "").trim();
    const asignadoA = String(params.asignado || "").trim();
    if (!titulo) return { ok: false, error: "El título de la tarea es obligatorio." };
    if (!asignadoA) return { ok: false, error: "Debes asignar la tarea a una persona." };

    const id = nextSeqId_(sheet, headers.indexOf("ID") + 1, "TAR");
    sheet.appendRow(rowFromMap_(headers, {
      "ID": id, "Titulo": titulo, "Descripcion": String(params.descripcion || "").trim(),
      "Tipo": String(params.tipo || "").trim(), "Asignado a": asignadoA,
      "Asignado por": String(params.asignadoPor || "").trim(),
      "Estado": String(params.estado || "Pendiente").trim(),
      "Prioridad": String(params.prioridad || "Media").trim(),
      "Fecha inicio": String(params.fechaInicio || "").trim(),
      "Fecha limite": String(params.fechaLimite || "").trim(),
      "Ticket relacionado": String(params.ticket || "").trim(),
      "Fecha completada": "", "En calendario": "No", "Event ID": "",
    }));

    // Integración futura con Google Calendar (solo si está habilitada).
    if (params.agendar === "true" || params.agendar === true) {
      const r = agendarTarea_({ id, titulo, descripcion: params.descripcion,
        fechaInicio: params.fechaInicio, fechaLimite: params.fechaLimite });
      if (r && r.ok) {
        const rowNum = findRowByKey_(sheet, headers.indexOf("ID") + 1, id);
        const col = colIndexMap_(headers, ["En calendario", "Event ID"]);
        if (rowNum !== -1) {
          sheet.getRange(rowNum, col["En calendario"]).setValue("Sí");
          sheet.getRange(rowNum, col["Event ID"]).setValue(r.eventId || "");
        }
      }
    }
    return { ok: true, id };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

function actualizarTarea_(params) {
  const { sheet, headers } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
  const id = String(params.id || "").trim();
  if (!id) return { ok: false, error: "Falta el ID de la tarea." };
  const rowNum = findRowByKey_(sheet, headers.indexOf("ID") + 1, id);
  if (rowNum === -1) return { ok: false, error: `Tarea "${id}" no encontrada.` };

  const col = colIndexMap_(headers, COLS_TAREAS);
  const setIf = (campo, key) => {
    if (params[key] !== undefined && col[campo])
      sheet.getRange(rowNum, col[campo]).setValue(String(params[key]));
  };
  setIf("Titulo", "titulo"); setIf("Descripcion", "descripcion"); setIf("Tipo", "tipo");
  setIf("Asignado a", "asignado"); setIf("Prioridad", "prioridad");
  setIf("Fecha inicio", "fechaInicio"); setIf("Fecha limite", "fechaLimite");
  setIf("Ticket relacionado", "ticket");

  if (params.estado !== undefined && col["Estado"]) {
    const nuevo = String(params.estado).trim();
    sheet.getRange(rowNum, col["Estado"]).setValue(nuevo);
    if (nuevo.toLowerCase() === "completada" && col["Fecha completada"])
      sheet.getRange(rowNum, col["Fecha completada"]).setValue(new Date());
  }
  return { ok: true, id };
}

// ════════════════════════════════════════════════════════
// GOOGLE CALENDAR (preparado para el futuro)
// ════════════════════════════════════════════════════════
/**
 * Crea un evento en Google Calendar para una tarea.
 * Desactivado por defecto: requiere Script Property CALENDAR_ENABLED = "true".
 * Devuelve { ok, eventId } o { ok:false, error }.
 */
function agendarTarea_(tarea) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty("CALENDAR_ENABLED") !== "true")
      return { ok: false, error: "Calendario no habilitado (CALENDAR_ENABLED != true)." };

    const calId = props.getProperty("CALENDAR_ID");
    const cal = calId ? CalendarApp.getCalendarById(calId) : CalendarApp.getDefaultCalendar();
    if (!cal) return { ok: false, error: "Calendario no encontrado." };

    const inicio = parseLocalDateTime_(tarea.fechaInicio) || parseLocalDateTime_(tarea.fechaLimite) || new Date();
    const fin    = parseLocalDateTime_(tarea.fechaLimite) || new Date(inicio.getTime() + 60 * 60 * 1000);
    const ev = cal.createEvent(`[Tarea ${tarea.id}] ${tarea.titulo}`, inicio, fin,
      { description: tarea.descripcion || "" });
    return { ok: true, eventId: ev.getId() };
  } catch (err) {
    console.error("[agendarTarea]", err);
    return { ok: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════
function doGet(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const callback = p.callback || null;
  const action = String(p.action || "tickets");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    // Gate de autorización: las acciones de escritura y la lista de usuarios
    // exigen un token de sesión válido (emitido en login) y el rol adecuado.
    // login, config y las demás lecturas son públicas.
    if (Object.prototype.hasOwnProperty.call(AUTHZ, action)) {
      const auth = requireAuth_(p, AUTHZ[action]);
      if (auth.fail) return jsonOutput_(auth.fail, callback);
      p._sess = auth.sess;
    }

    switch (action) {
      // ── Config / parámetros ──
      case "config":
        ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
        ensureHistorialSheet_();
        return jsonOutput_(buildConfigPayload_(), callback);

      // ── Tickets ──
      case "create":       return jsonOutput_(createTicket_(p), callback);
      case "update":       return jsonOutput_(updateTicket_(p), callback);
      case "tomarTicket":  return jsonOutput_(tomarTicket_(p), callback);
      case "uploadEvidencia": return jsonOutput_(uploadEvidencia_(p), callback);
      case "historial": {
        const sheet = ss.getSheetByName(SHEET_HISTORIAL) || ensureHistorialSheet_();
        return jsonOutput_(sheetToObjects_(sheet), callback);
      }

      // ── Usuarios / login ──
      case "login":             return jsonOutput_(login_(p), callback);
      case "usuarios":          return jsonOutput_(listUsuarios_(), callback);
      case "crearUsuario":      return jsonOutput_(crearUsuario_(p), callback);
      case "actualizarUsuario": return jsonOutput_(actualizarUsuario_(p), callback);

      // ── Equipos (inventario) ──
      case "equipos":           return jsonOutput_(listEquipos_(), callback);
      case "crearEquipo":       return jsonOutput_(crearEquipo_(p), callback);
      case "actualizarEquipo":  return jsonOutput_(actualizarEquipo_(p), callback);

      // ── Celulares (inventario móvil) ──
      case "celulares":         return jsonOutput_(listCelulares_(), callback);
      case "crearCelular":      return jsonOutput_(crearCelular_(p), callback);
      case "actualizarCelular": return jsonOutput_(actualizarCelular_(p), callback);

      // ── Tareas + catálogo ──
      case "tareas":            return jsonOutput_(listTareas_(p), callback);
      case "crearTarea":        return jsonOutput_(crearTarea_(p), callback);
      case "actualizarTarea":   return jsonOutput_(actualizarTarea_(p), callback);
      case "catalogo":          return jsonOutput_(listCatalogoTareas_(), callback);
      case "crearCatalogoTarea": return jsonOutput_(crearCatalogoTarea_(p), callback);

      // ── Default: todos los tickets ──
      default: {
        const sheet = ss.getSheetByName(SHEET_TICKETS);
        if (!sheet) return jsonOutput_({ status: "error", message: `No existe la hoja "${SHEET_TICKETS}"` }, callback);
        return jsonOutput_(sheetToObjects_(sheet), callback);
      }
    }
  } catch (err) {
    console.error("[doGet]", err);
    return jsonOutput_({ status: "error", message: err.toString() }, callback);
  }
}

function doPost(e) {
  try {
    // Delegamos en el router GET para que apliquen el mismo gate de autorización y reglas.
    return doGet(e);
  } catch (err) {
    return jsonOutput_({ status: "error", message: String(err) }, null);
  }
}
