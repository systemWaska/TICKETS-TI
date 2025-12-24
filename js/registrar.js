// 1. Configuración de datos de personal por área
const personalPorArea = {
    "RR.HH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
};

// 2. Función para cargar personal dinámicamente según el área seleccionada
function cargarPersonal() {
    const areaSel = document.getElementById("area").value;
    const nombreSel = document.getElementById("nombre");

    // Limpiar y deshabilitar si no hay área
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

// 3. Configuración de la URL de tu Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec";

// 4. Evento de envío del formulario
document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    // Estado visual de carga
    btn.innerText = "Enviando...";
    btn.disabled = true;

    // Convertimos los datos del formulario a URLSearchParams para Apps Script
    const formData = new FormData(this);
    const params = new URLSearchParams();
    
    for (const pair of formData) {
        params.append(pair[0], pair[1]);
    }

    // Petición de envío a Google Sheets
    fetch(SCRIPT_URL, {
        method: 'POST',
        body: params,
        mode: 'no-cors' // Importante para evitar bloqueos de seguridad de Google
    })
    .then(() => {
        // Mostrar mensaje de éxito
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert success";
        mensajeDiv.innerText = "✅ Ticket registrado con éxito en el sistema.";
        
        // Limpiar formulario
        this.reset();
        cargarPersonal(); 

        // Ocultar el mensaje después de 5 segundos
        setTimeout(() => {
            mensajeDiv.style.display = 'none';
            mensajeDiv.classList.add('hidden');
        }, 5000);
    })
    .catch(error => {
        // Mostrar mensaje de error
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert error";
        mensajeDiv.innerText = "❌ Error al conectar con el servidor.";
        console.error('Error detallado:', error);
    })
    .finally(() => {
        // Restaurar botón
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
    });
});

// Inicializar el evento de cambio de área al cargar el script
document.addEventListener('DOMContentLoaded', () => {
    const areaInput = document.getElementById("area");
    if(areaInput) {
        areaInput.addEventListener("change", cargarPersonal);
    }
});
