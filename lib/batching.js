export const SEPARADOR = '\n\n';
export const MAX_CARACTERES = 15000;

export function construirLotes(textos, { maxCaracteres = MAX_CARACTERES } = {}) {
  const lotes = [];
  let actual = null;

  const cerrar = () => {
    if (actual) lotes.push(actual);
    actual = null;
  };

  textos.forEach((texto, indiceOrigen) => {
    const costo = actual ? SEPARADOR.length + texto.length : texto.length;

    if (actual && actual.texto.length + costo > maxCaracteres) cerrar();

    if (!actual) {
      actual = { texto, indice: [{ indiceOrigen, inicio: 0, longitud: texto.length }] };
      return;
    }

    actual.indice.push({
      indiceOrigen,
      inicio: actual.texto.length + SEPARADOR.length,
      longitud: texto.length,
    });
    actual.texto += SEPARADOR + texto;
  });

  cerrar();
  return lotes;
}

/**
 * Traduce los offsets globales que devuelve LanguageTool sobre el texto del
 * lote a coordenadas locales (indiceOrigen, offset) de cada texto original.
 * Descarta cualquier match que no quepa integro dentro de un solo texto.
 */
export function mapearMatches(matches, indice) {
  const resultado = [];

  for (const match of matches) {
    const fin = match.offset + match.length;

    const entrada = indice.find(
      (e) => match.offset >= e.inicio && fin <= e.inicio + e.longitud
    );
    if (!entrada) continue;

    resultado.push({
      indiceOrigen: entrada.indiceOrigen,
      offset: match.offset - entrada.inicio,
      longitud: match.length,
      match,
    });
  }

  return resultado;
}

/**
 * Entre que se lee el texto y que llega la respuesta de la API pasan segundos,
 * y una SPA puede re-renderizar en ese lapso. Si el texto de un nodo ya no es
 * identico al que se envio, sus offsets dejan de ser validos: resaltarlos
 * marcaria texto correcto como erroneo. Se exige identidad exacta porque en una
 * herramienta de QA un falso positivo cuesta mas que un error no detectado.
 */
export function filtrarHallazgosVigentes(hallazgos, textosActuales, textosOriginales) {
  return hallazgos.filter(
    (h) => textosActuales[h.indiceOrigen] === textosOriginales[h.indiceOrigen]
  );
}
