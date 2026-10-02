import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularPosicionTooltip } from '../lib/tooltip.js';

const VIEWPORT = { width: 1000, height: 800 };
const TOOLTIP = { width: 200, height: 60 };
// margen al borde = 8, separacion respecto a la palabra = 6

test('por defecto se coloca encima de la palabra y centrado', () => {
  const marca = { left: 400, top: 300, width: 100, height: 20, bottom: 320 };

  const pos = calcularPosicionTooltip(marca, TOOLTIP, VIEWPORT);

  assert.equal(pos.lado, 'arriba');
  assert.equal(pos.top, 300 - 60 - 6);   // encima, con separacion
  assert.equal(pos.left, 450 - 100);     // centro de la palabra menos media anchura
});

test('se voltea hacia abajo cuando no cabe arriba', () => {
  const marca = { left: 400, top: 10, width: 100, height: 20, bottom: 30 };

  const pos = calcularPosicionTooltip(marca, TOOLTIP, VIEWPORT);

  assert.equal(pos.lado, 'abajo');
  assert.equal(pos.top, 30 + 6);
});

test('no se sale por el borde izquierdo', () => {
  const marca = { left: 2, top: 300, width: 40, height: 20, bottom: 320 };

  const pos = calcularPosicionTooltip(marca, TOOLTIP, VIEWPORT);

  assert.equal(pos.left, 8); // pegado al margen, no en negativo
});

test('no se sale por el borde derecho', () => {
  const marca = { left: 960, top: 300, width: 40, height: 20, bottom: 320 };

  const pos = calcularPosicionTooltip(marca, TOOLTIP, VIEWPORT);

  assert.equal(pos.left, 1000 - 200 - 8); // 792
});

test('si no cabe ni arriba ni abajo se queda dentro de la pantalla', () => {
  const chico = { width: 1000, height: 100 };
  const marca = { left: 400, top: 40, width: 100, height: 20, bottom: 60 };

  const pos = calcularPosicionTooltip(marca, TOOLTIP, chico);

  assert.ok(pos.top >= 8, `top ${pos.top} quedo por encima del margen`);
  assert.ok(pos.top + TOOLTIP.height <= 100 - 8 || pos.top === 8);
});

test('un tooltip mas ancho que la pantalla se ancla al margen izquierdo', () => {
  const ancho = { width: 1200, height: 60 };
  const marca = { left: 400, top: 300, width: 100, height: 20, bottom: 320 };

  const pos = calcularPosicionTooltip(marca, ancho, VIEWPORT);

  assert.equal(pos.left, 8);
});
