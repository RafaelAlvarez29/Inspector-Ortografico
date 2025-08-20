//=================================================================
// SCRIPT DE CONTENIDO - Inyectado y controlado por el popup
// =================================================================
if (typeof window.revisorOrtograficoInyectado === 'undefined') {
  window.revisorOrtograficoInyectado = true;

  const LANGUAGE = "es";

  // --- MANEJO DE MENSAJES DESDE EL POPUP ---
  chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
    if (mensaje.accion === "iniciarRevision") {
      revisarPaginaEntera();
    }
    
    if (mensaje.accion === "limpiarRevision") {
      limpiarResaltadoCompleto();
      sendResponse({ status: "limpieza completada" });
    }

    if (mensaje.accion === "irAError") {
      const elementoError = document.getElementById(mensaje.errorId);
      if (elementoError) {
        elementoError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elementoError.classList.add('error-flash');
        setTimeout(() => {
          elementoError.classList.remove('error-flash');
        }, 1500);
      }
    }
    
    if (mensaje.accion === "desmarcarError") {
      const markElement = document.getElementById(mensaje.errorId);
      if (markElement) {
        desenvolverMark(markElement);
      }
    }
  });

  // --- FUNCIONES DE MANIPULACIÓN DEL DOM ---
  function desenvolverMark(markElement) {
    const parent = markElement.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(markElement.textContent), markElement);
      parent.normalize();
    }
  }

  function limpiarResaltadoCompleto() {
    const erroresResaltados = document.querySelectorAll('mark.error-ortografia');
    erroresResaltados.forEach(mark => desenvolverMark(mark));
    console.log("Resaltado de errores limpiado.");
  }
  
  // --- FUNCIÓN PRINCIPAL DE REVISIÓN ---
  async function revisarPaginaEntera() {
    limpiarResaltadoCompleto();
    const storageData = await chrome.storage.sync.get(['diccionarioPersonal']);
    const diccionarioPersonal = new Set((storageData.diccionarioPersonal || []).map(p => p.toLowerCase()));

    const allTextNodes = [];
    const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let currentNode;
    while (currentNode = treeWalker.nextNode()) {
      const parentTag = currentNode.parentElement ? currentNode.parentElement.tagName.toUpperCase() : '';
      if (currentNode.nodeValue.trim() !== "" && parentTag !== 'SCRIPT' && parentTag !== 'STYLE' && parentTag !== 'NOSCRIPT' && parentTag !== 'MARK') {
        allTextNodes.push(currentNode);
      }
    }

    let erroresTotales = [];
    let errorCounter = 0;

    for (const node of allTextNodes) {
      try {
        const textoParaVerificar = node.nodeValue;
        let erroresEncontrados = await verificarTexto(textoParaVerificar);
        
        if (erroresEncontrados.length > 0) {
            const erroresFiltrados = erroresEncontrados.filter(error => {
                const palabraError = error.context.text.substring(error.context.offset, error.context.offset + error.length);
                return !diccionarioPersonal.has(palabraError.toLowerCase());
            });

            if (erroresFiltrados.length > 0) {
              const erroresResaltados = resaltarErroresEnNodo(node, erroresFiltrados, errorCounter);
              errorCounter += erroresResaltados.length;
              erroresTotales.push(...erroresResaltados);
            }
        }
      } catch (error) {
        console.error("Error al procesar un nodo de texto:", error);
      }
    }
    
    chrome.runtime.sendMessage({ accion: "mostrarErrores", datos: erroresTotales });
    chrome.runtime.sendMessage({ accion: "guardarErrores", datos: erroresTotales });
  }

  // --- FUNCIÓN DE CONEXIÓN A API (sin cambios) ---
  async function verificarTexto(texto) {
    try {
      const respuesta = await fetch("https://api.languagetool.org/v2/check", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `text=${encodeURIComponent(texto)}&language=${LANGUAGE}`
      });
      if (!respuesta.ok) return [];
      const datos = await respuesta.json();
      return datos.matches || [];
    } catch (error) {
      return [];
    }
  }

  // --- FUNCIÓN DE RESALTADO (con cambios) ---
  function resaltarErroresEnNodo(textNode, errores, startIndex) {
      if (!textNode.isConnected) return [];
      const erroresFormateados = [];

      errores.slice().reverse().forEach((error, index) => {
          const errorStart = error.offset;
          const errorLength = error.length;
          const errorEnd = errorStart + errorLength;
          if (errorEnd > textNode.nodeValue.length) return;

          try {
              let middleNode = textNode.splitText(errorStart);
              middleNode.splitText(errorLength);

              const mark = document.createElement("mark");
              const errorId = `lt-error-${startIndex + index}`;
              mark.id = errorId;
              
              // ===== NUEVO: Clasificar y asignar clase CSS =====
              const categoria = clasificarError(error.rule.category.id);
              mark.className = `error-ortografia categoria-${categoria}`;

              const sugerencias = error.replacements.map(r => r.value).join(', ');
              mark.title = `(${error.rule.category.name})\n${error.message}\nSugerencias: ${sugerencias}`;
              mark.textContent = middleNode.nodeValue;
              
              if (middleNode.parentNode) {
                  middleNode.parentNode.replaceChild(mark, middleNode);
              }

              // ===== NUEVO: Guardar la categoría en el objeto de error =====
              erroresFormateados.unshift({
                  id: errorId,
                  palabra: mark.textContent,
                  mensaje: error.message,
                  sugerencias: error.replacements.map(r => r.value),
                  categoria: categoria, // <-- Guardamos la categoría simplificada
                  url: window.location.href,
                  fecha: new Date().toISOString()
              });
          } catch (e) {
              console.error("Error al resaltar:", e);
          }
      });
      return erroresFormateados;
  }

  // ===== NUEVO: Función para simplificar las categorías de la API =====
  function clasificarError(categoriaId) {
    const id = categoriaId.toUpperCase();
    if (id.includes('TYPOS')) {
        return 'typo'; // Errores de ortografía
    }
    if (id.includes('GRAMMAR')) {
        return 'gramatica'; // Errores gramaticales
    }
    if (id.includes('STYLE') || id.includes('CONFUSED_WORDS')) {
        return 'estilo'; // Errores de estilo o palabras confusas
    }
    return 'otro'; // Puntuación, mayúsculas, etc.
  }
  
  // --- INYECCIÓN DE ESTILOS (sin cambios) ---
  const style = document.createElement('style');
  style.textContent = `
    @keyframes error-flash-animation {
      from { 
        outline: 3px solid rgba(255, 82, 82, 0.8);
        box-shadow: 0 0 10px rgba(255, 82, 82, 0.5);
      }
      to { 
        outline: 3px solid transparent;
        box-shadow: 0 0 0 transparent;
      }
    }
    mark.error-flash {
      animation: error-flash-animation 1.5s ease-out;
    }
  `;
  document.head.appendChild(style);

}