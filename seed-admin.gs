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
