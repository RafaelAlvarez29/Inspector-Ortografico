import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/**
 * Prueba de humo del popup: carga el popup.html REAL en un DOM y ejecuta
 * popup.js contra un chrome.* falso.
 *
 * Los tests unitarios no detectan que falte un id en el HTML, que se llame a
 * una funcion inexistente o que el archivo este vacio: todo eso solo aparece
 * al ejecutar la pagina. Esta prueba cubre ese hueco.
 */
function montarPopup() {
  const html = readFileSync(new URL('../popup.html', import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://localhost/' });
  const { window } = dom;

  const errores = [];
  window.addEventListener('error', (e) => errores.push(e.error || e.message));

  const sinRespuesta = async () => undefined;
  const chrome = {
    runtime: {
      sendMessage: async () => ({ datos: [] }),
      onMessage: { addListener: () => {} },
      openOptionsPage: () => {},
      lastError: null,
    },
    tabs: {
      query: async () => [{ id: 1, url: 'https://ejemplo.test/' }],
      sendMessage: sinRespuesta,
    },
    storage: { sync: { get: async () => ({}), set: async () => {} } },
    scripting: { insertCSS: sinRespuesta, executeScript: sinRespuesta },
  };

  return { dom, window, chrome, errores };
}

test('popup.js se ejecuta sobre popup.html sin lanzar', async () => {
  const { window, chrome, errores } = montarPopup();

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.chrome = chrome;
  // En Node 22 globalThis.navigator solo tiene getter: hay que redefinirlo.
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
  });

  await import('../popup.js');

  // Los listeners se registran al dispararse DOMContentLoaded.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 20));

  assert.deepEqual(
    errores.map((e) => (e && e.message) || String(e)),
    [],
    'popup.js lanzo al inicializarse'
  );
});

test('popup.html contiene todos los elementos que popup.js busca', () => {
  const { window } = montarPopup();
  const fuente = readFileSync(new URL('../popup.js', import.meta.url), 'utf8');

  const pedidos = [...fuente.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
  assert.ok(pedidos.length > 0, 'no se encontro ningun getElementById');

  const faltan = pedidos.filter((id) => !window.document.getElementById(id));
  assert.deepEqual(faltan, [], 'ids ausentes en popup.html');
});
