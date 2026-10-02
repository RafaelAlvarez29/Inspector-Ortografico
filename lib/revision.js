import { mapearMatches } from './batching.js';
import { verificarTexto } from './languagetool.js';

export const CONCURRENCIA = 2;

/**
 * Revisa todos los lotes con un maximo de peticiones simultaneas.
 * Un lote que falla no aborta la revision: se contabiliza en lotesFallidos
 * para que la UI pueda informar que el resultado es parcial.
 */
export async function revisarLotes(
  lotes,
  { verificar = verificarTexto, concurrencia = CONCURRENCIA, idioma, onProgreso } = {}
) {
  const hallazgos = [];
  let lotesFallidos = 0;
  let siguiente = 0;
  let terminados = 0;

  async function trabajador() {
    while (siguiente < lotes.length) {
      const lote = lotes[siguiente++];
      try {
        const matches = await verificar(lote.texto, { idioma });
        hallazgos.push(...mapearMatches(matches, lote.indice));
      } catch {
        lotesFallidos++;
      }
      // El avance se informa tanto si el lote salio bien como si fallo: lo que
      // interesa en pantalla es cuanto queda, no cuanto funciono.
      terminados++;
      onProgreso?.(terminados, lotes.length);
    }
  }

  const trabajadores = Array.from(
    { length: Math.min(concurrencia, lotes.length) },
    trabajador
  );
  await Promise.all(trabajadores);

  hallazgos.sort((a, b) => a.indiceOrigen - b.indiceOrigen || a.offset - b.offset);

  return { hallazgos, lotesFallidos, lotesTotales: lotes.length };
}
