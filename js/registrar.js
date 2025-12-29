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
 * Actualiza el texto del botón dinámicamente según el tipo de solicitud
 */
function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    // Si no hay tipo seleccionado, vuelve al texto base
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

/**
 * Manejo del envío del formulario
 */
document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    
    const btn = document.getElementById("btnEnviar");
    const formData = new FormData(this);
    
    // Bloquear botón y mostrar estado de carga
    btn.disabled = true;
    btn.innerText = "Registrando...";

    // 1. Enviar datos a Google Apps Script
    fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(formData)
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            // ✅ Mostrar alerta con el ID generado por el servidor
            Swal.fire({
                title: `¡${data.tipo} Registrado!`,
                icon: 'success',
                html: `ID: <b>${data.id}</b><br>Usuario: <b>${data.usuario}</b>`,
                confirmButtonText: 'Aceptar'
            });

            // 2. Enviar Correo mediante EmailJS usando los datos reales del registro
            emailjs.send("tickets-ti", "template_5j0iae9", {
                to_email: document.getElementById('email').value,
                user_name: data.usuario,
                ticket_id: data.id,
                ticket_title: data.titulo,
                ticket_type: data.tipo
            }).then(() => {
                console.log("✅ Notificación enviada");
            }).catch(err => {
                console.error("❌ Error EmailJS:", err);
            });

            // Limpiar formulario y resetear botón
            this.reset();
            actualizarBoton();
        } else {
            throw new Error(data.message);
        }
    })
    .catch(err => {
        console.error("❌ Error:", err);
        Swal.fire('Error', 'No se pudo completar el registro.', 'error');
    })
    .finally(() => {
        // Habilitar botón y restaurar el texto correcto según el select
        btn.disabled = false;
        actualizarBoton();
    });
});
