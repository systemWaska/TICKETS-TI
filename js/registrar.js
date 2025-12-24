const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec"; // REEMPLAZA ESTO

// 1. Datos de personal por área
const personalPorArea = {
    "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
};

// 2. Función para cargar nombres (Asegúrate de que el HTML tenga id="area" e id="nombre")
function cargarPersonal() {
    const areaSel = document.getElementById("area").value;
    const nombreSel = document.getElementById("nombre");

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

// 3. LA PARTE QUE FALTA: Escuchar el cambio de área
// Esto debe estar fuera de cualquier función para que se active al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    const areaSelect = document.getElementById("area");
    if (areaSelect) {
        areaSelect.addEventListener('change', cargarPersonal);
    }
});

// 4. Configuración del envío (Tu URL de Apps Script)
const SCRIPT_URL = "TU_URL_DE_APPS_SCRIPT_AQUI";

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
        mensajeDiv.className = "alert success";
        mensajeDiv.innerHTML = `✅ <strong>¡Ticket Creado!</strong><br>Código: <strong>${idGenerado}</strong>`;
        
        this.reset();
        cargarPersonal(); // Esto limpia el selector de nombres tras el reset
    })
    .catch(error => {
        console.error(error);
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert success";
        mensajeDiv.innerText = "✅ Ticket enviado correctamente.";
    })
    .finally(() => {
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
    });
});
