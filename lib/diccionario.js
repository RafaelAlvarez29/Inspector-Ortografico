// Separadores con los que un usuario puede pegar o escribir varias palabras:
// espacios, saltos de linea, comas, puntos y comas, y tabulaciones.
const SEPARADORES = /[\s,;]+/;

/** El diccionario se guarda siempre en minusculas para comparar sin ambiguedad. */
export const normalizar = (palabra) => palabra.trim().toLowerCase();

/**
 * Incorpora una o varias palabras a la lista.
 *
 * Devuelve tambien que se agrego y que estaba repetido, para que la interfaz
 * pueda avisar en vez de descartar en silencio: si el usuario escribe algo y
 * no aparece ningun chip, necesita saber por que.
 */
export function agregarPalabras(lista, entrada) {
  const resultado = [...lista];
  const agregadas = [];
  const duplicadas = [];

  for (const bruta of String(entrada ?? '').split(SEPARADORES)) {
    const palabra = normalizar(bruta);
    if (!palabra) continue;

    if (resultado.includes(palabra)) {
      duplicadas.push(palabra);
      continue;
    }
    resultado.push(palabra);
    agregadas.push(palabra);
  }

  return { lista: resultado, agregadas, duplicadas };
}

export function quitarPalabra(lista, palabra) {
  const objetivo = normalizar(palabra);
  return lista.filter((p) => p !== objetivo);
}
