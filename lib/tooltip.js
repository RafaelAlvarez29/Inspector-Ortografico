export const MARGEN = 8;      // distancia minima al borde de la ventana
export const SEPARACION = 6;  // hueco entre la palabra y el tooltip

const acotar = (valor, min, max) => Math.min(Math.max(valor, min), max);

/**
 * Decide donde dibujar el tooltip para que quede siempre visible.
 *
 * Se prefiere arriba de la palabra; si no cabe, se voltea hacia abajo.
 * En horizontal se centra sobre la palabra y luego se acota a los bordes,
 * de modo que una palabra pegada al borde no empuje el tooltip fuera.
 *
 * Trabaja con coordenadas de viewport (las de getBoundingClientRect), asi que
 * el resultado se aplica tal cual sobre un elemento con position: fixed.
 */
export function calcularPosicionTooltip(marca, tooltip, viewport, opciones = {}) {
  const { margen = MARGEN, separacion = SEPARACION } = opciones;

  const cabeArriba = marca.top - tooltip.height - separacion >= margen;
  const lado = cabeArriba ? 'arriba' : 'abajo';

  const top = cabeArriba
    ? marca.top - tooltip.height - separacion
    : marca.bottom + separacion;

  const centrado = marca.left + marca.width / 2 - tooltip.width / 2;

  // Si el tooltip no cabe en la ventana, el limite superior caeria por debajo
  // del margen y acotar() devolveria un valor negativo. Se eleva el maximo al
  // margen para que en ese caso quede anclado al borde en vez de fuera.
  return {
    lado,
    left: acotar(centrado, margen, Math.max(margen, viewport.width - tooltip.width - margen)),
    top: acotar(top, margen, Math.max(margen, viewport.height - tooltip.height - margen)),
  };
}
