// 1. Datos de personal por área
const personalPorArea = {
    "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
};

// 2. Función para cargar nombres (llamada desde el onchange del HTML)
function cargarPersonal() {
    const areaSel = document.getElementById("area").value;
    const nombreSel = document.getElementById("nombre");

    // Limpiar opciones previas
    nombreSel.innerHTML = '<option value="">Seleccione personal...</option>';
    
    if (areaSel && personalPorArea[areaSel]) {
        nombreSel.disabled = false;
        personalPorArea[areaSel].forEach(nombre => {
            let option = document.createElement("option");
            option.value = nombre;
            option.text = nombre;
            nombreSel.appendChild(option);
        });
    } else {
        nombreSel.disabled = true;
    }
}

// 3. Configuración del envío a Google Sheets
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec"; // REEMPLAZA ESTO

document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    btn.innerText = "Generando Ticket...";
    btn.disabled = true;

    const data = new URLSearchParams(new FormData(this));

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: data,
        mode: 'cors'
    })
    .then(res => res.text())
    .then(idGenerado => {
        mensajeDiv.style.display = 'block';
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = "alert success";
        
        // El mensaje ahora muestra el ID que genera tu script de Google (INC-, REQ-, EVE-)
        mensajeDiv.innerHTML = `✅ <strong>¡Ticket Creado!</strong><br>Tu código es: <strong>${idGenerado}</strong>.<br>Úsalo en la sección "Ver Mis Tickets".`;
        
        this.reset();
        cargarPersonal(); // Deshabilita el selector de nombres
        window.scrollTo(0, 0); // Sube la pantalla para ver el mensaje
    })
    .catch(error => {
        console.error("Error:", error);
        mensajeDiv.style.display = 'block';
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.className = "alert error";
        mensajeDiv.innerText = "❌ Hubo un error al registrar el ticket.";
    })
    .finally(() => {
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
    });
});
