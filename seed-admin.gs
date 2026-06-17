/**
 * seed-admin.gs — Usuario administrador por defecto (admin / PIN 1234)
 * ──────────────────────────────────────────────────────────────────────
 * El backend ya crea admin/1234 en una instalación NUEVA (cuando la hoja USUARIOS
 * está vacía, vía ensureUsuariosSheet_ → setup()). Esta función cubre el caso de
 * una hoja que YA tiene datos: garantiza —de forma IDEMPOTENTE— que exista el
 * usuario administrador con PIN 1234, Rol = Administrador y Activo = Sí, sin
 * duplicar filas. Se puede ejecutar las veces que haga falta.
 *
 * CÓMO USAR (una sola vez):
 *   1. Pega este archivo junto al backend en el editor de Apps Script.
 *   2. En el selector de funciones elige  seedAdminUsuario  y pulsa ▶ Ejecutar.
 *   3. Autoriza si Google lo pide. Listo: ingresa con  usuario: admin  /  PIN: 1234.
 *
 * El PIN se guarda HASHEADO (SHA-256 + sal del backend) reutilizando hashPin_(),
 * por lo que nunca queda el 1234 en texto plano en la hoja.
 *
 * Reutiliza helpers del backend (ensureUsuariosSheet_, sheetToObjects_, rowFromMap_,
 * hashPin_); NO redefine ninguna función, por lo que no genera conflictos.
 */
function seedAdminUsuario() {
  const ADMIN = {
    ID: 'USR-001', Nombre: 'Administrador', Email: 'admin',
    Rol: 'Administrador', Equipo: 'TI',
  };
  const PIN_DEFECTO = '1234';

  const { sheet, headers } = ensureUsuariosSheet_();   // crea la hoja con encabezados si no existe
  const colPIN = headers.indexOf('PIN') + 1;
  const colRol = headers.indexOf('Rol') + 1;
  const colAct = headers.indexOf('Activo') + 1;

  // Buscar un admin existente por Email = "admin" o Nombre = "Administrador".
  const filas = sheetToObjects_(sheet);
  let fila = -1;
  for (let i = 0; i < filas.length; i++) {
    const email = String(filas[i].Email  || '').trim().toLowerCase();
    const nom   = String(filas[i].Nombre || '').trim().toLowerCase();
    if (email === 'admin' || nom === 'administrador') { fila = i + 2; break; } // +2: la fila 1 son los encabezados
  }

  if (fila === -1) {
    // No existe → crear la fila completa (8 columnas).
    sheet.appendRow(rowFromMap_(headers, {
      'ID': ADMIN.ID, 'Nombre': ADMIN.Nombre, 'Email': ADMIN.Email,
      'PIN': hashPin_(PIN_DEFECTO), 'Rol': ADMIN.Rol, 'Equipo': ADMIN.Equipo,
      'Activo': 'Sí', 'Fecha alta': new Date(),
    }));
    Logger.log('✅ Admin creado: admin / %s', PIN_DEFECTO);
    return 'Admin creado: admin / ' + PIN_DEFECTO;
  }

  // Existe → restablecer PIN, Rol y Activo (idempotente, sin duplicar).
  sheet.getRange(fila, colPIN).setValue(hashPin_(PIN_DEFECTO));
  sheet.getRange(fila, colRol).setValue(ADMIN.Rol);
  sheet.getRange(fila, colAct).setValue('Sí');
  Logger.log('✅ Admin restablecido (fila %s): admin / %s', fila, PIN_DEFECTO);
  return 'Admin restablecido: admin / ' + PIN_DEFECTO;
}
