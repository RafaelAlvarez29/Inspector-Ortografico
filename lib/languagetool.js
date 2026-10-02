export const ENDPOINT = 'https://api.languagetool.org/v2/check';
export const IDIOMA = 'es';
// 'auto' deja que LanguageTool detecte el idioma de cada lote.
export const IDIOMAS = ['auto', 'es', 'en-US', 'en-GB', 'pt-BR', 'fr', 'de-DE', 'it'];
export const REINTENTOS = 3;
export const ESPERA_BASE_MS = 1000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function leerRetryAfter(respuesta) {
  const valor = respuesta.headers?.get?.('Retry-After');
  const segundos = Number(valor);
  return Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : null;
}

/**
 * Consulta LanguageTool. A diferencia de la version anterior, NUNCA devuelve
 * un array vacio ante un fallo: lanza. Un vacio significa "no hay errores".
 * Reintenta ante 429 y 5xx con backoff exponencial, respetando Retry-After.
 */
export async function verificarTexto(
  texto,
  { fetchFn = fetch, reintentos = REINTENTOS, esperar = dormir, idioma = IDIOMA } = {}
) {
  let ultimoError;

  for (let intento = 0; intento <= reintentos; intento++) {
    if (intento > 0) {
      await esperar(ultimoError.esperaMs ?? ESPERA_BASE_MS * 2 ** (intento - 1));
    }

    try {
      const respuesta = await fetchFn(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `text=${encodeURIComponent(texto)}&language=${encodeURIComponent(idioma)}`,
      });

      if (respuesta.ok) {
        const datos = await respuesta.json();
        return datos.matches || [];
      }

      ultimoError = new Error(`LanguageTool respondio ${respuesta.status}`);
      ultimoError.status = respuesta.status;
      ultimoError.esperaMs = leerRetryAfter(respuesta);

      // 4xx distinto de 429 no se arregla reintentando.
      if (respuesta.status !== 429 && respuesta.status < 500) throw ultimoError;
    } catch (e) {
      if (e === ultimoError) throw e;
      ultimoError = e; // fallo de red: reintentable
    }
  }

  throw ultimoError;
}
