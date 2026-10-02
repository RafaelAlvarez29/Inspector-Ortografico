import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarPalabras, quitarPalabra } from '../lib/diccionario.js';

test('agrega una palabra normalizada a minusculas', () => {
  const r = agregarPalabras([], 'Olaa');

  assert.deepEqual(r.lista, ['olaa']);
  assert.deepEqual(r.agregadas, ['olaa']);
  assert.deepEqual(r.duplicadas, []);
});

test('no agrega una palabra que ya existe, aunque cambie la caja', () => {
  const r = agregarPalabras(['olaa'], 'OLAA');

  assert.deepEqual(r.lista, ['olaa']);
  assert.deepEqual(r.agregadas, []);
  assert.deepEqual(r.duplicadas, ['olaa']);
});

test('separa varias palabras pegadas de una vez', () => {
  const r = agregarPalabras([], 'uno dos,tres\ncuatro;cinco');

  assert.deepEqual(r.lista, ['uno', 'dos', 'tres', 'cuatro', 'cinco']);
});

test('descarta espacios sobrantes y entradas vacias', () => {
  const r = agregarPalabras([], '   hola   ,,  ,  \n  ');

  assert.deepEqual(r.lista, ['hola']);
});

test('no duplica dentro de la misma entrada', () => {
  const r = agregarPalabras([], 'dos dos DOS');

  assert.deepEqual(r.lista, ['dos']);
  assert.deepEqual(r.duplicadas, ['dos', 'dos']);
});

test('conserva las palabras con tilde y con enie', () => {
  const r = agregarPalabras([], 'Ñoño Acentuación');

  assert.deepEqual(r.lista, ['ñoño', 'acentuación']);
});

test('una entrada vacia no cambia la lista', () => {
  const r = agregarPalabras(['uno'], '   ');

  assert.deepEqual(r.lista, ['uno']);
  assert.deepEqual(r.agregadas, []);
});

test('quita una palabra sin tocar las demas', () => {
  assert.deepEqual(quitarPalabra(['uno', 'dos', 'tres'], 'dos'), ['uno', 'tres']);
});

test('quitar una palabra inexistente deja la lista igual', () => {
  assert.deepEqual(quitarPalabra(['uno'], 'nueve'), ['uno']);
});
