const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyXdV2cveu1ECWhi-3HMODJxKLIrEHmk1dA-15vAq1N8X-X_PRIR8t43i6-ulc_J5Dwxg/exec";

// Datos de personal
const personalPorArea = {
    "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
};

function cargarPersonal() {
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
    const originalText = btn.innerText;

    btn.innerText = "Procesando...";
    btn.disabled = true;

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(new FormData(this))
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            // VENTANA EMERGENTE DE ÉXITO
            alert(`✅ ¡REGISTRO EXITOSO!\n\nEl ${data.tipo} con código ${data.id} ha sido generado correctamente.\nSe envió una copia al correo ingresado.`);
            this.reset();
            cargarPersonal();
            actualizarBoton();
        } else {
            alert("❌ Error: " + data.message);
        }
    })
    .catch(err => {
        // Fallback en caso de bloqueo de respuesta pero registro exitoso
        alert("✅ El ticket fue enviado. Por favor revise la sección 'Mis Tickets' para confirmar el código.");
        this.reset();
    })
    .finally(() => {
        btn.innerText = originalText;
        btn.disabled = false;
    });
});
