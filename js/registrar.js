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

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyC5v7JYt6Q32Ts1NdNBUapYLaNpmf9OktPqx37I9vBKxwC2I6Hq_Qnmzh_M0zDCDFj/exec";

document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    btn.innerText = "Enviando...";
    btn.disabled = true;

    // Crear FormData con los datos del formulario
    const formData = new FormData(this);

    // Enviar datos reales a Google Sheets
    fetch(SCRIPT_URL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors' // Necesario para evitar bloqueos de seguridad de Google
    })
    .then(() => {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert success";
        mensajeDiv.innerText = "✅ Ticket registrado con éxito en el sistema.";
        
        this.reset();
        cargarPersonal(); // Limpia el segundo select
    })
    .catch(error => {
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert error";
        mensajeDiv.innerText = "❌ Error al conectar con el servidor.";
        console.error('Error:', error);
    })
    .finally(() => {
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
    });
});
