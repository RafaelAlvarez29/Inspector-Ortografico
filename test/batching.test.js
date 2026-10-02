import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirLotes } from '../lib/batching.js';

test('une varios textos en un solo lote separados por doble salto de linea', () => {
  const lotes = construirLotes(['Olaa mundo', 'esto es un erorr']);

  assert.equal(lotes.length, 1);
  assert.equal(lotes[0].texto, 'Olaa mundo\n\nesto es un erorr');
});

test('cada lote lleva un indice con la posicion global de cada texto', () => {
  const [lote] = construirLotes(['Olaa mundo', 'esto es un erorr', 'ok']);

  assert.deepEqual(lote.indice, [
    { indiceOrigen: 0, inicio: 0,  longitud: 10 },
    { indiceOrigen: 1, inicio: 12, longitud: 16 },
    { indiceOrigen: 2, inicio: 30, longitud: 2 },
  ]);
});

test('corta en varios lotes al superar el maximo de caracteres', () => {
  const lotes = construirLotes(['aaaa', 'bbbb', 'cccc'], { maxCaracteres: 10 });

  assert.equal(lotes.length, 2);
  assert.equal(lotes[0].texto, 'aaaa\n\nbbbb');
  assert.equal(lotes[1].texto, 'cccc');
});

test('cada lote reinicia sus offsets en cero pero conserva el indice de origen', () => {
  const lotes = construirLotes(['aaaa', 'bbbb', 'cccc'], { maxCaracteres: 10 });

  assert.deepEqual(lotes[1].indice, [{ indiceOrigen: 2, inicio: 0, longitud: 4 }]);
});

test('sin textos no devuelve ningun lote', () => {
  assert.deepEqual(construirLotes([]), []);
});

test('un texto mas largo que el maximo queda solo en su propio lote', () => {
  const largo = 'x'.repeat(20);
  const lotes = construirLotes(['aa', largo, 'bb'], { maxCaracteres: 10 });

  assert.deepEqual(lotes.map((l) => l.texto), ['aa', largo, 'bb']);
});

test('los offsets del indice apuntan al texto correcto dentro del lote', () => {
  const textos = ['uno', 'dos', 'tres'];
  const [lote] = construirLotes(textos);

  for (const e of lote.indice) {
    assert.equal(lote.texto.substr(e.inicio, e.longitud), textos[e.indiceOrigen]);
  }
});
