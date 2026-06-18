/**
 * backend-avanzado.gs — BACKEND CONSOLIDADO v5.2 (este ES el archivo a pegar/desplegar).
 * ──────────────────────────────────────────────────────────────────────────────
 * Base: v5.1 capturada el 2026-06-18 del Apps Script VINCULADO al Sheet
 * "Copia de Copia de IT: Control Tasks Flow" (ID 1PETWVvjBShv0LoBj48WlvF9sQ3CZApubWia3gSvDBuE).
 *
 * CAMBIOS v5.2 (2026-06-18, tras auditoría profunda — todo en UN solo archivo):
 *  • Celulares INTEGRADO (hoja Registro_Celulares): listCelulares_/crearCelular_/
 *    actualizarCelular_/setupCelulares + AUTHZ + router + config + setup().
 *  • Acceso admin por defecto incluido (configurarAccesoAdmin/seedAdminUsuario/fijarPinSalt).
 *  • Bugs corregidos: contador de estado solo si cambia (B1); router devuelve error ante
 *    acción desconocida en vez de tickets (B5); guards de columna CODIGO (B7); detección de
 *    duplicados aunque la fecha sea texto (B9); LockService en actualizaciones y comentarios (B4).
 *  • Seguridad: lecturas sensibles exigen token de sesión (A2/S1); anti-inyección de fórmulas
 *    en todas las escrituras (sanitizeCell_, S5/S9); rate-limit de login (S3); logout_ real (S2);
 *    sin Math.random en tokens; valida tipo de imagen en evidencias (S6); doPost JSON seguro (S8).
 *  • SOLID/DRY: reuso de bloquearRango_; y TODAS las funciones quedaron documentadas.
 *
 * Despliega como WebApp ("Ejecutar como: yo" · "Acceso: Cualquiera") tras pegarlo. La fuente de
 * verdad sigue siendo el proyecto Apps Script del Sheet; si editas allá, recaptura aquí.
 */

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
const SHEET_TICKETS      = "TICKETS";
const SHEET_CONFIG       = "Config";
const SHEET_HISTORIAL    = "HISTORIAL";
const SHEET_USUARIOS     = "USUARIOS";
const SHEET_EQUIPOS      = "EQUIPOS";
const SHEET_TAREAS       = "TAREAS";
const SHEET_CATALOGO     = "CATALOGO_TAREAS";
const SHEET_PANEL        = "Panel de Control";
const SHEET_URGENTES_LOG = "URGENTES_LOG";
const SHEET_HIST_EQUIPOS = "HISTORIAL_EQUIPOS";
const SHEET_ACCESOS      = "ACCESOS";

// ── SLA: horas para considerar un ticket activo "vencido" según prioridad ──
const SLA_HORAS = { "alta": 24, "media": 72, "baja": 120 };
const SLA_HORAS_DEFAULT = 48;

// Columnas manuales del Panel de Control (1-based). Nunca escribir en col 3 (Colaboradores), 4 (Estado), 9 (IP) — son ARRAYFORMULA.
const PANEL_COL = Object.freeze({ Prioridad: 1, Tarea: 2, Marca: 5, Canal: 6, Complejidad: 7, Area: 8 });

const PANEL_MARCAS        = ["All Stores", "AoA_USA", "Waska", "AYA_USA", "AoA_EU", "AYA_EU"];
const PANEL_CANALES       = ["Admin", "Shopify", "Quickbooks", "Google Ads", "Amazon", "Klaviyo", "Affiliate", "Meta Ads", "Otros"];
const PANEL_COMPLEJIDADES = ["Bajo", "Medio", "Alto"];
const PANEL_AREAS         = ["Marketing", "Logística", "Inventario", "B2B", "IT", "Cyber Security", "Administración"];

// ── CONFIGURACIÓN HORARIA (slots de 15 min, L-V) ──────────
const WORK_START_MIN  = 7 * 60;        // 07:00 = 420 min
const WORK_END_MIN    = 17 * 60 + 36;  // 17:36 = 1056 min
const SLOT_MIN        = 15;
const URGENT_WINDOW_DAYS = 21;
const URGENT_THRESHOLD   = 3;
const ALERT_EMAIL        = "asistenciawaska@gmail.com";

// ── COLUMNAS REQUERIDAS POR HOJA (se crean automáticamente) ──
const COLS_TICKETS = [
  "CODIGO", "Nombre", "Area", "Tipo", "Titulo del requerimiento", "Descripcion",
  "Prioridad", "Evidencia", "Estado", "Fecha de ingreso de ticket", "Fecha de cierre",
  "Solucion", "Detalle de la solucion", "Ultimo cambio de estado",
  "Tecnico asignado",
  "Fecha de asignacion",
  "Cambio de estado count",
  "IP",
  "Urgente",
  "Responsable directo",
  "Co responsables",
  "Confirmado por tecnico",
  "Horario estimado atencion",
  "Revisado coordinador",
  "Comentarios internos",
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
  "Hora inicio", "Hora fin", "Duracion minutos", "IP",
  "Responsable directo", "Co responsables",
];

const COLS_CATALOGO = [
  "ID", "Nombre", "Descripcion", "Categoria", "Duracion estimada (h)",
  "Rol sugerido", "Activo",
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

// Estados de las SUB-TAREAS (pestañas "Tasks - <persona>"), que es el modelo que usa
// el frontend de Tareas/Calendario. Vocabulario distinto al de la hoja TAREAS (arriba).
const ESTADOS_SUBTAREA_DEFAULT = ["Pendiente", "En desarrollo", "Pausado", "Terminado", "Cancelada"];

const TIPOS_EQUIPO_DEFAULT  = ["PC de escritorio", "Laptop", "Monitor", "Impresora",
                               "Servidor", "Teléfono IP", "Tablet", "Periférico", "Red", "Otro"];
const ESTADOS_EQUIPO_DEFAULT = ["Operativo", "En stock", "En reparación", "Asignado", "De baja"];

// ════════════════════════════════════════════════════════
// SETUP / INICIALIZACIÓN MANUAL
// ════════════════════════════════════════════════════════
/**
 * Crea TODAS las hojas necesarias de una sola vez y siembra el admin por defecto.
 * Ejecútala UNA VEZ desde el editor de Apps Script:
 *   1) Selecciona "setup" en el menú de funciones (junto a ▶ Ejecutar).
 *   2) Pulsa ▶ Ejecutar y autoriza los permisos cuando lo pida.
 * Crea: TICKETS, HISTORIAL, USUARIOS (con admin/1234), EQUIPOS, TAREAS, CATALOGO_TAREAS.
 * No toca hojas existentes (Panel de Control, Tasks-[Persona], IP_Score).
 */
function setup() {
  ensureSheet_(SHEET_TICKETS,  COLS_TICKETS);
  ensureHistorialSheet_();
  ensureUsuariosSheet_();   // crea USUARIOS + siembra admin (PIN 1234 hasheado)
  ensureSheet_(SHEET_EQUIPOS,  COLS_EQUIPOS);
  ensureSheet_(SHEET_TAREAS,   COLS_TAREAS);
  ensureSheet_(SHEET_CATALOGO, COLS_CATALOGO);
  ensureSheet_(SHEET_CELULARES, COLS_CELULARES);
  const msg = "Setup OK → hojas: TICKETS, HISTORIAL, USUARIOS, EQUIPOS, TAREAS, CATALOGO_TAREAS. Admin: admin / 1234";
  console.log(msg);
  return msg;
}

// ════════════════════════════════════════════════════════
// HELPERS GENÉRICOS
// ════════════════════════════════════════════════════════
/**
 * Serializa un objeto a la respuesta HTTP de la WebApp. Si hay callback devuelve JSONP
 * (text/javascript) para evitar CORS; si no, JSON puro.
 * @param {Object} obj Objeto a serializar.
 * @param {string} callback Nombre de la función JSONP (opcional).
 * @return {TextOutput} Salida lista para retornar desde doGet/doPost.
 */
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

/**
 * Devuelve el correo del administrador para notificaciones: la Script Property
 * ADMIN_EMAIL o, en su defecto, el correo del usuario que ejecuta el script.
 * @return {string} Email del administrador.
 */
function getAdminEmail_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_EMAIL")
    || Session.getEffectiveUser().getEmail();
}

/**
 * Convierte el contenido de una hoja en un array de objetos usando la fila 1 como
 * cabeceras. Omite filas vacías y serializa las fechas a ISO 8601.
 * @param {Sheet} sheet Hoja de cálculo a leer.
 * @return {Object[]} Filas como objetos {Columna: valor}.
 */
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

/**
 * Aplica el estilo de cabecera (negrita, fondo oscuro, texto blanco) a la fila 1.
 * @param {Sheet} sheet Hoja a estilizar.
 * @param {number} n Número de columnas de la cabecera.
 */
function styleHeader_(sheet, n) {
  const r = sheet.getRange(1, 1, 1, n);
  r.setFontWeight("bold").setBackground("#111827").setFontColor("#ffffff");
}
/**
 * Aplica el estilo de cabecera a una sola celda (usado al agregar columnas nuevas).
 * @param {Range} cell Celda a estilizar.
 */
function styleHeaderCell_(cell) {
  cell.setFontWeight("bold").setBackground("#111827").setFontColor("#ffffff");
}

/**
 * Construye un mapa nombre→índice de columna (1-based) a partir de las cabeceras.
 * @param {string[]} headers Cabeceras de la hoja.
 * @param {string[]} names Nombres de columna a localizar.
 * @return {Object} Mapa {nombre: índice 1-based}; 0 indica que la columna no existe.
 */
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

/** Neutraliza inyección de fórmulas en Sheets: antepone una comilla a textos que
 *  empiezan con = + - @ (o tab/CR). NO toca números, fechas ni otros tipos. */
function sanitizeCell_(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

/** Construye una fila alineada a headers a partir de un objeto {Columna: valor}.
 *  Los valores de texto se sanean contra inyección de fórmulas. */
function rowFromMap_(headers, map) {
  const row = new Array(headers.length).fill("");
  headers.forEach((h, i) => { if (Object.prototype.hasOwnProperty.call(map, h)) row[i] = sanitizeCell_(map[h]); });
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
  // Panel de Control (integración con Google Sheet)
  crearTareaPanel:      ["Líder de equipo"],
  actualizarTareaPanel: ["Líder de equipo"],
  guardarSubTarea:      [],                              // autenticado (avanza su sub tarea)
  adjuntarEvidenciaTarea: [],                            // autenticado (evidencia de cierre)
  // ── Sprint 0: asignación inteligente ──
  confirmarApoyo:     ["Técnico TI", "Líder de equipo"],
  colaborarTicket:    ["Técnico TI", "Líder de equipo"],
  transferirTicket:   ["Técnico TI", "Líder de equipo"],
  revisarCoordinador: ["Administrador", "Líder de equipo"],
  statsAdmin:         ["Administrador", "Líder de equipo"],
  // ── Sprint 1: comentarios internos ──
  comentarTicket:     ["Técnico TI", "Líder de equipo"],
  // ── Sprint 4: bitácora de accesos ──
  accesos:            ["Administrador"],
  // ── Lecturas sensibles: exigir sesión (token de login) ──
  historial:        [],
  tareas:           [],
  catalogo:         [],
  listTareasPanel:  [],
  listSubTareas:    [],
  equipos:          [],
  celulares:        [],
  historialEquipo:  [],
  slotsDisponibles: ["Técnico TI", "Líder de equipo"],
  asignarAuto:      ["Técnico TI", "Líder de equipo"],
};

/**
 * Devuelve la sal secreta para el hash de PINs (Script Property PIN_SALT, con valor por
 * defecto de respaldo). Parte del modelo de seguridad: nunca se guarda el PIN en claro.
 * @return {string} Sal usada al hashear el PIN.
 */
function pinSalt_() {
  return PropertiesService.getScriptProperties().getProperty("PIN_SALT") || "ti-sistema-salt-v5";
}
/**
 * Calcula el hash SHA-256 del PIN concatenado con la sal. Así el PIN se almacena cifrado
 * y no en texto plano en la hoja USUARIOS.
 * @param {string|number} pin PIN en claro.
 * @return {string} Hash hexadecimal de 64 caracteres.
 */
function hashPin_(pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pinSalt_() + String(pin));
  return bytes.map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join("");
}
/**
 * Indica si un valor ya tiene forma de hash SHA-256 (64 hex). Sirve para distinguir PINs
 * cifrados de PINs antiguos en texto plano y migrarlos.
 * @param {string} s Valor a comprobar.
 * @return {boolean} true si parece un hash SHA-256.
 */
function isHash_(s) { return /^[0-9a-f]{64}$/i.test(String(s || "")); }
/** Compara un PIN en claro contra el valor guardado (hash o, por compatibilidad, texto). */
function pinMatches_(pin, stored) {
  const s = String(stored || "");
  return isHash_(s) ? (s.toLowerCase() === hashPin_(pin)) : (s === String(pin));
}

/**
 * Genera un token de sesión opaco e impredecible (dos UUID v4 concatenados) que se
 * entrega en el login para autenticar las acciones de escritura.
 * @return {string} Token de sesión.
 */
function makeToken_() {
  // Dos UUID v4 concatenados: entropía suficiente sin depender de Math.random.
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
}
/**
 * Guarda la sesión en CacheService (clave "sess_<token>") con expiración SESSION_TTL (6 h).
 * Es el almacén de tokens del modelo de seguridad: no hay sesiones en disco.
 * @param {string} token Token de sesión emitido en el login.
 * @param {Object} sess Datos de sesión a persistir ({email, nombre, rol}).
 */
function saveSession_(token, sess) {
  CacheService.getScriptCache().put("sess_" + token, JSON.stringify(sess), SESSION_TTL);
}
/**
 * Recupera y deserializa la sesión asociada a un token desde CacheService. Devuelve null
 * si el token falta, expiró o está corrupto: base del gate de autorización.
 * @param {string} token Token de sesión a validar.
 * @return {Object|null} Datos de sesión o null si no es válido.
 */
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
/**
 * Garantiza la existencia de la hoja HISTORIAL con sus cabeceras y estilo. La crea si falta.
 * @return {Sheet} La hoja HISTORIAL lista para usar.
 */
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

/**
 * Registra un cambio de estado de un ticket en la hoja HISTORIAL (append). Nunca lanza
 * error: solo lo registra en consola.
 * @param {string} codigo Código del ticket.
 * @param {string} oldEstado Estado anterior.
 * @param {string} nuevoEstado Estado nuevo.
 * @param {string} solucion Solución registrada (opcional).
 * @param {string} detalle Detalle de la solución (opcional).
 * @param {string} tecnicoOverride Técnico a registrar; si falta usa el usuario actual.
 */
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
/**
 * Construye el payload de configuración que consume el frontend: áreas/tipos/prioridades
 * leídos de la hoja Config más todas las listas por defecto (estados, roles, equipos,
 * celulares y opciones del Panel de Control).
 * @return {Object} Objeto con status y todas las listas de parámetros para los selects.
 */
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
    estadosSubTarea: ESTADOS_SUBTAREA_DEFAULT,
    tiposEquipo: TIPOS_EQUIPO_DEFAULT,
    estadosEquipo: ESTADOS_EQUIPO_DEFAULT,
    operadores: OPERADORES_DEFAULT,
    estadosCelular: ESTADOS_CELULAR_DEFAULT,
    raw,
    // Panel de Control — opciones para selects del frontend
    panelMarcas:        PANEL_MARCAS,
    panelCanales:       PANEL_CANALES,
    panelComplejidades: PANEL_COMPLEJIDADES,
    panelAreas:         PANEL_AREAS,
  };
}
/**
 * Normaliza un array a valores únicos, sin vacíos y ordenados alfabéticamente.
 * @param {Array} arr Valores de entrada (se convierten a texto y se recortan).
 * @return {string[]} Valores únicos, no vacíos y ordenados.
 */
function uniqSorted_(arr) {
  return [...new Set(arr.map(x => String(x || "").trim()).filter(Boolean))].sort();
}

// ════════════════════════════════════════════════════════
// TICKETS  (lógica heredada v3/v4 + asignación)
// ════════════════════════════════════════════════════════
/**
 * Mapea el tipo de ticket a su prefijo de código (requerimiento→REQ, incidencia→INC,
 * evento→EVE; por defecto REQ).
 * @param {string} tipo Tipo del ticket.
 * @return {string} Prefijo de tres letras.
 */
function prefixFromTipo_(tipo) {
  const t = String(tipo || "").trim().toLowerCase();
  if (t === "requerimiento") return "REQ";
  if (t === "incidencia")    return "INC";
  if (t === "evento")        return "EVE";
  return "REQ";
}

/**
 * Calcula el siguiente código secuencial de ticket (p. ej. REQ-001) sobre la columna CODIGO.
 * @param {string} prefix Prefijo del código (REQ/INC/EVE).
 * @param {Sheet} sheet Hoja TICKETS.
 * @param {string[]} headers Cabeceras de la hoja.
 * @return {string} Código nuevo no usado.
 */
function nextCode_(prefix, sheet, headers) {
  const codeCol = headers.indexOf("CODIGO") + 1;
  if (codeCol === 0) return `${prefix}-001`;
  return nextSeqId_(sheet, codeCol, prefix);
}

/**
 * Detecta un ticket duplicado reciente (últimas ~150 filas) comparando nombre, área, tipo,
 * título y descripción normalizados dentro de una ventana de tiempo. Evita registros dobles.
 * @param {Sheet} sheet Hoja TICKETS.
 * @param {string[]} headers Cabeceras de la hoja.
 * @param {Object} fields Campos a comparar {nombre, area, tipo, titulo, descripcion}.
 * @param {number} windowSeconds Ventana en segundos hacia atrás para considerar duplicado.
 * @return {string|null} Código del ticket duplicado o null si no hay coincidencia.
 */
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
    const dRaw = row[idx.fecha];
    let t;
    if (dRaw instanceof Date) { t = dRaw.getTime(); }
    else { const parsed = parseLocalDateTime_(String(dRaw)); t = parsed ? parsed.getTime() : Date.parse(String(dRaw)); }
    if (!t || isNaN(t) || (now - t) > limitMs) continue;
    if (norm(row[idx.nombre]) === norm(fields.nombre) &&
        norm(row[idx.area])   === norm(fields.area) &&
        norm(row[idx.tipo])   === norm(fields.tipo) &&
        norm(row[idx.titulo]) === norm(fields.titulo) &&
        norm(row[idx.desc])   === norm(fields.descripcion))
      return String(row[idx.codigo] || "").trim() || null;
  }
  return null;
}

/**
 * Crea un ticket en la hoja TICKETS: valida campos, evita duplicados recientes, genera el
 * código, opcionalmente lo auto-asigna y estima horario, dispara el flujo de urgentes,
 * registra HISTORIAL y notifica por correo al administrador. Usa LockService para concurrencia.
 * @param {Object} data Datos del ticket (nombre, area, tipo, titulo, descripcion, prioridad, etc.).
 * @return {Object} {status, id, ...} en éxito o {status:"error", message} en fallo.
 */
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
    if (nombre.length > 120 || area.length > 120 || tipo.length > 80 || prioridad.length > 40)
      return { status: "error", message: "Campo de texto demasiado largo." };

    const dup = findRecentDuplicate_(sheet, headers, { nombre, area, tipo, titulo, descripcion }, 90);
    if (dup) return { status: "success", id: dup, usuario: nombre, tipo, titulo, duplicated: true };

    const codigo = nextCode_(prefixFromTipo_(tipo), sheet, headers);
    const ahora  = new Date();
    const ip     = parseInt(String(data.ip || data.IP || "0")) || 0;
    const urgente = (String(data.urgente || "").toLowerCase() === "sí" ||
                    String(data.urgente || "").toLowerCase() === "true" ||
                    data.urgente === true) ? "Sí" : "No";
    const asignacionAuto = String(data.asignacionAuto || "").toLowerCase() === "true";

    // Asignación automática si se solicitó
    let tecnicoAsignado = String(data.tecnicoAsignado || "").trim();
    let horarioEstimado = "";
    if (asignacionAuto) {
      const auto = asignarTicketAuto_();
      if (auto) {
        tecnicoAsignado = auto.tecnico;
        horarioEstimado = estimarHorarioAtencion_(auto.tecnico);
      }
    } else if (tecnicoAsignado) {
      horarioEstimado = estimarHorarioAtencion_(tecnicoAsignado);
    }

    sheet.appendRow(rowFromMap_(headers, {
      "CODIGO": codigo, "Nombre": nombre, "Area": area, "Tipo": tipo,
      "Titulo del requerimiento": titulo, "Descripcion": descripcion,
      "Prioridad": prioridad, "Evidencia": "", "Estado": "Pendiente",
      "Fecha de ingreso de ticket": ahora, "Ultimo cambio de estado": ahora,
      "Cambio de estado count": 0,
      "IP": ip,
      "Urgente": urgente,
      "Tecnico asignado": tecnicoAsignado,
      "Responsable directo": tecnicoAsignado,
      "Horario estimado atencion": horarioEstimado,
    }));

    // Si es urgente, disparar el proceso de registro
    let alertaUrgente = null;
    if (urgente === "Sí") {
      const emailSolicitante = String(data.emailSolicitante || "").trim() ||
        (findUsuarioByNombre_(nombre) || {}).Email || "";
      alertaUrgente = registrarUrgente_({ usuario: nombre, email: emailSolicitante, ticketId: codigo });
    }

    logHistorial_(codigo, "", "Pendiente", "", "Ticket creado");

    try {
      const adminEmail = getAdminEmail_();
      if (adminEmail) MailApp.sendEmail(adminEmail,
        `[${codigo}] Nuevo ticket — ${tipo}: ${titulo}`,
        `Ticket: ${codigo}\nUsuario: ${nombre}\nÁrea: ${area}\nTipo: ${tipo}\nPrioridad: ${prioridad}\n\nTítulo: ${titulo}\n\nDescripción:\n${descripcion}`);
    } catch (e) { console.warn("[createTicket] email:", e); }

    return {
      status: "success", id: codigo, usuario: nombre, tipo, titulo,
      tecnicoAsignado, horarioEstimado,
      alertaUrgente: alertaUrgente || null,
    };
  } catch (err) {
    console.error("[createTicket]", err);
    return { status: "error", message: `Error interno: ${err.message}` };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/**
 * Parsea una fecha/hora local en formato "YYYY-MM-DD" o "YYYY-MM-DD HH:MM[:SS]" a un Date,
 * sin desfases de zona horaria. Devuelve null si el formato no coincide.
 * @param {string} value Cadena de fecha/hora.
 * @return {Date|null} Fecha construida en hora local o null.
 */
function parseLocalDateTime_(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4] || 0, +m[5] || 0, +m[6] || 0);
}

/**
 * Actualiza el estado de un ticket en la hoja TICKETS: cambia estado, solución/detalle,
 * técnico asignado y fecha de cierre, incrementa el contador de cambios, registra HISTORIAL
 * y notifica al solicitante por correo si el nuevo estado es notificable.
 * @param {Object} params Datos {codigo, estado, solucion, detalle, tecnico, fechaCierre}.
 * @return {Object} {ok:true, codigo, oldEstado, nuevoEstado, timestamp} o {ok:false, error}.
 */
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
  if (changed && col["Ultimo cambio de estado"]) sheet.getRange(rowNum, col["Ultimo cambio de estado"]).setValue(new Date());
  if (col["Tecnico asignado"] && tecnico) {
    sheet.getRange(rowNum, col["Tecnico asignado"]).setValue(tecnico);
    if (col["Fecha de asignacion"] && !String(sheet.getRange(rowNum, col["Fecha de asignacion"]).getValue() || "").trim())
      sheet.getRange(rowNum, col["Fecha de asignacion"]).setValue(new Date());
  }
  if (changed && col["Cambio de estado count"]) {
    const current = parseInt(sheet.getRange(rowNum, col["Cambio de estado count"]).getValue() || "0") || 0;
    sheet.getRange(rowNum, col["Cambio de estado count"]).setValue(current + 1);
  }

  const esCierre = ["atendido", "anulado"].includes(nuevoEstado.toLowerCase());
  if (col["Fecha de cierre"] && esCierre) {
    const fechaCierre = fechaRaw ? parseLocalDateTime_(fechaRaw) : new Date();
    sheet.getRange(rowNum, col["Fecha de cierre"]).setValue(fechaCierre || new Date());
  }

  if (changed) logHistorial_(codigo, oldEstado, nuevoEstado, solucion, detalle, tecnico);

  // Notificar al solicitante en más estados (no solo "Atendido").
  if (changed && estadoNotificable_(nuevoEstado)) {
    try {
      const nombre = col["Nombre"] ? String(sheet.getRange(rowNum, col["Nombre"]).getValue() || "") : "";
      const area   = col["Area"]   ? String(sheet.getRange(rowNum, col["Area"]).getValue() || "")   : "";
      const email  = findEmailForUser_(area.trim(), nombre.trim());
      if (email) sendStatusEmail_(email, { codigo, nombre, area, nuevoEstado, oldEstado, solucion, detalle, tecnico });
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
/**
 * Sube una imagen (base64) a la carpeta de Drive DRIVE_FOLDER_ID, valida MIME y tamaño
 * (máx 5MB), la comparte por enlace y guarda la URL en la columna Evidencia del ticket.
 * @param {Object} params Datos {imageData (base64), mimeType, codigo}.
 * @return {Object} {ok:true, viewUrl, directUrl, fileName} o {ok:false, error}.
 */
function uploadEvidencia_(params) {
  const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) return { ok: false, error: "DRIVE_FOLDER_ID no configurado en Script Properties." };

  const base64   = String(params.imageData || "");
  const mimeType = String(params.mimeType || "image/jpeg");
  const codigo   = String(params.codigo || "SIN-CODIGO");
  const ext      = mimeType.includes("png") ? "png" : mimeType.includes("gif") ? "gif" : mimeType.includes("webp") ? "webp" : "jpg";
  const fileName = `evidencia_${codigo}_${Date.now()}.${ext}`;
  const _ALLOWED_MIME = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
  if (_ALLOWED_MIME.indexOf(String(mimeType).toLowerCase()) === -1)
    return { ok: false, error: "Tipo de imagen no permitido." };

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
/**
 * Resuelve el correo de un solicitante: primero busca en la hoja USUARIOS por nombre y, si
 * no lo halla, recurre a la hoja Config (compatibilidad v4) cruzando por área y usuario.
 * @param {string} area Área del solicitante.
 * @param {string} nombre Nombre del solicitante.
 * @return {string} Email encontrado o cadena vacía.
 */
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

/**
 * Envía un correo al solicitante adaptado al nuevo estado del ticket.
 * Cubre más estados que antes (no solo "Atendido").
 */
function sendStatusEmail_(toEmail, info) {
  try {
    const estado = String(info.nuevoEstado || "").trim();
    const e = estado.toLowerCase();
    let cuerpo;
    if (e === "atendido") {
      cuerpo = `Hola ${info.nombre || ""},\n\nTu ticket ${info.codigo} ha sido ATENDIDO.\n\n` +
        `Solución: ${info.solucion || "—"}\nDetalle: ${info.detalle || "—"}\n\n` +
        `Gracias por usar el sistema de Tickets TI.`;
    } else if (e === "anulado") {
      cuerpo = `Hola ${info.nombre || ""},\n\nTu ticket ${info.codigo} ha sido ANULADO.\n\n` +
        `Motivo: ${info.solucion || info.detalle || "—"}\n\n` +
        `Si crees que es un error, vuelve a registrar tu solicitud.`;
    } else if (e === "en atención") {
      cuerpo = `Hola ${info.nombre || ""},\n\nTu ticket ${info.codigo} está siendo ATENDIDO` +
        `${info.tecnico ? ` por ${info.tecnico}` : ""}.\n\nTe avisaremos cuando se resuelva.`;
    } else if (e === "pausado" || e === "bloqueado" || e === "bloqueado por recursos") {
      cuerpo = `Hola ${info.nombre || ""},\n\nTu ticket ${info.codigo} cambió a estado "${estado}".\n\n` +
        `${info.detalle ? `Detalle: ${info.detalle}\n\n` : ""}` +
        `Se reanudará en cuanto sea posible.`;
    } else {
      cuerpo = `Hola ${info.nombre || ""},\n\nTu ticket ${info.codigo} cambió de estado: ` +
        `${info.oldEstado || "—"} → ${estado}.\n\nSistema de Tickets TI.`;
    }
    MailApp.sendEmail(toEmail, `[Tickets TI] ${info.codigo} — ${estado}`, cuerpo);
  } catch (err) { console.error("[sendStatusEmail]", err); }
}

/** Estados que disparan notificación por correo al solicitante. */
function estadoNotificable_(estado) {
  return ["en atención", "pausado", "bloqueado", "bloqueado por recursos", "atendido", "anulado"]
    .includes(String(estado || "").trim().toLowerCase());
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

/**
 * Lista los usuarios de la hoja USUARIOS, eliminando el campo PIN del resultado para no
 * exponer credenciales (PII protegida por AUTHZ).
 * @return {Object[]} Usuarios sin el campo PIN.
 */
function listUsuarios_() {
  const { sheet } = ensureUsuariosSheet_();
  // No exponer el PIN en el listado general
  return sheetToObjects_(sheet).map(u => { const o = Object.assign({}, u); delete o.PIN; return o; });
}

/**
 * Busca un usuario en la hoja USUARIOS por nombre (sin distinguir mayúsculas/espacios).
 * @param {string} nombre Nombre a buscar.
 * @return {Object|null} Objeto del usuario o null si no existe.
 */
function findUsuarioByNombre_(nombre) {
  const { sheet } = ensureUsuariosSheet_();
  const n = String(nombre || "").trim().toLowerCase();
  return sheetToObjects_(sheet).find(u => String(u.Nombre || "").trim().toLowerCase() === n) || null;
}

/**
 * Valida el login contra la hoja USUARIOS: aplica rate-limiting por intentos fallidos
 * (CacheService), compara el PIN con su hash, migra PINs antiguos en texto plano a hash,
 * emite un token de sesión y registra el acceso en la bitácora.
 * @param {Object} params Credenciales {email|usuario, pin}.
 * @return {Object} {ok:true, usuario, token, ttl} o {ok:false, error}.
 */
function login_(params) {
  const email = String(params.email || params.usuario || "").trim().toLowerCase();
  const pin   = String(params.pin || "").trim();
  if (!email || !pin) return { ok: false, error: "Ingresa correo/usuario y PIN." };

  const _cache = CacheService.getScriptCache();
  const _rlKey = "login_fail_" + email;
  if ((parseInt(_cache.get(_rlKey) || "0", 10) || 0) >= 8) {
    logAcceso_(email, email, "Bloqueado", "Demasiados intentos fallidos");
    return { ok: false, error: "Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo." };
  }

  const { sheet, headers } = ensureUsuariosSheet_();
  const rows = sheetToObjects_(sheet);
  const u = rows.find(r =>
    (String(r.Email || "").trim().toLowerCase() === email ||
     String(r.Nombre || "").trim().toLowerCase() === email));
  if (!u) { logAcceso_(email, email, "Fallido", "Usuario no encontrado"); return { ok: false, error: "Usuario no encontrado." }; }
  if (String(u.Activo || "").trim().toLowerCase() === "no") {
    logAcceso_(u.Nombre, u.Email, "Fallido", "Usuario inactivo");
    return { ok: false, error: "Usuario inactivo." };
  }
  if (!pinMatches_(pin, u.PIN)) {
    _cache.put(_rlKey, String((parseInt(_cache.get(_rlKey) || "0", 10) || 0) + 1), 900);
    logAcceso_(u.Nombre, u.Email, "Fallido", "PIN incorrecto");
    return { ok: false, error: "PIN incorrecto." };
  }

  // Migrar a hash si el PIN estaba guardado en texto plano (transparente para el usuario).
  if (!isHash_(u.PIN)) {
    const rowNum = findRowByKey_(sheet, headers.indexOf("ID") + 1, u.ID);
    if (rowNum !== -1) sheet.getRange(rowNum, headers.indexOf("PIN") + 1).setValue(hashPin_(pin));
  }

  const usuario = {
    id: u.ID, nombre: u.Nombre, email: u.Email,
    rol: u.Rol || "Usuario", equipo: u.Equipo || "",
  };
  _cache.remove(_rlKey);  // login correcto: limpia el contador de intentos
  const token = makeToken_();
  saveSession_(token, { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol });
  logAcceso_(usuario.nombre, usuario.email, "Exitoso", `Rol: ${usuario.rol}`);
  return { ok: true, usuario, token, ttl: SESSION_TTL };
}

/** Cierra la sesión: elimina el token de la caché y registra el cierre. */
function logout_(params) {
  try {
    const sess = validateToken_(params.token);
    CacheService.getScriptCache().remove("sess_" + String(params.token || ""));
    if (sess) logAcceso_(sess.nombre || "", sess.email || "", "Logout", "Cierre de sesión");
  } catch (_) {}
  return { ok: true };
}

/**
 * Crea un usuario en la hoja USUARIOS: valida nombre y PIN, exige email único, hashea el PIN
 * y asigna un ID secuencial (USR-###). Protegido por AUTHZ (solo Administrador).
 * @param {Object} params Datos {nombre, email, rol, equipo, pin, activo}.
 * @return {Object} {ok:true, id, nombre} o {ok:false, error}.
 */
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

/**
 * Actualiza un usuario existente de la hoja USUARIOS por ID: solo modifica los campos
 * recibidos; si llega un PIN nuevo lo re-hashea. Protegido por AUTHZ (solo Administrador).
 * @param {Object} params Datos {id, nombre, email, rol, equipo, activo, pin}.
 * @return {Object} {ok:true, id} o {ok:false, error}.
 */
function actualizarUsuario_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
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
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ════════════════════════════════════════════════════════
// EQUIPOS (inventario informático)
// ════════════════════════════════════════════════════════
/**
 * Lista los equipos del inventario (hoja EQUIPOS), creándola si no existe.
 * @return {Object[]} Equipos registrados.
 */
function listEquipos_() {
  const { sheet } = ensureSheet_(SHEET_EQUIPOS, COLS_EQUIPOS);
  return sheetToObjects_(sheet);
}

/**
 * Da de alta un equipo en el inventario (hoja EQUIPOS): valida tipo, deriva el estado por
 * defecto según si está asignado, genera código secuencial (EQ-###) y registra el alta en
 * HISTORIAL_EQUIPOS.
 * @param {Object} params Datos {tipo, marca, modelo, serie, asignado, area, ubicacion, estado, observaciones, usuario}.
 * @return {Object} {ok:true, id} o {ok:false, error}.
 */
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
    logHistorialEquipo_(id, "Registro",
      `Alta de equipo: ${tipo}${asignado ? ` · asignado a ${asignado}` : ""} · estado ${estado}`,
      String(params.usuario || "").trim());
    return { ok: true, id };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

/**
 * Actualiza un equipo del inventario por código: modifica solo los campos recibidos y
 * registra en HISTORIAL_EQUIPOS los cambios de estado, reasignaciones y liberaciones.
 * @param {Object} params Datos {codigo|id, tipo, marca, modelo, serie, area, ubicacion, estado, observaciones, asignado, usuario}.
 * @return {Object} {ok:true, id} o {ok:false, error}.
 */
function actualizarEquipo_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
  const { sheet, headers } = ensureSheet_(SHEET_EQUIPOS, COLS_EQUIPOS);
  const id = String(params.codigo || params.id || "").trim();
  if (!id) return { ok: false, error: "Falta el código del equipo." };
  const rowNum = findRowByKey_(sheet, headers.indexOf("Codigo") + 1, id);
  if (rowNum === -1) return { ok: false, error: `Equipo "${id}" no encontrado.` };

  const col = colIndexMap_(headers, COLS_EQUIPOS);
  const usuario = String(params.usuario || "").trim();

  // Capturar estado/asignación previos para registrar cambios en el historial
  const estadoPrev = col["Estado"] ? String(sheet.getRange(rowNum, col["Estado"]).getValue() || "").trim() : "";

  const setIf = (campo, key) => {
    if (params[key] !== undefined && col[campo])
      sheet.getRange(rowNum, col[campo]).setValue(String(params[key]));
  };
  setIf("Tipo", "tipo"); setIf("Marca", "marca"); setIf("Modelo", "modelo");
  setIf("N Serie", "serie"); setIf("Area", "area"); setIf("Ubicacion", "ubicacion");
  setIf("Estado", "estado"); setIf("Observaciones", "observaciones");

  if (params.estado !== undefined && String(params.estado).trim() !== estadoPrev)
    logHistorialEquipo_(id, "Cambio de estado", `${estadoPrev || "—"} → ${String(params.estado).trim()}`, usuario);

  if (params.asignado !== undefined && col["Asignado a"]) {
    const prev = String(sheet.getRange(rowNum, col["Asignado a"]).getValue() || "").trim();
    const nuevo = String(params.asignado).trim();
    sheet.getRange(rowNum, col["Asignado a"]).setValue(nuevo);
    if (nuevo && nuevo !== prev) {
      sheet.getRange(rowNum, col["Fecha asignacion"]).setValue(new Date());
      logHistorialEquipo_(id, "Reasignación", `${prev || "Sin asignar"} → ${nuevo}`, usuario);
    } else if (!nuevo && prev) {
      logHistorialEquipo_(id, "Liberación", `Liberado de ${prev}`, usuario);
    }
  }
  return { ok: true, id };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ════════════════════════════════════════════════════════
// TAREAS + CATÁLOGO PARAMETRIZADO
// ════════════════════════════════════════════════════════
/**
 * Lista las entradas del catálogo parametrizado de tareas (hoja CATALOGO_TAREAS).
 * @return {Object[]} Tareas del catálogo.
 */
function listCatalogoTareas_() {
  const { sheet } = ensureSheet_(SHEET_CATALOGO, COLS_CATALOGO);
  return sheetToObjects_(sheet);
}

/**
 * Agrega una entrada al catálogo parametrizado de tareas (hoja CATALOGO_TAREAS) con ID
 * secuencial (CAT-###). Protegido por AUTHZ (Líder de equipo).
 * @param {Object} params Datos {nombre, descripcion, categoria, duracion, rol, activo}.
 * @return {Object} {ok:true, id} o {ok:false, error}.
 */
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

/**
 * Lista las tareas de la hoja TAREAS, opcionalmente filtradas por la persona asignada.
 * @param {Object} params Filtro opcional {asignado}.
 * @return {Object[]} Tareas (todas o las del asignado indicado).
 */
function listTareas_(params) {
  const { sheet } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
  let rows = sheetToObjects_(sheet);
  const asignado = String((params && params.asignado) || "").trim().toLowerCase();
  if (asignado) rows = rows.filter(t => String(t["Asignado a"] || "").trim().toLowerCase() === asignado);
  return rows;
}

/**
 * Crea una tarea en la hoja TAREAS: valida título y asignado, genera ID secuencial (TAR-###),
 * calcula la hora fin a partir de inicio + duración y, si se solicita, la agenda en Google
 * Calendar. Protegido por AUTHZ (Líder de equipo).
 * @param {Object} params Datos {titulo, asignado, descripcion, tipo, asignadoPor, estado, prioridad, fechaInicio, fechaLimite, ticket, horaInicio, duracionMinutos, ip, coResponsables, agendar}.
 * @return {Object} {ok:true, id} o {ok:false, error}.
 */
function crearTarea_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const { sheet, headers } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
    const titulo = String(params.titulo || "").trim();
    const asignadoA = String(params.asignado || "").trim();
    if (!titulo) return { ok: false, error: "El título de la tarea es obligatorio." };
    if (!asignadoA) return { ok: false, error: "Debes asignar la tarea a una persona." };

    const id = nextSeqId_(sheet, headers.indexOf("ID") + 1, "TAR");

    // Calcular Hora fin a partir de inicio + duración (en minutos)
    const horaInicio    = String(params.horaInicio || "").trim();
    const durMinutos    = parseInt(String(params.duracionMinutos || "0")) || 0;
    const horaFin       = (horaInicio && durMinutos)
      ? minToTime_(timeToMin_(horaInicio) + durMinutos)
      : String(params.horaFin || "").trim();
    const ipTarea       = parseInt(String(params.ip || "0")) || 0;
    const respDirecto   = asignadoA;
    const coResp        = String(params.coResponsables || "").trim();

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
      "Hora inicio": horaInicio,
      "Hora fin": horaFin,
      "Duracion minutos": durMinutos || "",
      "IP": ipTarea,
      "Responsable directo": respDirecto,
      "Co responsables": coResp,
    }));

    // Integración con Google Calendar (solo si está habilitada).
    if (params.agendar === "true" || params.agendar === true) {
      const r = agendarTarea_({ id, titulo, descripcion: params.descripcion,
        fechaInicio: params.fechaInicio, fechaLimite: params.fechaLimite,
        horaInicio, horaFin });
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

/**
 * Actualiza una tarea de la hoja TAREAS por ID: modifica solo los campos recibidos y, al
 * pasar a "Completada", fija la fecha de completada. Protegido por AUTHZ (autenticado).
 * @param {Object} params Datos {id, titulo, descripcion, tipo, asignado, prioridad, fechaInicio, fechaLimite, ticket, estado}.
 * @return {Object} {ok:true, id} o {ok:false, error}.
 */
function actualizarTarea_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
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
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ════════════════════════════════════════════════════════
// PANEL DE CONTROL — Integración con Google Sheet existente
// ════════════════════════════════════════════════════════

/** Devuelve la hoja "Tasks - [Persona]" para el nombre dado.
 *  Intenta coincidencia exacta, luego parcial. */
function getTasksSheetForPersona_(persona) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const n = String(persona || "").trim().toLowerCase();
  const PREFIX = "Tasks - ";
  const sheets = ss.getSheets().filter(s => s.getName().startsWith(PREFIX));
  let found = sheets.find(s => s.getName().substring(PREFIX.length).trim().toLowerCase() === n);
  if (found) return found;
  found = sheets.find(s => {
    const pn = s.getName().substring(PREFIX.length).trim().toLowerCase();
    return pn.startsWith(n) || n.startsWith(pn);
  });
  return found || null;
}

/** Agrega columnas nuevas a Tasks-[Persona] sin tocar las existentes.
 *  Devuelve { sheet, headers } actualizados. */
function ensureTasksPersonaExtras_(sheet) {
  const EXTRA = ["Fecha limite", "Ticket relacionado", "Evidencia",
                 "Fecha actividad", "Hora inicio", "Hora fin", "Duracion minutos"];
  const lastCol = Math.max(1, sheet.getLastColumn());
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  EXTRA.forEach(req => {
    if (!headers.includes(req)) {
      const col = headers.length + 1;
      sheet.getRange(1, col).setValue(req);
      styleHeaderCell_(sheet.getRange(1, col));
      headers.push(req);
    }
  });
  return { sheet, headers };
}

// ── LISTAR TAREAS DEL PANEL DE CONTROL ───────────────────
/**
 * Lee las filas de la hoja "Panel de Control" (cols A–I) y las devuelve como objetos,
 * omitiendo las filas sin nombre de tarea. Incluye _row con el número de fila real.
 * @return {Object[]} Tareas del Panel de Control.
 */
function listTareasPanel_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PANEL);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
  const HDRS = ["Prioridad", "Tarea", "Colaboradores", "Estado", "Marca", "Canal", "Complejidad", "Area", "IP"];
  return data
    .map((row, i) => {
      if (!String(row[1] || "").trim()) return null;
      const obj = { _row: i + 2 };
      HDRS.forEach((h, j) => { const v = row[j]; obj[h] = (v instanceof Date) ? v.toISOString() : v; });
      return obj;
    })
    .filter(Boolean);
}

// ── CREAR TAREA EN PANEL DE CONTROL ──────────────────────
/** Solo escribe en columnas manuales (A, B, E, F, G, H).
 *  Las columnas C (Colaboradores), D (Estado), I (IP) son ARRAYFORMULA — nunca se tocan. */
function crearTareaPanel_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PANEL);
    if (!sheet) return { ok: false, error: "Hoja 'Panel de Control' no encontrada." };

    const tarea       = String(params.tarea       || "").trim();
    const prioridad   = String(params.prioridad   || "").trim();
    const marca       = String(params.marca       || "").trim();
    const canal       = String(params.canal       || "").trim();
    const complejidad = String(params.complejidad || "").trim();
    const area        = String(params.area        || "").trim();

    if (!tarea) return { ok: false, error: "El nombre de la tarea es obligatorio." };

    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const existentes = sheet.getRange(2, PANEL_COL.Tarea, lastRow - 1, 1).getValues().flat()
        .map(v => String(v || "").trim().toLowerCase());
      if (existentes.includes(tarea.toLowerCase()))
        return { ok: false, error: `Ya existe una tarea con el nombre "${tarea}".` };
    }

    const nextRow = lastRow + 1;
    sheet.getRange(nextRow, PANEL_COL.Prioridad).setValue(prioridad);
    sheet.getRange(nextRow, PANEL_COL.Tarea).setValue(tarea);
    // Cols 3 (Colaboradores), 4 (Estado): vacías — las rellena el ARRAYFORMULA del Sheet
    sheet.getRange(nextRow, PANEL_COL.Marca).setValue(marca);
    sheet.getRange(nextRow, PANEL_COL.Canal).setValue(canal);
    sheet.getRange(nextRow, PANEL_COL.Complejidad).setValue(complejidad);
    sheet.getRange(nextRow, PANEL_COL.Area).setValue(area);
    // Col 9 (IP): vacía — la rellena el ARRAYFORMULA del Sheet

    return { ok: true, tarea, row: nextRow };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ── ACTUALIZAR TAREA EN PANEL DE CONTROL ─────────────────
/** Edita columnas manuales. Nunca toca Colaboradores (3), Estado (4), IP (9). */
function actualizarTareaPanel_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PANEL);
  if (!sheet) return { ok: false, error: "Hoja 'Panel de Control' no encontrada." };

  const tarea = String(params.tarea || "").trim();
  if (!tarea) return { ok: false, error: "Falta el parámetro 'tarea'." };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, error: `Tarea "${tarea}" no encontrada.` };

  const col2 = sheet.getRange(2, PANEL_COL.Tarea, lastRow - 1, 1).getValues().flat()
    .map(v => String(v || "").trim());
  const idx = col2.findIndex(v => v.toLowerCase() === tarea.toLowerCase());
  if (idx === -1) return { ok: false, error: `Tarea "${tarea}" no encontrada en Panel de Control.` };

  const rowNum = idx + 2;
  const setIf = (col, key) => {
    if (params[key] !== undefined && String(params[key]).trim() !== "")
      sheet.getRange(rowNum, col).setValue(String(params[key]).trim());
  };
  setIf(PANEL_COL.Prioridad,    "prioridad");
  setIf(PANEL_COL.Marca,        "marca");
  setIf(PANEL_COL.Canal,        "canal");
  setIf(PANEL_COL.Complejidad,  "complejidad");
  setIf(PANEL_COL.Area,         "area");

  return { ok: true, tarea, row: rowNum };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ── LISTAR SUB TAREAS ─────────────────────────────────────
/** Recorre todas las hojas "Tasks - [Persona]" y devuelve las filas cuyo campo
 *  "Tarea" coincide con params.tarea. Si vacío, devuelve todas las sub tareas. */
function listSubTareas_(params) {
  const tareaFiltro = String((params && params.tarea) || "").trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets().filter(s => s.getName().startsWith("Tasks - "));
  const result = [];

  for (const sheet of sheets) {
    const persona = sheet.getName().substring("Tasks - ".length).trim();
    if (sheet.getLastRow() < 2) continue;
    const data = sheet.getDataRange().getValues();
    const rawHdrs = data[0].map(h => String(h).trim());
    const tareaIdx = rawHdrs.indexOf("Tarea");

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row.every(c => c === "" || c === null)) continue;
      const tareaVal = tareaIdx >= 0 ? String(row[tareaIdx] || "").trim() : "";
      if (!tareaVal) continue;
      if (tareaFiltro && tareaVal.toLowerCase() !== tareaFiltro) continue;
      const obj = { _persona: persona, _rowIndex: i + 1 };
      rawHdrs.forEach((h, j) => {
        if (!h || h === "^") return;
        const v = row[j];
        obj[h] = (v instanceof Date) ? v.toISOString() : v;
      });
      result.push(obj);
    }
  }
  return result;
}

// ── GUARDAR SUB TAREA ─────────────────────────────────────
/** Agrega o actualiza una sub tarea en la hoja Tasks-[Persona].
 *  Agrega columnas Fecha limite, Ticket relacionado, Evidencia si no existen.
 *  Identifica fila por coincidencia exacta de Tarea + Sub Tareas (case-insensitive). */
function guardarSubTarea_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const persona           = String(params.persona           || "").trim();
    const tarea             = String(params.tarea             || "").trim();
    const subTarea          = String(params.subTarea          || "").trim();
    const estado            = String(params.estado            || "Pendiente").trim();
    const observacion       = String(params.observacion       || "").trim();
    const fechaLimite       = String(params.fechaLimite       || "").trim();
    const ticketRelacionado = String(params.ticketRelacionado || "").trim();
    const fechaActividad    = String(params.fechaActividad    || "").trim();
    const horaInicio        = String(params.horaInicio        || "").trim();
    const durMinutos        = parseInt(String(params.duracionMinutos || "0")) || 0;
    const horaFin           = (horaInicio && durMinutos)
      ? minToTime_(timeToMin_(horaInicio) + durMinutos)
      : String(params.horaFin || "").trim();

    if (!persona) return { ok: false, error: "Falta 'persona'." };
    if (!tarea)   return { ok: false, error: "Falta 'tarea'." };
    if (!subTarea)return { ok: false, error: "Falta 'subTarea'." };

    const sheet = getTasksSheetForPersona_(persona);
    if (!sheet) return { ok: false, error: `No existe hoja "Tasks - ${persona}". Personas: Joshua, Claudia Macedo, Jose F., Miguel Angel, Franco, Angel.` };

    const { headers } = ensureTasksPersonaExtras_(sheet);
    const colMap = {};
    headers.forEach((h, i) => { if (h && h !== "^") colMap[h] = i + 1; });

    let rowNum = -1;
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2 && colMap["Tarea"] && colMap["Sub Tareas"]) {
      const tVals = sheet.getRange(2, colMap["Tarea"],      lastRow - 1, 1).getValues().flat()
        .map(v => String(v || "").trim().toLowerCase());
      const sVals = sheet.getRange(2, colMap["Sub Tareas"], lastRow - 1, 1).getValues().flat()
        .map(v => String(v || "").trim().toLowerCase());
      for (let i = 0; i < tVals.length; i++) {
        if (tVals[i] === tarea.toLowerCase() && sVals[i] === subTarea.toLowerCase()) { rowNum = i + 2; break; }
      }
    }

    if (rowNum === -1) {
      const newRow = new Array(headers.length).fill("");
      const setNew = (campo, val) => { if (colMap[campo] && val !== "") newRow[colMap[campo] - 1] = sanitizeCell_(val); };
      setNew("Registry", new Date());
      setNew("Tarea",    tarea);
      setNew("Sub Tareas", subTarea);
      setNew("Estado",   estado);
      setNew("Observaciones", observacion);
      setNew("Fecha limite", fechaLimite);
      setNew("Ticket relacionado", ticketRelacionado);
      setNew("Fecha actividad", fechaActividad);
      setNew("Hora inicio", horaInicio);
      setNew("Hora fin", horaFin);
      setNew("Duracion minutos", durMinutos || "");
      sheet.appendRow(newRow);
      rowNum = sheet.getLastRow();
    } else {
      if (colMap["Estado"]) sheet.getRange(rowNum, colMap["Estado"]).setValue(estado);
      const setCell = (k, v) => { if (colMap[k] && v !== "") sheet.getRange(rowNum, colMap[k]).setValue(sanitizeCell_(v)); };
      setCell("Observaciones", observacion);
      setCell("Fecha limite", fechaLimite);
      setCell("Ticket relacionado", ticketRelacionado);
      setCell("Fecha actividad", fechaActividad);
      setCell("Hora inicio", horaInicio);
      setCell("Hora fin", horaFin);
      setCell("Duracion minutos", durMinutos || "");
    }

    return { ok: true, persona, tarea, subTarea, estado, row: rowNum };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ── ADJUNTAR EVIDENCIA A TAREA ────────────────────────────
/** Sube imagen a Drive y actualiza columna "Evidencia" en Tasks-[Persona].
 *  Si hay ticketRelacionado, actualiza también la columna Evidencia en TICKETS. */
function adjuntarEvidenciaTarea_(params) {
  const persona           = String(params.persona           || "").trim();
  const tarea             = String(params.tarea             || "").trim();
  const subTarea          = String(params.subTarea          || "").trim();
  const ticketRelacionado = String(params.ticketRelacionado || "").trim();

  if (!persona) return { ok: false, error: "Falta 'persona'." };

  const uploadResult = uploadEvidencia_({
    imageData: params.imageData,
    mimeType:  params.mimeType,
    codigo:    ticketRelacionado || ("TAREA-" + tarea.replace(/\s/g, "_").substring(0, 20)),
  });
  if (!uploadResult.ok) return uploadResult;
  const viewUrl = uploadResult.viewUrl;

  const sheet = getTasksSheetForPersona_(persona);
  if (!sheet) return { ok: true, viewUrl, warning: `Imagen subida pero no se encontró hoja para "${persona}".` };

  const { headers } = ensureTasksPersonaExtras_(sheet);
  const colMap = {};
  headers.forEach((h, i) => { if (h && h !== "^") colMap[h] = i + 1; });

  let rowNum = -1;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2 && colMap["Tarea"] && colMap["Sub Tareas"]) {
    const tVals = sheet.getRange(2, colMap["Tarea"],      lastRow - 1, 1).getValues().flat()
      .map(v => String(v || "").trim().toLowerCase());
    const sVals = sheet.getRange(2, colMap["Sub Tareas"], lastRow - 1, 1).getValues().flat()
      .map(v => String(v || "").trim().toLowerCase());
    for (let i = 0; i < tVals.length; i++) {
      if (tVals[i] === tarea.toLowerCase() &&
          (!subTarea || sVals[i] === subTarea.toLowerCase())) { rowNum = i + 2; break; }
    }
  }
  if (rowNum === -1 && params.rowIndex) rowNum = parseInt(params.rowIndex) || -1;

  if (rowNum !== -1 && colMap["Evidencia"])
    sheet.getRange(rowNum, colMap["Evidencia"]).setValue(viewUrl);

  if (ticketRelacionado) {
    try {
      const { sheet: ts, headers: th } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
      const codCol  = th.indexOf("CODIGO") + 1;
      const evidCol = th.indexOf("Evidencia") + 1;
      if (codCol && evidCol) {
        const tr = findRowByKey_(ts, codCol, ticketRelacionado);
        if (tr !== -1) ts.getRange(tr, evidCol).setValue(viewUrl);
      }
    } catch (err) { console.warn("[adjuntarEvidenciaTarea] ticket update:", err); }
  }

  return { ok: true, viewUrl, directUrl: uploadResult.directUrl, rowActualizado: rowNum };
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

    // Si hay hora de inicio/fin (timepicker), usar bloque horario exacto sobre la fecha.
    let inicio, fin;
    const baseFecha = parseLocalDateTime_(tarea.fechaInicio) || parseLocalDateTime_(tarea.fechaLimite) || new Date();
    if (tarea.horaInicio) {
      const [hi, mi] = String(tarea.horaInicio).split(":").map(n => parseInt(n) || 0);
      inicio = new Date(baseFecha.getFullYear(), baseFecha.getMonth(), baseFecha.getDate(), hi, mi, 0);
      if (tarea.horaFin) {
        const [hf, mf] = String(tarea.horaFin).split(":").map(n => parseInt(n) || 0);
        fin = new Date(baseFecha.getFullYear(), baseFecha.getMonth(), baseFecha.getDate(), hf, mf, 0);
      } else {
        fin = new Date(inicio.getTime() + 60 * 60 * 1000);
      }
    } else {
      inicio = baseFecha;
      fin    = parseLocalDateTime_(tarea.fechaLimite) || new Date(inicio.getTime() + 60 * 60 * 1000);
    }
    const ev = cal.createEvent(`[Tarea ${tarea.id}] ${tarea.titulo}`, inicio, fin,
      { description: tarea.descripcion || "" });
    return { ok: true, eventId: ev.getId() };
  } catch (err) {
    console.error("[agendarTarea]", err);
    return { ok: false, error: err.message };
  }
}

// ════════════════════════════════════════════════════════
// SPRINT 0: ASIGNACIÓN INTELIGENTE + SLOTS + STATS
// ════════════════════════════════════════════════════════

/** Inicializa la hoja de log de urgentes si no existe. */
function ensureUrgentesLogSheet_() {
  const cols = ["ID", "Usuario", "Email", "Ticket ID", "Fecha"];
  const { sheet } = ensureSheet_(SHEET_URGENTES_LOG, cols);
  return sheet;
}

/** Convierte "HH:MM" a minutos desde medianoche. */
function timeToMin_(hhmm) {
  if (!hhmm) return 0;
  const parts = String(hhmm).split(":");
  return parseInt(parts[0] || "0") * 60 + parseInt(parts[1] || "0");
}

/** Convierte minutos desde medianoche a "HH:MM". */
function minToTime_(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

/** Verifica si una fecha es L-V (0=Dom, 6=Sáb). */
function esLaborable_(date) {
  const d = date.getDay();
  return d !== 0 && d !== 6;
}

/**
 * Genera todos los slots de 15 min para una fecha dentro del horario laboral.
 * Retorna array de { start: "HH:MM", end: "HH:MM" }.
 */
function generarSlotsDia_() {
  const slots = [];
  for (let m = WORK_START_MIN; m + SLOT_MIN <= WORK_END_MIN; m += SLOT_MIN) {
    slots.push({ start: minToTime_(m), end: minToTime_(m + SLOT_MIN) });
  }
  return slots; // 42 slots: 07:00–07:15 ... 17:21–17:36
}

/**
 * Cuenta las tareas activas (no completadas/canceladas) asignadas a un técnico.
 * Usado para asignación automática (menor carga).
 */
function contarTareasActivas_(tecnico) {
  const { sheet } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
  const rows = sheetToObjects_(sheet);
  const inactivos = ["completada", "cancelada"];
  return rows.filter(t =>
    String(t["Asignado a"] || t["Responsable directo"] || "").trim().toLowerCase() === tecnico.toLowerCase() &&
    !inactivos.includes(String(t.Estado || "").trim().toLowerCase())
  ).length;
}

/**
 * Asignación automática: devuelve el técnico TI con menor carga activa.
 * Retorna { tecnico, carga } o null si no hay técnicos activos.
 */
function asignarTicketAuto_() {
  const { sheet } = ensureUsuariosSheet_();
  const activos = sheetToObjects_(sheet).filter(u =>
    String(u.Activo || "").trim().toLowerCase() === "sí");

  // Pool primario: Técnico TI / Líder de equipo. Respaldo: Administrador
  // (así la auto-asignación nunca falla en silencio si solo existe el admin).
  let pool = activos.filter(u => ["Técnico TI", "Líder de equipo"].includes(String(u.Rol || "")));
  let esRespaldo = false;
  if (!pool.length) {
    pool = activos.filter(u => String(u.Rol || "") === "Administrador");
    esRespaldo = true;
  }
  if (!pool.length) return null;

  let mejor = null, menorCarga = Infinity;
  pool.forEach(t => {
    const carga = contarTareasActivas_(t.Nombre);
    if (carga < menorCarga) { menorCarga = carga; mejor = t; }
  });
  return mejor ? { tecnico: mejor.Nombre, carga: menorCarga, respaldo: esRespaldo } : null;
}

/**
 * Retorna los slots disponibles de un técnico para una fecha dada.
 * Bloquea los slots ya ocupados en TAREAS y en Google Calendar (si está habilitado).
 * params: { tecnico, fecha } → fecha en formato "YYYY-MM-DD"
 */
function getSlotsDisponibles_(params) {
  const tecnico = String(params.tecnico || "").trim();
  const fechaStr = String(params.fecha || "").trim();
  if (!tecnico || !fechaStr) return { ok: false, error: "Faltan parámetros tecnico y fecha." };

  const fecha = parseLocalDateTime_(fechaStr);
  if (!fecha) return { ok: false, error: "Fecha inválida." };
  if (!esLaborable_(fecha)) return { ok: false, slotsLibres: [], mensaje: "Día no laborable." };

  const todosSlots = generarSlotsDia_();
  const bloqueados = new Set();

  // Helper: bloquear un rango [hInicio, hFin) sobre los slots del día
  const bloquearRango_ = (hInicio, hFin) => {
    if (!hInicio || !hFin) return;
    const minI = timeToMin_(hInicio), minF = timeToMin_(hFin);
    todosSlots.forEach(s => {
      const si = timeToMin_(s.start);
      if (si >= minI && si < minF) bloqueados.add(s.start);
    });
  };

  // (1) Bloquear por SUB TAREAS del colaborador (hoja "Tasks - [Persona]")
  const tasksSheet = getTasksSheetForPersona_(tecnico);
  if (tasksSheet) {
    sheetToObjects_(tasksSheet).forEach(st => {
      const fechaAct = String(st["Fecha actividad"] || "").slice(0, 10);
      if (fechaAct !== fechaStr) return;
      const estado = String(st["Estado"] || "").trim().toLowerCase();
      if (estado === "cancelada" || estado === "cancelado") return;
      bloquearRango_(String(st["Hora inicio"] || "").trim(), String(st["Hora fin"] || "").trim());
    });
  }

  // (2) Bloquear por TAREAS activas con hora asignada ese día (compatibilidad)
  const { sheet } = ensureSheet_(SHEET_TAREAS, COLS_TAREAS);
  const tareas = sheetToObjects_(sheet);
  tareas.forEach(t => {
    const asig = String(t["Asignado a"] || t["Responsable directo"] || "").trim().toLowerCase();
    if (asig !== tecnico.toLowerCase()) return;
    const fechaTarea = String(t["Fecha inicio"] || "").slice(0, 10);
    if (fechaTarea !== fechaStr) return;
    bloquearRango_(String(t["Hora inicio"] || "").trim(), String(t["Hora fin"] || "").trim());
  });

  // Bloquear por Google Calendar (opcional, si está habilitado)
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("CALENDAR_ENABLED") === "true") {
    try {
      const tecUser = sheetToObjects_(ensureUsuariosSheet_().sheet).find(u =>
        String(u.Nombre || "").toLowerCase() === tecnico.toLowerCase());
      const calEmail = tecUser?.Email;
      if (calEmail) {
        const inicioDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);
        const finDia    = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59);
        const cal = CalendarApp.getCalendarById(calEmail) || CalendarApp.getDefaultCalendar();
        const eventos = cal.getEvents(inicioDia, finDia);
        eventos.forEach(ev => {
          // Respetar eventos marcados como NO asistir (GuestStatus.NO)
          const myStatus = ev.getMyStatus();
          if (myStatus === CalendarApp.GuestStatus.NO) return;
          const evStart = ev.getStartTime(), evEnd = ev.getEndTime();
          const minEvI = evStart.getHours() * 60 + evStart.getMinutes();
          const minEvF = evEnd.getHours()   * 60 + evEnd.getMinutes();
          todosSlots.forEach(s => {
            const si = timeToMin_(s.start), sf = si + SLOT_MIN;
            if (si < minEvF && sf > minEvI) bloqueados.add(s.start);
          });
        });
      }
    } catch (e) { console.warn("[getSlotsDisponibles] Calendar error:", e); }
  }

  const slotsLibres = todosSlots
    .filter(s => !bloqueados.has(s.start))
    .map(s => ({ start: s.start, end: s.end, libre: true }));
  const slotsOcupados = todosSlots
    .filter(s => bloqueados.has(s.start))
    .map(s => ({ start: s.start, end: s.end, libre: false }));

  return {
    ok: true,
    tecnico,
    fecha: fechaStr,
    slotsLibres,
    slotsOcupados,
    todos: todosSlots.map(s => ({
      ...s, libre: !bloqueados.has(s.start)
    })),
  };
}

/**
 * Estima el próximo horario de atención para un técnico.
 * Busca el primer slot libre a partir de hoy.
 */
function estimarHorarioAtencion_(tecnico) {
  const hoy = new Date();
  for (let d = 0; d < 10; d++) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + d);
    if (!esLaborable_(fecha)) continue;
    const fechaStr = fecha.toISOString().slice(0, 10);
    const res = getSlotsDisponibles_({ tecnico, fecha: fechaStr });
    if (res.ok && res.slotsLibres && res.slotsLibres.length > 0) {
      const slot = res.slotsLibres[0];
      return `${fechaStr} ${slot.start}`;
    }
  }
  return "No disponible en los próximos 10 días";
}

/**
 * Registra un ticket urgente, verifica si el usuario supera el umbral (3 en 21 días)
 * y envía correo de alerta a asistenciawaska@gmail.com si es necesario.
 */
function registrarUrgente_(params) {
  const usuario  = String(params.usuario  || "").trim();
  const email    = String(params.email    || "").trim();
  const ticketId = String(params.ticketId || "").trim();
  if (!usuario || !ticketId) return { ok: false, error: "Faltan parámetros." };

  const logSheet = ensureUrgentesLogSheet_();
  const id = nextSeqId_(logSheet, 1, "URG");
  logSheet.appendRow([id, usuario, email, ticketId, new Date()]);

  // Contar urgentes del usuario en los últimos URGENT_WINDOW_DAYS días
  const limite = new Date(Date.now() - URGENT_WINDOW_DAYS * 24 * 3600 * 1000);
  const logs = sheetToObjects_(logSheet);
  const recientes = logs.filter(l => {
    const f = l["Fecha"] ? new Date(l["Fecha"]) : null;
    return f && f >= limite && String(l["Usuario"] || "").trim().toLowerCase() === usuario.toLowerCase();
  });

  if (recientes.length >= URGENT_THRESHOLD) {
    try {
      MailApp.sendEmail(ALERT_EMAIL,
        `[Alerta] Usuario ${usuario} ha generado ${recientes.length} interrupciones urgentes en TI`,
        `Estimado equipo,\n\nEl usuario "${usuario}" (${email || "sin email"}) ha registrado ` +
        `${recientes.length} tickets con prioridad URGENTE en los últimos ${URGENT_WINDOW_DAYS} días.\n\n` +
        `Tickets urgentes recientes:\n${recientes.map(l => `- ${l["Ticket ID"]} (${l["Fecha"]})`).join("\n")}\n\n` +
        `Se solicita coordinar con esta persona para mejorar la gestión de solicitudes y evitar interrupciones en el área de TI.\n\n` +
        `Sistema de Tickets TI`
      );
    } catch (e) { console.warn("[registrarUrgente] alert email:", e); }
    return { ok: true, alerta: true, contador: recientes.length };
  }

  // Aviso al solicitante sobre el uso de urgente
  if (email) {
    try {
      MailApp.sendEmail(email,
        `[Tickets TI] Has activado una solicitud de extrema prioridad`,
        `Hola ${usuario},\n\nHas marcado tu ticket ${ticketId} como URGENTE.\n\n` +
        `⚠️ Esta función genera interrupciones inmediatas en el trabajo del equipo TI. ` +
        `Por favor úsala únicamente cuando sea estrictamente necesario.\n\n` +
        `Recuerda que al llegar a ${URGENT_THRESHOLD} solicitudes urgentes en menos de ` +
        `${URGENT_WINDOW_DAYS} días, se notificará a la coordinación.\n\n` +
        `Gracias por coordinar tus actividades con el área de TI.`
      );
    } catch (e) { console.warn("[registrarUrgente] user email:", e); }
  }

  return { ok: true, alerta: false, contador: recientes.length };
}

/**
 * El técnico confirma (o rechaza/redirige) su apoyo a un ticket.
 * params: { codigo, accion: "confirmar"|"rechazar", nuevoTecnico (si rechaza) }
 */
function confirmarApoyo_(params) {
  const codigo = String(params.codigo || "").trim();
  const accion = String(params.accion || "confirmar").trim().toLowerCase();
  if (!codigo) return { ok: false, error: "Falta el código del ticket." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Confirmado por tecnico", "Tecnico asignado", "Estado"]);
  if (!col["CODIGO"]) return { ok: false, error: "Estructura de hoja incorrecta." };
  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  if (accion === "confirmar") {
    if (col["Confirmado por tecnico"])
      sheet.getRange(rowNum, col["Confirmado por tecnico"]).setValue(new Date().toISOString());
    return { ok: true, codigo, confirmado: true };
  }

  if (accion === "rechazar") {
    const nuevoTecnico = String(params.nuevoTecnico || "").trim();
    if (!nuevoTecnico) return { ok: false, error: "Para rechazar debes indicar un nuevo técnico." };
    if (col["Tecnico asignado"])
      sheet.getRange(rowNum, col["Tecnico asignado"]).setValue(nuevoTecnico);
    if (col["Confirmado por tecnico"])
      sheet.getRange(rowNum, col["Confirmado por tecnico"]).setValue("");
    logHistorial_(codigo, "", "", "", `Ticket redirigido a ${nuevoTecnico}`);
    return { ok: true, codigo, redirigido: true, nuevoTecnico };
  }

  return { ok: false, error: "Acción no reconocida. Usa confirmar o rechazar." };
}

/**
 * Agrega co-responsables a un ticket. El responsable directo nunca cambia aquí
 * (para eso existe transferirTicket_). Siempre valida que haya responsable directo.
 * params: { codigo, coResponsables: "Nombre1,Nombre2" }
 */
function colaborarTicket_(params) {
  const codigo = String(params.codigo || "").trim();
  const coResp = String(params.coResponsables || "").trim();
  if (!codigo) return { ok: false, error: "Falta el código del ticket." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Co responsables", "Responsable directo", "Tecnico asignado"]);
  if (!col["CODIGO"]) return { ok: false, error: "Estructura de hoja incorrecta." };
  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  // Asegurar que haya responsable directo
  let respDir = col["Responsable directo"]
    ? String(sheet.getRange(rowNum, col["Responsable directo"]).getValue() || "").trim()
    : "";
  if (!respDir && col["Tecnico asignado"])
    respDir = String(sheet.getRange(rowNum, col["Tecnico asignado"]).getValue() || "").trim();
  if (!respDir) return { ok: false, error: "El ticket no tiene un responsable directo asignado." };

  if (col["Co responsables"])
    sheet.getRange(rowNum, col["Co responsables"]).setValue(coResp);
  logHistorial_(codigo, "", "", "", `Co-responsables actualizados: ${coResp || "ninguno"}`);
  return { ok: true, codigo, coResponsables: coResp, responsableDirecto: respDir };
}

/**
 * Transfiere el ticket completo a otro técnico. El nuevo técnico se convierte en
 * responsable directo. Siempre debe quedar un responsable asignado.
 * params: { codigo, nuevoTecnico }
 */
function transferirTicket_(params) {
  const codigo       = String(params.codigo || "").trim();
  const nuevoTecnico = String(params.nuevoTecnico || "").trim();
  if (!codigo)       return { ok: false, error: "Falta el código del ticket." };
  if (!nuevoTecnico) return { ok: false, error: "Debes indicar el nuevo responsable." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Tecnico asignado", "Responsable directo",
    "Fecha de asignacion", "Confirmado por tecnico", "Estado"]);
  if (!col["CODIGO"]) return { ok: false, error: "Estructura de hoja incorrecta." };
  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  const anteriorTecnico = col["Tecnico asignado"]
    ? String(sheet.getRange(rowNum, col["Tecnico asignado"]).getValue() || "").trim() : "";

  if (col["Tecnico asignado"])
    sheet.getRange(rowNum, col["Tecnico asignado"]).setValue(nuevoTecnico);
  if (col["Responsable directo"])
    sheet.getRange(rowNum, col["Responsable directo"]).setValue(nuevoTecnico);
  if (col["Fecha de asignacion"])
    sheet.getRange(rowNum, col["Fecha de asignacion"]).setValue(new Date());
  if (col["Confirmado por tecnico"])
    sheet.getRange(rowNum, col["Confirmado por tecnico"]).setValue("");

  logHistorial_(codigo, "", "", "", `Ticket transferido de ${anteriorTecnico} a ${nuevoTecnico}`, nuevoTecnico);
  return { ok: true, codigo, anterior: anteriorTecnico, nuevoTecnico };
}

/**
 * Marca un ticket como revisado por el coordinador.
 * params: { codigo, revisado: "true"|"false" }
 */
function revisarCoordinador_(params) {
  const codigo   = String(params.codigo || "").trim();
  const revisado = String(params.revisado || "true") !== "false";
  if (!codigo) return { ok: false, error: "Falta el código del ticket." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Revisado coordinador"]);
  if (!col["CODIGO"]) return { ok: false, error: "Estructura de hoja incorrecta." };
  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  if (col["Revisado coordinador"])
    sheet.getRange(rowNum, col["Revisado coordinador"]).setValue(revisado ? new Date().toISOString() : "");
  return { ok: true, codigo, revisado };
}

/**
 * Estadísticas administrativas: carga por técnico, top solicitantes, top áreas, incidencias.
 */
function getStatsAdmin_() {
  const { sheet: tSheet } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const tickets = sheetToObjects_(tSheet);

  // Carga por técnico (tickets activos)
  const estadosActivos = ["pendiente", "en atención", "bloqueado", "pausado", "bloqueado por recursos"];
  const cargaTecnico = {};
  tickets.filter(t => estadosActivos.includes(String(t.Estado || "").toLowerCase())).forEach(t => {
    const tec = String(t["Tecnico asignado"] || t["Responsable directo"] || "—").trim();
    cargaTecnico[tec] = (cargaTecnico[tec] || 0) + 1;
  });

  // Top solicitantes
  const contSolicitante = {};
  tickets.forEach(t => {
    const n = String(t.Nombre || "").trim();
    if (n) contSolicitante[n] = (contSolicitante[n] || 0) + 1;
  });

  // Top áreas
  const contArea = {};
  tickets.forEach(t => {
    const a = String(t.Area || "").trim();
    if (a) contArea[a] = (contArea[a] || 0) + 1;
  });

  // Incidencias: tickets urgentes
  const urgentes = tickets.filter(t => String(t.Urgente || "").toLowerCase() === "sí");

  // Tickets sin confirmar (asignados pero sin confirmación del técnico)
  const sinConfirmar = tickets.filter(t =>
    String(t["Tecnico asignado"] || "").trim() &&
    !String(t["Confirmado por tecnico"] || "").trim() &&
    estadosActivos.includes(String(t.Estado || "").toLowerCase())
  ).map(t => ({ codigo: t.CODIGO, tecnico: t["Tecnico asignado"], estado: t.Estado }));

  // SLA vencido: tickets activos cuyo tiempo abierto supera el umbral por prioridad
  const vencidos = tickets.filter(t =>
    estadosActivos.includes(String(t.Estado || "").toLowerCase()) && slaVencido_(t)
  ).map(t => ({
    codigo: t.CODIGO, prioridad: t.Prioridad, estado: t.Estado,
    tecnico: t["Tecnico asignado"] || "—", horas: horasAbierto_(t),
  })).sort((a, b) => b.horas - a.horas);

  const sortByCount = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }));

  return {
    ok: true,
    cargaTecnico: sortByCount(cargaTecnico),
    topSolicitantes: sortByCount(contSolicitante),
    topAreas: sortByCount(contArea),
    totalUrgentes: urgentes.length,
    urgentesRecientes: urgentes.slice(-10).reverse(),
    ticketsSinConfirmar: sinConfirmar,
    slaVencidos: vencidos,
    totalSlaVencidos: vencidos.length,
  };
}

/** Horas transcurridas desde el ingreso de un ticket (objeto crudo de la hoja). */
function horasAbierto_(t) {
  const ing = t["Fecha de ingreso de ticket"] || t["Fecha"] || "";
  if (!ing) return 0;
  const d = new Date(ing);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
}

/** ¿El ticket activo superó su SLA según prioridad? */
function slaVencido_(t) {
  const prio = String(t.Prioridad || "").trim().toLowerCase();
  const limite = SLA_HORAS[prio] || SLA_HORAS_DEFAULT;
  return horasAbierto_(t) > limite;
}

// ════════════════════════════════════════════════════════
// SPRINT 1: COMENTARIOS INTERNOS DEL TICKET
// ════════════════════════════════════════════════════════
/**
 * Agrega un comentario interno al ticket (no cambia el estado).
 * Los comentarios se guardan como JSON array en la celda "Comentarios internos".
 * params: { codigo, comentario, autor }
 */
function comentarTicket_(params) {
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
  const codigo     = String(params.codigo || "").trim();
  const comentario = String(params.comentario || "").trim();
  const autor      = String(params.autor || "").trim() || "Anónimo";
  if (!codigo)     return { ok: false, error: "Falta el código del ticket." };
  if (!comentario) return { ok: false, error: "El comentario no puede estar vacío." };
  if (comentario.length > 1000) return { ok: false, error: "Comentario demasiado largo (máx 1000)." };

  const { sheet, headers } = ensureSheet_(SHEET_TICKETS, COLS_TICKETS);
  const col = colIndexMap_(headers, ["CODIGO", "Comentarios internos"]);
  if (!col["Comentarios internos"]) return { ok: false, error: "Columna de comentarios no disponible." };
  const rowNum = findRowByKey_(sheet, col["CODIGO"], codigo);
  if (rowNum === -1) return { ok: false, error: `Ticket "${codigo}" no encontrado.` };

  let lista = [];
  const actual = String(sheet.getRange(rowNum, col["Comentarios internos"]).getValue() || "").trim();
  if (actual) { try { lista = JSON.parse(actual); } catch (_) { lista = []; } }
  if (!Array.isArray(lista)) lista = [];

  lista.push({ fecha: new Date().toISOString(), autor, texto: comentario });
  sheet.getRange(rowNum, col["Comentarios internos"]).setValue(JSON.stringify(lista));
  return { ok: true, codigo, comentarios: lista };
  } catch (err) { return { ok: false, error: err.message }; }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

// ════════════════════════════════════════════════════════
// SPRINT 3: HISTORIAL DE EQUIPOS
// ════════════════════════════════════════════════════════
/**
 * Garantiza la hoja HISTORIAL_EQUIPOS con sus cabeceras, creándola si falta.
 * @return {Sheet} La hoja de historial de equipos.
 */
function ensureHistEquiposSheet_() {
  const cols = ["Fecha", "Codigo equipo", "Accion", "Detalle", "Usuario"];
  const { sheet } = ensureSheet_(SHEET_HIST_EQUIPOS, cols);
  return sheet;
}

/** Registra un evento en el historial de un equipo. */
function logHistorialEquipo_(codigo, accion, detalle, usuario) {
  try {
    const sheet = ensureHistEquiposSheet_();
    sheet.appendRow([new Date(), codigo, accion, detalle || "", usuario || "sistema"]);
  } catch (err) { console.error("[logHistorialEquipo]", err); }
}

/** Lista el historial de un equipo (o todo si no se pasa código). */
function listHistorialEquipo_(params) {
  const sheet = ensureHistEquiposSheet_();
  const codigo = String((params && params.codigo) || "").trim();
  let rows = sheetToObjects_(sheet);
  if (codigo) rows = rows.filter(r => String(r["Codigo equipo"] || "").trim() === codigo);
  return rows;
}

// ════════════════════════════════════════════════════════
// SPRINT 4: BITÁCORA DE ACCESOS
// ════════════════════════════════════════════════════════
/**
 * Garantiza la hoja ACCESOS (bitácora de logins) con sus cabeceras, creándola si falta.
 * @return {Sheet} La hoja de bitácora de accesos.
 */
function ensureAccesosSheet_() {
  const cols = ["Fecha", "Usuario", "Email", "Resultado", "Detalle"];
  const { sheet } = ensureSheet_(SHEET_ACCESOS, cols);
  return sheet;
}

/** Registra un intento de acceso (login) exitoso o fallido. */
function logAcceso_(usuario, email, resultado, detalle) {
  try {
    const sheet = ensureAccesosSheet_();
    const s = v => sanitizeCell_(String(v == null ? "" : v).slice(0, 200));
    sheet.appendRow([new Date(), s(usuario), s(email), s(resultado), s(detalle)]);
  } catch (err) { console.error("[logAcceso]", err); }
}

/** Lista los accesos registrados (más recientes primero, máx 200). */
function listAccesos_() {
  const sheet = ensureAccesosSheet_();
  const rows = sheetToObjects_(sheet);
  return rows.slice(-200).reverse();
}

// ════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════
/**
 * Punto de entrada JSONP de la WebApp y router principal. Fusiona los parámetros GET con el
 * cuerpo JSON (si lo hay), aplica el gate de autorización AUTHZ por rol a las acciones de
 * escritura/lecturas sensibles (token de sesión obligatorio) y despacha cada `action` a su
 * handler. Toda respuesta se serializa con jsonOutput_ (JSONP si se pasa callback).
 * @param {Object} e Evento de la WebApp (e.parameter, e.postData).
 * @return {TextOutput} Respuesta JSON/JSONP de la acción solicitada.
 */
function doGet(e) {
  let p = (e && e.parameter) ? e.parameter : {};
  // Si llega un POST con cuerpo JSON, fusionarlo para que la acción se enrute y autorice.
  if (e && e.postData && e.postData.contents && /json/i.test(String(e.postData.type || ""))) {
    try {
      const body = JSON.parse(e.postData.contents);
      if (body && typeof body === "object") p = Object.assign({}, p, body);
    } catch (_) {
      return jsonOutput_({ status: "error", message: "Cuerpo JSON inválido" }, (p && p.callback) || null);
    }
  }
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
      case "logout":            return jsonOutput_(logout_(p), callback);
      case "usuarios":          return jsonOutput_(listUsuarios_(), callback);
      case "crearUsuario":      return jsonOutput_(crearUsuario_(p), callback);
      case "actualizarUsuario": return jsonOutput_(actualizarUsuario_(p), callback);

      // ── Equipos (inventario) ──
      case "equipos":           return jsonOutput_(listEquipos_(), callback);
      case "crearEquipo":       return jsonOutput_(crearEquipo_(p), callback);
      case "actualizarEquipo":  return jsonOutput_(actualizarEquipo_(p), callback);

      // ── Celulares (Registro_Celulares) ──
      case "celulares":         return jsonOutput_(listCelulares_(), callback);
      case "crearCelular":      return jsonOutput_(crearCelular_(p), callback);
      case "actualizarCelular": return jsonOutput_(actualizarCelular_(p), callback);

      // ── Tareas + catálogo ──
      case "tareas":            return jsonOutput_(listTareas_(p), callback);
      case "crearTarea":        return jsonOutput_(crearTarea_(p), callback);
      case "actualizarTarea":   return jsonOutput_(actualizarTarea_(p), callback);
      case "catalogo":          return jsonOutput_(listCatalogoTareas_(), callback);
      case "crearCatalogoTarea": return jsonOutput_(crearCatalogoTarea_(p), callback);

      // ── Panel de Control ──
      case "listTareasPanel":       return jsonOutput_(listTareasPanel_(), callback);
      case "crearTareaPanel":       return jsonOutput_(crearTareaPanel_(p), callback);
      case "actualizarTareaPanel":  return jsonOutput_(actualizarTareaPanel_(p), callback);
      case "listSubTareas":         return jsonOutput_(listSubTareas_(p), callback);
      case "guardarSubTarea":       return jsonOutput_(guardarSubTarea_(p), callback);
      case "adjuntarEvidenciaTarea": return jsonOutput_(adjuntarEvidenciaTarea_(p), callback);

      // ── Sprint 0: asignación inteligente ──
      case "asignarAuto":        return jsonOutput_(asignarTicketAuto_(), callback);
      case "slotsDisponibles":   return jsonOutput_(getSlotsDisponibles_(p), callback);
      case "confirmarApoyo":     return jsonOutput_(confirmarApoyo_(p), callback);
      case "colaborarTicket":    return jsonOutput_(colaborarTicket_(p), callback);
      case "transferirTicket":   return jsonOutput_(transferirTicket_(p), callback);
      case "revisarCoordinador": return jsonOutput_(revisarCoordinador_(p), callback);
      case "statsAdmin":         return jsonOutput_(getStatsAdmin_(), callback);

      // ── Sprint 1: comentarios internos ──
      case "comentarTicket":     return jsonOutput_(comentarTicket_(p), callback);

      // ── Sprint 3: historial de equipos ──
      case "historialEquipo":    return jsonOutput_(listHistorialEquipo_(p), callback);

      // ── Sprint 4: bitácora de accesos ──
      case "accesos":            return jsonOutput_(listAccesos_(), callback);

      // ── Default: todos los tickets (solo cuando NO se especifica action) ──
      default: {
        if (p.action && action !== "tickets") {
          return jsonOutput_({ status: "error", message: "Acción no reconocida: " + action }, callback);
        }
        const auth = requireAuth_(p, []);
        if (auth.fail) return jsonOutput_(auth.fail, callback);
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

/**
 * Punto de entrada JSONP para peticiones POST. Delega en doGet para aplicar el mismo router
 * y gate de autorización AUTHZ, de modo que GET y POST comparten reglas.
 * @param {Object} e Evento de la WebApp (e.postData con el cuerpo JSON).
 * @return {TextOutput} Respuesta JSON/JSONP de la acción solicitada.
 */
function doPost(e) {
  try {
    // Delegamos en el router GET para que apliquen el mismo gate de autorización y reglas.
    return doGet(e);
  } catch (err) {
    return jsonOutput_({ status: "error", message: String(err) }, null);
  }
}

// ════════════════════════════════════════════════════════
// MÓDULO CELULARES (Registro_Celulares) — integrado
// ════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════
// ACCESO ADMIN POR DEFECTO (admin/1234) + sal — desde seed-admin.gs
// ════════════════════════════════════════════════════════
/**
 * seed-admin.gs — Acceso administrador por defecto (admin / PIN 1234) + sal propia.
 * ──────────────────────────────────────────────────────────────────────────────
 * Para el BACKEND AVANZADO ("IT: Control Tasks Flow"). Es un script VINCULADO al
 * Sheet contenedor (usa SpreadsheetApp.getActiveSpreadsheet()), así que este archivo
 * DEBE pegarse en el MISMO proyecto Apps Script de ese Sheet:
 *     en el Sheet → Extensiones → Apps Script → + → Secuencia de comandos.
 * (En un proyecto independiente fallaría: getActiveSpreadsheet() devolvería null.)
 *
 * USO RECOMENDADO (un solo clic):
 *   Selecciona la función  configurarAccesoAdmin  y pulsa ▶ Ejecutar.
 *   Hace TODO en orden: 1) fija la sal, 2) (re)siembra el admin con esa sal.
 *
 * Funciones sueltas (opcional):
 *   - fijarPinSalt()      Genera y guarda una "sal" (PIN_SALT) secreta y única en las
 *                         Script Properties (almacén privado del proyecto). Si ya hay
 *                         una, la conserva; fijarPinSalt(true) la regenera (luego vuelve
 *                         a correr seedAdminUsuario).
 *   - seedAdminUsuario()  Garantiza el admin con PIN 1234. Idempotente: si no existe lo
 *                         crea; si existe le restablece PIN=1234, Rol y Activo. Sin duplicar.
 *   - cualSheet()         Imprime la URL del Sheet vinculado (para confirmar que es el bueno).
 *
 * El PIN se guarda HASHEADO (SHA-256 + sal) reutilizando hashPin_(): nunca queda 1234
 * en texto plano en la hoja. Reutiliza helpers del backend (ensureUsuariosSheet_,
 * sheetToObjects_, rowFromMap_, hashPin_, findRowByKey_) y NO redefine ninguno: cero conflictos.
 *
 * NOTA: si vuelves a sacar una "Copia de" este Sheet, la copia NO hereda las Script
 * Properties → se pierde la sal y el PIN deja de coincidir. En ese caso, vuelve a
 * ejecutar configurarAccesoAdmin en la copia.
 */

const ADMIN_DEFECTO = {
  ID: 'USR-001', Nombre: 'Administrador', Email: 'admin',
  PIN: '1234', Rol: 'Administrador', Equipo: 'TI',
};

/** Hace todo en orden: 1) fija la sal, 2) (re)siembra el admin. Recomendado. */
function configurarAccesoAdmin() {
  const salMsg   = fijarPinSalt();        // 1) sal estable (se conserva si ya existía)
  const adminMsg = seedAdminUsuario();    // 2) admin cifrado con esa sal
  const url      = cualSheet();
  const msg = [
    '✅ Acceso admin configurado.',
    '  • ' + salMsg,
    '  • ' + adminMsg,
    '  • Sheet: ' + url,
    '  • Entra con:  admin / 1234',
  ].join('\n');
  Logger.log(msg);
  return msg;
}

/**
 * Genera y guarda una sal secreta única (PIN_SALT) en Script Properties.
 * - Si ya existe una sal, la CONSERVA (para no invalidar PINs ya cifrados).
 * - fijarPinSalt(true) la regenera a la fuerza (luego re-ejecuta seedAdminUsuario).
 */
function fijarPinSalt(force) {
  const props  = PropertiesService.getScriptProperties();
  const actual = props.getProperty('PIN_SALT');
  if (actual && !force) {
    Logger.log('PIN_SALT ya existía; se conserva.');
    return 'PIN_SALT ya existía (conservada).';
  }
  const nueva = 'ti-' + Utilities.getUuid();   // única y no adivinable
  props.setProperty('PIN_SALT', nueva);
  Logger.log('PIN_SALT fijada: %s  (vive en Configuración del proyecto → Propiedades de la secuencia de comandos)', nueva);
  return 'PIN_SALT fijada (nueva).';
}

/**
 * Garantiza el usuario admin (admin / PIN 1234). Idempotente y seguro de re-ejecutar.
 * Cifra el PIN con la sal ACTUAL (la misma que usará el login), por eso funciona aunque
 * la sal haya cambiado al copiar el Sheet.
 */
function seedAdminUsuario() {
  const a = ADMIN_DEFECTO;
  const { sheet, headers } = ensureUsuariosSheet_();   // crea la hoja USUARIOS si falta

  // Buscar un admin existente por Email = "admin" o Nombre = "Administrador" (igual que el login).
  const filas = sheetToObjects_(sheet);
  let admin = null;
  for (let i = 0; i < filas.length; i++) {
    const email = String(filas[i].Email  || '').trim().toLowerCase();
    const nom   = String(filas[i].Nombre || '').trim().toLowerCase();
    if (email === a.Email || nom === a.Nombre.toLowerCase()) { admin = filas[i]; break; }
  }

  if (!admin) {
    // No existe → crear la fila completa (8 columnas).
    sheet.appendRow(rowFromMap_(headers, {
      'ID': a.ID, 'Nombre': a.Nombre, 'Email': a.Email,
      'PIN': hashPin_(a.PIN), 'Rol': a.Rol, 'Equipo': a.Equipo,
      'Activo': 'Sí', 'Fecha alta': new Date(),
    }));
    Logger.log('✅ Admin creado: admin / %s', a.PIN);
    return 'Admin creado: admin / ' + a.PIN;
  }

  // Existe → restablecer PIN, Rol y Activo (idempotente, sin duplicar).
  const rowNum = findRowByKey_(sheet, headers.indexOf('ID') + 1, admin.ID);
  if (rowNum === -1) return 'No se pudo ubicar la fila del admin (ID "' + admin.ID + '").';
  sheet.getRange(rowNum, headers.indexOf('PIN') + 1).setValue(hashPin_(a.PIN));
  sheet.getRange(rowNum, headers.indexOf('Rol') + 1).setValue(a.Rol);
  sheet.getRange(rowNum, headers.indexOf('Activo') + 1).setValue('Sí');
  Logger.log('✅ Admin restablecido (fila %s): admin / %s', rowNum, a.PIN);
  return 'Admin restablecido: admin / ' + a.PIN + ' (fila ' + rowNum + ')';
}

/** Imprime/retorna la URL del Sheet vinculado, para confirmar que es el correcto. */
function cualSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const url = ss ? ss.getUrl() : '(null: este script NO está vinculado a ningún Sheet)';
  Logger.log('Sheet vinculado: %s', url);
  return url;
}


