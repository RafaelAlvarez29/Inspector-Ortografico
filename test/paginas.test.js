import { test } from 'node:test';
import assert from 'node:assert/strict';
import { motivoNoRevisable, mensajeDeFallo } from '../lib/paginas.js';

test('las paginas internas de Chrome no son revisables', () => {
  for (const url of [
    'chrome://extensions',
    'chrome://newtab/',
    'chrome-extension://abcdef/popup.html',
    'devtools://devtools/bundled/inspector.html',
    'about:blank',
    'edge://settings',
  ]) {
    assert.match(motivoNoRevisable(url) || '', /interna/i, `deberia bloquear ${url}`);
  }
});

test('la tienda de extensiones tampoco es revisable', () => {
  assert.match(
    motivoNoRevisable('https://chromewebstore.google.com/detail/algo') || '',
    /tienda/i
  );
  assert.match(
    motivoNoRevisable('https://chrome.google.com/webstore/category/extensions') || '',
    /tienda/i
  );
});

test('el codigo fuente de una pagina no es revisable', () => {
  assert.ok(motivoNoRevisable('view-source:https://ejemplo.com'));
});

test('una pagina web normal si es revisable', () => {
  assert.equal(motivoNoRevisable('https://ejemplo.com/articulo'), null);
  assert.equal(motivoNoRevisable('http://localhost:3000/'), null);
});

test('sin url conocida se permite intentarlo', () => {
  // tabs.query puede no devolver la url; bloquear por si acaso impediria
  // revisar paginas perfectamente validas.
  assert.equal(motivoNoRevisable(undefined), null);
  assert.equal(motivoNoRevisable(''), null);
});

test('traduce el fallo de acceso de Chrome a una explicacion util', () => {
  const m = mensajeDeFallo(new Error('Cannot access a chrome:// URL'));

  assert.match(m, /no se puede revisar/i);
  assert.doesNotMatch(m, /chrome:\/\/ URL/, 'no deberia soltar el texto crudo de Chrome');
});

test('traduce tambien el fallo de contenido inaccesible', () => {
  const m = mensajeDeFallo(new Error('Cannot access contents of the page.'));

  assert.match(m, /no se puede revisar/i);
});

test('un fallo inesperado conserva su detalle para poder diagnosticarlo', () => {
  const m = mensajeDeFallo(new Error('algo raro paso'));

  assert.match(m, /algo raro paso/);
});

test('distingue los fallos esperados de los que merecen registrarse', () => {
  assert.equal(mensajeDeFallo.esEsperado(new Error('Cannot access a chrome:// URL')), true);
  assert.equal(mensajeDeFallo.esEsperado(new Error('algo raro paso')), false);
});
