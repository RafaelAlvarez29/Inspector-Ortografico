import { renderizarErrores, renderizarFiltros, renderizarEstado } from './lib/render.js';
import { estadoSigueVigente } from './lib/estado.js';
import { agruparErrores, contarPorCategoria } from './lib/agrupar.js';
import { nombreDeIdioma } from './lib/idiomas.js';
import { motivoNoRevisable, mensajeDeFallo } from './lib/paginas.js';
import { montarConfiguracion } from './lib/configuracion.js';
import { aplicarTema } from './lib/tema.js';

document.addEventListener('DOMContentLoaded', () => {
  const botonRevisar = document.getElementById('revisar');
  const botonLimpiar = document.getElementById('limpiar');
  const botonExportar = document.getElementById('exportar');
  const filaExportar = document.getElementById('accionesExportar');
  const pieIdioma = document.getElementById('idiomaActivo');
  const carril = document.getElementById('carril');
  const vistaPrincipal = document.getElementById('vistaPrincipal');
  const vistaConfig = document.getElementById('vistaConfig');
  const botonVolver = document.getElementById('volver');
  const contenedorConfig = document.getElementById('config');
  const marcoCarril = document.querySelector('.carril-marco');
  const cajaProgreso = document.getElementById('progreso');
  const barraProgreso = document.getElementById('progresoBarra');
  const listaErroresDiv = document.getElementById('listaErrores');
  const filtrosDiv = document.getElementById('filtros');
  const statusDiv = document.getElementById('status');
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
  // El tema se aplica cuanto antes. Las paginas de extension no admiten
  // scripts en linea, asi que no puede ser antes del primer pintado: quien
  // fuerce un tema distinto al del sistema vera un destello muy breve.
  chrome.storage.sync.get(['tema']).then(({ tema }) => aplicarTema(tema));

  async function inicializarPopup() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      statusDiv.textContent = 'No se pudo identificar la pestaña activa.';
      [botonRevisar, botonLimpiar, botonExportar].forEach((b) => (b.disabled = true));
      return;
    }
    activeTab = tab;
    mostrarIdiomaActivo();

    // Chrome no deja actuar sobre sus paginas internas ni sobre su tienda.
    // Es una accion imposible, no un error: mejor no ofrecerla.
    const motivo = motivoNoRevisable(tab.url);
    if (motivo) {
      vistaPrincipal.dataset.vacio = 'si';
      renderizarEstado(statusDiv, {
        tipo: 'bloqueado',
        titulo: 'Aquí no se puede revisar',
        detalle: motivo,
      }, document);
      statusDiv.hidden = false;
      botonRevisar.disabled = true;
      botonLimpiar.style.display = 'none';
      filaExportar.style.display = 'none';
      return;
    }

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

  // El idioma se edita en Opciones; aqui solo se recuerda cual esta activo,
  // para que un resultado extraño por idioma equivocado tenga explicacion.
  async function mostrarIdiomaActivo() {
    const { idioma } = await chrome.storage.sync.get(['idioma']);
    pieIdioma.textContent = nombreDeIdioma(idioma);
  }

  async function preguntarALaPagina() {
    try {
      return await chrome.tabs.sendMessage(activeTab.id, { accion: 'ping' });
    } catch {
      return null; // no hay content script: la pagina se recargo
    }
  }

  // --- ACCIONES ---
  // Hasta ahora las Opciones solo se alcanzaban con clic derecho sobre el
  // icono de la extension, algo que casi nadie descubre.
  botonOpciones.addEventListener('click', () => irA('config'));
  botonVolver.addEventListener('click', () => irA('principal'));

  // --- CARRIL DE VISTAS ---
  // La configuracion se monta al abrir el panel, no al pulsar el engranaje.
  // Montarla al vuelo hacia que la animacion arrancase antes de que el
  // navegador recalculara el tamano, y la primera transicion quedaba a medias.
  // El coste de tenerla lista de antemano es despreciable.
  const configuracion = montarConfiguracion(contenedorConfig, {
    alGuardar: () => setTimeout(() => irA('principal'), 900),
  });

  function irA(vista) {
    const aConfig = vista === 'config';

    // Pudo cambiarse el diccionario desde la pagina independiente.
    if (aConfig) configuracion.cargar();

    carril.dataset.vista = aConfig ? 'config' : 'principal';

    // inert saca a la vista oculta del orden de tabulacion y de los lectores
    // de pantalla: sin esto se tabula hacia controles invisibles.
    vistaPrincipal.toggleAttribute('inert', aConfig);
    vistaPrincipal.setAttribute('aria-hidden', String(aConfig));
    vistaConfig.toggleAttribute('inert', !aConfig);
    vistaConfig.setAttribute('aria-hidden', String(!aConfig));

    // preventScroll es imprescindible: enfocar un elemento dentro de un
    // contenedor con overflow oculto lo desplaza por scroll para "traerlo a la
    // vista", y el carril acababa a medio camino entre las dos pantallas.
    if (aConfig) {
      botonVolver.focus({ preventScroll: true });
    } else {
      botonOpciones.focus({ preventScroll: true });
      mostrarIdiomaActivo();
    }

    // Red de seguridad: el desplazamiento del carril lo hace el transform, asi
    // que cualquier scroll del marco es un desajuste.
    marcoCarril.scrollLeft = 0;
  }

  // Escape vuelve atras, como en cualquier panel que se superpone.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && carril.dataset.vista === 'config') {
      event.preventDefault();
      irA('principal');
    }
  });

  botonDeshacer.addEventListener('click', deshacerIgnorar);

  botonRevisar.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    listaErroresDiv.replaceChildren();
    filtrosDiv.hidden = true;
    filaExportar.style.display = 'none';
    filtroActivo = null;
    ocurrenciaPorClave.clear();
    renderizarEstado(statusDiv, {
      tipo: 'inicial',
      titulo: 'Revisando la página…',
      detalle: 'Analizando el texto visible.',
    }, document);
    statusDiv.hidden = false;
    botonRevisar.disabled = true;
    iniciarProgreso();
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
      // Un fallo esperado no se registra: acabaria en la lista de errores de
      // la extension dando a entender que algo esta roto.
      if (!mensajeDeFallo.esEsperado(error)) console.error('Fallo la revision:', error);
      erroresActuales = [];
      mostrarErroresUI([], { error: mensajeDeFallo(error) });
    } finally {
      botonRevisar.disabled = false;
      ocultarProgreso();
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
      mostrarProgreso(mensaje.hechos, mensaje.total);
    }
  });

  // --- PROGRESO DE LA REVISION ---
  function iniciarProgreso() {
    // Hasta que termina el primer lote no se sabe cuantos hay. Una barra
    // parada en cero pareceria que la revision no avanza, asi que se muestra
    // indeterminada y pasa a determinada en cuanto llega la primera fraccion.
    cajaProgreso.hidden = false;
    cajaProgreso.classList.add('indeterminado');
    cajaProgreso.removeAttribute('aria-valuenow');
    cajaProgreso.setAttribute('aria-valuetext', 'Preparando la revisión');
    barraProgreso.style.width = '';
  }

  function mostrarProgreso(hechos, total) {
    const porcentaje = total > 0 ? Math.round((hechos / total) * 100) : 0;

    cajaProgreso.hidden = false;
    cajaProgreso.classList.remove('indeterminado');
    barraProgreso.style.width = `${porcentaje}%`;
    cajaProgreso.setAttribute('aria-valuenow', String(porcentaje));
    cajaProgreso.setAttribute('aria-valuetext', `Bloque ${hechos} de ${total}`);
    const detalle = statusDiv.querySelector('.estado-detalle');
    if (detalle) detalle.textContent = `Bloque ${hechos} de ${total}`;
  }

  function ocultarProgreso() {
    cajaProgreso.hidden = true;
    cajaProgreso.classList.remove('indeterminado');
    barraProgreso.style.width = '';
    cajaProgreso.removeAttribute('aria-valuenow');
  }

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

  // "Aun no has revisado" y "no se encontro nada" son mensajes opuestos:
  // compartian la misma caja gris y no se distinguian.
  function estadoVacio(aviso, estado) {
    if (aviso) return { tipo: 'aviso', titulo: 'Revisión incompleta', detalle: aviso };
    if (estado) {
      return {
        tipo: 'exito',
        titulo: 'Sin errores',
        detalle: 'No se encontró ningún problema en el texto visible.',
      };
    }
    return {
      tipo: 'inicial',
      titulo: 'Listo para revisar',
      detalle: 'Pulsa «Revisar Página» para analizar el texto de esta pestaña.',
    };
  }

  function mostrarErroresUI(errores, estado) {
    const aviso = describirEstado(estado);
    const conteo = contarPorCategoria(errores || []);

    renderizarFiltros(filtrosDiv, conteo, filtroActivo, document);
    filtrosDiv.hidden = conteo.total === 0;

    // Exportar solo se ofrece cuando hay algo que exportar: un boton que lo
    // unico que puede hacer es responder "no hay nada" no deberia existir.
    filaExportar.style.display = conteo.total > 0 ? 'flex' : 'none';

    vistaPrincipal.dataset.vacio = errores && errores.length ? 'no' : 'si';

    if (!errores || errores.length === 0) {
      listaErroresDiv.replaceChildren();
      renderizarEstado(statusDiv, estadoVacio(aviso, estado), document);
      statusDiv.hidden = false;
      botonLimpiar.style.display = 'none';
      return;
    }

    const visibles = filtroActivo ? errores.filter((e) => e.categoria === filtroActivo) : errores;
    renderizarErrores(listaErroresDiv, agruparErrores(visibles), document);

    if (aviso) {
      renderizarEstado(statusDiv, {
        tipo: 'aviso', titulo: 'Revisión incompleta', detalle: aviso,
      }, document);
    } else {
      statusDiv.replaceChildren();
    }
    statusDiv.hidden = !aviso;
    botonLimpiar.style.display = 'flex';
  }

  inicializarPopup();
});
