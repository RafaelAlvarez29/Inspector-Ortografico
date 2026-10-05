/**
 * Catalogo de idiomas, en un unico sitio.
 *
 * Lo consume la pagina de opciones para construir el selector y el panel para
 * mostrar el idioma activo. Tenerlo repetido en el marcado y en el codigo
 * garantiza que tarde o temprano dejen de coincidir.
 *
 * Los codigos son los que acepta LanguageTool; 'auto' le pide que lo deduzca
 * del propio texto.
 */
export const IDIOMA_POR_DEFECTO = 'es';

export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español' },
  { codigo: 'auto', nombre: 'Detección automática' },
  { codigo: 'en-US', nombre: 'Inglés (EE. UU.)' },
  { codigo: 'en-GB', nombre: 'Inglés (Reino Unido)' },
  { codigo: 'pt-BR', nombre: 'Portugués (Brasil)' },
  { codigo: 'fr', nombre: 'Francés' },
  { codigo: 'de-DE', nombre: 'Alemán' },
  { codigo: 'it', nombre: 'Italiano' },
];

/** Un codigo desconocido se devuelve tal cual: es mas util que un hueco. */
export function nombreDeIdioma(codigo) {
  const buscado = codigo || IDIOMA_POR_DEFECTO;
  return IDIOMAS.find((i) => i.codigo === buscado)?.nombre ?? buscado;
}
