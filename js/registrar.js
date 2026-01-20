/**
 * ============================================================
 * registrar.js
 * ------------------------------------------------------------
 * Frontend para registrar tickets contra el WebApp de Apps Script.
 *
 * Puntos clave:
 * - El backend (Apps Script) genera el CODIGO: REQ-001 / INC-001 / EVE-001
 * - El backend fuerza Estado = "Pendiente" al registrar
 * - Evidencia (imagen) está oculto por ahora (más adelante se subirá a Drive)
 * ============================================================
 */

/**
 * Rellena el selector de personal según el área elegida.
 * Se activa con el evento onchange del <select id="area">.
 */
function cargarPersonal() {
  // Diccionario local (rápido) para personal por área.
  // Más adelante puede salir de la hoja Config usando un endpoint ?action=config.
  const personalPorArea = {
    "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"],
  };

  const areaElement = document.getElementById("area");
  const nombreElement = document.getElementById("nombre");

  // Seguridad: si esta página no tiene esos elementos, no hacemos nada.
  if (!areaElement || !nombreElement) return;

  const areaSel = areaElement.value;

  // Limpia opciones actuales
  nombreElement.innerHTML = '<option value="">Seleccione personal...</option>';

  // Si hay área válida, carga sus usuarios
  if (areaSel && personalPorArea[areaSel]) {
    nombreElement.disabled = false;
    personalPorArea[areaSel].forEach((n) => {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      nombreElement.appendChild(opt);
    });
  } else {
    nombreElement.disabled = true;
    nombreElement.innerHTML = '<option value="">Seleccione primero el área...</option>';
  }
}

/**
 * Cambia el texto del botón según el tipo seleccionado.
 */
function actualizarBoton() {
  const tipoElement = document.getElementById("tipo");
  const btn = document.getElementById("btnEnviar");

  if (!tipoElement || !btn) return;

  const tipo = tipoElement.value;
  btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Ticket";
}

/**
 * Helper: muestra alertas consistentes.
 */
function showAlertSuccess(data) {
  Swal.fire({
    title: `¡${data.tipo} Registrado!`,
    icon: "success",
    html: `Código generado: <b>${data.id}</b><br>Usuario: <b>${data.usuario}</b>`,
    confirmButtonText: "Aceptar",
  });
}

function showAlertError(message) {
  Swal.fire({
    title: "Error",
    icon: "error",
    text: message,
    confirmButtonText: "Aceptar",
  });
}

/**
 * Envío del formulario.
 * Protegido para que no falle en otras páginas.
 */
const formularioTicket = document.getElementById("ticketForm");

if (formularioTicket) {
  formularioTicket.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("btnEnviar");
    if (!btn) return;

    // Estado visual
    btn.disabled = true;
    btn.innerText = "Registrando...";

    try {
      // Empaqueta datos del formulario
      const formData = new FormData(formularioTicket);

      // Forzamos estado a Pendiente desde el frontend también (doble seguridad)
      // El backend igualmente lo fuerza.
      formData.set("estado", "Pendiente");

      // IMPORTANTE: no enviamos archivos binarios (evidencia) aún.
      // Cuando se habilite, se debe subir a Drive y guardar un link.
      formData.delete("evidencia");

      // Llamada al backend
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: "POST",
        body: new URLSearchParams(formData),
      });

      if (!res.ok) {
        throw new Error("Error en la respuesta del servidor");
      }

      const data = await res.json();

      if (data.status !== "success") {
        throw new Error(data.message || "No se pudo registrar el ticket");
      }

      showAlertSuccess(data);

      // Limpia el formulario
      formularioTicket.reset();
      actualizarBoton();

      // Reinicia selector de personal
      const nombreElement = document.getElementById("nombre");
      if (nombreElement) {
        nombreElement.disabled = true;
        nombreElement.innerHTML = '<option value="">Seleccione primero el área...</option>';
      }
    } catch (err) {
      console.error("❌ Error registrando ticket:", err);
      showAlertError("No se pudo completar el registro. Verifica tu conexión y la URL del script.");
    } finally {
      btn.disabled = false;
      actualizarBoton();
    }
  });
}
