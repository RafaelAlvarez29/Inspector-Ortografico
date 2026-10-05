import { agregarPalabras, quitarPalabra } from './diccionario.js';
import { renderizarChips } from './render.js';
import { IDIOMAS, IDIOMA_POR_DEFECTO } from './idiomas.js';
import { TEMAS, TEMA_POR_DEFECTO, aplicarTema } from './tema.js';

/**
 * Vista de configuracion: idioma y diccionario personal.
 *
 * Construye su propio marcado para que exista una sola implementacion, montada
 * en dos sitios: el panel la desliza sobre si mismo y options.html la muestra a
 * pagina completa. Duplicar el HTML en ambos hosts garantizaria que se
 * desincronicen.
 */

// Plantilla sin interpolacion: ni un solo dato entra aqui. Las opciones de
// idioma y las etiquetas del diccionario se construyen aparte con la API del
// DOM, porque esas si llevan datos.
const PLANTILLA = `
  <h2 class="config-titulo">Idioma</h2>
  <p class="ayuda">
    Idioma con el que se revisarán las páginas. <em>Detectar automáticamente</em>
    deja que el servicio lo deduzca del propio texto.
  </p>
  <label class="campo-idioma">
    <span>Revisar en</span>
    <select id="idioma" class="campo-select"></select>
  </label>

  <hr class="divider">

  <h2 class="config-titulo">Apariencia</h2>
  <p class="ayuda">
    <em>Automático</em> sigue el tema de tu sistema operativo.
  </p>
  <label class="campo-idioma">
    <span>Tema</span>
    <select id="tema" class="campo-select"></select>
  </label>

  <hr class="divider">

  <h2 class="config-titulo">Diccionario personal</h2>
  <p class="ayuda">
    Palabras que el inspector no marcará como error. Escribe una y pulsa
    <kbd>Espacio</kbd>, <kbd>Enter</kbd>, <kbd>Tab</kbd> o <kbd>,</kbd>.
    También puedes pegar una lista entera. <kbd>Retroceso</kbd> con el campo
    vacío borra la última.
  </p>

  <div class="campo-chips" id="campo">
    <input id="entrada" type="text" autocomplete="off" spellcheck="false"
           aria-label="Añadir palabra al diccionario" placeholder="Añadir palabra...">
  </div>

  <div class="barra">
    <button id="guardar" type="button" class="button button-primary">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
      <span>Guardar cambios</span>
    </button>
    <span id="conteo"></span>
  </div>

  <div id="status" class="config-status" role="status"></div>
`;

// Teclas que cierran la palabra que se esta escribiendo.
const TECLAS_CONFIRMAR = new Set([' ', 'Enter', 'Tab', ',', ';']);

export function montarConfiguracion(raiz, { alGuardar } = {}) {
  raiz.innerHTML = PLANTILLA;

  const campo = raiz.querySelector('#campo');
  const entrada = raiz.querySelector('#entrada');
  const selectIdioma = raiz.querySelector('#idioma');
  const selectTema = raiz.querySelector('#tema');
  const botonGuardar = raiz.querySelector('#guardar');
  const conteoSpan = raiz.querySelector('#conteo');
  const statusDiv = raiz.querySelector('#status');

  let palabras = [];
  let guardado = [];
  let idiomaGuardado = IDIOMA_POR_DEFECTO;
  let temaGuardado = TEMA_POR_DEFECTO;
  let temporizadorAviso;

  // El selector se construye desde el catalogo para que no haya dos listas de
  // idiomas que mantener sincronizadas a mano.
  const llenar = (select, catalogo) => {
    for (const { codigo, nombre } of catalogo) {
      const opcion = document.createElement('option');
      opcion.value = codigo;
      opcion.textContent = nombre;
      select.appendChild(opcion);
    }
  };
  llenar(selectIdioma, IDIOMAS);
  llenar(selectTema, TEMAS);

  // --- ENTRADA ---
  entrada.addEventListener('keydown', (event) => {
    if (TECLAS_CONFIRMAR.has(event.key)) {
      // Tab con el campo vacio debe seguir moviendo el foco, no capturarse.
      if (event.key === 'Tab' && entrada.value.trim() === '') return;
      event.preventDefault();
      confirmarEntrada();
      return;
    }

    // Retroceso con el campo vacio borra la ultima etiqueta, como en los
    // campos de destinatarios de un correo.
    if (event.key === 'Backspace' && entrada.value === '' && palabras.length) {
      palabras = palabras.slice(0, -1);
      pintar();
    }
  });

  // Al perder el foco no se pierde lo escrito a medias.
  entrada.addEventListener('blur', confirmarEntrada);

  // Pegar una lista entera: se parte igual que al escribirla.
  entrada.addEventListener('paste', (event) => {
    const texto = event.clipboardData?.getData('text');
    if (!texto) return;
    event.preventDefault();
    incorporar(texto);
  });

  campo.addEventListener('click', (event) => {
    const quitar = event.target.closest('.chip-quitar');
    if (quitar) {
      palabras = quitarPalabra(palabras, quitar.closest('.chip').dataset.palabra);
      pintar();
      entrada.focus();
      return;
    }
    // El contenedor parece un campo de texto: pulsar en un hueco lo enfoca.
    if (event.target === campo) entrada.focus();
  });

  selectIdioma.addEventListener('change', pintar);

  // El tema se aplica al instante aunque no se haya guardado: elegir "oscuro"
  // y no ver nada hasta pulsar Guardar haria dudar de si funciono.
  selectTema.addEventListener('change', () => {
    aplicarTema(selectTema.value);
    pintar();
  });

  // Ctrl+S se engancha a la raiz y no al documento: en el panel, el atajo solo
  // debe guardar cuando el foco esta dentro de la configuracion.
  raiz.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!botonGuardar.disabled) botonGuardar.click();
    }
  });

  botonGuardar.addEventListener('click', async () => {
    await chrome.storage.sync.set({
      diccionarioPersonal: palabras,
      idioma: selectIdioma.value,
      tema: selectTema.value,
    });
    guardado = [...palabras];
    idiomaGuardado = selectIdioma.value;
    temaGuardado = selectTema.value;
    pintar();
    avisar('¡Cambios guardados con éxito!');
    alGuardar?.();
  });

  function confirmarEntrada() {
    if (entrada.value.trim() === '') return;
    incorporar(entrada.value);
  }

  function incorporar(texto) {
    const resultado = agregarPalabras(palabras, texto);
    palabras = resultado.lista;
    entrada.value = '';
    pintar();

    // Si todo lo escrito ya estaba, sin aviso pareceria que no funciono.
    if (resultado.agregadas.length === 0 && resultado.duplicadas.length) {
      const unicas = [...new Set(resultado.duplicadas)];
      avisar(
        unicas.length === 1
          ? `"${unicas[0]}" ya estaba en el diccionario.`
          : 'Esas palabras ya estaban en el diccionario.',
        true
      );
    }
  }

  function pintar() {
    // Se reemplazan solo las etiquetas y nunca el <input>: moverlo de sitio le
    // quitaria el foco, y entonces no se podria escribir la palabra siguiente.
    for (const chip of campo.querySelectorAll('.chip')) chip.remove();

    const temporal = document.createElement('div');
    renderizarChips(temporal, palabras, document);
    entrada.before(...temporal.childNodes);

    const total = palabras.length;
    const hayCambios =
      JSON.stringify(palabras) !== JSON.stringify(guardado) ||
      selectIdioma.value !== idiomaGuardado ||
      selectTema.value !== temaGuardado;

    conteoSpan.textContent =
      (total === 0 ? 'Sin palabras' : `${total} palabra${total === 1 ? '' : 's'}`) +
      (hayCambios ? ' · sin guardar' : '');
    botonGuardar.disabled = !hayCambios;
  }

  function avisar(mensaje, esAviso = false) {
    statusDiv.textContent = mensaje;
    statusDiv.classList.toggle('aviso', esAviso);
    statusDiv.style.opacity = '1';
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (statusDiv.style.opacity = '0'), 2500);
  }

  /** Relee lo almacenado. Se llama al montar y al volver a abrir la vista. */
  async function cargar() {
    const almacenado = await chrome.storage.sync.get(['diccionarioPersonal', 'idioma', 'tema']);
    palabras = almacenado.diccionarioPersonal || [];
    guardado = [...palabras];
    idiomaGuardado = almacenado.idioma || IDIOMA_POR_DEFECTO;
    selectIdioma.value = idiomaGuardado;
    temaGuardado = almacenado.tema || TEMA_POR_DEFECTO;
    selectTema.value = temaGuardado;
    // Si se abandona sin guardar, el tema debe volver a lo almacenado.
    aplicarTema(temaGuardado);
    pintar();
  }

  const listo = cargar();
  return { cargar, listo, enfocar: () => selectIdioma.focus() };
}
