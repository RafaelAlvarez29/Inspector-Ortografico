import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (n) => readFileSync(new URL(`../${n}`, import.meta.url), 'utf8');

const NOMBRE = 'Inspector Ortográfico';

test('el producto se llama igual en todas partes', () => {
  // Llegaron a convivir tres nombres: el del manifest (que es el que ve el
  // usuario en la tienda y en la barra), el del titulo del panel y el de la
  // cabecera. Para una ficha de tienda coherente tienen que coincidir.
  const manifest = JSON.parse(leer('manifest.json'));
  assert.equal(manifest.name, NOMBRE, 'manifest.json');

  for (const pagina of ['popup.html', 'options.html']) {
    const html = leer(pagina);
    const titulo = html.match(/<title>(.*?)<\/title>/)[1];
    assert.ok(titulo.includes(NOMBRE), `${pagina}: <title> dice "${titulo}"`);

    const h1 = html.match(/<h1>(.*?)<\/h1>/)[1];
    assert.equal(h1.trim(), NOMBRE, `${pagina}: <h1>`);
  }

  assert.ok(leer('README.md').includes(`# ${NOMBRE}`), 'README.md');
});

test('la version del manifest sigue el formato de Chrome', () => {
  const { version } = JSON.parse(leer('manifest.json'));
  assert.match(version, /^\d+(\.\d+){0,3}$/, 'versión no válida para Chrome');
});
