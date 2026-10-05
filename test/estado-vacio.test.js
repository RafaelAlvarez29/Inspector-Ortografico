import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderizarEstado, ESTADOS } from '../lib/render.js';

function contenedor() {
  const dom = new JSDOM('<div id="e"></div>');
  return { doc: dom.window.document, cont: dom.window.document.getElementById('e') };
}

test('pinta icono, titulo y detalle', () => {
  const { doc, cont } = contenedor();

  renderizarEstado(cont, { tipo: 'inicial', titulo: 'Listo para revisar', detalle: 'Pulsa el botón.' }, doc);

  assert.ok(cont.querySelector('svg'), 'falta el icono');
  assert.equal(cont.querySelector('.estado-titulo').textContent, 'Listo para revisar');
  assert.equal(cont.querySelector('.estado-detalle').textContent, 'Pulsa el botón.');
});

test('cada tipo lleva su propia clase, para darle su color', () => {
  const { doc, cont } = contenedor();

  renderizarEstado(cont, { tipo: 'exito', titulo: 'Sin errores' }, doc);

  assert.ok(cont.querySelector('.estado').classList.contains('estado-exito'));
});

test('sin detalle no se pinta una linea vacia', () => {
  const { doc, cont } = contenedor();

  renderizarEstado(cont, { tipo: 'exito', titulo: 'Sin errores' }, doc);

  assert.equal(cont.querySelector('.estado-detalle'), null);
});

test('el detalle no se interpreta como HTML', () => {
  // El detalle puede venir de un mensaje de error del navegador.
  const { doc, cont } = contenedor();

  renderizarEstado(cont, { tipo: 'aviso', titulo: 'x', detalle: '<img src=x onerror=alert(1)>' }, doc);

  assert.equal(cont.querySelectorAll('img').length, 0);
  assert.equal(cont.querySelector('.estado-detalle').textContent, '<img src=x onerror=alert(1)>');
});

test('un tipo desconocido no deja el panel sin icono', () => {
  const { doc, cont } = contenedor();

  renderizarEstado(cont, { tipo: 'inexistente', titulo: 'Algo' }, doc);

  assert.ok(cont.querySelector('svg'));
});

test('hay un estado definido para cada situacion del panel', () => {
  assert.deepEqual(Object.keys(ESTADOS).sort(), ['aviso', 'bloqueado', 'exito', 'inicial']);
});

test('volver a pintar reemplaza, no acumula', () => {
  const { doc, cont } = contenedor();

  renderizarEstado(cont, { tipo: 'inicial', titulo: 'Uno' }, doc);
  renderizarEstado(cont, { tipo: 'exito', titulo: 'Dos' }, doc);

  assert.equal(cont.querySelectorAll('.estado').length, 1);
  assert.equal(cont.querySelector('.estado-titulo').textContent, 'Dos');
});
