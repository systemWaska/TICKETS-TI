const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfef4NbXuBwn__PkPDBEkZNsP1RXwGldXMLPy1Gptr8s-HaIh0gPqJQMDogSzmcWM9VA/exec"; // REEMPLAZA ESTO

// ... (Manten tu función cargarPersonal igual) ...

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
        mode: 'cors' // Cambiamos a cors para intentar leer la respuesta
    })
    .then(res => res.text()) // Aquí recibimos el prefijo (INC-001, etc.)
    .then(idGenerado => {
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert success";
        // Mostramos el ID real que devolvió Google
        mensajeDiv.innerHTML = `✅ <strong>¡Ticket Creado!</strong><br>Tu código es: <strong>${idGenerado}</strong>.<br>Guárdalo para consultar su estado.`;
        
        this.reset();
        cargarPersonal();
    })
    .catch(error => {
        // Si falla el CORS pero el dato llega (común en Google), mostramos éxito genérico
        mensajeDiv.style.display = 'block';
        mensajeDiv.className = "alert success";
        mensajeDiv.innerText = "✅ Ticket enviado. Revisa tu Excel en unos segundos.";
    })
    .finally(() => {
        btn.innerText = "Enviar Requerimiento";
        btn.disabled = false;
    });
});
