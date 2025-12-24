const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyXdV2cveu1ECWhi-3HMODJxKLIrEHmk1dA-15vAq1N8X-X_PRIR8t43i6-ulc_J5Dwxg/exec";

// 1. Cargar personal dinámicamente
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

// 2. Cambiar texto del botón
function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

// 3. Envío del Formulario
document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    btn.disabled = true;
    btn.innerText = "Registrando...";

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(new FormData(this))
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            // VENTANA EMERGENTE DINÁMICA
            Swal.fire({
                title: '¡Registro Exitoso!',
                icon: 'success',
                html: `El <b>${data.tipo}</b> ha sido creado para <b>${data.usuario}</b>.<br><br>` +
                      `Código: <b style="font-size:1.5em; color:#2c3e50;">${data.id}</b>`,
                confirmButtonText: 'Entendido'
            });
            this.reset();
            actualizarBoton();
        }
    })
    .catch(err => {
        Swal.fire('Aviso', 'Ticket enviado. Verifícalo en "Mis Tickets".', 'info');
        this.reset();
    })
    .finally(() => {
        btn.disabled = false;
        actualizarBoton();
    });
});
