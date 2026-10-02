/**
 * Decide si los errores guardados para una pestana todavia se corresponden con
 * lo que hay en pantalla.
 *
 * Comparar la URL no basta: recargar con F5 deja la misma URL pero borra los
 * <mark> del DOM. La senal fiable es la respuesta del content script, que solo
 * existe mientras la pagina no se haya recargado y sabe cuantas marcas quedan.
 */
export function estadoSigueVigente(respuestaPing) {
  return Boolean(respuestaPing?.activo && respuestaPing.marcas > 0);
}
