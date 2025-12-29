// --- LECTURA PARA EL DASHBOARD ---
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Tickets") || ss.getSheets()[0];
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const json = rows.map(row => {
      let obj = {};
      headers.forEach((header, i) => {
        obj[header.toString().trim()] = row[i];
      });
      return obj;
    });

    return ContentService.createTextOutput(JSON.stringify(json))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- REGISTRO Y ENVÍO DE CORREO ---
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Tickets") || ss.getSheets()[0];
    const data = e.parameter;

    const tipo = data.tipo || "Requerimiento";
    let prefijo = (tipo === "Incidencia") ? "INC" : (tipo === "Evento" ? "EVE" : "REQ");

    // Generar ID independiente
    const nextId = generarNuevoId(prefijo, sheet);

    const nuevaFila = [
      nextId, data.nombre, data.area, data.titulo, data.descripcion,
      data.prioridad, "", "En Proceso", new Date(), data.email, tipo
    ];
    
    sheet.appendRow(nuevaFila);

    // ENVIAR CORREO (No se olvida)
    enviarCorreo(data.email, nextId, data.nombre, data.titulo, tipo);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success", id: nextId, tipo: tipo, usuario: data.nombre
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function generarNuevoId(prefijo, sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return prefijo + "-001";
  const valores = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNum = 0;
  valores.forEach(item => {
    if (item && item.toString().startsWith(prefijo + "-")) {
      const num = parseInt(item.toString().split("-")[1]);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  return prefijo + "-" + Utilities.formatString("%03d", maxNum + 1);
}

function enviarCorreo(email, id, nombre, titulo, tipo) {
  const asunto = `Ticket Registrado: ${id}`;
  const cuerpo = `Hola ${nombre}, tu ticket ${tipo} ha sido registrado con el código ${id}.\n\nTítulo: ${titulo}`;
  MailApp.sendEmail(email, asunto, cuerpo);
}
