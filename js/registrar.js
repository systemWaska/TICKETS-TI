/**
 * Rellena el segundo menú desplegable según el área elegida.
 * Esta función se activa con el evento 'onchange' en el HTML.
 */
function cargarPersonal() {
    // Diccionario de datos: Personal asignado a cada área
    const personalPorArea = {
        "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
        "CONTABILIDAD": ["ERICK", "ALONSO"],
        "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
        "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
    };

    const areaElement = document.getElementById("area");
    const nombreElement = document.getElementById("nombre");

    // Verificamos que ambos elementos existan en el HTML actual
    if (!areaElement || !nombreElement) return;

    const areaSel = areaElement.value;
    
    // Limpia las opciones actuales del selector de nombre
    nombreElement.innerHTML = '<option value="">Seleccione personal...</option>';
    
    if (areaSel && personalPorArea[areaSel]) {
        nombreElement.disabled = false; // Habilita el campo si hay un área válida
        personalPorArea[areaSel].forEach(n => {
            let opt = document.createElement("option");
            opt.value = n; 
            opt.text = n;
            nombreElement.appendChild(opt);
        });
    } else { 
        nombreElement.disabled = true; // Deshabilita si no hay área seleccionada
    }
}

/**
 * Cambia dinámicamente el texto del botón de envío según el tipo de solicitud.
 */
function actualizarBoton() {
    const tipoElement = document.getElementById("tipo");
    const btn = document.getElementById("btnEnviar");

    // Solo ejecuta si los elementos existen
    if (tipoElement && btn) {
        const tipo = tipoElement.value;
        // Si no hay tipo seleccionado, usa un texto genérico
        btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
    }
}

/**
 * Lógica principal de envío del formulario.
 * Protegida con un IF para que NO dé error en páginas donde no existe el formulario.
 */
const formularioTicket = document.getElementById("ticketForm");

if (formularioTicket) {
    formularioTicket.addEventListener("submit", function(e) {
        e.preventDefault(); // Detiene la recarga de la página
        
        const btn = document.getElementById("btnEnviar");
        const formData = new FormData(this); // Empaqueta los datos del formulario
        
        // Estado visual de carga
        btn.disabled = true;
        btn.innerText = "Registrando...";

        // 1. Envío a la API de Google Sheets (definida en config.js)
        fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: new URLSearchParams(formData)
        })
        .then(res => {
            // Validamos que el servidor responda un JSON válido
            if (!res.ok) throw new Error("Error en la respuesta del servidor");
            return res.json();
        })
        .then(data => {
            if(data.status === "success") {
                // Alerta de éxito con los datos devueltos por el servidor
                Swal.fire({
                    title: `¡${data.tipo} Registrado!`,
                    icon: 'success',
                    html: `ID Generado: <b>${data.id}</b><br>Usuario: <b>${data.usuario}</b>`,
                    confirmButtonText: 'Aceptar'
                });

                // 2. Envío de Notificación por EmailJS
                // Solo se ejecuta si la librería EmailJS cargó correctamente en el HTML
                if (typeof emailjs !== 'undefined') {
                    emailjs.send("tickets-ti", "template_5j0iae9", {
                        to_email: document.getElementById('email').value,
                        user_name: data.usuario,
                        ticket_id: data.id,       // ID real generado (ej: INC-001)
                        ticket_title: data.titulo,
                        ticket_type: data.tipo
                    }).then(() => console.log("✅ Correo enviado"))
                      .catch(err => console.error("❌ Fallo EmailJS:", err));
                }

                // Limpieza del formulario tras el éxito
                this.reset();
                actualizarBoton();
            } else {
                throw new Error(data.message || "Error desconocido en el servidor");
            }
        })
        .catch(err => {
            console.error("❌ Error en el proceso:", err);
            Swal.fire('Error', 'No se pudo completar el registro. Verifica tu conexión.', 'error');
        })
        .finally(() => {
            // Reactivamos el botón siempre al finalizar
            btn.disabled = false;
            actualizarBoton();
        });
    });
}
