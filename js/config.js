const CONFIG = {
  // TU URL DE APPS SCRIPT AQUÍ
  SCRIPT_URL: "https://script.google.com/macros/s/TU_ID_AQUI/exec",
};

// Helper JSONP mejorado con Timeout
window.jsonpRequest = function(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const cbName = `cb_${Date.now()}_${Math.floor(Math.random() * 99999)}`;
    const script = document.createElement('script');
    
    // Limpieza
    const cleanup = () => {
      delete window[cbName];
      if(script.parentNode) script.parentNode.removeChild(script);
    };

    // Timeout
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado"));
    }, timeout);

    window[cbName] = (data) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("Error al cargar script"));
    };

    const join = url.includes('?') ? '&' : '?';
    script.src = `${url}${join}callback=${cbName}`;
    document.body.appendChild(script);
  });
};
