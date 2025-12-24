// MODIFICADO: Ya no definimos la URL aquí, la tomamos de CONFIG
document.getElementById("ticketForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const btn = document.getElementById("btnEnviar");
    btn.disabled = true;
    btn.innerText = "Registrando...";

    // MODIFICADO: Usamos CONFIG.SCRIPT_URL
    fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: new URLSearchParams(new FormData(this))
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") {
            Swal.fire({
                title: `¡${data.tipo} Generado!`,
                icon: 'success',
                html: `Usuario: <b>${data.usuario}</b><br>Código: <b>${data.id}</b>`,
                confirmButtonText: 'Aceptar'
            });
            this.reset();
            if (typeof actualizarBoton === "function") actualizarBoton();
        }
    })
    .catch(err => Swal.fire('Error', 'No se pudo conectar', 'error'))
    .finally(() => btn.disabled = false);
});

// Mantén tus funciones cargarPersonal() y actualizarBoton() igual que antes...
