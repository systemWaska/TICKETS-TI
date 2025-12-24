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

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyXdV2cveu1ECWhi-3HMODJxKLIrEHmk1dA-15vAq1N8X-X_PRIR8t43i6-ulc_J5Dwxg/exec";

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
            // MODIFICADO: Ventana dinámica con SweetAlert2
            Swal.fire({
                title: `¡${data.tipo} Generado!`,
                icon: 'success',
                html: `Hola <b>${data.usuario}</b>, tu ticket ha sido creado correctamente.<br><br>` +
                      `Tu código es: <b style="font-size: 1.5em; color: #2ecc71;">${data.id}</b>`,
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#3085d6'
            });
            this.reset();
        } else {
            Swal.fire('Error', 'No se pudo registrar: ' + data.message, 'error');
        }
    })
    .catch(err => {
        Swal.fire('Atención', 'El servidor no respondió, pero el ticket podría haberse enviado. Revisa "Mis Tickets".', 'warning');
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Requerimiento";
    });
});
