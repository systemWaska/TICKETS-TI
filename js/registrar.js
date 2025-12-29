// Carga el personal según el área
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
            opt.value = n; opt.text = n;
            nombreSel.appendChild(opt);
        });
    } else { nombreSel.disabled = true; }
}

function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    btn.disabled = true;
    btn.innerText = "Registrando...";

    // Enviar datos al Sheet
    fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(new FormData(this))
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            // 1. Alerta de éxito con el ID generado (EVE-001, REQ-001, etc)
            Swal.fire({
                title: `¡${data.tipo} Creado!`,
                icon: 'success',
                html: `Usuario: <b>${data.usuario}</b><br>ID: <b>${data.id}</b>`,
                confirmButtonText: 'Aceptar'
            });

            // 2. Envío de Notificación por EmailJS
            emailjs.send("tickets-ti", "template_5j0iae9", {
                to_email: document.getElementById('email').value,
                user_name: data.usuario,
                ticket_id: data.id,
                ticket_title: data.titulo,
                ticket_type: data.tipo
            }).then(() => {
                console.log("✅ Correo enviado");
            }).catch(err => {
                console.error("❌ Error EmailJS:", err);
            });

            this.reset();
            actualizarBoton();
        } else {
            throw new Error(data.message);
        }
    })
    .catch(err => {
        console.error("❌ Error:", err);
        Swal.fire('Error', 'No se pudo registrar el ticket.', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Requerimiento";
    });
});
