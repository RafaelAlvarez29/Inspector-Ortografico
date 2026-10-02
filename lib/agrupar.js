export const CATEGORIAS = ['typo', 'gramatica', 'estilo', 'otro'];

/**
 * Una misma palabra mal escrita en un componente reutilizable aparece decenas
 * de veces. Se agrupan las ocurrencias para que la lista muestre cuantas
 * palabras distintas estan mal, y no cuantas veces se repite el mismo fallo.
 *
 * La clave ignora mayusculas (Erorr y erorr son el mismo fallo) pero incluye la
 * categoria: "esta" puede ser un typo en un sitio y un error gramatical en otro.
 */
export function agruparErrores(errores) {
  const porClave = new Map();

  for (const e of errores) {
    const categoria = e.categoria || 'otro';
    const clave = `${(e.palabra || '').toLowerCase()}|${categoria}`;

    if (!porClave.has(clave)) {
      porClave.set(clave, {
        clave,
        palabra: e.palabra, // como se escribio la primera vez
        categoria,
        mensaje: e.mensaje,
        sugerencias: e.sugerencias || [],
        ids: [],
      });
    }
    porClave.get(clave).ids.push(e.id);
  }

  // Map conserva el orden de insercion: el de aparicion en la pagina.
  return [...porClave.values()].map((g) => ({ ...g, total: g.ids.length }));
}

/** Cuenta ocurrencias (no palabras distintas) por categoria, para las pastillas. */
export function contarPorCategoria(errores) {
  const conteo = { total: errores.length };
  for (const c of CATEGORIAS) conteo[c] = 0;

  for (const e of errores) {
    const c = CATEGORIAS.includes(e.categoria) ? e.categoria : 'otro';
    conteo[c]++;
  }
  return conteo;
}
