/**
 * ============================================================
 * SISTEMA DE TICKETS TI — Google Apps Script v3.0
 * ============================================================
 * NOVEDADES v3:
 * - ensureTicketHeaders_(): crea columnas faltantes AUTOMÁTICAMENTE
 * - ensureHistorialSheet_(): crea hoja HISTORIAL si no existe
 * - Estado "Bloqueado por recursos" para casos de hardware pendiente
 * - Subida de evidencia a Google Drive (configurar DRIVE_FOLDER_ID)
 * - Mejor manejo de errores y logs
 * ============================================================
 *
 * CONFIGURACIÓN INICIAL:
 * 1. En Script Properties agrega:
 *    ADMIN_EMAIL  = tu@email.com
 *    DRIVE_FOLDER_ID = ID de la carpeta en Drive para evidencias
 * 2. Despliega como WebApp: "Acceso: Cualquier persona"
 * ============================================================
 */

// ── NOMBRES DE HOJAS ──────────────────────────────────────
const SHEET_TICKETS   = "TICKETS";
const SHEET_CONFIG    = "Config";
const SHEET_HISTORIAL = "HISTORIAL";

// ── COLUMNAS REQUERIDAS (se crean automáticamente si faltan) ──
const REQUIRED_COLS = [
  "CODIGO",
  "Nombre",
  "Area",
  "Tipo",
  "Titulo del requerimiento",
  "Descripcion",
  "Prioridad",
  "Evidencia",
  "Estado",
  "Fecha de ingreso de ticket",
  "Fecha de cierre",
  "Solucion",
  "Detalle de la solucion",
  "Ultimo cambio de estado",
  "Tecnico asignado",       // ← columna nueva
  "Cambio de estado count", // ← contador de cambios
];

// ── ESTADOS DISPONIBLES ──────────────────────────────────
// NUEVO: "Bloqueado por recursos" para casos como hardware pendiente
const ESTADOS_DEFAULT = [
  "Pendiente",
  "En atención",
  "Bloqueado por recursos",  // ← NUEVO: hardware/presupuesto pendiente
  "Pausado",
  "Bloqueado",               // bloqueado por terceros/dependencia externa
  "Atendido",
  "Anulado",
];

// ── HELPERS ───────────────────────────────────────────────
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
        if (val instanceof Date) {
          o[h] = val.toISOString();
        } else {
          o[h] = val;
        }
      });
      return o;
    });
}

// ── ENSURE TICKET COLUMNS ─────────────────────────────────
/**
 * Verifica y crea las columnas requeridas en la hoja TICKETS.
 * NO elimina ni reordena columnas existentes.
 * Devuelve array de headers actualizado.
 */
function ensureTicketHeaders_(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  let headers = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim())
    : [];

  let colCount = headers.length;
  const added = [];

  REQUIRED_COLS.forEach(required => {
    if (!headers.includes(required)) {
      colCount++;
      sheet.getRange(1, colCount).setValue(required);
      // Dar formato al encabezado nuevo (igual al resto)
      const headerCell = sheet.getRange(1, colCount);
      headerCell.setFontWeight("bold");
      headerCell.setBackground("#111827");
      headerCell.setFontColor("#ffffff");
      headers.push(required);
      added.push(required);
    }
  });

  if (added.length > 0) {
    console.log(`[ensureTicketHeaders] Columnas agregadas: ${added.join(", ")}`);
  }
  return headers;
}

// ── ENSURE HISTORIAL SHEET ────────────────────────────────
function ensureHistorialSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_HISTORIAL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORIAL);
    const headerRange = sheet.getRange(1, 1, 1, 7);
    headerRange.setValues([["Fecha","CODIGO","Estado anterior","Estado nuevo","Solucion","Tecnico","Detalle"]]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#111827");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, 7, 150);
    console.log("[ensureHistorialSheet] Hoja HISTORIAL creada.");
  }
  return sheet;
}

// ── LOG EN HISTORIAL ──────────────────────────────────────
function logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle) {
  try {
    const sheet = ensureHistorialSheet_();
    const tecnico = Session.getEffectiveUser().getEmail() || "sistema";
    sheet.appendRow([new Date(), codigo, oldEstado||"", nuevoEstado, solucion||"", tecnico, detalle||""]);
  } catch(err) {
    console.error("[logHistorial] Error:", err);
  }
}

// ── CONFIG PAYLOAD ────────────────────────────────────────
function buildConfigPayload_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_CONFIG);
  if (!configSheet) return { status:"error", message:`No existe la hoja "${SHEET_CONFIG}"` };

  const rows = sheetToObjects_(configSheet);
  const areas   = [...new Set(rows.map(r => String(r.Area||r["Área"]||"").trim()).filter(Boolean))].sort();
  const tipos   = [...new Set(rows.map(r => String(r.Tipo||"").trim()).filter(Boolean))].sort();
  const prios   = [...new Set(rows.map(r => String(r.Prioridad||"").trim()).filter(Boolean))].sort();
  const estados = ESTADOS_DEFAULT;

  return { status:"success", areas, tipos, prioridades:prios, estados, raw:rows };
}

// ── NEXT CODE ─────────────────────────────────────────────
function prefixFromTipo_(tipo) {
  const t = String(tipo||"").trim().toLowerCase();
  if (t === "requerimiento") return "REQ";
  if (t === "incidencia")    return "INC";
  if (t === "evento")        return "EVE";
  return "REQ";
}

function nextCode_(prefix, sheet, headers) {
  const lastRow = sheet.getLastRow();
  const codeCol = headers.indexOf("CODIGO") + 1;
  if (lastRow < 2 || codeCol === 0) return `${prefix}-001`;

  const normalize = c => String(c||"").trim().replace(/[\u2010-\u2015\u2212]/g,"-");
  const codes = sheet.getRange(2, codeCol, lastRow - 1, 1).getValues().flat().map(normalize);
  const re = new RegExp(`^${prefix}[-](\\d+)$`, "i");
  let max = 0;
  codes.forEach(c => { const m = c.match(re); if (m) { const n = parseInt(m[1]); if (!isNaN(n) && n > max) max = n; } });

  let next = max + 1;
  while (true) {
    const candidate = `${prefix}-${String(next).padStart(3,"0")}`;
    if (!codes.includes(candidate)) return candidate;
    next++;
  }
}

// ── DUPLICATE CHECK ───────────────────────────────────────
function findRecentDuplicate_(sheet, headers, fields, windowSeconds) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const idx = {
    codigo: headers.indexOf("CODIGO"),
    nombre: headers.indexOf("Nombre"),
    area:   headers.indexOf("Area"),
    tipo:   headers.indexOf("Tipo"),
    titulo: headers.indexOf("Titulo del requerimiento"),
    desc:   headers.indexOf("Descripcion"),
    prio:   headers.indexOf("Prioridad"),
    fecha:  headers.indexOf("Fecha de ingreso de ticket"),
  };

  const start = Math.max(2, lastRow - 150 + 1);
  const values = sheet.getRange(start, 1, lastRow - start + 1, headers.length).getValues();
  const now = Date.now(), limitMs = windowSeconds * 1000;
  const norm = s => String(s||"").trim().toLowerCase().replace(/\s+/g," ");

  for (let i = values.length - 1; i >= 0; i--) {
    const row = values[i];
    const d = row[idx.fecha];
    const t = d instanceof Date ? d.getTime() : NaN;
    if (!t || (now - t) > limitMs) continue;
    if (
      norm(row[idx.nombre]) === norm(fields.nombre) &&
      norm(row[idx.area])   === norm(fields.area)   &&
      norm(row[idx.tipo])   === norm(fields.tipo)   &&
      norm(row[idx.titulo]) === norm(fields.titulo) &&
      norm(row[idx.desc])   === norm(fields.descripcion)
    ) return String(row[idx.codigo]||"").trim() || null;
  }
  return null;
}

// ── APPEND TICKET ─────────────────────────────────────────
function appendTicketByHeaders_(sheet, headers, ticket) {
  const row = new Array(headers.length).fill("");
  const map = {
    "CODIGO":                      ticket.codigo,
    "Nombre":                      ticket.nombre,
    "Area":                        ticket.area,
    "Tipo":                        ticket.tipo,
    "Titulo del requerimiento":    ticket.titulo,
    "Descripcion":                 ticket.descripcion,
    "Prioridad":                   ticket.prioridad,
    "Evidencia":                   ticket.evidencia || "",
    "Estado":                      ticket.estado,
    "Fecha de ingreso de ticket":  ticket.fechaIngreso,
    "Fecha de cierre":             "",
    "Solucion":                    "",
    "Detalle de la solucion":      "",
    "Ultimo cambio de estado":     ticket.fechaIngreso,
    "Tecnico asignado":            "",
    "Cambio de estado count":      0,
  };
  headers.forEach((h, i) => { if (Object.prototype.hasOwnProperty.call(map, h)) row[i] = map[h]; });
  sheet.appendRow(row);
}

// ── CREATE TICKET ─────────────────────────────────────────
function createTicket_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
    if (!ticketsSheet) return { status:"error", message:`No existe la hoja "${SHEET_TICKETS}"` };

    // Asegurar columnas y crear historial si faltan
    const headers = ensureTicketHeaders_(ticketsSheet);
    ensureHistorialSheet_();

    const nombre      = String(data.nombre      || data.Nombre || "").trim();
    const area        = String(data.area        || data.Area   || "").trim();
    const tipo        = String(data.tipo        || data.Tipo   || "").trim();
    const titulo      = String(data.titulo      || data["Titulo del requerimiento"] || "").trim();
    const descripcion = String(data.descripcion || data.Descripcion || "").trim();
    const prioridad   = String(data.prioridad   || data.Prioridad   || "").trim();

    const errors = [];
    if (!nombre)      errors.push("nombre");
    if (!area)        errors.push("área");
    if (!tipo)        errors.push("tipo");
    if (!titulo)      errors.push("título");
    if (!descripcion) errors.push("descripción");
    if (!prioridad)   errors.push("prioridad");
    if (errors.length) return { status:"error", message:`Campos requeridos faltantes: ${errors.join(", ")}` };
    if (titulo.length > 200)      return { status:"error", message:"Título demasiado largo (máx 200 caracteres)" };
    if (descripcion.length > 2000) return { status:"error", message:"Descripción demasiado larga (máx 2000 caracteres)" };

    const dup = findRecentDuplicate_(ticketsSheet, headers, { nombre, area, tipo, titulo, descripcion, prioridad }, 90);
    if (dup) return { status:"success", id:dup, usuario:nombre, tipo, titulo, duplicated:true };

    const prefix = prefixFromTipo_(tipo);
    const codigo = nextCode_(prefix, ticketsSheet, headers);
    const ahora  = new Date();

    appendTicketByHeaders_(ticketsSheet, headers, {
      codigo, nombre, area, tipo, titulo, descripcion,
      prioridad, estado:"Pendiente", evidencia:"", fechaIngreso:ahora,
    });

    // Log historial
    logHistorial_(codigo, "", "Pendiente", "", "Ticket creado");

    // Notificación al admin
    try {
      const adminEmail = getAdminEmail_();
      if (adminEmail) {
        MailApp.sendEmail(adminEmail,
          `[${codigo}] Nuevo ticket — ${tipo}: ${titulo}`,
          `Ticket: ${codigo}\nUsuario: ${nombre}\nÁrea: ${area}\nTipo: ${tipo}\nPrioridad: ${prioridad}\n\nTítulo: ${titulo}\n\nDescripción:\n${descripcion}`
        );
      }
    } catch(mailErr) { console.warn("[createTicket] Email falló:", mailErr); }

    return { status:"success", id:codigo, usuario:nombre, tipo, titulo };
  } catch(err) {
    console.error("[createTicket] Error:", err);
    return { status:"error", message:`Error interno: ${err.message}` };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

// ── PARSE DATE ────────────────────────────────────────────
function parseLocalDateTime_(value) {
  const s = String(value||"").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3], +m[4]||0, +m[5]||0, +m[6]||0);
}

// ── UPDATE TICKET ─────────────────────────────────────────
function updateTicket_(params) {
  const codigo       = String(params.codigo||"").trim();
  const nuevoEstado  = String(params.estado||"").trim();
  const solucion     = String(params.solucion||"").trim();
  const detalle      = String(params.detalle||"").trim();
  const tecnico      = String(params.tecnico||"").trim();
  const fechaRaw     = String(params.fechaCierre||params.fecha_cierre||"").trim();

  if (!codigo) return { ok:false, error:"Falta el código del ticket." };
  if (!nuevoEstado) return { ok:false, error:"Falta el nuevo estado." };

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_TICKETS);
  if (!sheet) return { ok:false, error:`No existe la hoja "${SHEET_TICKETS}"` };

  const headers = ensureTicketHeaders_(sheet);

  // Índices de columnas (1-based)
  const col = {};
  ["CODIGO","Nombre","Area","Estado","Fecha de cierre","Solucion",
   "Detalle de la solucion","Ultimo cambio de estado","Tecnico asignado",
   "Cambio de estado count"].forEach(h => {
    col[h] = headers.indexOf(h) + 1;
  });

  if (!col["CODIGO"] || !col["Estado"])
    return { ok:false, error:"Estructura de hoja incorrecta." };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok:false, error:"No hay tickets registrados." };

  const codes = sheet.getRange(2, col["CODIGO"], lastRow-1, 1).getValues().map(r=>String(r[0]).trim());
  const idx = codes.findIndex(c => c === codigo);
  if (idx === -1) return { ok:false, error:`Ticket "${codigo}" no encontrado.` };
  const rowNum = idx + 2;

  const oldEstado = String(sheet.getRange(rowNum, col["Estado"]).getValue()||"").trim();
  const changed = oldEstado !== nuevoEstado;

  // Actualizar campos
  sheet.getRange(rowNum, col["Estado"]).setValue(nuevoEstado);
  if (col["Solucion"])              sheet.getRange(rowNum, col["Solucion"]).setValue(solucion);
  if (col["Detalle de la solucion"]) sheet.getRange(rowNum, col["Detalle de la solucion"]).setValue(detalle);
  if (col["Ultimo cambio de estado"]) sheet.getRange(rowNum, col["Ultimo cambio de estado"]).setValue(new Date());
  if (col["Tecnico asignado"] && tecnico) sheet.getRange(rowNum, col["Tecnico asignado"]).setValue(tecnico);

  // Incrementar contador de cambios
  if (col["Cambio de estado count"]) {
    const current = parseInt(sheet.getRange(rowNum, col["Cambio de estado count"]).getValue()||"0") || 0;
    sheet.getRange(rowNum, col["Cambio de estado count"]).setValue(current + 1);
  }

  // Fecha de cierre solo para estados cerrados
  const esCierre = ["atendido","anulado"].includes(nuevoEstado.toLowerCase());
  if (col["Fecha de cierre"] && esCierre) {
    const fechaCierre = fechaRaw ? parseLocalDateTime_(fechaRaw) : new Date();
    sheet.getRange(rowNum, col["Fecha de cierre"]).setValue(fechaCierre || new Date());
  }

  // Log en historial
  if (changed) logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle);

  // Email al usuario (solo Atendido)
  if (changed && nuevoEstado.toLowerCase() === "atendido") {
    try {
      const nombre = col["Nombre"] ? String(sheet.getRange(rowNum, col["Nombre"]).getValue()||"") : "";
      const area   = col["Area"]   ? String(sheet.getRange(rowNum, col["Area"]).getValue()||"")   : "";
      const email  = findEmailForUser_(area.trim(), nombre.trim());
      if (email) sendStatusEmail_(email, { codigo, nombre, area, nuevoEstado, oldEstado, solucion, detalle });
    } catch(mailErr) { console.warn("[updateTicket] Email falló:", mailErr); }
  }

  return { ok:true, codigo, oldEstado, nuevoEstado, timestamp:new Date().toISOString() };
}

// ── UPLOAD EVIDENCIA ──────────────────────────────────────
/**
 * Sube una imagen a Google Drive y guarda el enlace en el ticket.
 *
 * CONFIGURACIÓN:
 * 1. Crear carpeta en Google Drive → "Evidencias Tickets TI"
 * 2. Clic derecho → Compartir → "Cualquiera con el enlace" (solo ver)
 * 3. Copiar el ID de la URL: drive.google.com/drive/folders/[ESTE_ES_EL_ID]
 * 4. Script Properties → DRIVE_FOLDER_ID = [el ID]
 */
function uploadEvidencia_(params) {
  const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) {
    return { ok:false, error:"DRIVE_FOLDER_ID no configurado en Script Properties. Sigue las instrucciones en INSTRUCCIONES-EVIDENCIA.md" };
  }

  const base64   = String(params.imageData||"");
  const mimeType = String(params.mimeType||"image/jpeg");
  const codigo   = String(params.codigo||"SIN-CODIGO");
  const ext      = mimeType.includes("png")?"png":mimeType.includes("gif")?"gif":mimeType.includes("webp")?"webp":"jpg";
  const fileName = `evidencia_${codigo}_${Date.now()}.${ext}`;

  if (!base64)           return { ok:false, error:"No se recibió la imagen." };
  if (base64.length > 6*1024*1024) return { ok:false, error:"Imagen demasiado grande (máx 5MB)." };

  try {
    const folder  = DriveApp.getFolderById(folderId);
    const decoded = Utilities.base64Decode(base64);
    const blob    = Utilities.newBlob(decoded, mimeType, fileName);
    const file    = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId   = file.getId();
    const viewUrl  = `https://drive.google.com/file/d/${fileId}/view`;
    const directUrl= `https://lh3.googleusercontent.com/d/${fileId}`;

    // Guardar URL en columna Evidencia del ticket
    if (codigo !== "SIN-CODIGO") {
      const ss = SpreadsheetApp.getActive();
      const sheet = ss.getSheetByName(SHEET_TICKETS);
      if (sheet) {
        const headers = ensureTicketHeaders_(sheet);
        const codCol  = headers.indexOf("CODIGO")    + 1;
        const evidCol = headers.indexOf("Evidencia") + 1;
        if (codCol && evidCol) {
          const lastRow = sheet.getLastRow();
          const codes = sheet.getRange(2, codCol, lastRow-1, 1).getValues().flat().map(c=>String(c).trim());
          const idx = codes.findIndex(c => c === codigo);
          if (idx !== -1) sheet.getRange(idx+2, evidCol).setValue(viewUrl);
        }
      }
    }

    return { ok:true, viewUrl, directUrl, fileName };
  } catch(err) {
    console.error("[uploadEvidencia] Error:", err);
    return { ok:false, error:`Error al subir imagen: ${err.message}` };
  }
}

// ── EMAIL HELPERS ─────────────────────────────────────────
function findEmailForUser_(area, nombre) {
  const ss = SpreadsheetApp.getActive();
  const cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg) return "";
  const values  = cfg.getDataRange().getValues();
  if (values.length < 2) return "";
  const headers = values[0].map(h => String(h).trim());
  const iArea   = headers.indexOf("Area");
  const iUser   = headers.indexOf("Usuario");
  const iEmail  = headers.indexOf("Email");
  if (iEmail === -1 || iUser === -1) return "";

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const ra  = iArea >= 0 ? String(row[iArea]||"").trim() : "";
    const ru  = String(row[iUser]||"").trim();
    const re  = String(row[iEmail]||"").trim();
    if (!re) continue;
    if (ra === area && ru === nombre) return re;
  }
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const ru = String(row[iUser]||"").trim();
    const re = String(row[iEmail]||"").trim();
    if (ru === nombre && re) return re;
  }
  return "";
}

function sendStatusEmail_(toEmail, info) {
  try {
    MailApp.sendEmail(
      toEmail,
      `[Tickets TI] ${info.codigo} — ${info.nuevoEstado}`,
      `Hola ${info.nombre||""},\n\nTu ticket ${info.codigo} ha sido ATENDIDO.\n\nSolución: ${info.solucion||"—"}\nDetalle: ${info.detalle||"—"}\n\nGracias por usar el sistema de Tickets TI.`
    );
  } catch(err) { console.error("[sendStatusEmail] Error:", err); }
}

// ── doGet ─────────────────────────────────────────────────
function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : null;
  const action   = e && e.parameter ? String(e.parameter.action||"tickets") : "tickets";

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "config") {
      // También asegurar estructura al consultar config
      const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
      if (ticketsSheet) ensureTicketHeaders_(ticketsSheet);
      ensureHistorialSheet_();
      return jsonOutput_(buildConfigPayload_(), callback);
    }

    if (action === "create") return jsonOutput_(createTicket_(e.parameter||{}), callback);
    if (action === "update") return jsonOutput_(updateTicket_(e.parameter||{}), callback);

    if (action === "historial") {
      const sheet = ss.getSheetByName(SHEET_HISTORIAL) || ensureHistorialSheet_();
      return jsonOutput_(sheetToObjects_(sheet), callback);
    }

    if (action === "uploadEvidencia") return jsonOutput_(uploadEvidencia_(e.parameter||{}), callback);

    // Default: devolver todos los tickets
    const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
    if (!ticketsSheet) return jsonOutput_({ status:"error", message:`No existe la hoja "${SHEET_TICKETS}"` }, callback);
    return jsonOutput_(sheetToObjects_(ticketsSheet), callback);

  } catch(err) {
    console.error("[doGet] Error:", err);
    return jsonOutput_({ status:"error", message:err.toString() }, callback);
  }
}

function doPost(e) {
  try {
    const data = e && e.parameter ? e.parameter : {};
    return jsonOutput_(createTicket_(data), null);
  } catch(err) {
    return jsonOutput_({ status:"error", message:String(err) }, null);
  }
}
