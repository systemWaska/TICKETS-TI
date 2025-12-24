// Datos simulados para el registro (reemplaza con fetch cuando tengas la API)
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

document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    btn.innerText = "Enviando...";
    btn.disabled = true;

    // Simular envío
    setTimeout(() => {
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        // Generar ID según tipo
        let prefijo = "REQ";
        if (data.tipo === "Incidencia") prefijo = "INC";
        if (data.tipo === "Evento") prefijo = "EVE";

        // Simulación de ID único
        const nextId = prefijo + "-001"; // En producción, esto lo genera Apps Script

        // Mostrar mensaje de éxito
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.classList.add('success');
        mensajeDiv.innerText = `✅ Ticket registrado con éxito: ${nextId}`;
        mensajeDiv.style.display = 'block';

        // Resetear formulario
        this.reset();
        document.getElementById("area").dispatchEvent(new Event('change'));

        // Simular envío de correo
        console.log(`Correo enviado a: ${data.email} con ticket ${nextId}`);

        // Volver a estado normal
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;

        // Ocultar mensaje después de 3 segundos
        setTimeout(() => {
            mensajeDiv.classList.add('hidden');
            mensajeDiv.style.display = 'none';
        }, 3000);

    }, 1500);
});
