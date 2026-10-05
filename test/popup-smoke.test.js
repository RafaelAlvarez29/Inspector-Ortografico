import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montar, ejecutar, idsQuePide, visible } from './ayuda-montaje.js';

const HTML = new URL('../popup.html', import.meta.url);
const SCRIPT = new URL('../popup.js', import.meta.url);

function chromeFalso(guardados = [], almacenado = {}, url = 'https://ejemplo.test/') {
  const sinRespuesta = async () => undefined;
  // Se guardan los oyentes para poder entregarles mensajes desde las pruebas,
  // que es como llega el progreso de la revision desde el service worker.
  const oyentes = [];
  const api = {
    __emitir: (mensaje) => oyentes.forEach((f) => f(mensaje)),
    runtime: {
      sendMessage: async (m) =>
        m.accion === 'obtenerErrores' ? { datos: guardados } : undefined,
      onMessage: { addListener: (f) => oyentes.push(f) },
      openOptionsPage: () => {},
      lastError: null,
    },
    tabs: {
      query: async () => [{ id: 1, url }],
      // Responder al ping mantiene vigente el estado guardado.
      sendMessage: async (id, m) =>
        m.accion === 'ping' ? { activo: true, marcas: guardados.length } : undefined,
    },
    storage: { sync: { get: async () => ({ ...almacenado }), set: async () => {} } },
    scripting: { insertCSS: sinRespuesta, executeScript: sinRespuesta },
  };
  return api;
}

const error = (id, palabra, categoria = 'typo') => ({
  id, palabra, categoria, mensaje: 'Posible error', sugerencias: ['ok'],
});

test('popup.js se ejecuta sobre popup.html sin lanzar', async () => {
  const { errores } = await ejecutar(HTML, SCRIPT, chromeFalso());

  assert.deepEqual(
    errores.map((e) => (e && e.message) || String(e)),
    [],
    'popup.js lanzo al inicializarse'
  );
});

test('popup.html contiene todos los elementos que popup.js busca', () => {
  const { window } = montar(HTML);

  const faltan = idsQuePide(SCRIPT).filter((id) => !window.document.getElementById(id));
  assert.deepEqual(faltan, [], 'ids ausentes en popup.html');
});

test('el boton Exportar CSV no se ofrece cuando no hay nada que exportar', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([]));

  assert.equal(visible(window.document.getElementById('exportar')), false);
});

test('el boton Exportar CSV aparece cuando hay errores', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([error('lt-error-0', 'Olaa')]));

  assert.equal(visible(window.document.getElementById('exportar')), true);
});

test('el selector de idioma no esta en la vista de revision, sino en la de ajustes', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());
  const doc = window.document;

  assert.equal(doc.getElementById('vistaPrincipal').querySelector('#idioma'), null);
  assert.ok(doc.getElementById('vistaConfig').querySelector('#idioma'));
});

test('muestra el idioma activo en el pie del panel', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([], { idioma: 'fr' }));

  assert.equal(window.document.getElementById('idiomaActivo').textContent, 'Francés');
});

test('sin idioma guardado el pie muestra el valor por defecto', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());

  assert.equal(window.document.getElementById('idiomaActivo').textContent, 'Español');
});

test('en una pagina interna de Chrome no se ofrece revisar', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([], {}, 'chrome://extensions'));

  assert.equal(window.document.getElementById('revisar').disabled, true);
  assert.match(window.document.getElementById('status').textContent, /no permite revisarla/i);
});

test('en la tienda de extensiones tampoco se ofrece revisar', async () => {
  const chrome = chromeFalso([], {}, 'https://chromewebstore.google.com/detail/x');
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  assert.equal(window.document.getElementById('revisar').disabled, true);
});

test('en una pagina normal el boton de revisar sigue activo', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());

  assert.equal(window.document.getElementById('revisar').disabled, false);
});

// --- CARRIL DE VISTAS ---
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));

test('al abrir, la configuracion esta oculta y fuera del orden de tabulacion', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());
  const doc = window.document;

  assert.notEqual(doc.getElementById('carril').dataset.vista, 'config');
  assert.equal(doc.getElementById('vistaConfig').hasAttribute('inert'), true);
});

test('el engranaje desliza hasta la configuracion', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());
  const doc = window.document;

  doc.getElementById('opciones').click();
  await esperar();

  assert.equal(doc.getElementById('carril').dataset.vista, 'config');
  assert.equal(doc.getElementById('vistaConfig').hasAttribute('inert'), false);
  assert.equal(doc.getElementById('vistaPrincipal').hasAttribute('inert'), true);
});

test('la configuracion se monta con sus controles dentro del panel', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());
  const doc = window.document;

  doc.getElementById('opciones').click();
  await esperar();

  const config = doc.getElementById('config');
  assert.ok(config.querySelector('#idioma'), 'falta el selector de idioma');
  assert.ok(config.querySelector('#campo'), 'falta el campo del diccionario');
  assert.ok(config.querySelector('#guardar'), 'falta el boton de guardar');
});

test('la flecha de volver regresa a la revision', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());
  const doc = window.document;

  doc.getElementById('opciones').click();
  await esperar();
  doc.getElementById('volver').click();
  await esperar();

  assert.equal(doc.getElementById('carril').dataset.vista, 'principal');
  assert.equal(doc.getElementById('vistaPrincipal').hasAttribute('inert'), false);
  assert.equal(doc.getElementById('vistaConfig').hasAttribute('inert'), true);
});

test('Escape tambien vuelve a la revision', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());
  const doc = window.document;

  doc.getElementById('opciones').click();
  await esperar();
  doc.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await esperar();

  assert.equal(doc.getElementById('carril').dataset.vista, 'principal');
});

test('el panel ya no abre la pagina de opciones en otra pestana', async () => {
  let abierta = false;
  const chrome = chromeFalso();
  chrome.runtime.openOptionsPage = () => { abierta = true; };
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  window.document.getElementById('opciones').click();
  await esperar();

  assert.equal(abierta, false, 'deberia deslizar, no abrir una pestana');
});

test('la configuracion ya esta montada antes de pulsar el engranaje', async () => {
  // Montarla al vuelo hacia que la animacion arrancase antes de que el
  // navegador recalculara el tamano: la primera transicion quedaba a medias.
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());

  const config = window.document.getElementById('config');
  assert.ok(config.querySelector('#idioma'), 'deberia estar montada de antemano');
  assert.ok(config.querySelector('#campo'), 'deberia estar montada de antemano');
});

// --- BARRA DE PROGRESO ---
test('la barra de progreso esta oculta mientras no se revisa', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());

  assert.equal(visible(window.document.getElementById('progreso')), false);
});

test('el progreso traduce la fraccion de lotes a un porcentaje', async () => {
  const chrome = chromeFalso();
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  chrome.__emitir({ accion: 'progreso', hechos: 2, total: 5 });
  await esperar();

  const barra = window.document.getElementById('progresoBarra');
  const caja = window.document.getElementById('progreso');
  assert.equal(barra.style.width, '40%');
  assert.equal(caja.getAttribute('aria-valuenow'), '40');
  assert.equal(visible(caja), true);
});

test('el progreso se anuncia tambien como texto para lectores de pantalla', async () => {
  const chrome = chromeFalso();
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  chrome.__emitir({ accion: 'progreso', hechos: 3, total: 4 });
  await esperar();

  assert.match(window.document.getElementById('progreso').getAttribute('aria-valuetext'), /3.*4/);
});

test('antes del primer lote el progreso es indeterminado', async () => {
  // Entre que arranca la revision y termina el primer lote no se sabe cuantos
  // hay: una barra parada en cero pareceria que no avanza.
  const chrome = chromeFalso();
  // La revision se deja en curso: si resolviera, el finally ocultaria la barra
  // antes de poder observar el estado intermedio.
  chrome.tabs.sendMessage = (id, m) =>
    m.accion === 'iniciarRevision' ? new Promise(() => {}) : Promise.resolve(undefined);
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  window.document.getElementById('revisar').click();
  await esperar();

  const caja = window.document.getElementById('progreso');
  assert.equal(caja.classList.contains('indeterminado'), true);
  assert.equal(caja.hasAttribute('aria-valuenow'), false);
});

test('al terminar la revision la barra desaparece', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());

  window.document.getElementById('revisar').click();
  await esperar(60);

  assert.equal(visible(window.document.getElementById('progreso')), false);
});

// --- ESTADOS DEL PANEL ---
const estado = (window) => ({
  tipo: [...window.document.querySelector('#status .estado').classList]
    .find((c) => c.startsWith('estado-') && c !== 'estado-titulo'),
  titulo: window.document.querySelector('.estado-titulo')?.textContent,
  detalle: window.document.querySelector('.estado-detalle')?.textContent,
});

test('al abrir sin revision previa invita a revisar', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso());

  const e = estado(window);
  assert.equal(e.tipo, 'estado-inicial');
  assert.match(e.titulo, /listo para revisar/i);
  assert.match(e.detalle, /Revisar Página/);
});

test('una revision sin hallazgos se celebra, no se confunde con no haber revisado', async () => {
  const chrome = chromeFalso();
  chrome.tabs.sendMessage = async (id, m) =>
    m.accion === 'iniciarRevision'
      ? { errores: [], estado: { lotesFallidos: 0, lotesTotales: 3 } }
      : undefined;
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  window.document.getElementById('revisar').click();
  await esperar(60);

  const e = estado(window);
  assert.equal(e.tipo, 'estado-exito');
  assert.match(e.titulo, /sin errores/i);
});

test('una revision parcial se marca como incompleta', async () => {
  const chrome = chromeFalso();
  chrome.tabs.sendMessage = async (id, m) =>
    m.accion === 'iniciarRevision'
      ? { errores: [], estado: { lotesFallidos: 2, lotesTotales: 5 } }
      : undefined;
  const { window } = await ejecutar(HTML, SCRIPT, chrome);

  window.document.getElementById('revisar').click();
  await esperar(60);

  const e = estado(window);
  assert.equal(e.tipo, 'estado-aviso');
  assert.match(e.detalle, /2 de 5/);
});

test('una pagina interna muestra el estado bloqueado con su motivo', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([], {}, 'chrome://extensions'));

  const e = estado(window);
  assert.equal(e.tipo, 'estado-bloqueado');
  assert.match(e.detalle, /no permite revisarla/i);
});

// --- ALTURA ESTABLE ---
test('el panel se marca como vacio para poder centrar el estado', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([]));

  assert.equal(window.document.getElementById('vistaPrincipal').dataset.vacio, 'si');
});

test('con errores el panel deja de estar vacio y manda la lista', async () => {
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([error('lt-error-0', 'Olaa')]));

  assert.equal(window.document.getElementById('vistaPrincipal').dataset.vacio, 'no');
});

test('el estado se oculta con hidden, no con estilos en linea', async () => {
  // Un display en linea pisaria el centrado que hace el CSS cuando esta vacio.
  const { window } = await ejecutar(HTML, SCRIPT, chromeFalso([error('lt-error-0', 'Olaa')]));

  const status = window.document.getElementById('status');
  assert.equal(status.style.display, '', 'no deberia llevar display en linea');
  assert.equal(visible(status), false);
});
