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
    } else { 
        nombreSel.disabled = true; 
    }
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

    fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(new FormData(this))
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            // ✅ Muestra el mensaje de éxito
            Swal.fire({
                title: `¡${data.tipo} Creado!`,
                icon: 'success',
                html: `Usuario: <b>${data.usuario}</b><br>ID: <b>${data.id}</b>`,
                confirmButtonText: 'Aceptar'
            });

            // ✅ Envía el correo usando EmailJS
            const userEmail = document.getElementById('email').value;
            const userName = data.usuario;
            const ticketId = data.id;
            const ticketTitle = data.titulo;
            const ticketType = data.tipo;

            // ⚙️ Usa tus IDs reales de EmailJS aquí
            emailjs.send("tickets-ti", "template_5j0iae9", {
                to_email: userEmail,
                user_name: userName,
                ticket_id: ticketId,
                ticket_title: ticketTitle,
                ticket_type: ticketType
            }).then(() => {
                console.log("✅ Correo enviado correctamente a:", userEmail);
            }).catch(err => {
                console.error("❌ Error al enviar correo:", err);
                // Opcional: muestra un alerta si falla el correo
                Swal.fire({
                    title: 'Correo no enviado',
                    text: 'El ticket se registró, pero hubo un error al enviar la notificación por correo. Por favor, revisa tu bandeja de entrada.',
                    icon: 'warning',
                    confirmButtonText: 'Aceptar'
                });
            });

            this.reset();
            actualizarBoton();
        }
    })
    .catch(err => {
        console.error("❌ Error al registrar ticket:", err);
        Swal.fire('Error', 'No se pudo registrar el ticket. Por favor, inténtalo más tarde.', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Requerimiento";
    });
});
