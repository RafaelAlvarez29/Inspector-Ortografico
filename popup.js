import { renderizarErrores, renderizarFiltros } from './lib/render.js';
import { estadoSigueVigente } from './lib/estado.js';
import { agruparErrores, contarPorCategoria } from './lib/agrupar.js';

document.addEventListener('DOMContentLoaded', () => {
  const botonRevisar = document.getElementById('revisar');
  const botonLimpiar = document.getElementById('limpiar');
  const botonExportar = document.getElementById('exportar');
  const listaErroresDiv = document.getElementById('listaErrores');
  const filtrosDiv = document.getElementById('filtros');
  const statusDiv = document.getElementById('status');
  const selectIdioma = document.getElementById('idioma');
  const botonOpciones = document.getElementById('opciones');
  const barraDeshacer = document.getElementById('deshacer');
  const textoDeshacer = document.getElementById('deshacerTexto');
  const botonDeshacer = document.getElementById('deshacerBtn');

  const SEGUNDOS_DESHACER = 8;

  let activeTab;
  let erroresActuales = [];
  let filtroActivo = null;
  let ultimoIgnorado = null;
  let temporizadorDeshacer = null;
  // Una palabra repetida tiene varias ocurrencias; se recuerda por cual va el
  // usuario para que cada clic salte a la siguiente en vez de a la misma.
  const ocurrenciaPorClave = new Map();

  // --- INICIALIZACION ---
  async function inicializarPopup() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      statusDiv.textContent = 'No se pudo identificar la pestaña activa.';
      [botonRevisar, botonLimpiar, botonExportar].forEach((b) => (b.disabled = true));
      return;
    }
    activeTab = tab;

    const { idioma = 'es' } = await chrome.storage.sync.get(['idioma']);
    selectIdioma.value = idioma;

    let guardados = [];
    try {
      const respuesta = await chrome.runtime.sendMessage({
        accion: 'obtenerErrores',
        tabId: activeTab.id,
      });
      guardados = respuesta?.datos || [];
    } catch {
      statusDiv.textContent = 'Error al comunicarse con el script de fondo.';
      return;
    }

    if (guardados.length === 0) return mostrarErroresUI([]);

    // Si la pagina se recargo o navego, los <mark> ya no existen y esta lista
    // apuntaria a ids inexistentes: hacer clic en un error no haria nada.
    if (!estadoSigueVigente(await preguntarALaPagina())) {
      chrome.runtime.sendMessage({ accion: 'limpiarRevision', tabId: activeTab.id });
      return mostrarErroresUI([]);
    }

    erroresActuales = guardados;
    try {
      await chrome.scripting.insertCSS({ target: { tabId: activeTab.id }, files: ['styles.css'] });
    } catch (e) {
      console.warn('No se pudo inyectar CSS en la pagina.', e.message);
    }
    mostrarErroresUI(erroresActuales);
  }

  async function preguntarALaPagina() {
    try {
      return await chrome.tabs.sendMessage(activeTab.id, { accion: 'ping' });
    } catch {
      return null; // no hay content script: la pagina se recargo
    }
  }

  // --- ACCIONES ---
  selectIdioma.addEventListener('change', () => {
    chrome.storage.sync.set({ idioma: selectIdioma.value });
  });

  // Hasta ahora las Opciones solo se alcanzaban con clic derecho sobre el
  // icono de la extension, algo que casi nadie descubre.
  botonOpciones.addEventListener('click', () => chrome.runtime.openOptionsPage());

  botonDeshacer.addEventListener('click', deshacerIgnorar);

  botonRevisar.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    listaErroresDiv.replaceChildren();
    filtrosDiv.hidden = true;
    filtroActivo = null;
    ocurrenciaPorClave.clear();
    statusDiv.textContent = 'Revisando, por favor espera...';
    statusDiv.style.display = 'block';
    botonRevisar.disabled = true;
    botonLimpiar.style.display = 'none';

    try {
      await chrome.scripting.insertCSS({ target: { tabId: activeTab.id }, files: ['styles.css'] });
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js'],
      });

      // Se espera el desenlace en vez de confiar en un mensaje posterior: si
      // el content script muere a mitad, esto rechaza y el finally reactiva
      // el boton, en lugar de dejar el popup colgado en "Revisando...".
      const resultado = await chrome.tabs.sendMessage(activeTab.id, { accion: 'iniciarRevision' });
      erroresActuales = resultado?.errores || [];
      mostrarErroresUI(erroresActuales, resultado?.estado);
    } catch (error) {
      console.error('Fallo la revision:', error);
      erroresActuales = [];
      mostrarErroresUI([], { error: `La revisión no pudo completarse. (${error.message})` });
    } finally {
      botonRevisar.disabled = false;
    }
  });

  botonExportar.addEventListener('click', () => {
    if (activeTab?.id) chrome.runtime.sendMessage({ accion: 'exportarCSV', tabId: activeTab.id });
  });

  botonLimpiar.addEventListener('click', () => {
    if (!activeTab?.id) return;
    chrome.tabs.sendMessage(activeTab.id, { accion: 'limpiarRevision' }).catch(() => {});
    chrome.runtime.sendMessage({ accion: 'limpiarRevision', tabId: activeTab.id });
    erroresActuales = [];
    filtroActivo = null;
    ocurrenciaPorClave.clear();
    mostrarErroresUI([]);
  });

  filtrosDiv.addEventListener('click', (event) => {
    const pastilla = event.target.closest('.filtro');
    if (!pastilla) return;
    filtroActivo = pastilla.dataset.categoria || null;
    mostrarErroresUI(erroresActuales);
  });

  listaErroresDiv.addEventListener('click', (event) => {
    const item = event.target.closest('.error-item');
    if (!item) return;

    const copiar = event.target.closest('.copiar-btn');
    if (copiar) {
      copiarCorreccion(copiar);
      return;
    }

    if (event.target.closest('.ignorar-btn')) {
      ignorarPalabra(item.dataset.palabra, (item.dataset.ids || '').split(','));
      return;
    }
    irASiguienteOcurrencia(item);
  });

  // Los controles dentro de la fila son <span role="button">: el teclado no
  // dispara click sobre ellos, hay que traducir Enter y Espacio.
  listaErroresDiv.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const control = event.target.closest('.copiar-btn, .ignorar-btn');
    if (!control) return;
    event.preventDefault();
    control.click();
  });

  chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje.accion === 'alerta') {
      mostrarErroresUI(erroresActuales, { error: mensaje.mensaje });
    }
    if (mensaje.accion === 'progreso') {
      statusDiv.textContent = `Revisando bloque ${mensaje.hechos} de ${mensaje.total}...`;
    }
  });

  // --- COPIAR CORRECCION ---
  async function copiarCorreccion(boton) {
    try {
      await navigator.clipboard.writeText(boton.dataset.copia);
      const original = boton.textContent;
      boton.textContent = 'Copiado';
      boton.classList.add('copiado');
      setTimeout(() => {
        boton.textContent = original;
        boton.classList.remove('copiado');
      }, 1200);
    } catch (e) {
      console.warn('No se pudo copiar al portapapeles.', e.message);
    }
  }

  // --- NAVEGACION ENTRE OCURRENCIAS ---
  function irASiguienteOcurrencia(item) {
    const ids = (item.dataset.ids || '').split(',').filter(Boolean);
    if (ids.length === 0) return;

    const clave = item.dataset.clave;
    const siguiente = ((ocurrenciaPorClave.get(clave) ?? -1) + 1) % ids.length;
    ocurrenciaPorClave.set(clave, siguiente);

    if (ids.length > 1) item.dataset.posicion = `${siguiente + 1}/${ids.length}`;

    chrome.tabs
      .sendMessage(activeTab.id, { accion: 'irAError', errorId: ids[siguiente] })
      .catch(() => {});
  }

  // --- DICCIONARIO ---
  function pintarIgnorado(ids, ignorado) {
    for (const id of ids) {
      chrome.tabs
        .sendMessage(activeTab.id, { accion: 'marcarIgnorado', errorId: id, ignorado })
        .catch(() => {});
    }
  }

  function guardarEstado() {
    chrome.runtime.sendMessage({
      accion: 'guardarErrores',
      datos: erroresActuales,
      tabId: activeTab.id,
    });
  }

  async function ignorarPalabra(palabra, ids) {
    const { diccionarioPersonal = [] } = await chrome.storage.sync.get(['diccionarioPersonal']);
    const enMinusculas = palabra.toLowerCase();
    // Si ya estaba, deshacer no debe sacarla: no fue este clic quien la metio.
    const yaEstaba = diccionarioPersonal.includes(enMinusculas);
    if (!yaEstaba) {
      diccionarioPersonal.push(enMinusculas);
      await chrome.storage.sync.set({ diccionarioPersonal });
    }

    // Se ocultan TODAS las ocurrencias, no solo la que se ve en la lista.
    pintarIgnorado(ids, true);

    const descartados = new Set(ids);
    const retirados = erroresActuales.filter((e) => descartados.has(e.id));
    erroresActuales = erroresActuales.filter((e) => !descartados.has(e.id));
    guardarEstado();

    ultimoIgnorado = { palabra, enMinusculas, ids, retirados, yaEstaba };
    mostrarDeshacer(palabra);
    mostrarErroresUI(erroresActuales);
  }

  async function deshacerIgnorar() {
    if (!ultimoIgnorado) return;
    const { enMinusculas, ids, retirados, yaEstaba } = ultimoIgnorado;

    if (!yaEstaba) {
      const { diccionarioPersonal = [] } = await chrome.storage.sync.get(['diccionarioPersonal']);
      await chrome.storage.sync.set({
        diccionarioPersonal: diccionarioPersonal.filter((p) => p !== enMinusculas),
      });
    }

    pintarIgnorado(ids, false);

    // Se reinsertan en su posicion original para no alterar el orden de lectura.
    // Los ids son "lt-error-N", asignados en orden de aparicion en la pagina.
    const posicion = (e) => Number(e.id.replace(/\D/g, ''));
    erroresActuales = [...erroresActuales, ...retirados].sort((a, b) => posicion(a) - posicion(b));
    guardarEstado();

    ocultarDeshacer();
    mostrarErroresUI(erroresActuales);
  }

  function mostrarDeshacer(palabra) {
    textoDeshacer.textContent = `Se ignoró "${palabra}".`;
    barraDeshacer.hidden = false;
    clearTimeout(temporizadorDeshacer);
    temporizadorDeshacer = setTimeout(ocultarDeshacer, SEGUNDOS_DESHACER * 1000);
  }

  function ocultarDeshacer() {
    clearTimeout(temporizadorDeshacer);
    barraDeshacer.hidden = true;
    ultimoIgnorado = null;
  }

  // --- PINTADO ---
  // Un fallo de la API ya no se confunde con "no hay errores": si algun lote
  // no se pudo revisar, el reporte se marca explicitamente como parcial.
  function describirEstado(estado) {
    if (!estado) return null;
    if (estado.error) return estado.error;
    if (estado.lotesFallidos > 0) {
      return `Revisión parcial: fallaron ${estado.lotesFallidos} de ${estado.lotesTotales} bloques. Reintenta en un minuto.`;
    }
    return null;
  }

  function mostrarErroresUI(errores, estado) {
    const aviso = describirEstado(estado);
    const conteo = contarPorCategoria(errores || []);

    renderizarFiltros(filtrosDiv, conteo, filtroActivo, document);
    filtrosDiv.hidden = conteo.total === 0;

    if (!errores || errores.length === 0) {
      listaErroresDiv.replaceChildren();
      statusDiv.textContent =
        aviso || '¡Todo correcto o las palabras desconocidas han sido ignoradas!';
      statusDiv.style.display = 'block';
      botonLimpiar.style.display = 'none';
      return;
    }

    const visibles = filtroActivo ? errores.filter((e) => e.categoria === filtroActivo) : errores;
    renderizarErrores(listaErroresDiv, agruparErrores(visibles), document);

    statusDiv.textContent = aviso || '';
    statusDiv.style.display = aviso ? 'block' : 'none';
    botonLimpiar.style.display = 'flex';
  }

  inicializarPopup();
});
