import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { TEMAS, TEMA_POR_DEFECTO, aplicarTema, nombreDeTema } from '../lib/tema.js';

const raiz = () => new JSDOM('<html><body></body></html>').window.document.documentElement;

test('ofrece automatico, claro y oscuro, y automatico es el valor por defecto', () => {
  assert.deepEqual(TEMAS.map((t) => t.codigo), ['auto', 'claro', 'oscuro']);
  assert.equal(TEMA_POR_DEFECTO, 'auto');
});

test('forzar un tema lo marca en la raiz del documento', () => {
  const r = raiz();

  aplicarTema('oscuro', r);
  assert.equal(r.dataset.tema, 'oscuro');

  aplicarTema('claro', r);
  assert.equal(r.dataset.tema, 'claro');
});

test('en automatico no se marca nada: manda la preferencia del sistema', () => {
  const r = raiz();
  aplicarTema('oscuro', r);

  aplicarTema('auto', r);

  assert.equal(r.hasAttribute('data-tema'), false);
});

test('sin valor guardado se comporta como automatico', () => {
  const r = raiz();
  aplicarTema('oscuro', r);

  aplicarTema(undefined, r);

  assert.equal(r.hasAttribute('data-tema'), false);
});

test('un valor desconocido no deja la interfaz en un estado raro', () => {
  const r = raiz();

  aplicarTema('arcoiris', r);

  assert.equal(r.hasAttribute('data-tema'), false);
});

test('traduce el codigo a un nombre legible', () => {
  assert.equal(nombreDeTema('oscuro'), 'Oscuro');
  assert.equal(nombreDeTema('auto'), 'Automático (según el sistema)');
});
