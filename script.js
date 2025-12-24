// Envío a Google Sheets (Real)
document.getElementById("tiForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    const mensajeDiv = document.getElementById("mensaje");

    // Mostrar estado de carga
    btn.innerText = "Enviando...";
    btn.disabled = true;
    btn.classList.add('btn-loading');

    // Obtenemos los datos del formulario
    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    // Construir el objeto para enviar a Google Apps Script
    // Nota: Los nombres deben coincidir con los que usas en el script (nombre, area, titulo, descripcion, prioridad)
    const payload = {
        nombre: data.nombre,
        area: data.area,
        titulo: data.titulo,
        descripcion: data.descripcion,
        prioridad: data.prioridad
    };

    // URL de tu Google Apps Script (¡REEMPLÁZALA CON LA NUEVA URL!)
    const url = "https://script.google.com/macros/s/AKfycbyC5v7JYt6Q32Ts1NdNBUapYLaNpmf9OktPqx37I9vBKxwC2I6Hq_Qnmzh_M0zDCDFj/exec"; // 👈 ¡CAMBIA ESTO!

    fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.text())
    .then(text => {
        // Quitar clase de carga
        btn.classList.remove('btn-loading');
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;

        if (text === "Success") {
            // Resetear formulario
            document.getElementById("tiForm").reset();
            document.getElementById("area").dispatchEvent(new Event('change')); // Resetear personal

            // Mostrar mensaje de éxito
            mensajeDiv.classList.remove('hidden');
            mensajeDiv.style.display = 'block';
            mensajeDiv.innerText = "¡Ticket enviado con éxito!";

            // Ocultar mensaje después de 3 segundos
            setTimeout(() => {
                mensajeDiv.classList.add('hidden');
                mensajeDiv.style.display = 'none';
            }, 3000);
        } else {
            // Mostrar mensaje de error
            mensajeDiv.classList.remove('hidden');
            mensajeDiv.style.display = 'block';
            mensajeDiv.innerText = "Error: " + text;
            mensajeDiv.style.backgroundColor = "#f8d7da";
            mensajeDiv.style.color = "#721c24";
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Quitar clase de carga
        btn.classList.remove('btn-loading');
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;

        // Mostrar mensaje de error
        mensajeDiv.classList.remove('hidden');
        mensajeDiv.style.display = 'block';
        mensajeDiv.innerText = "Error de red. Por favor, intente nuevamente.";
        mensajeDiv.style.backgroundColor = "#f8d7da";
        mensajeDiv.style.color = "#721c24";
    });
});
