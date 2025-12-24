// Datos de personal por área (esto sigue igual, solo para el frontend)
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
    nombreSel.disabled = true;

    if (areaSel && personalPorArea[areaSel]) {
        nombreSel.disabled = false;
        personalPorArea[areaSel].forEach(nombre => {
            let option = document.createElement("option");
            option.value = nombre;
            option.text = nombre;
            nombreSel.appendChild(option);
        });
    }
}

// ⚠️ REEMPLAZA ESTA URL CON LA NUEVA QUE TE DE GOOGLE AL REPUBLICAR
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyC5v7JYt6Q32Ts1NdNBUapYLaNpmf9OktPqx37I9vBKxwC2I6Hq_Qnmzh_M0zDCDFj/exec";

document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    // Crear FormData directamente del formulario
    const formData = new FormData(this);

    // Validar que el correo esté presente (por si el navegador omite required)
    if (!formData.get('email')) {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.classList.add('error');
        mensajeDiv.innerText = "Por favor, ingresa tu correo electrónico.";
        mensajeDiv.style.display = 'block';
        return;
    }

    btn.innerText = "Enviando...";
    btn.disabled = true;

    // ✅ ENVIAR A TU APPS SCRIPT REAL
    fetch(SCRIPT_URL, {
        method: "POST",
        body: formData, // ⚠️ No uses JSON.stringify, usa FormData directamente
        // Google Apps Script espera datos como "application/x-www-form-urlencoded"
        // y FormData lo hace automáticamente
    })
    .then(response => {
        if (!response.ok) throw new Error("Error en la red");
        return response.text();
    })
    .then(text => {
        if (text === "Success") {
            mensajeDiv.classList.remove('hidden');
            mensajeDiv.classList.add('success');
            mensajeDiv.innerText = "✅ ¡Ticket registrado con éxito!";
            mensajeDiv.style.display = 'block';

            // Resetear formulario
            this.reset();
            document.getElementById("area").dispatchEvent(new Event('change')); // Resetea "Personal"
        } else {
            throw new Error(text);
        }
    })
    .catch(error => {
        console.error("Error:", error);
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.classList.add('error');
        mensajeDiv.innerText = "❌ Error al enviar: " + (error.message || "Intenta nuevamente.");
        mensajeDiv.style.display = 'block';
    })
    .finally(() => {
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
        // Opcional: ocultar mensaje después de 4 segundos
        setTimeout(() => {
            mensajeDiv.classList.add('hidden');
            mensajeDiv.style.display = 'none';
        }, 4000);
    });
});
