import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderizarChips } from '../lib/render.js';

function contenedor() {
  const dom = new JSDOM('<div id="c"></div>');
  return { doc: dom.window.document, cont: dom.window.document.getElementById('c') };
}

test('pinta un chip por palabra', () => {
  const { doc, cont } = contenedor();

  renderizarChips(cont, ['uno', 'dos'], doc);

  assert.deepEqual([...cont.querySelectorAll('.chip')].map((c) => c.dataset.palabra), ['uno', 'dos']);
});

test('cada chip lleva un boton para quitarlo', () => {
  const { doc, cont } = contenedor();

  renderizarChips(cont, ['uno'], doc);

  const quitar = cont.querySelector('.chip .chip-quitar');
  assert.equal(quitar.closest('.chip').dataset.palabra, 'uno');
  assert.match(quitar.getAttribute('aria-label'), /uno/);
});

test('una palabra del diccionario no se interpreta como HTML', () => {
  // Las palabras llegan al diccionario desde el texto de paginas web.
  const { doc, cont } = contenedor();

  renderizarChips(cont, ['<img src=x onerror=alert(1)>'], doc);

  assert.equal(cont.querySelectorAll('img').length, 0);
  assert.equal(cont.querySelector('.chip-texto').textContent, '<img src=x onerror=alert(1)>');
});

test('sin palabras no pinta ningun chip', () => {
  const { doc, cont } = contenedor();

  renderizarChips(cont, [], doc);

  assert.equal(cont.querySelectorAll('.chip').length, 0);
});

test('vuelve a pintar desde cero y no acumula', () => {
  const { doc, cont } = contenedor();

  renderizarChips(cont, ['uno', 'dos'], doc);
  renderizarChips(cont, ['tres'], doc);

  assert.equal(cont.querySelectorAll('.chip').length, 1);
});
