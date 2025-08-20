document.addEventListener('DOMContentLoaded', () => {
  // --- ELEMENTOS DEL DOM ---
  const botonRevisar = document.getElementById("revisar");
  const botonLimpiar = document.getElementById("limpiar");
  const botonExportar = document.getElementById("exportar");
  const listaErroresDiv = document.getElementById("listaErrores");
  const statusDiv = document.getElementById("status");

  let activeTab;
  let erroresActuales = [];

  // --- FUNCIÓN DE INICIALIZACIÓN ---
  async function inicializarPopup() {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
        statusDiv.textContent = "No se pudo identificar la pestaña activa.";
        botonRevisar.disabled = true;
        botonLimpiar.disabled = true;
        botonExportar.disabled = true;
        return;
    }
    activeTab = tab;

    // Pide al background script los errores que ya tiene para esta pestaña
    chrome.runtime.sendMessage({ accion: "obtenerErrores", tabId: activeTab.id }, async (respuesta) => {
        if (chrome.runtime.lastError) {
            console.error("Error al obtener estado:", chrome.runtime.lastError.message);
            statusDiv.textContent = "Error al comunicarse con el script de fondo.";
            return;
        }
        
        if (respuesta && respuesta.datos) {
            erroresActuales = respuesta.datos;
            
            // ===== CORRECCIÓN CLAVE: Inyectar CSS si hay errores guardados =====
            if (erroresActuales.length > 0) {
                try {
                    // Nos aseguramos de que los estilos estén presentes en la página
                    // para que los resaltados guardados sean visibles.
                    await chrome.scripting.insertCSS({
                        target: { tabId: activeTab.id },
                        files: ["styles.css"]
                    });
                } catch (e) {
                    console.warn("No se pudo inyectar CSS en la página al recargar el popup. Los resaltados pueden no ser visibles.", e.message);
                }
            }

            mostrarErroresUI(erroresActuales);
        }
    });
  }

  // --- EVENT LISTENERS ---
  botonRevisar.addEventListener("click", async () => {
    if (!activeTab || !activeTab.id) return;
    listaErroresDiv.innerHTML = "";
    statusDiv.textContent = "Revisando, por favor espera...";
    statusDiv.style.display = 'block';
    botonRevisar.disabled = true;
    botonLimpiar.style.display = 'none';
    try {
        // La inyección de CSS y JS ya estaba aquí, lo cual es correcto para una nueva revisión.
        await chrome.scripting.insertCSS({ target: { tabId: activeTab.id }, files: ["styles.css"] });
        await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ["content.js"] });
        chrome.tabs.sendMessage(activeTab.id, { accion: "iniciarRevision" });
    } catch (error) {
        console.error("Fallo al inyectar script:", error);
        statusDiv.textContent = `No se puede ejecutar en esta página. (${error.message})`;
        botonRevisar.disabled = false;
    }
  });

  botonExportar.addEventListener("click", () => {
    if (activeTab && activeTab.id) {
      chrome.runtime.sendMessage({ accion: "exportarCSV", tabId: activeTab.id });
    }
  });
  
  botonLimpiar.addEventListener("click", () => {
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, { accion: "limpiarRevision" });
      chrome.runtime.sendMessage({ accion: "limpiarRevision", tabId: activeTab.id });
      erroresActuales = [];
      mostrarErroresUI([]);
    }
  });
  
  listaErroresDiv.addEventListener('click', (event) => {
    const errorItem = event.target.closest('.error-item');
    if (!errorItem) return;

    if (event.target.closest('.ignorar-btn')) {
        const palabraAIgnorar = errorItem.dataset.palabra;
        const errorId = errorItem.dataset.errorId;
        if (palabraAIgnorar && errorId) {
            ignorarPalabra(palabraAIgnorar, errorId, errorItem);
        }
    } 
    else {
        const errorId = errorItem.dataset.errorId;
        if (errorId) {
            chrome.tabs.sendMessage(activeTab.id, {
                accion: 'irAError',
                errorId: errorId
            });
        }
    }
  });

  // --- MANEJO DE MENSAJES ---
  chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
    if (mensaje.accion === "mostrarErrores") {
      erroresActuales = mensaje.datos;
      mostrarErroresUI(erroresActuales);
      botonRevisar.disabled = false;
    }
    if (mensaje.accion === "alerta") {
      alert(mensaje.mensaje);
    }
  });

  // --- FUNCIONES AUXILIARES ---
  async function ignorarPalabra(palabra, errorId, elementoDOM) {
    const result = await chrome.storage.sync.get(['diccionarioPersonal']);
    let diccionario = result.diccionarioPersonal || [];
    const palabraEnMinusculas = palabra.toLowerCase();
    if (!diccionario.includes(palabraEnMinusculas)) {
        diccionario.push(palabraEnMinusculas);
    }
    await chrome.storage.sync.set({ diccionarioPersonal: diccionario });

    chrome.tabs.sendMessage(activeTab.id, { accion: 'desmarcarError', errorId: errorId });

    elementoDOM.remove();

    erroresActuales = erroresActuales.filter(e => e.id !== errorId);
    chrome.runtime.sendMessage({ 
        accion: 'guardarErrores', 
        datos: erroresActuales, 
        tabId: activeTab.id 
    });

    if (erroresActuales.length === 0) {
        mostrarErroresUI([]);
    }
  }
  
  function mostrarErroresUI(errores) {
    listaErroresDiv.innerHTML = "";

    if (!errores || errores.length === 0) {
      statusDiv.textContent = "¡Todo correcto o las palabras desconocidas han sido ignoradas!";
      statusDiv.style.display = 'block';
      botonLimpiar.style.display = 'none';
      return;
    }
    
    statusDiv.style.display = 'none';
    botonLimpiar.style.display = 'flex';

    errores.forEach(e => {
      const item = document.createElement('div');
      item.className = `error-item categoria-${e.categoria || 'otro'}`;
      item.dataset.errorId = e.id;
      item.dataset.palabra = e.palabra;

      const sugerenciasTexto = e.sugerencias.length > 0 ? e.sugerencias.join(', ') : 'Ninguna';

      item.innerHTML = `
        <div class="error-header">
            <span class="palabra">${e.palabra}</span>
            <button class="ignorar-btn" title="Añadir '${e.palabra}' al diccionario personal">Ignorar</button>
        </div>
        <div class="mensaje">${e.mensaje}</div>
        <div class="sugerencias">Sugerencias: ${sugerenciasTexto}</div>
      `;
      
      listaErroresDiv.appendChild(item);
    });
  }

  // --- EJECUTAR INICIALIZACIÓN ---
  inicializarPopup();
});