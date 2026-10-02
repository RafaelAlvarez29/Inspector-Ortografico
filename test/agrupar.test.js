import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparErrores, contarPorCategoria } from '../lib/agrupar.js';

const err = (id, palabra, categoria = 'typo', extra = {}) => ({
  id, palabra, categoria,
  mensaje: 'Posible error', sugerencias: ['ok'], ...extra,
});

test('agrupa las ocurrencias de la misma palabra en una sola entrada', () => {
  const grupos = agruparErrores([err('a', 'erorr'), err('b', 'erorr'), err('c', 'obbio')]);

  assert.equal(grupos.length, 2);
  assert.equal(grupos[0].palabra, 'erorr');
  assert.deepEqual(grupos[0].ids, ['a', 'b']);
  assert.equal(grupos[0].total, 2);
  assert.equal(grupos[1].total, 1);
});

test('agrupa sin distinguir mayusculas pero conserva como se escribio primero', () => {
  const grupos = agruparErrores([err('a', 'Erorr'), err('b', 'erorr')]);

  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].palabra, 'Erorr');
  assert.equal(grupos[0].total, 2);
});

test('no mezcla la misma palabra si pertenece a categorias distintas', () => {
  const grupos = agruparErrores([err('a', 'esta', 'typo'), err('b', 'esta', 'gramatica')]);

  assert.equal(grupos.length, 2);
});

test('conserva el orden de aparicion en la pagina', () => {
  const grupos = agruparErrores([err('a', 'zeta'), err('b', 'alfa'), err('c', 'zeta')]);

  assert.deepEqual(grupos.map((g) => g.palabra), ['zeta', 'alfa']);
});

test('sin errores devuelve una lista vacia', () => {
  assert.deepEqual(agruparErrores([]), []);
});

test('cuenta cuantos errores hay de cada categoria', () => {
  const conteo = contarPorCategoria([
    err('a', 'uno', 'typo'), err('b', 'dos', 'typo'), err('c', 'tres', 'gramatica'),
  ]);

  assert.equal(conteo.total, 3);
  assert.equal(conteo.typo, 2);
  assert.equal(conteo.gramatica, 1);
  assert.equal(conteo.estilo, 0);
  assert.equal(conteo.otro, 0);
});

test('el conteo cuenta ocurrencias, no palabras distintas', () => {
  const conteo = contarPorCategoria([err('a', 'erorr'), err('b', 'erorr')]);

  assert.equal(conteo.typo, 2);
});
