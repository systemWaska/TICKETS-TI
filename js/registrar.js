const SCRIPT_URL = "TU_URL_AQUI";

const personalPorArea = {
    "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
};

// Cambia el personal según el área
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

// CAMBIO SOLICITADO: Actualiza el texto del botón según el tipo
function actualizarBoton() {
    const tipo = document.getElementById("tipo").value;
    const btn = document.getElementById("btnEnviar");
    btn.innerText = tipo ? `Enviar ${tipo}` : "Enviar Requerimiento";
}

document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");
    const originalText = btn.innerText;

    btn.innerText = "Enviando...";
    btn.disabled = true;

    fetch(SCRIPT_URL, { method: 'POST', body: new URLSearchParams(new FormData(this)) })
    .then(res => res.text())
    .then(idGenerado => {
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert success";
        // Muestra el código generado (INC-, REQ-, EVE-)
        mensajeDiv.innerHTML = `✅ ¡Ticket Creado! Código: <strong>${idGenerado}</strong>. Revisa tu correo electrónico.`;
        this.reset();
        cargarPersonal();
        actualizarBoton();
    })
    .catch(() => {
        mensajeDiv.className = "alert success";
        mensajeDiv.innerText = "✅ Ticket enviado. Verifícalo en 'Mis Tickets'.";
    })
    .finally(() => {
        btn.innerText = originalText;
        btn.disabled = false;
    });
});
