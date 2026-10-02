import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarHallazgosVigentes } from '../lib/batching.js';

const hallazgo = (indiceOrigen, offset, longitud) => ({ indiceOrigen, offset, longitud });

test('conserva los hallazgos de nodos cuyo texto no cambio', () => {
  const originales = ['Olaa mundo', 'otro texto'];
  const actuales = ['Olaa mundo', 'otro texto'];

  const vigentes = filtrarHallazgosVigentes([hallazgo(0, 0, 4)], actuales, originales);

  assert.equal(vigentes.length, 1);
});

test('descarta los hallazgos de un nodo cuyo texto cambio durante la espera', () => {
  const originales = ['Olaa mundo'];
  const actuales = ['Hola amigos']; // la SPA re-renderizo: el rango 0-4 aun cabe

  const vigentes = filtrarHallazgosVigentes([hallazgo(0, 0, 4)], actuales, originales);

  assert.deepEqual(vigentes, []);
});

test('un nodo que cambio no arrastra a los hallazgos de los demas nodos', () => {
  const originales = ['Olaa mundo', 'un erorr aqui'];
  const actuales = ['Hola amigos', 'un erorr aqui'];

  const vigentes = filtrarHallazgosVigentes(
    [hallazgo(0, 0, 4), hallazgo(1, 3, 5)], actuales, originales);

  assert.deepEqual(vigentes.map((h) => h.indiceOrigen), [1]);
});

test('descarta los hallazgos de un nodo que desaparecio del DOM', () => {
  const vigentes = filtrarHallazgosVigentes([hallazgo(0, 0, 4)], [null], ['Olaa mundo']);

  assert.deepEqual(vigentes, []);
});
