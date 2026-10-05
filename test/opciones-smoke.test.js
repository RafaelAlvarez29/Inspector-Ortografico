import { IDIOMAS } from '../lib/idiomas.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montar, ejecutar, idsQuePide } from './ayuda-montaje.js';

const HTML = new URL('../options.html', import.meta.url);
const SCRIPT = new URL('../options.js', import.meta.url);

function chromeFalso(almacenado = {}) {
  const guardado = { ...almacenado };
  return {
    guardado,
    api: {
      storage: {
        sync: {
          get: async () => ({ ...guardado }),
          set: async (v) => Object.assign(guardado, v),
        },
      },
      runtime: { onMessage: { addListener: () => {} } },
    },
  };
}

test('options.js se ejecuta sobre options.html sin lanzar', async () => {
  const { api } = chromeFalso({ diccionarioPersonal: ['olaa', 'erorr'] });
  const { errores } = await ejecutar(HTML, SCRIPT, api);

  assert.deepEqual(
    errores.map((e) => (e && e.message) || String(e)),
    [],
    'options.js lanzo al inicializarse'
  );
});

test('options.html contiene todos los elementos que options.js busca', () => {
  const { window } = montar(HTML);

  const faltan = idsQuePide(SCRIPT).filter((id) => !window.document.getElementById(id));
  assert.deepEqual(faltan, [], 'ids ausentes en options.html');
});

test('pinta un chip por cada palabra guardada', async () => {
  const { api } = chromeFalso({ diccionarioPersonal: ['olaa', 'erorr', 'obbio'] });
  const { window } = await ejecutar(HTML, SCRIPT, api);

  const chips = [...window.document.querySelectorAll('.chip')].map((c) => c.dataset.palabra);
  assert.deepEqual(chips, ['olaa', 'erorr', 'obbio']);
});

test('el selector de idioma vive en la pagina de opciones', async () => {
  const { api } = chromeFalso({ idioma: 'en-US' });
  const { window } = await ejecutar(HTML, SCRIPT, api);

  const select = window.document.getElementById('idioma');
  assert.ok(select, 'no hay selector de idioma en options.html');
  assert.equal(select.value, 'en-US', 'no carga el idioma guardado');
});

test('guardar conserva el idioma elegido junto al diccionario', async () => {
  const falso = chromeFalso({ idioma: 'es', diccionarioPersonal: ['olaa'] });
  const { window } = await ejecutar(HTML, SCRIPT, falso.api);

  const select = window.document.getElementById('idioma');
  select.value = 'fr';
  select.dispatchEvent(new window.Event('change'));

  window.document.getElementById('guardar').click();
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(falso.guardado.idioma, 'fr');
  assert.deepEqual(falso.guardado.diccionarioPersonal, ['olaa']);
});

test('el selector se construye desde el catalogo de idiomas', async () => {
  const { api } = chromeFalso();
  const { window } = await ejecutar(HTML, SCRIPT, api);

  const opciones = [...window.document.querySelectorAll('#idioma option')];
  assert.deepEqual(
    opciones.map((o) => o.value),
    IDIOMAS.map((i) => i.codigo),
    'el selector y el catalogo no coinciden'
  );
  assert.deepEqual(opciones.map((o) => o.textContent), IDIOMAS.map((i) => i.nombre));
});

test('la configuracion ofrece elegir la apariencia', async () => {
  const { api } = chromeFalso({ tema: 'oscuro' });
  const { window } = await ejecutar(HTML, SCRIPT, api);

  const select = window.document.getElementById('tema');
  assert.ok(select, 'no hay selector de tema');
  assert.equal(select.value, 'oscuro', 'no carga el tema guardado');
});

test('el tema guardado se aplica a la raiz del documento al abrir', async () => {
  const { api } = chromeFalso({ tema: 'oscuro' });
  const { window } = await ejecutar(HTML, SCRIPT, api);

  assert.equal(window.document.documentElement.dataset.tema, 'oscuro');
});

test('en automatico no se marca la raiz: manda el sistema', async () => {
  const { api } = chromeFalso({ tema: 'auto' });
  const { window } = await ejecutar(HTML, SCRIPT, api);

  assert.equal(window.document.documentElement.hasAttribute('data-tema'), false);
});

test('cambiar el tema se ve al instante, sin esperar a guardar', async () => {
  const { api } = chromeFalso({ tema: 'auto' });
  const { window } = await ejecutar(HTML, SCRIPT, api);

  const select = window.document.getElementById('tema');
  select.value = 'oscuro';
  select.dispatchEvent(new window.Event('change'));

  assert.equal(window.document.documentElement.dataset.tema, 'oscuro');
});

test('guardar conserva el tema junto al idioma y el diccionario', async () => {
  const falso = chromeFalso({ tema: 'auto', idioma: 'es', diccionarioPersonal: ['olaa'] });
  const { window } = await ejecutar(HTML, SCRIPT, falso.api);

  const select = window.document.getElementById('tema');
  select.value = 'claro';
  select.dispatchEvent(new window.Event('change'));
  window.document.getElementById('guardar').click();
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(falso.guardado.tema, 'claro');
  assert.equal(falso.guardado.idioma, 'es');
  assert.deepEqual(falso.guardado.diccionarioPersonal, ['olaa']);
});
