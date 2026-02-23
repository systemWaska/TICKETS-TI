/**
 * ============================================================
 * Sistema de Tickets TI - Backend (Google Apps Script) v2.0
 * ============================================================
 * MEJORAS:
 * - Hoja HISTORIAL: registra cada cambio de estado con fecha/hora
 * - Columna "Evidencia" gestionada automáticamente
 * - Columna "Tecnico asignado" para saber quién atiende
 * - ensureHistorialHeaders_() crea la hoja si no existe
 * - Subida de imagen desde Drive (endpoint action=uploadEvidencia)
 * ============================================================
 */

const SHEET_TICKETS  = "TICKETS";
const SHEET_CONFIG   = "Config";
const SHEET_HISTORIAL= "HISTORIAL";  // ← NUEVA

// ── ADMIN EMAIL ──────────────────────────────────────────
function getAdminEmail_() {
  const prop = PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL");
  return prop || Session.getEffectiveUser().getEmail();
}

// ── JSONP HELPER ─────────────────────────────────────────
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

// ── SHEET TO OBJECTS ─────────────────────────────────────
function sheetToObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .filter(row => row.some(c => c !== "" && c !== null))
    .map(row => {
      const o = {};
      headers.forEach((h, i) => {
        let value = row[i];
        if (value instanceof Date) {
          o[h] = value.toISOString();
        } else {
          o[h] = value;
          if (h === "Area" || h === "Área") o.area = value;
          if (h === "Titulo del requerimiento" || h === "Título del requerimiento") o.titulo = value;
          if (h === "Descripcion" || h === "Descripción") o.descripcion = value;
          if (h === "Detalle de la solucion" || h === "Detalle de la solución") o.detalleSolucion = value;
        }
      });
      return o;
    });
}

// ── CONFIG PAYLOAD ────────────────────────────────────────
function buildConfigPayload_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_CONFIG);
  if (!configSheet) return { status: "error", message: `No existe la hoja ${SHEET_CONFIG}` };
  const rows = sheetToObjects_(configSheet);
  const areas      = [...new Set(rows.map(r => String(r.Area||r["Área"]||r.area||"").trim()).filter(Boolean))].sort();
  const usuarios   = [...new Set(rows.map(r => String(r.Usuario||r.usuario||"").trim()).filter(Boolean))].sort();
  const tiposFS    = rows.map(r => String(r.Tipo||r.tipo||"").trim()).filter(Boolean);
  const tipos      = tiposFS.length ? [...new Set(tiposFS)].sort() : ["Incidencia","Requerimiento","Evento"];
  const prioFS     = rows.map(r => String(r.Prioridad||r.prioridad||"").trim()).filter(Boolean);
  const prioridades= prioFS.length ? [...new Set(prioFS)].sort() : ["Baja","Media","Alta"];
  const estadosFS  = rows.map(r => String(r.Estado||r.estado||"").trim()).filter(Boolean);
  const estados    = estadosFS.length ? [...new Set(estadosFS)].sort() : ["Pendiente","En atención","Pausado","Bloqueado","Atendido","Anulado"];
  return { status:"success", areas, usuarios, tipos, prioridades, estados, raw: rows };
}

// ── PREFIX ────────────────────────────────────────────────
function prefixFromTipo_(tipo) {
  const t = String(tipo||"").trim().toLowerCase();
  if (t==="requerimiento") return "REQ";
  if (t==="incidencia")   return "INC";
  if (t==="evento")       return "EVE";
  return "REQ";
}

// ── NEXT CODE ─────────────────────────────────────────────
function nextCode_(prefix, ticketsSheet) {
  const lastRow = ticketsSheet.getLastRow();
  if (lastRow < 2) return `${prefix}-001`;
  const headers = ticketsSheet.getRange(1,1,1,ticketsSheet.getLastColumn()).getValues()[0].map(h=>String(h).trim());
  const codeCol = headers.findIndex(h=>h.toUpperCase()==="CODIGO");
  const col = codeCol >= 0 ? codeCol+1 : 1;
  const normalizeCode = c => String(c||"").trim().replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g,"-").replace(/\s+/g,"");
  const codes = ticketsSheet.getRange(2,col,lastRow-1,1).getValues().flat().map(normalizeCode);
  const re = new RegExp("^"+prefix+"[-](\\d+)$","i");
  let max = 0;
  codes.forEach(c=>{ const m=c.match(re); if(m&&m[1]){const n=parseInt(m[1]);if(!isNaN(n)&&n>max)max=n;}});
  let next = max+1;
  while (true) {
    const candidate = `${prefix}-${String(next).padStart(3,"0")}`;
    if (!codes.includes(candidate)) return candidate;
    next++;
  }
}

// ── ENSURE TICKET HEADERS ─────────────────────────────────
// Agrega columnas faltantes automáticamente sin romper las existentes
function ensureTicketHeaders_(sheet) {
  const required = [
    "CODIGO","Nombre","Area","Tipo","Titulo del requerimiento",
    "Descripcion","Prioridad","Evidencia","Estado",
    "Fecha de ingreso de ticket","Fecha de cierre",
    "Solucion","Detalle de la solucion","Ultimo cambio de estado",
    "Tecnico asignado"  // ← NUEVA columna
  ];
  const lastCol = Math.max(1, sheet.getLastColumn());
  let headers = sheet.getRange(1,1,1,lastCol).getValues()[0].map(h=>String(h).trim());
  let colCount = headers.length;
  required.forEach(h => {
    if (!headers.includes(h)) {
      colCount++;
      sheet.getRange(1,colCount).setValue(h);
      headers.push(h);
    }
  });
  return headers;
}

// ── ENSURE HISTORIAL SHEET ────────────────────────────────
function ensureHistorialSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_HISTORIAL);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_HISTORIAL);
    // Encabezados del historial
    sheet.getRange(1,1,1,7).setValues([[
      "Fecha","CODIGO","Estado anterior","Estado nuevo","Solucion","Tecnico","Detalle"
    ]]);
    // Formato del encabezado
    const headerRange = sheet.getRange(1,1,1,7);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#111827");
    headerRange.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1,150);
    sheet.setColumnWidth(2,90);
    sheet.setColumnWidth(6,180);
    sheet.setColumnWidth(7,250);
    console.log("[ensureHistorialSheet] Hoja HISTORIAL creada.");
  }
  return sheet;
}

// ── LOG EN HISTORIAL ──────────────────────────────────────
function logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle) {
  try {
    const sheet = ensureHistorialSheet_();
    const tecnico = Session.getEffectiveUser().getEmail() || "sistema";
    sheet.appendRow([
      new Date(),   // Fecha
      codigo,       // CODIGO
      oldEstado,    // Estado anterior
      nuevoEstado,  // Estado nuevo
      solucion||"", // Solucion
      tecnico,      // Técnico que cambió
      detalle||""   // Detalle
    ]);
  } catch(err) {
    console.error("[logHistorial] Error:", err);
  }
}

// ── APPEND TICKET ─────────────────────────────────────────
function appendTicketByHeaders_(sheet, ticket) {
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>String(h).trim());
  const row = new Array(headers.length).fill("");
  const map = {
    "CODIGO": ticket.codigo,
    "Nombre": ticket.nombre,
    "Area": ticket.area,
    "Tipo": ticket.tipo,
    "Titulo del requerimiento": ticket.titulo,
    "Descripcion": ticket.descripcion,
    "Prioridad": ticket.prioridad,
    "Evidencia": ticket.evidencia,
    "Estado": ticket.estado,
    "Fecha de ingreso de ticket": ticket.fechaIngreso,
    "Fecha de cierre": ticket.fechaCierre,
    "Solucion": ticket.solucion,
    "Detalle de la solucion": ticket.detalleSolucion,
    "Tecnico asignado": ticket.tecnico || ""
  };
  headers.forEach((h,idx) => { if (Object.prototype.hasOwnProperty.call(map,h)) row[idx]=map[h]; });
  sheet.appendRow(row);
}

// ── DUPLICATE CHECK ───────────────────────────────────────
function findRecentDuplicate_(sheet, fields, windowSeconds) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const start = Math.max(2, lastRow-100+1);
  const range = sheet.getRange(start,1,lastRow-start+1,sheet.getLastColumn());
  const values = range.getValues();
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>String(h).trim());
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
  if (Object.values(idx).some(v=>v===-1)) return null;
  const now = Date.now(), limitMs = windowSeconds*1000;
  const normalize = str => String(str||"").trim().toLowerCase().replace(/\s+/g," ");
  for (let i=values.length-1;i>=0;i--) {
    const row = values[i];
    const d = row[idx.fecha];
    const t = (d instanceof Date) ? d.getTime() : NaN;
    if (!t||(now-t)>limitMs) continue;
    if (
      normalize(row[idx.nombre])===normalize(fields.nombre) &&
      normalize(row[idx.area])===normalize(fields.area) &&
      normalize(row[idx.tipo])===normalize(fields.tipo) &&
      normalize(row[idx.titulo])===normalize(fields.titulo) &&
      normalize(row[idx.desc])===normalize(fields.descripcion) &&
      normalize(row[idx.prio])===normalize(fields.prioridad)
    ) return String(row[idx.codigo]||"").trim()||null;
  }
  return null;
}

// ── CREATE TICKET ─────────────────────────────────────────
function createTicket_(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
    if (!ticketsSheet) return { status:"error", message:"No existe la hoja TICKETS" };
    ensureTicketHeaders_(ticketsSheet);
    ensureHistorialSheet_(); // Asegurar que historial exista desde el inicio
    const nombre    = String(data.nombre||data.Nombre||"").trim();
    const area      = String(data.area||data.Area||"").trim();
    const tipo      = String(data.tipo||data.Tipo||"").trim();
    const titulo    = String(data.titulo||data["Titulo del requerimiento"]||"").trim();
    const descripcion = String(data.descripcion||data["Descripcion"]||"").trim();
    const prioridad = String(data.prioridad||data.Prioridad||"").trim();
    const errors = [];
    if (!nombre)    errors.push("nombre");
    if (!area)      errors.push("área");
    if (!tipo)      errors.push("tipo");
    if (!titulo)    errors.push("título");
    if (!descripcion) errors.push("descripción");
    if (!prioridad) errors.push("prioridad");
    if (errors.length) return { status:"error", message:`Faltan campos: ${errors.join(", ")}` };
    if (titulo.length > 200) return { status:"error", message:"El título es demasiado largo (máx. 200 caracteres)" };
    if (descripcion.length > 2000) return { status:"error", message:"La descripción es demasiado larga (máx. 2000 caracteres)" };
    const dup = findRecentDuplicate_(ticketsSheet, { nombre, area, tipo, titulo, descripcion, prioridad }, 90);
    if (dup) return { status:"success", id:dup, usuario:nombre, tipo, titulo, duplicated:true };
    const prefix = prefixFromTipo_(tipo);
    const code   = nextCode_(prefix, ticketsSheet);
    const ticket = {
      codigo:codigo=code, nombre, area, tipo, titulo, descripcion,
      solucion:"", detalleSolucion:"", prioridad, evidencia:"",
      estado:"Pendiente", fechaIngreso:new Date(), fechaCierre:"", tecnico:""
    };
    appendTicketByHeaders_(ticketsSheet, ticket);
    // Log en historial
    logHistorial_(code, "", "Pendiente", "", "Ticket creado");
    // Notificación admin
    const adminEmail = getAdminEmail_();
    if (adminEmail) {
      const subject = `[${code}] Nuevo ticket (${tipo})`;
      const body = `Nuevo ticket registrado:\n\nCódigo: ${code}\nUsuario: ${nombre}\nÁrea: ${area}\nTipo: ${tipo}\nPrioridad: ${prioridad}\nTítulo: ${titulo}\nDescripción: ${descripcion}\nEstado: Pendiente\n`;
      MailApp.sendEmail(adminEmail, subject, body);
    }
    return { status:"success", id:code, usuario:nombre, tipo, titulo };
  } catch (err) {
    console.error("[createTicket] Error:", err);
    return { status:"error", message:"Error interno al crear ticket" };
  } finally {
    try { lock.releaseLock(); } catch(_) {}
  }
}

// ── PARSE DATE ────────────────────────────────────────────
function parseLocalDateTime_(value) {
  const s = String(value||'').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0));
}

// ── UPDATE TICKET ─────────────────────────────────────────
function updateTicket_(params) {
  const codigo       = String(params.codigo||"").trim();
  const nuevoEstado  = String(params.estado||"").trim();
  const solucion     = String(params.solucion||"").trim();
  const detalle      = String(params.detalle||params.detalle_solucion||"").trim();
  const tecnico      = String(params.tecnico||"").trim();
  const fechaCierreStr = String(params.fecha_cierre||params.fechaCierre||"").trim();
  const fechaCierreManual = fechaCierreStr ? parseLocalDateTime_(fechaCierreStr) : null;

  if (!codigo) return { ok:false, error:"Falta CODIGO." };
  if (!nuevoEstado) return { ok:false, error:"Falta estado." };

  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(SHEET_TICKETS);
  if (!sheet) return { ok:false, error:`No existe la hoja ${SHEET_TICKETS}.` };

  ensureTicketHeaders_(sheet);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>String(h).trim());
  const col = {
    codigo:      headers.indexOf("CODIGO")+1,
    area:        headers.indexOf("Area")+1,
    nombre:      headers.indexOf("Nombre")+1,
    estado:      headers.indexOf("Estado")+1,
    fechaCierre: headers.indexOf("Fecha de cierre")+1,
    solucion:    headers.indexOf("Solucion")+1,
    detalle:     headers.indexOf("Detalle de la solucion")+1,
    ultimoCambio:headers.indexOf("Ultimo cambio de estado")+1,
    tecnico:     headers.indexOf("Tecnico asignado")+1,
  };
  if (!col.codigo || !col.estado) return { ok:false, error:"Headers incompletos." };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok:false, error:"No hay tickets." };
  const codes = sheet.getRange(2,col.codigo,lastRow-1,1).getValues().map(r=>String(r[0]).trim());
  const idx = codes.findIndex(c=>c===codigo);
  if (idx===-1) return { ok:false, error:`Ticket ${codigo} no encontrado.` };
  const rowNum = idx+2;

  const oldEstado = String(sheet.getRange(rowNum,col.estado).getValue()||"").trim();
  const changed   = oldEstado !== nuevoEstado;

  sheet.getRange(rowNum,col.estado).setValue(nuevoEstado);
  if (col.solucion)     sheet.getRange(rowNum,col.solucion).setValue(solucion);
  if (col.detalle)      sheet.getRange(rowNum,col.detalle).setValue(detalle);
  if (col.ultimoCambio) sheet.getRange(rowNum,col.ultimoCambio).setValue(new Date());
  if (col.tecnico && tecnico) sheet.getRange(rowNum,col.tecnico).setValue(tecnico);

  const cierre = ["atendido","anulado"].includes(nuevoEstado.toLowerCase());
  if (col.fechaCierre && cierre) {
    sheet.getRange(rowNum,col.fechaCierre).setValue(fechaCierreManual||new Date());
  }

  // ── REGISTRAR EN HISTORIAL ──
  if (changed) logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle);

  // ── EMAIL AL USUARIO (solo si pasa a Atendido) ──
  if (changed && nuevoEstado.toLowerCase()==="atendido") {
    const area   = col.area   ? String(sheet.getRange(rowNum,col.area).getValue()||"").trim()   : "";
    const nombre = col.nombre ? String(sheet.getRange(rowNum,col.nombre).getValue()||"").trim() : "";
    const email  = findEmailForUser_(area, nombre);
    if (email) sendStatusEmail_(email, { codigo, area, nombre, nuevoEstado, oldEstado, solucion, detalle });
  }

  return { ok:true, codigo, oldEstado, nuevoEstado, timestamp:new Date().toISOString() };
}

// ── UPLOAD EVIDENCIA (Drive) ──────────────────────────────
/**
 * Recibe base64 de imagen, la sube a una carpeta en Drive,
 * devuelve la URL pública del archivo.
 *
 * Para habilitar: crea una carpeta en Drive → comparte con "cualquiera con el enlace" (solo ver)
 * → copia el ID de la carpeta → ponlo en Script Properties: DRIVE_FOLDER_ID = <id>
 */
function uploadEvidencia_(params) {
  const folderId  = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) return { ok:false, error:"DRIVE_FOLDER_ID no configurado en Script Properties." };

  const base64    = String(params.imageData||"");
  const mimeType  = String(params.mimeType||"image/jpeg");
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : "jpg";
  const codigo    = String(params.codigo||"SIN-CODIGO");
  const fileName  = `evidencia_${codigo}_${Date.now()}.${extension}`;

  if (!base64) return { ok:false, error:"No se recibió imageData." };
  if (base64.length > 5*1024*1024) return { ok:false, error:"Imagen demasiado grande (máx 5MB)." };

  try {
    const folder   = DriveApp.getFolderById(folderId);
    const decoded  = Utilities.base64Decode(base64);
    const blob     = Utilities.newBlob(decoded, mimeType, fileName);
    const file     = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId   = file.getId();
    const viewUrl  = `https://drive.google.com/file/d/${fileId}/view`;
    const directUrl= `https://drive.google.com/uc?id=${fileId}`;

    // Guardar URL en la columna Evidencia del ticket
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(SHEET_TICKETS);
    if (sheet && codigo !== "SIN-CODIGO") {
      const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(h=>String(h).trim());
      const codCol  = headers.indexOf("CODIGO")+1;
      const evidCol = headers.indexOf("Evidencia")+1;
      if (codCol && evidCol) {
        const lastRow = sheet.getLastRow();
        const codes   = sheet.getRange(2,codCol,lastRow-1,1).getValues().map(r=>String(r[0]).trim());
        const idx     = codes.findIndex(c=>c===codigo);
        if (idx!==-1) sheet.getRange(idx+2,evidCol).setValue(viewUrl);
      }
    }
    return { ok:true, viewUrl, directUrl, fileName };
  } catch(err) {
    console.error("[uploadEvidencia] Error:", err);
    return { ok:false, error:"Error al subir: " + err.message };
  }
}

// ── EMAIL HELPERS ─────────────────────────────────────────
function findEmailForUser_(area, nombre) {
  const ss  = SpreadsheetApp.getActive();
  const cfg = ss.getSheetByName(SHEET_CONFIG);
  if (!cfg) return "";
  const values  = cfg.getDataRange().getValues();
  if (values.length < 2) return "";
  const headers = values[0].map(h=>String(h).trim());
  const iArea   = headers.indexOf("Area");
  const iUser   = headers.indexOf("Usuario");
  const iEmail  = headers.indexOf("Email");
  if (iEmail===-1||iUser===-1) return "";
  const a=String(area||"").trim(), n=String(nombre||"").trim();
  for (let r=1;r<values.length;r++) {
    const row=values[r], ra=iArea>=0?String(row[iArea]||"").trim():"", ru=String(row[iUser]||"").trim(), re=String(row[iEmail]||"").trim();
    if (!re) continue;
    if (a&&ra&&ra===a&&ru===n) return re;
  }
  for (let r=1;r<values.length;r++) {
    const row=values[r], ru=String(row[iUser]||"").trim(), re=String(row[iEmail]||"").trim();
    if (ru===n&&re) return re;
  }
  return "";
}

function sendStatusEmail_(toEmail, info) {
  try {
    const subject = `[Tickets TI] ${info.codigo} - Estado: ${info.nuevoEstado}`;
    const body = [
      `Hola ${info.nombre||""},`, "",
      `Tu ticket ${info.codigo} ha sido ATENDIDO.`, "",
      info.solucion ? `Solución: ${info.solucion}` : "",
      info.detalle  ? `Detalle:   ${info.detalle}`  : "",
      "", "Este mensaje fue enviado automáticamente.",
    ].filter(Boolean).join("\n");
    MailApp.sendEmail(toEmail, subject, body);
  } catch(err) { console.error("Error enviando correo:", err); }
}

// ── doGet ─────────────────────────────────────────────────
function doGet(e) {
  const callback = e&&e.parameter ? e.parameter.callback : null;
  const action   = e&&e.parameter ? String(e.parameter.action||"tickets") : "tickets";
  console.log(`[doGet] Action: ${action}`);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ticketsSheet = ss.getSheetByName(SHEET_TICKETS);
    if (action==="config")  return jsonOutput_(buildConfigPayload_(), callback);
    if (action==="create")  return jsonOutput_(createTicket_(e.parameter||{}), callback);
    if (action==="update")  return jsonOutput_(updateTicket_(e.parameter||{}), callback);
    if (action==="historial") {
      const sheet = ss.getSheetByName(SHEET_HISTORIAL);
      if (!sheet) { ensureHistorialSheet_(); return jsonOutput_([], callback); }
      return jsonOutput_(sheetToObjects_(sheet), callback);
    }
    if (action==="uploadEvidencia") return jsonOutput_(uploadEvidencia_(e.parameter||{}), callback);
    if (!ticketsSheet) return jsonOutput_({ status:"error", message:"No existe la hoja TICKETS" }, callback);
    const tickets = sheetToObjects_(ticketsSheet);
    console.log(`[doGet] Tickets: ${tickets.length}`);
    return jsonOutput_(tickets, callback);
  } catch(err) {
    console.error(`[doGet] Error:`, err);
    return jsonOutput_({ status:"error", message:err.toString() }, callback);
  }
}

// ── doPost ────────────────────────────────────────────────
function doPost(e) {
  try {
    const data = e&&e.parameter ? e.parameter : {};
    return jsonOutput_(createTicket_(data), null);
  } catch(err) {
    return jsonOutput_({ status:"error", message:String(err) }, null);
  }
}
