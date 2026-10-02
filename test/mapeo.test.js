import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirLotes, mapearMatches } from '../lib/batching.js';

// "Olaa mundo\n\nesto es un erorr\n\nok"
//  0          10            23
const [LOTE] = construirLotes(['Olaa mundo', 'esto es un erorr', 'ok']);

test('mapea un match del primer texto conservando su offset', () => {
  const resultado = mapearMatches([{ offset: 0, length: 4 }], LOTE.indice);

  assert.deepEqual(resultado, [{ indiceOrigen: 0, offset: 0, longitud: 4, match: { offset: 0, length: 4 } }]);
});

test('resta el inicio del texto al mapear un match de un texto posterior', () => {
  const [resultado] = mapearMatches([{ offset: 23, length: 5 }], LOTE.indice);

  assert.equal(resultado.indiceOrigen, 1);
  assert.equal(resultado.offset, 11); // 23 - 12
  assert.equal(LOTE.texto.substr(23, 5), 'erorr');
});

test('descarta un match que cruza el separador entre dos textos', () => {
  const resultado = mapearMatches([{ offset: 8, length: 10 }], LOTE.indice);

  assert.deepEqual(resultado, []);
});

test('descarta un match que cae dentro del separador', () => {
  const resultado = mapearMatches([{ offset: 10, length: 2 }], LOTE.indice);

  assert.deepEqual(resultado, []);
});
