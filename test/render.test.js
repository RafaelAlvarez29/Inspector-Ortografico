import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderizarErrores } from '../lib/render.js';

function contenedor() {
  const dom = new JSDOM('<div id="lista"></div>');
  return { doc: dom.window.document, lista: dom.window.document.getElementById('lista') };
}

const error = (extra) => ({
  clave: 'olaa|typo',
  ids: ['lt-error-0'],
  total: 1,
  palabra: 'Olaa',
  mensaje: 'Error ortografico',
  sugerencias: ['Hola'],
  categoria: 'typo',
  ...extra,
});

test('no construye etiquetas HTML a partir del texto de la pagina', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ palabra: '<img src=x onerror=alert(1)>' })], doc);

  assert.equal(lista.querySelectorAll('img').length, 0);
  assert.equal(lista.querySelector('.palabra').textContent, '<img src=x onerror=alert(1)>');
});

test('no permite escapar del atributo title del boton ignorar', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ palabra: '" onmouseover="alert(1)' })], doc);

  const boton = lista.querySelector('.ignorar-btn');
  assert.equal(boton.getAttribute('onmouseover'), null);
  assert.match(boton.title, /onmouseover/); // quedo como texto literal, inofensivo
});

test('no construye etiquetas HTML a partir del mensaje de la API', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ mensaje: '<script>alert(1)</script>' })], doc);

  assert.equal(lista.querySelectorAll('script').length, 0);
});

test('renderiza el contenido normal de un error', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error()], doc);

  const item = lista.querySelector('.error-item');
  assert.equal(item.dataset.clave, 'olaa|typo');
  assert.equal(item.dataset.palabra, 'Olaa');
  assert.ok(item.className.includes('categoria-typo'));
  assert.equal(lista.querySelector('.mensaje').textContent, 'Error ortografico');
  assert.equal(lista.querySelector('.sugerencias').textContent, 'Sugerencias: Hola');
});

test('muestra Ninguna cuando el error no trae sugerencias', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ sugerencias: undefined })], doc);

  assert.equal(lista.querySelector('.sugerencias').textContent, 'Sugerencias: Ninguna');
});

test('muestra un contador cuando la palabra se repite', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ ids: ['a', 'b', 'c'], total: 3 })], doc);

  assert.equal(lista.querySelector('.repeticiones').textContent, '3');
  assert.equal(lista.querySelector('.error-item').dataset.total, '3');
});

test('no muestra contador cuando la palabra aparece una sola vez', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error()], doc);

  assert.equal(lista.querySelector('.repeticiones'), null);
});

test('el contador tampoco se construye como HTML', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ palabra: '<b>x</b>', ids: ['a', 'b'], total: 2 })], doc);

  assert.equal(lista.querySelectorAll('b').length, 0);
});

test('cada fila es un boton, accesible con teclado', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error()], doc);

  assert.equal(lista.querySelector('.error-item').tagName, 'BUTTON');
});

test('incluye un boton para copiar la correccion', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ palabra: 'parrafo', sugerencias: ['párrafo', 'parrafos'] })], doc);

  const copiar = lista.querySelector('.copiar-btn');
  assert.equal(copiar.dataset.copia, 'parrafo → párrafo');
});

test('no ofrece copiar cuando no hay ninguna sugerencia', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ sugerencias: [] })], doc);

  assert.equal(lista.querySelector('.copiar-btn'), null);
});

test('el texto a copiar guarda la palabra tal cual, sin interpretarla', () => {
  const { doc, lista } = contenedor();

  renderizarErrores(lista, [error({ palabra: '<b>x</b>', sugerencias: ['y'] })], doc);

  assert.equal(lista.querySelector('.copiar-btn').dataset.copia, '<b>x</b> → y');
  assert.equal(lista.querySelectorAll('b').length, 0);
});
