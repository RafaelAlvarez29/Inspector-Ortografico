import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construirLotes } from '../lib/batching.js';
import { revisarLotes } from '../lib/revision.js';

test('devuelve los matches ya mapeados al texto de origen', async () => {
  const lotes = construirLotes(['Olaa mundo', 'esto es un erorr']);
  const verificar = async () => [{ offset: 23, length: 5 }];

  const { hallazgos } = await revisarLotes(lotes, { verificar });

  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].indiceOrigen, 1);
  assert.equal(hallazgos[0].offset, 11);
});

test('un lote que falla no cancela los demas y queda contabilizado', async () => {
  const lotes = construirLotes(['aaaa', 'bbbb', 'cccc'], { maxCaracteres: 4 });
  const verificar = async (texto) => {
    if (texto === 'bbbb') throw new Error('429');
    return [{ offset: 0, length: 4 }];
  };

  const { hallazgos, lotesFallidos, lotesTotales } = await revisarLotes(lotes, { verificar });

  assert.equal(lotesTotales, 3);
  assert.equal(lotesFallidos, 1);
  assert.deepEqual(hallazgos.map((h) => h.indiceOrigen), [0, 2]);
});

test('nunca mantiene mas peticiones en vuelo que la concurrencia pedida', async () => {
  const lotes = construirLotes(['a', 'b', 'c', 'd', 'e'], { maxCaracteres: 1 });
  let enVuelo = 0;
  let pico = 0;
  const verificar = async () => {
    pico = Math.max(pico, ++enVuelo);
    await new Promise((r) => setTimeout(r, 5));
    enVuelo--;
    return [];
  };

  await revisarLotes(lotes, { verificar, concurrencia: 2 });

  assert.equal(pico, 2);
});

test('informa del avance a medida que terminan los lotes', async () => {
  const lotes = construirLotes(['a', 'b', 'c'], { maxCaracteres: 1 });
  const avisos = [];
  const verificar = async () => [];

  await revisarLotes(lotes, {
    verificar,
    concurrencia: 1,
    onProgreso: (hechos, total) => avisos.push(`${hechos}/${total}`),
  });

  assert.deepEqual(avisos, ['1/3', '2/3', '3/3']);
});

test('un lote que falla tambien cuenta como avance', async () => {
  const lotes = construirLotes(['a', 'b'], { maxCaracteres: 1 });
  const avisos = [];
  const verificar = async (t) => { if (t === 'a') throw new Error('429'); return []; };

  await revisarLotes(lotes, { verificar, concurrencia: 1, onProgreso: (h, t) => avisos.push(`${h}/${t}`) });

  assert.deepEqual(avisos, ['1/2', '2/2']);
});
