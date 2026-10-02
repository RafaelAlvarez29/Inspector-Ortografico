import { agregarPalabras, quitarPalabra } from './lib/diccionario.js';
import { renderizarChips } from './lib/render.js';

document.addEventListener('DOMContentLoaded', async () => {
  const campo = document.getElementById('campo');
  const entrada = document.getElementById('entrada');
  const botonGuardar = document.getElementById('guardar');
  const conteoSpan = document.getElementById('conteo');
  const statusDiv = document.getElementById('status');

  // Teclas que cierran la palabra que se esta escribiendo.
  const TECLAS_CONFIRMAR = new Set([' ', 'Enter', 'Tab', ',', ';']);

  let palabras = [];
  let guardado = [];

  // --- CARGA ---
  const almacenado = await chrome.storage.sync.get(['diccionarioPersonal']);
  palabras = almacenado.diccionarioPersonal || [];
  guardado = [...palabras];
  pintar();

  // --- ENTRADA ---
  entrada.addEventListener('keydown', (event) => {
    if (TECLAS_CONFIRMAR.has(event.key)) {
      // Tab con el campo vacio debe seguir moviendo el foco, no capturarse.
      if (event.key === 'Tab' && entrada.value.trim() === '') return;
      event.preventDefault();
      confirmarEntrada();
      return;
    }

    // Retroceso con el campo vacio borra el ultimo chip, como en los
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
    // El contenedor parece un input: pulsar en cualquier hueco enfoca el campo.
    if (event.target === campo) entrada.focus();
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

  // --- GUARDADO ---
  botonGuardar.addEventListener('click', async () => {
    await chrome.storage.sync.set({ diccionarioPersonal: palabras });
    guardado = [...palabras];
    pintar();
    avisar('¡Diccionario guardado con éxito!');
  });

  // Ctrl+S guarda, porque es un formulario que se edita a ratos.
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!botonGuardar.disabled) botonGuardar.click();
    }
  });

  // --- PINTADO ---
  function pintar() {
    // Se reemplazan solo los chips y nunca el <input>: moverlo de sitio le
    // quitaria el foco, y entonces no se podria escribir la palabra siguiente.
    for (const chip of campo.querySelectorAll('.chip')) chip.remove();

    const contenedorTemporal = document.createElement('div');
    renderizarChips(contenedorTemporal, palabras, document);
    entrada.before(...contenedorTemporal.childNodes);

    const total = palabras.length;
    conteoSpan.textContent =
      total === 0 ? 'Sin palabras' : `${total} palabra${total === 1 ? '' : 's'}`;

    const haycambios = JSON.stringify(palabras) !== JSON.stringify(guardado);
    botonGuardar.disabled = !haycambios;
    conteoSpan.textContent += haycambios ? ' · sin guardar' : '';
  }

  function avisar(mensaje, esAviso = false) {
    statusDiv.textContent = mensaje;
    statusDiv.classList.toggle('aviso', esAviso);
    statusDiv.style.opacity = '1';
    clearTimeout(avisar.temporizador);
    avisar.temporizador = setTimeout(() => (statusDiv.style.opacity = '0'), 2500);
  }
});
