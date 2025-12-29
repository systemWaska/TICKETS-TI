/**
 * Carga el personal según el área seleccionada
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
    
    nombreSel.innerHTML = '<option value="">Seleccione personal...</option>';
    
    if (areaSel && personalPorArea[areaSel]) {
        nombreSel.disabled = false;
        personalPorArea[areaSel].forEach(n => {
            let opt = document.createElement("option");
            opt.value = n; 
            opt.text = n;
            nombreSel.appendChild(opt);
        });
    } else { 
        nombreSel.disabled = true; 
    }
}

/**
 * Actualiza el texto del botón según el tipo de ticket
 */
function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

/**
 * Manejo del envío del formulario
 */
document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    
    const btn = document.getElementById("btnEnviar");
    const formData = new FormData(this);
    
    // Bloquear botón para evitar doble envío
    btn.disabled = true;
    btn.innerText = "Registrando en Sistema...";

    // 1. Enviar datos a Google Apps Script
    fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(formData)
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            // ✅ Éxito en Google Sheets: Mostrar SweetAlert con el ID real (INC-001, etc)
            Swal.fire({
                title: `¡${data.tipo} Registrado!`,
                icon: 'success',
                html: `
                    <div style="text-align:left; padding: 10px;">
                        <p><b>ID:</b> ${data.id}</p>
                        <p><b>Usuario:</b> ${data.usuario}</p>
                        <p><b>Estado:</b> En Proceso</p>
                    </div>
                `,
                confirmButtonText: 'Aceptar'
            });

            // 2. Enviar Correo mediante EmailJS usando la respuesta del servidor
            // Usamos data.titulo y data.id que vienen frescos del backend
            emailjs.send("tickets-ti", "template_5j0iae9", {
                to_email: document.getElementById('email').value,
                user_name: data.usuario,
                ticket_id: data.id,
                ticket_title: data.titulo, // El servidor ahora devuelve el título
                ticket_type: data.tipo
            }).then(() => {
                console.log("✅ Notificación enviada por EmailJS");
            }).catch(err => {
                console.error("❌ Error en EmailJS:", err);
            });

            // Limpiar formulario
            this.reset();
            actualizarBoton();
        } else {
            throw new Error(data.message || "Error desconocido en el servidor");
        }
    })
    .catch(err => {
        console.error("❌ Error crítico:", err);
        Swal.fire({
            title: 'Error de Conexión',
            text: 'No se pudo comunicar con la base de datos. Revisa la URL en config.js',
            icon: 'error'
        });
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Requerimiento";
    });
});
