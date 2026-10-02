import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoSigueVigente } from '../lib/estado.js';

test('el estado no es vigente si la pagina no responde al ping', () => {
  // La pagina se recargo o navego: el content script ya no existe.
  assert.equal(estadoSigueVigente(undefined), false);
  assert.equal(estadoSigueVigente(null), false);
});

test('el estado no es vigente si la pagina ya no tiene resaltados', () => {
  // Mismo content script, pero el DOM perdio los <mark>.
  assert.equal(estadoSigueVigente({ activo: true, marcas: 0 }), false);
});

test('el estado es vigente si la pagina conserva sus resaltados', () => {
  assert.equal(estadoSigueVigente({ activo: true, marcas: 3 }), true);
});
