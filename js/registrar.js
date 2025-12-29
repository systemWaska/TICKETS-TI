/**
 * Rellena el segundo menú desplegable según el área elegida
 */
function cargarPersonal() {
    const personalPorArea = {
        "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
        "CONTABILIDAD": ["ERICK", "ALONSO"],
        "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
        "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
    };
    const areaSel = document.getElementById("area").value;
    const nombreSel = document.getElementById("nombre");
    
    // Limpia las opciones actuales
    nombreSel.innerHTML = '<option value="">Seleccione personal...</option>';
    
    if (areaSel && personalPorArea[areaSel]) {
        nombreSel.disabled = false; // Habilita el campo
        personalPorArea[areaSel].forEach(n => {
            let opt = document.createElement("option");
            opt.value = n; 
            opt.text = n;
            nombreSel.appendChild(opt);
        });
    } else { 
        nombreSel.disabled = true; // Deshabilita si no hay área
    }
}

/**
 * Cambia dinámicamente el texto del botón de envío
 */
function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    // Cambia el texto: ej. "Enviar Incidencia" o "Enviar Requerimiento"
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

/**
 * Evento principal al hacer clic en el botón de enviar
 */
document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault(); // Evita que la página se recargue
    
    const btn = document.getElementById("btnEnviar");
    const formData = new FormData(this); // Captura todos los campos del formulario
    
    // Bloqueo visual del botón para evitar múltiples clics
    btn.disabled = true;
    btn.innerText = "Registrando...";

    // 1. ENVÍO A GOOGLE SHEETS
    fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(formData)
    })
    .then(res => {
        // Valida que la respuesta sea un JSON válido
        if (!res.ok) throw new Error("Error en la respuesta del servidor");
        return res.json();
    })
    .then(data => {
        // Si el servidor confirma el éxito (status: "success")
        if(data.status === "success") {
            // Muestra mensaje de éxito con SweetAlert2
            Swal.fire({
                title: `¡${data.tipo} Registrado!`,
                icon: 'success',
                html: `ID Generado: <b>${data.id}</b><br>Usuario: <b>${data.usuario}</b>`,
                confirmButtonText: 'Aceptar'
            });

            // 2. ENVÍO DE NOTIFICACIÓN POR EMAILJS
            // Se verifica que la librería de EmailJS esté cargada correctamente
            if (typeof emailjs !== 'undefined') {
                emailjs.send("tickets-ti", "template_5j0iae9", {
                    to_email: document.getElementById('email').value,
                    user_name: data.usuario,
                    ticket_id: data.id,       // ID real devuelto por el Sheet
                    ticket_title: data.titulo,
                    ticket_type: data.tipo
                }).then(() => console.log("✅ Email enviado con éxito"))
                  .catch(err => console.error("❌ Error al enviar email:", err));
            }

            // Resetea el formulario y el texto del botón
            this.reset();
            actualizarBoton();
        } else {
            throw new Error(data.message || "Error desconocido");
        }
    })
    .catch(err => {
        console.error("❌ Error crítico:", err);
        // Alerta en caso de fallo de conexión o JSON corrupto
        Swal.fire('Error', 'No se pudo completar el registro. Intente nuevamente.', 'error');
    })
    .finally(() => {
        // Siempre reactiva el botón, pase lo que pase
        btn.disabled = false;
        actualizarBoton(); // Restaura el texto según la selección actual
    });
});
