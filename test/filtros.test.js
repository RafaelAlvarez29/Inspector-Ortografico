import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderizarFiltros } from '../lib/render.js';

function contenedor() {
  const dom = new JSDOM('<div id="f"></div>');
  return { doc: dom.window.document, cont: dom.window.document.getElementById('f') };
}

const CONTEO = { total: 24, typo: 18, gramatica: 4, estilo: 2, otro: 0 };

test('pinta una pastilla por categoria con errores, mas la de todos', () => {
  const { doc, cont } = contenedor();

  renderizarFiltros(cont, CONTEO, null, doc);

  const valores = [...cont.querySelectorAll('.filtro')].map((b) => b.dataset.categoria);
  assert.deepEqual(valores, ['', 'typo', 'gramatica', 'estilo']); // 'otro' esta en 0
});

test('cada pastilla muestra su conteo', () => {
  const { doc, cont } = contenedor();

  renderizarFiltros(cont, CONTEO, null, doc);

  const typo = cont.querySelector('.filtro[data-categoria="typo"]');
  assert.match(typo.textContent, /18/);
});

test('marca como activa la categoria seleccionada', () => {
  const { doc, cont } = contenedor();

  renderizarFiltros(cont, CONTEO, 'typo', doc);

  assert.equal(cont.querySelector('.filtro.activo').dataset.categoria, 'typo');
  assert.equal(cont.querySelector('.filtro[data-categoria="typo"]').getAttribute('aria-pressed'), 'true');
});

test('sin filtro seleccionado la pastilla activa es la de todos', () => {
  const { doc, cont } = contenedor();

  renderizarFiltros(cont, CONTEO, null, doc);

  assert.equal(cont.querySelector('.filtro.activo').dataset.categoria, '');
});

test('sin errores no pinta ninguna pastilla', () => {
  const { doc, cont } = contenedor();

  renderizarFiltros(cont, { total: 0, typo: 0, gramatica: 0, estilo: 0, otro: 0 }, null, doc);

  assert.equal(cont.querySelectorAll('.filtro').length, 0);
});
