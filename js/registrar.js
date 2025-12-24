// MODIFICADO: Asegúrate de usar tu URL de implementación más reciente
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyXdV2cveu1ECWhi-3HMODJxKLIrEHmk1dA-15vAq1N8X-X_PRIR8t43i6-ulc_J5Dwxg/exec";

// Función para personal por área
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

// MODIFICADO: Función para que el botón sea dinámico
function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

// MODIFICADO: Envío con ventana emergente SweetAlert2
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
            // VENTANA DINÁMICA
            Swal.fire({
                title: `¡${data.tipo} Registrado!`,
                icon: 'success',
                html: `Hola <b>${data.usuario}</b>, solicitud procesada.<br><br>` +
                      `Código: <b style="font-size: 1.5em; color: #27ae60;">${data.id}</b>`,
                confirmButtonText: 'Aceptar'
            });
            this.reset();
            actualizarBoton();
        } else {
            Swal.fire('Error', data.message, 'error');
        }
    })
    .catch(err => {
        Swal.fire('Aviso', 'Registro enviado. Verifica en "Mis Tickets".', 'info');
        this.reset();
    })
    .finally(() => {
        btn.disabled = false;
        actualizarBoton();
    });
});
