/**
 * Que paginas se pueden revisar, y como contar un fallo cuando no se puede.
 *
 * Chrome prohibe inyectar scripts en sus paginas internas y en la tienda de
 * extensiones. No es un error recuperable: conviene desactivar el boton antes
 * de que el usuario lo pulse, en lugar de dejarle fallar y explicarlo despues.
 */
const ESQUEMAS_INTERNOS = [
  'chrome:',
  'chrome-extension:',
  'chrome-untrusted:',
  'devtools:',
  'edge:',
  'about:',
  'moz-extension:',
];

const TIENDA = [/^https:\/\/chromewebstore\.google\.com\//, /^https:\/\/chrome\.google\.com\/webstore/];

const MOTIVO_INTERNA =
  'Esta es una página interna del navegador y Chrome no permite revisarla.';
const MOTIVO_TIENDA =
  'Chrome no permite que las extensiones actúen sobre su tienda.';
const MOTIVO_FUENTE =
  'El código fuente de una página no se puede revisar.';

/**
 * Devuelve por que no se puede revisar la pagina, o null si si se puede.
 *
 * Una url desconocida devuelve null a proposito: tabs.query no siempre la
 * entrega, y bloquear ante la duda impediria revisar paginas validas. Para ese
 * caso queda la red de seguridad de mensajeDeFallo().
 */
export function motivoNoRevisable(url) {
  if (!url) return null;

  if (url.startsWith('view-source:')) return MOTIVO_FUENTE;
  if (ESQUEMAS_INTERNOS.some((e) => url.startsWith(e))) return MOTIVO_INTERNA;
  if (TIENDA.some((r) => r.test(url))) return MOTIVO_TIENDA;

  return null;
}

// Fallos de Chrome que significan "aqui no se puede", no "algo se rompio".
const FALLOS_DE_ACCESO = [
  /Cannot access a? ?chrome:\/\/ URL/i,
  /Cannot access contents of the page/i,
  /Cannot access contents of url/i,
  /The extensions gallery cannot be scripted/i,
  /Extension manifest must request permission/i,
  /Missing host permission/i,
];

const esDeAcceso = (error) => FALLOS_DE_ACCESO.some((r) => r.test(error?.message || ''));

/** Texto que ve el usuario cuando la revision no llega a empezar. */
export function mensajeDeFallo(error) {
  if (esDeAcceso(error)) {
    return 'Esta página no se puede revisar: Chrome no permite que las extensiones accedan a ella.';
  }
  return `La revisión no pudo completarse. (${error?.message || error})`;
}

/**
 * Un fallo esperado no deberia registrarse en la consola: acabaria en la lista
 * de errores de la extension, dando a entender que algo esta roto.
 */
mensajeDeFallo.esEsperado = (error) => esDeAcceso(error);
