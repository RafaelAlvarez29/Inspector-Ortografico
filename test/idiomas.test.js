import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDIOMAS, nombreDeIdioma } from '../lib/idiomas.js';

test('traduce un codigo de idioma a su nombre legible', () => {
  assert.equal(nombreDeIdioma('es'), 'Español');
  assert.equal(nombreDeIdioma('en-US'), 'Inglés (EE. UU.)');
});

test('la deteccion automatica tiene nombre propio', () => {
  assert.equal(nombreDeIdioma('auto'), 'Detección automática');
});

test('un codigo desconocido se muestra tal cual en vez de romper', () => {
  assert.equal(nombreDeIdioma('xx-YY'), 'xx-YY');
});

test('sin codigo asume espanol, que es el valor por defecto', () => {
  assert.equal(nombreDeIdioma(undefined), 'Español');
});

test('la lista no tiene codigos repetidos', () => {
  const codigos = IDIOMAS.map((i) => i.codigo);
  assert.equal(new Set(codigos).size, codigos.length);
});

test('espanol encabeza la lista por ser el valor por defecto', () => {
  assert.equal(IDIOMAS[0].codigo, 'es');
});
