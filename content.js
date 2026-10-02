// =================================================================
// SCRIPT DE CONTENIDO - Solo manipula el DOM.
// La red la hace el service worker (background.js).
// =================================================================
if (typeof window.revisorOrtograficoInyectado === 'undefined') {
  window.revisorOrtograficoInyectado = true;

  const ETIQUETAS_IGNORADAS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'MARK', 'TEXTAREA', 'INPUT']);

  chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
    // El popup pregunta si esta pagina sigue siendo la que se reviso. Si la
    // recargaron, este script ya no existe y el ping nunca llega a contestarse.
    if (mensaje.accion === 'ping') {
      sendResponse({
        activo: true,
        marcas: document.querySelectorAll('mark.error-ortografia').length,
      });
      return;
    }

    // La revision responde al que la pidio en vez de emitir un mensaje suelto:
    // asi el popup siempre obtiene un desenlace y puede reactivar su boton.
    if (mensaje.accion === 'iniciarRevision') {
      revisarPaginaEntera().then(sendResponse);
      return true;
    }

    if (mensaje.accion === 'limpiarRevision') {
      limpiarResaltadoCompleto();
      sendResponse({ status: 'limpieza completada' });
    }

    if (mensaje.accion === 'irAError') {
      const elemento = document.getElementById(mensaje.errorId);
      if (elemento) {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elemento.classList.add('error-flash');
        setTimeout(() => elemento.classList.remove('error-flash'), 1500);
      }
    }

    // Ignorar no desenvuelve la marca: solo le quita el resaltado. Asi el
    // usuario puede deshacerlo, cosa imposible si se destruye el elemento.
    // La marca desaparece de verdad en la siguiente revision, donde el
    // diccionario ya filtra la palabra.
    if (mensaje.accion === 'marcarIgnorado') {
      const mark = document.getElementById(mensaje.errorId);
      if (mark) mark.classList.toggle('error-ignorado', mensaje.ignorado !== false);
    }
  });

  // --- DOM ---
  function desenvolverMark(markElement) {
    const parent = markElement.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(markElement.textContent), markElement);
    parent.normalize();
  }

  function limpiarResaltadoCompleto() {
    document.querySelectorAll('mark.error-ortografia').forEach(desenvolverMark);
  }

  function recolectarNodosDeTexto() {
    const nodos = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let nodo;

    while ((nodo = walker.nextNode())) {
      const padre = nodo.parentElement;
      if (!padre) continue;
      if (ETIQUETAS_IGNORADAS.has(padre.tagName.toUpperCase())) continue;
      if (padre.isContentEditable) continue;
      if (padre.closest('[aria-hidden="true"]')) continue;
      if (nodo.nodeValue.trim() === '') continue;
      nodos.push(nodo);
    }
    return nodos;
  }

  // --- REVISION ---
  async function revisarPaginaEntera() {
    limpiarResaltadoCompleto();

    const { diccionarioPersonal = [], idioma = 'es' } = await chrome.storage.sync.get([
      'diccionarioPersonal',
      'idioma',
    ]);
    const diccionario = new Set(diccionarioPersonal.map((p) => p.toLowerCase()));

    const nodos = recolectarNodosDeTexto();
    const textos = nodos.map((n) => n.nodeValue);

    let respuesta;
    try {
      respuesta = await chrome.runtime.sendMessage({ accion: 'revisarTextos', textos, idioma });
    } catch (e) {
      return persistir([], { error: `No se pudo completar la revision: ${e.message}` });
    }

    const { hallazgos, lotesFallidos, lotesTotales } = respuesta;

    // Se descartan los hallazgos de nodos que cambiaron mientras esperabamos
    // la respuesta: sus offsets ya no son validos y resaltarlos marcaria texto
    // correcto como erroneo.
    const { filtrarHallazgosVigentes } = await import(
      chrome.runtime.getURL('lib/batching.js')
    );
    const vigentes = filtrarHallazgosVigentes(
      hallazgos,
      nodos.map((n) => (n.isConnected ? n.nodeValue : null)),
      textos
    );

    // El texto del error se lee del nodo original, no del "context" recortado
    // que devuelve la API, cuyo offset es relativo a ese fragmento.
    const visibles = vigentes.filter((h) => {
      const palabra = textos[h.indiceOrigen].substr(h.offset, h.longitud);
      return !diccionario.has(palabra.toLowerCase());
    });

    const errores = resaltar(nodos, visibles);
    return persistir(errores, { lotesFallidos, lotesTotales });
  }

  function persistir(errores, estado) {
    // Se guarda aunque el popup se haya cerrado durante la revision.
    chrome.runtime.sendMessage({ accion: 'guardarErrores', datos: errores }).catch(() => {});
    return { errores, estado };
  }

  // --- RESALTADO ---
  function resaltar(nodos, hallazgos) {
    // Los ids se asignan en orden de lectura, pero el resaltado se aplica de
    // atras hacia adelante para que los offsets previos sigan siendo validos
    // despues de cada splitText.
    hallazgos.forEach((h, i) => (h.id = `lt-error-${i}`));

    const porNodo = new Map();
    for (const h of hallazgos) {
      if (!porNodo.has(h.indiceOrigen)) porNodo.set(h.indiceOrigen, []);
      porNodo.get(h.indiceOrigen).push(h);
    }

    const errores = [];

    for (const [indiceOrigen, delNodo] of porNodo) {
      const nodo = nodos[indiceOrigen];
      if (!nodo.isConnected) continue;

      for (const h of [...delNodo].sort((a, b) => b.offset - a.offset)) {
        const mark = envolver(nodo, h);
        if (mark) errores.push(describir(mark, h));
      }
    }

    return errores.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }

  function envolver(nodo, hallazgo) {
    if (hallazgo.offset + hallazgo.longitud > nodo.nodeValue.length) return null;

    try {
      const medio = nodo.splitText(hallazgo.offset);
      medio.splitText(hallazgo.longitud);

      const mark = document.createElement('mark');
      mark.id = hallazgo.id;
      mark.className = `error-ortografia categoria-${clasificarError(hallazgo.match.rule?.category?.id)}`;
      mark.textContent = medio.nodeValue;
      // Se usa data-tooltip y no title: el atributo title dispara ademas el
      // globo nativo del navegador, que duplicaria el tooltip de styles.css.
      // aria-label conserva el texto para lectores de pantalla.
      const descripcion = construirTitulo(hallazgo.match);
      mark.dataset.tooltip = descripcion;
      mark.setAttribute('aria-label', descripcion);

      medio.parentNode?.replaceChild(mark, medio);
      return mark;
    } catch (e) {
      console.error('Error al resaltar:', e);
      return null;
    }
  }

  function construirTitulo(match) {
    const sugerencias = (match.replacements || []).map((r) => r.value).join(', ');
    return `(${match.rule?.category?.name || 'Desconocido'})\n${match.message}\nSugerencias: ${sugerencias || 'Ninguna'}`;
  }

  function describir(mark, hallazgo) {
    return {
      id: hallazgo.id,
      palabra: mark.textContent,
      mensaje: hallazgo.match.message,
      sugerencias: (hallazgo.match.replacements || []).map((r) => r.value),
      categoria: clasificarError(hallazgo.match.rule?.category?.id),
      url: window.location.href,
      fecha: new Date().toISOString(),
    };
  }

  function clasificarError(categoriaId) {
    const id = (categoriaId || '').toUpperCase();
    if (id.includes('TYPOS')) return 'typo';
    if (id.includes('GRAMMAR')) return 'gramatica';
    if (id.includes('STYLE') || id.includes('CONFUSED_WORDS')) return 'estilo';
    return 'otro';
  }

  // --- TOOLTIP ---
  // Un unico elemento con position: fixed colgado del <body>. Asi no lo recorta
  // ningun ancestro con overflow: hidden, y al posicionarlo por JS se puede
  // voltear o acotar cuando la palabra esta pegada a un borde de la ventana.
  let tooltipEl = null;
  let calcularPosicion = null;

  async function prepararTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'inspector-ortografico-tooltip';
    // aria-hidden porque el texto ya esta en el aria-label de la marca; ademas
    // hace que recolectarNodosDeTexto lo ignore y no se revise a si mismo.
    tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipEl);
    ({ calcularPosicionTooltip: calcularPosicion } = await import(
      chrome.runtime.getURL('lib/tooltip.js')
    ));
  }

  async function mostrarTooltip(marca) {
    await prepararTooltip();
    tooltipEl.textContent = marca.dataset.tooltip;

    // Se hace visible para poder medirlo, pero sin pintarlo todavia: sin medida
    // real no se puede saber si cabe arriba ni cuanto hay que desplazarlo.
    tooltipEl.style.visibility = 'hidden';
    tooltipEl.style.display = 'block';
    const medida = tooltipEl.getBoundingClientRect();

    const pos = calcularPosicion(
      marca.getBoundingClientRect(),
      { width: medida.width, height: medida.height },
      { width: window.innerWidth, height: window.innerHeight }
    );

    tooltipEl.style.left = `${pos.left}px`;
    tooltipEl.style.top = `${pos.top}px`;
    tooltipEl.dataset.lado = pos.lado;
    tooltipEl.style.visibility = 'visible';
  }

  function ocultarTooltip() {
    if (tooltipEl) tooltipEl.style.display = 'none';
  }

  // Delegacion en document: las marcas se crean y destruyen constantemente.
  document.addEventListener('mouseover', (e) => {
    const marca = e.target?.closest?.('mark.error-ortografia[data-tooltip]');
    if (marca) mostrarTooltip(marca);
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target?.closest?.('mark.error-ortografia')) ocultarTooltip();
  });
  // Con position: fixed el tooltip no acompana el scroll: se oculta.
  window.addEventListener('scroll', ocultarTooltip, true);

  // --- ESTILOS DE LA ANIMACION ---
  const style = document.createElement('style');
  style.textContent = `
    @keyframes error-flash-animation {
      from { outline: 3px solid rgba(255, 82, 82, 0.8); box-shadow: 0 0 10px rgba(255, 82, 82, 0.5); }
      to   { outline: 3px solid transparent; box-shadow: 0 0 0 transparent; }
    }
    mark.error-flash { animation: error-flash-animation 1.5s ease-out; }
  `;
  document.head.appendChild(style);
}
