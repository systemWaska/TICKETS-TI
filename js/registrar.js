/**
 * ============================================================
 * registrar.js
 * ------------------------------------------------------------
 * Página: registrar.html
 *
 * Objetivo:
 * - Cargar catálogos (Área, Usuario, Tipo, Prioridad) desde la hoja "Config"
 *   usando el endpoint del WebApp de Apps Script:  ?action=config
 * - Registrar tickets contra el WebApp (POST)
 * - Forzar Estado = "Pendiente" siempre al crear
 * - Evidencia (imagen) permanece oculta por ahora (no se envía)
 *
 * Requisitos:
 * - config.js debe tener CONFIG.SCRIPT_URL apuntando a tu WebApp publicado.
 * - En el Sheet, la hoja "Config" debe tener por lo menos:
 *     Area | Usuario | Tipo | Prioridad | Estado   (cabeceras)
 *   (Si algunas columnas no existen, el frontend usa valores por defecto.)
 * ============================================================
 */

// Guardamos la config en memoria para poder filtrar usuarios por área.
let CONFIG_CACHE = null;

/**
 * Ejecuta al cargar la página.
 */
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Carga catálogos desde Google Sheet (Config)
  await cargarConfig();

  // 1.1) Aplica parámetros de URL (ej: ?urgent=1)
  // Esto permite atajos desde el Home sin duplicar pantallas.
  applyUrlPresets_();

  // 2) Asegura que el botón tenga el texto correcto
  actualizarBoton();
});

/**
 * Lee query params y preconfigura el formulario.
 * - urgent=1: prioridad Alta (y opcionalmente tipo Incidencia)
 */
function applyUrlPresets_() {
  const params = new URLSearchParams(window.location.search || "");
  const urgent = params.get("urgent");

  const tipoEl = document.getElementById("tipo");
  const prioridadEl = document.getElementById("prioridad");

  // Si no estamos en registrar.html, no hacemos nada.
  if (!tipoEl || !prioridadEl) return;

  if (urgent === "1" || urgent === "true") {
    // Por defecto, un urgente suele ser una incidencia.
    // Si el usuario cambia el tipo después, está perfecto.
    if ([...tipoEl.options].some(o => o.value === "Incidencia")) {
      tipoEl.value = "Incidencia";
    }

    // Forzamos Alta prioridad si existe.
    if ([...prioridadEl.options].some(o => o.value === "Alta")) {
      prioridadEl.value = "Alta";
    }

    // Refrescamos textos del botón y del label de título.
    actualizarBoton();
  }
}

/**
 * Llama al backend para obtener catálogos desde la hoja Config.
 * Endpoint: GET {SCRIPT_URL}?action=config
 */
async function cargarConfig() {
  const tipoEl = document.getElementById("tipo");
  const areaEl = document.getElementById("area");
  const nombreEl = document.getElementById("nombre");
  const prioridadEl = document.getElementById("prioridad");

  // Si no estamos en registrar.html, no hacemos nada.
  if (!tipoEl || !areaEl || !nombreEl || !prioridadEl) return;

  try {
    // IMPORTANTE (CORS): usamos JSONP porque el frontend puede estar
    // hospedado en GitHub Pages / servidor externo.
    // Esto llama:  .../exec?action=config&callback=...
    const cfg = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=config`);

    if (!cfg || cfg.status !== "success") {
      throw new Error(cfg?.message || "No se pudo cargar Config");
    }

    // Cache global para filtrar usuarios por área.
    CONFIG_CACHE = cfg;

    // ----- TIPOS -----
    // Si tu Config trae tipos, se usan. Si no, se usan defaults.
    const tipos = (cfg.tipos && cfg.tipos.length)
      ? cfg.tipos
      : ["Incidencia", "Requerimiento", "Evento"];

    tipoEl.innerHTML = `<option value="">Seleccione...</option>` +
      tipos.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

    // ----- ÁREAS -----
    const areas = (cfg.areas && cfg.areas.length) ? cfg.areas : [];
    areaEl.innerHTML = `<option value="">Seleccione área...</option>` +
      areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("");

    // ----- PRIORIDADES -----
    const prioridades = (cfg.prioridades && cfg.prioridades.length)
      ? cfg.prioridades
      : ["Baja", "Media", "Alta"];

    // Nota: NO dejamos prioridad preseleccionada.
    prioridadEl.innerHTML = `<option value="">Seleccione prioridad...</option>` +
      prioridades.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("");

    // Inicialmente el personal está deshabilitado hasta elegir área.
    nombreEl.disabled = true;
    nombreEl.innerHTML = `<option value="">Seleccione primero el área...</option>`;

  } catch (err) {
    console.error("❌ Error cargando Config:", err);
    // Fallback mínimo para que el formulario no quede roto.
    // (Esto NO inventa datos del negocio, solo deja opciones genéricas.)
    tipoEl.innerHTML = `
      <option value="">Seleccione...</option>
      <option value="Incidencia">Incidencia</option>
      <option value="Requerimiento">Requerimiento</option>
      <option value="Evento">Evento</option>
    `;
    prioridadEl.innerHTML = `
      <option value="">Seleccione prioridad...</option>
      <option value="Baja">Baja</option>
      <option value="Media">Media</option>
      <option value="Alta">Alta</option>
    `;
    areaEl.innerHTML = `<option value="">No se pudo cargar áreas (revisa Config / URL)</option>`;
  }
}

/**
 * Rellena el selector de personal según el área elegida.
 * Se activa con el onchange del <select id="area">.
 */
function cargarPersonal() {
  const areaEl = document.getElementById("area");
  const nombreEl = document.getElementById("nombre");

  if (!areaEl || !nombreEl) return;

  const areaSel = String(areaEl.value || "").trim();

  // Si no hay área elegida, bloqueamos el personal.
  if (!areaSel) {
    nombreEl.disabled = true;
    nombreEl.innerHTML = `<option value="">Seleccione primero el área...</option>`;
    return;
  }

  // Si aún no llegó la config, bloqueamos.
  if (!CONFIG_CACHE || !Array.isArray(CONFIG_CACHE.raw)) {
    nombreEl.disabled = true;
    nombreEl.innerHTML = `<option value="">Config no cargada (reintente)</option>`;
    return;
  }

  // Filtra usuarios por área desde el RAW de Config.
  const usuarios = CONFIG_CACHE.raw
    .filter(r => String(r.Area || r.area || "").trim() === areaSel)
    .map(r => String(r.Usuario || r.usuario || "").trim())
    .filter(Boolean);

  // Quita duplicados manteniendo el orden.
  const seen = new Set();
  const unique = usuarios.filter(u => (seen.has(u) ? false : (seen.add(u), true)));

  if (!unique.length) {
    nombreEl.disabled = true;
    nombreEl.innerHTML = `<option value="">No hay usuarios para esta área</option>`;
    return;
  }

  // Renderiza el select
  nombreEl.disabled = false;
  nombreEl.innerHTML = `<option value="">Seleccione personal...</option>` +
    unique.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join("");
}

/**
 * Cambia el texto del botón según el tipo seleccionado.
 */
function actualizarBoton() {
  const tipoEl = document.getElementById("tipo");
  const btn = document.getElementById("btnEnviar");
  const tituloLabel = document.getElementById("tituloLabel");
  if (!tipoEl || !btn) return;

  const tipo = tipoEl.value;
  btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Ticket";

  // Cambia el texto del label según el tipo seleccionado.
  if (tituloLabel) {
    if (!tipo) {
      tituloLabel.textContent = "Título *";
    } else {
      // Gramática: Incidencia (fem) vs Requerimiento/Evento (masc)
      const articulo = {
        Incidencia: "de la",
        Requerimiento: "del",
        Evento: "del",
      }[tipo] || "de";

      // Ej: "Título de la Incidencia *" / "Título del Requerimiento *" / "Título del Evento *"
      tituloLabel.textContent = `Título ${articulo} ${tipo} *`;
    }
  }
}

/**
 * Helper: escapar HTML (evita que valores del Sheet rompan el DOM)
 */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Helpers de alertas.
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
      // Validación HTML5 nativa (required, minlength, etc.)
      if (!formularioTicket.checkValidity()) {
        formularioTicket.reportValidity();
        return;
      }

      const formData = new FormData(formularioTicket);

      // ✅ Forzamos estado a Pendiente (frontend)
      // (El backend también lo fuerza, esto es doble seguridad.)
      formData.set("estado", "Pendiente");

      // 🚫 Evidencia (imagen) aún NO se envía.
      // Cuando se habilite: subir a Drive y guardar el link en la columna Evidencia.
      formData.delete("evidencia");

      // =====================================================
      // IMPORTANTE (CORS):
      // En sitios externos, el fetch POST hacia Apps Script puede
      // fallar por CORS. Por eso registramos usando JSONP:
      //   GET .../exec?action=create&...&callback=...
      // =====================================================
      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        // Seguridad: no mandamos evidencia aún
        if (key === "evidencia") return;
        params.set(key, value);
      });

      const data = await window.jsonpRequest(`${CONFIG.SCRIPT_URL}?action=create&${params.toString()}`);

      if (data.status !== "success") {
        throw new Error(data.message || "No se pudo registrar el ticket");
      }

      showAlertSuccess(data);

      // Limpia el formulario
      formularioTicket.reset();
      actualizarBoton();

      // Reinicia selector de personal
      const nombreEl = document.getElementById("nombre");
      if (nombreEl) {
        nombreEl.disabled = true;
        nombreEl.innerHTML = `<option value="">Seleccione primero el área...</option>`;
      }

    } catch (err) {
      console.error("❌ Error registrando ticket:", err);
      showAlertError(
        "No se pudo completar el registro. Verifica tu conexión, la URL en config.js y que el script esté publicado."
      );
    } finally {
      btn.disabled = false;
      actualizarBoton();
    }
  });
}
