const personalPorArea = {
    "RRHH": ["RENZO", "CLARA", "CLAUDIA"],
    "CONTABILIDAD": ["ERICK", "ALONSO"],
    "MARKETING": ["ALEC", "BRYAN", "CAMILA"],
    "PRODUCCION": ["KELLY", "JOSUE", "EDUARDO", "LUCIA", "ADRIAN"]
};

// Función para cargar personal según área
function cargarPersonal() {
    const areaSel = document.getElementById("area").value;
    const nombreSel = document.getElementById("nombre");

    // Resetear opciones y deshabilitar
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

        // Añadir clase para animación de entrada
        setTimeout(() => {
            nombreSel.classList.add('form-input');
            nombreSel.classList.add('visible');
        }, 50);
    } else {
        nombreSel.disabled = true;
    }
}

// Función para animar todos los inputs al cargar
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('.form-group input, .form-group select, .form-group textarea');
    inputs.forEach((input, index) => {
        input.classList.add('form-input');
        setTimeout(() => {
            input.classList.add('visible');
        }, 100 + (index * 50)); // Retardo escalonado
    });
});

// Envío a Google Sheets (Simulado)
document.getElementById("tiForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    // Mostrar estado de carga
    btn.innerText = "Enviando...";
    btn.disabled = true;
    btn.classList.add('btn-loading');

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    console.log("Datos a enviar:", data);

    // Simulación de envío
    setTimeout(() => {
        // Resetear formulario con animación
        document.getElementById("tiForm").reset();
        document.getElementById("area").dispatchEvent(new Event('change')); // Resetear personal

        // Quitar clase de carga
        btn.classList.remove('btn-loading');
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;

        // Mostrar mensaje con animación
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.style.display = 'block';

        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
            mensajeDiv.classList.add('hidden');
            mensajeDiv.style.display = 'none';
        }, 3000);

    }, 1500);
});
