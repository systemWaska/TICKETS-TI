const personalPorArea = {
    "RRHH": ["RENZO", "CLARA", "CLAUDIA"],
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

// Envío a Google Sheets (Simulado hasta tener tu URL)
document.getElementById("tiForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    btn.innerText = "Enviando...";
    btn.disabled = true;

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    // Aquí iría tu fetch a Google Apps Script
    console.log("Datos a enviar:", data);
    
    setTimeout(() => {
        document.getElementById("tiForm").reset();
        document.getElementById("mensaje").classList.remove("hidden");
        document.getElementById("mensaje").innerText = "¡Ticket enviado con éxito!";
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
    }, 1500);
});
