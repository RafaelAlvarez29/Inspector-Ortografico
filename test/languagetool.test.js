import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verificarTexto } from '../lib/languagetool.js';

const respuestaOk = (matches) => ({
  ok: true,
  status: 200,
  json: async () => ({ matches }),
});

test('devuelve los matches que entrega la API', async () => {
  const fetchFn = async () => respuestaOk([{ offset: 0, length: 4 }]);

  const matches = await verificarTexto('Olaa', { fetchFn });

  assert.deepEqual(matches, [{ offset: 0, length: 4 }]);
});

test('lanza error cuando la API responde con fallo en vez de devolver vacio', async () => {
  const fetchFn = async () => ({ ok: false, status: 500, headers: new Map() });

  await assert.rejects(
    () => verificarTexto('Olaa', { fetchFn, reintentos: 0 }),
    /500/
  );
});

test('lanza error cuando la red falla en vez de devolver vacio', async () => {
  const fetchFn = async () => { throw new TypeError('Failed to fetch'); };

  await assert.rejects(() => verificarTexto('Olaa', { fetchFn, reintentos: 0 }));
});

test('reintenta tras un 429 y respeta el header Retry-After', async () => {
  const esperas = [];
  let llamadas = 0;
  const fetchFn = async () => {
    llamadas++;
    if (llamadas === 1) {
      return { ok: false, status: 429, headers: new Map([['Retry-After', '2']]) };
    }
    return respuestaOk([{ offset: 0, length: 4 }]);
  };

  const matches = await verificarTexto('Olaa', {
    fetchFn,
    esperar: async (ms) => { esperas.push(ms); },
  });

  assert.equal(llamadas, 2);
  assert.deepEqual(esperas, [2000]);
  assert.equal(matches.length, 1);
});

test('se rinde tras agotar los reintentos y lanza', async () => {
  let llamadas = 0;
  const fetchFn = async () => {
    llamadas++;
    return { ok: false, status: 429, headers: new Map() };
  };

  await assert.rejects(
    () => verificarTexto('Olaa', { fetchFn, reintentos: 2, esperar: async () => {} }),
    /429/
  );
  assert.equal(llamadas, 3); // intento inicial + 2 reintentos
});

test('envia el idioma configurado a la API', async () => {
  let cuerpo;
  const fetchFn = async (url, opciones) => { cuerpo = opciones.body; return respuestaOk([]); };

  await verificarTexto('Hello world', { fetchFn, idioma: 'en-US' });

  assert.match(cuerpo, /language=en-US/);
});

test('usa deteccion automatica cuando se pide auto', async () => {
  let cuerpo;
  const fetchFn = async (url, opciones) => { cuerpo = opciones.body; return respuestaOk([]); };

  await verificarTexto('Hello', { fetchFn, idioma: 'auto' });

  assert.match(cuerpo, /language=auto/);
});

test('por defecto sigue revisando en espanol', async () => {
  let cuerpo;
  const fetchFn = async (url, opciones) => { cuerpo = opciones.body; return respuestaOk([]); };

  await verificarTexto('Olaa', { fetchFn });

  assert.match(cuerpo, /language=es/);
});
