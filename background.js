let erroresPorPestana = {};

// Escuchamos cuando una pestaña se cierra para limpiar la memoria
chrome.tabs.onRemoved.addListener((tabId) => {
  if (erroresPorPestana[tabId]) {
    delete erroresPorPestana[tabId];
    console.log(`Limpiando errores para la pestaña cerrada: ${tabId}`);
  }
});

chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  const tabId = mensaje.tabId || (sender.tab ? sender.tab.id : null);

  if (!tabId) return;

  if (mensaje.accion === "guardarErrores") {
    erroresPorPestana[tabId] = mensaje.datos;
    console.log(`Errores guardados para la pestaña ${tabId}:`, erroresPorPestana[tabId].length);
    return;
  }

  if (mensaje.accion === "obtenerErrores") {
    const errores = erroresPorPestana[tabId] || [];
    sendResponse({ datos: errores });
    return true; // Respuesta asíncrona
  }

  if (mensaje.accion === "limpiarRevision") {
    if (erroresPorPestana[tabId]) {
      delete erroresPorPestana[tabId];
      console.log(`Datos de revisión limpiados para la pestaña ${tabId}`);
    }
    return;
  }

  if (mensaje.accion === "exportarCSV") {
    const erroresParaExportar = erroresPorPestana[tabId] || [];

    if (erroresParaExportar.length === 0) {
      // Intentamos enviar el mensaje de alerta al popup, si no, a la pestaña activa.
      chrome.runtime.sendMessage({ accion: "alerta", mensaje: "No hay errores para exportar. Realiza una revisión primero." }).catch(() => {
        chrome.tabs.sendMessage(tabId, { accion: "alerta", mensaje: "No hay errores para exportar. Realiza una revisión primero." });
      });
      return;
    }

    const encabezado = "Palabra,Mensaje,Sugerencias,URL,Fecha\n";
    const filas = erroresParaExportar.map(e => {
        const palabra = (e.palabra || "").replace(/"/g, '""');
        const mensaje = (e.mensaje || "").replace(/"/g, '""');
        const sugerencias = (e.sugerencias || []).join(', ').replace(/"/g, '""');
        const url = (e.url || "").replace(/"/g, '""');
        const fecha = (e.fecha || "").replace(/"/g, '""');
        return `"${palabra}","${mensaje}","${sugerencias}","${url}","${fecha}"`;
    }).join("\n");

    // ===== CORRECCIÓN: Usar data: URL en lugar de Blob URL =====
    
    // El BOM (Byte Order Mark) ayuda a Excel a abrir correctamente archivos UTF-8
    const bom = "\uFEFF"; 
    const contenidoCSV = bom + encabezado + filas;

    // Creamos una data: URL. El contenido debe estar codificado para ser parte de la URL.
    const url = "data:text/csv;charset=utf-8," + encodeURIComponent(contenidoCSV);

    chrome.downloads.download({
      url: url,
      filename: `reporte_ortografia_${new Date().toISOString().slice(0, 10)}.csv`
    });
  }
});