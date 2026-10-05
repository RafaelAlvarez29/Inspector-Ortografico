/**
 * Apariencia de la interfaz.
 *
 * En automatico no se marca nada y manda `prefers-color-scheme`, igual que
 * antes de que existiera el selector. Forzar un tema se hace con un atributo
 * en la raiz del documento, que base.css usa para aplicar la otra paleta.
 */
export const TEMA_POR_DEFECTO = 'auto';

export const TEMAS = [
  { codigo: 'auto', nombre: 'Automático (según el sistema)' },
  { codigo: 'claro', nombre: 'Claro' },
  { codigo: 'oscuro', nombre: 'Oscuro' },
];

const FORZABLES = new Set(['claro', 'oscuro']);

/**
 * Un codigo desconocido cae en automatico en vez de dejar un atributo que no
 * corresponde a ninguna regla: la interfaz quedaria a medio pintar.
 */
export function aplicarTema(codigo, raiz = document.documentElement) {
  if (FORZABLES.has(codigo)) {
    raiz.dataset.tema = codigo;
  } else {
    raiz.removeAttribute('data-tema');
  }
}

export function nombreDeTema(codigo) {
  const buscado = codigo || TEMA_POR_DEFECTO;
  return TEMAS.find((t) => t.codigo === buscado)?.nombre ?? buscado;
}
