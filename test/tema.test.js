import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (nombre) => readFileSync(new URL(`../${nombre}`, import.meta.url), 'utf8');

// Hojas que describen pantallas. base.css queda fuera: es donde viven los
// colores, y el unico sitio donde deben estar escritos.
const HOJAS = ['popup.css', 'configuracion.css', 'options.css'];

test('solo base.css define colores literales', () => {
  // Un color escrito a mano en una hoja de pantalla no cambia con el tema:
  // asi es como se rompe el modo oscuro, una regla cada vez.
  const culpables = [];

  for (const hoja of HOJAS) {
    leer(hoja)
      .split('\n')
      .forEach((linea, i) => {
        if (linea.trim().startsWith('/*') || linea.trim().startsWith('*')) return;
        const hex = linea.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (hex) culpables.push(`${hoja}:${i + 1} ${hex.join(', ')}`);
      });
  }

  assert.deepEqual(culpables, [], 'colores literales fuera de base.css');
});

test('base.css redefine los tokens para el tema oscuro', () => {
  const base = leer('base.css');

  assert.match(base, /@media \(prefers-color-scheme: dark\)/);
  // Sin color-scheme, los controles nativos (select, barras de scroll) siguen
  // pintandose en claro aunque el resto de la interfaz sea oscura.
  assert.match(base, /color-scheme:\s*light dark/);
});

test('las dos reglas de tema oscuro asignan exactamente los mismos tokens', () => {
  // Una aplica cuando el sistema pide oscuro; la otra cuando se fuerza desde
  // las opciones. Si divergen, forzar el tema daria un resultado distinto a
  // dejarlo en automatico, y el fallo seria dificil de ver.
  const base = leer('base.css');
  const bloques = [...base.matchAll(/\{\s*((?:\s*--[a-z0-9-]+:\s*var\(--o-[a-z0-9-]+\);\s*)+)\}/g)]
    .map((m) => [...m[1].matchAll(/(--[a-z0-9-]+):/g)].map((x) => x[1]).sort());

  assert.equal(bloques.length, 2, 'deberia haber dos listas de asignacion');
  assert.deepEqual(bloques[0], bloques[1]);
  assert.ok(bloques[0].length > 20, 'la paleta oscura parece incompleta');
});

test('cada token oscuro definido se usa, y cada uso existe', () => {
  const base = leer('base.css');
  const definidos = new Set([...base.matchAll(/^\s*--o-([a-z0-9-]+):/gm)].map((m) => m[1]));
  const usados = new Set([...base.matchAll(/var\(--o-([a-z0-9-]+)\)/g)].map((m) => m[1]));

  assert.deepEqual([...definidos].filter((t) => !usados.has(t)), [], 'tokens oscuros sin usar');
  assert.deepEqual([...usados].filter((t) => !definidos.has(t)), [], 'tokens oscuros inexistentes');
});

const ETIQUETAS_HTML = new Set([
  'html', 'body', 'div', 'span', 'p', 'a', 'button', 'input', 'select', 'option',
  'textarea', 'label', 'img', 'svg', 'section', 'header', 'footer', 'nav', 'main',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'mark', 'kbd', 'em',
  'strong', 'code', 'pre', 'table', 'tr', 'td', 'th', 'form', 'fieldset', 'legend',
]);

test('los selectores de etiqueta corresponden a elementos reales', () => {
  // Un pegote al editar ("buttonbutton.error-item") es un selector valido para
  // el analizador de CSS, asi que no lo detecta: simplemente no casa con nada.
  const sospechosos = [];

  for (const hoja of [...HOJAS, 'base.css']) {
    for (const [i, linea] of leer(hoja).split('\n').entries()) {
      const m = linea.match(/^([a-zA-Z][a-zA-Z0-9]*)[.:[\s,{]/);
      if (m && !ETIQUETAS_HTML.has(m[1].toLowerCase())) {
        sospechosos.push(`${hoja}:${i + 1} "${m[1]}"`);
      }
    }
  }

  assert.deepEqual(sospechosos, [], 'selectores de etiqueta desconocidos');
});

test('los iconos son SVG, no emojis', () => {
  // Un emoji se dibuja distinto en cada sistema operativo y no hereda el color
  // del texto, asi que desentona junto a los iconos de trazo del resto.
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
  const culpables = [];

  for (const hoja of [...HOJAS, 'base.css', 'styles.css']) {
    leer(hoja)
      .split('\n')
      .forEach((linea, i) => {
        if (emoji.test(linea)) culpables.push(`${hoja}:${i + 1} ${linea.trim()}`);
      });
  }

  assert.deepEqual(culpables, [], 'emojis en las hojas de estilo');
});
