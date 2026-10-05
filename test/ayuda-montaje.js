import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/**
 * Andamiaje compartido por las pruebas de humo de las paginas de la extension.
 *
 * Monta el HTML real en un DOM y ejecuta su script contra un chrome.* falso.
 * Las pruebas unitarias no detectan que falte un id en el marcado, que se
 * invoque una funcion inexistente o que el archivo este vacio: eso solo aparece
 * al ejecutar la pagina.
 */
let instancia = 0;

export function montar(urlHtml) {
  const dom = new JSDOM(readFileSync(urlHtml, 'utf8'), { url: 'https://localhost/' });
  const errores = [];
  dom.window.addEventListener('error', (e) => errores.push(e.error || e.message));
  return { dom, window: dom.window, errores };
}

/**
 * Cada ejecucion necesita su propia instancia del modulo: estos scripts
 * enganchan su escuchador al document global del momento, asi que reimportar
 * sin cambiar el especificador devolveria la instancia cacheada, atada al
 * primer documento.
 */
export async function ejecutar(urlHtml, urlScript, chrome) {
  const montaje = montar(urlHtml);
  const { window } = montaje;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.chrome = chrome;
  // En Node 22 globalThis.navigator solo tiene getter: hay que redefinirlo.
  Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator,
    configurable: true,
  });

  await import(`${urlScript}?instancia=${instancia++}`);

  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await new Promise((r) => setTimeout(r, 30));

  return montaje;
}

/** Los ids que el script pide, para comprobar que existen todos en el marcado. */
export function idsQuePide(urlScript) {
  const fuente = readFileSync(urlScript, 'utf8');
  return [...fuente.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
}

/**
 * Visibilidad efectiva: se recorren los ancestros porque ocultar un control o
 * su contenedor son dos formas validas de resolverlo, y la prueba no debe
 * atarse a una de ellas. jsdom no calcula el diseno: se miran estilos en linea.
 */
export function visible(el) {
  for (let n = el; n && n.style; n = n.parentElement) {
    if (n.hidden || n.style.display === 'none') return false;
  }
  return true;
}
