/**
 * Construye la lista de errores del popup a partir de grupos (ver agruparErrores).
 *
 * Los datos (palabra, mensaje, sugerencias) provienen del texto de la pagina
 * revisada, es decir, de un tercero no confiable. Por eso la estructura se
 * construye con la API del DOM y los datos entran solo como texto o como
 * valor de propiedad: nunca se concatenan dentro de una cadena de HTML.
 */
export function renderizarErrores(contenedor, grupos, doc = document) {
  contenedor.replaceChildren();

  const crear = (tag, clase, texto) => {
    const el = doc.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  };

  for (const g of grupos) {
    const sugerencias = g.sugerencias || [];
    const total = g.total ?? g.ids?.length ?? 1;

    // <button> y no <div>: recibe foco, responde a Enter y los lectores de
    // pantalla lo anuncian como accionable.
    const item = crear('button', `error-item categoria-${g.categoria || 'otro'}`);
    item.type = 'button';
    item.dataset.clave = g.clave;
    item.dataset.palabra = g.palabra;
    item.dataset.ids = (g.ids || []).join(',');
    item.dataset.total = String(total);

    const boton = crear('span', 'ignorar-btn', 'Ignorar');
    boton.setAttribute('role', 'button');
    boton.setAttribute('tabindex', '0');
    boton.title = `Añadir '${g.palabra}' al diccionario personal`;

    const titulo = crear('span', 'palabra', g.palabra);

    const header = crear('div', 'error-header');
    header.append(titulo);
    if (total > 1) {
      const contador = crear('span', 'repeticiones', String(total));
      contador.title = `Aparece ${total} veces en la pagina`;
      header.append(contador);
    }

    // Al reportar un bug se escribe "dice X, debe decir Y": se deja listo para
    // pegar. Sin sugerencias no hay correccion que copiar, asi que no se pinta.
    if (sugerencias.length) {
      const copiar = crear('span', 'copiar-btn', 'Copiar');
      copiar.setAttribute('role', 'button');
      copiar.setAttribute('tabindex', '0');
      copiar.dataset.copia = `${g.palabra} → ${sugerencias[0]}`;
      copiar.title = 'Copiar la corrección al portapapeles';
      header.append(copiar);
    }

    header.append(boton);

    item.append(
      header,
      crear('div', 'mensaje', g.mensaje),
      crear('div', 'sugerencias',
        `Sugerencias: ${sugerencias.length ? sugerencias.join(', ') : 'Ninguna'}`)
    );

    contenedor.appendChild(item);
  }
}

const ETIQUETAS = {
  typo: 'Ortografía',
  gramatica: 'Gramática',
  estilo: 'Estilo',
  otro: 'Otros',
};

/**
 * Pastillas de conteo por categoria, que ademas filtran la lista.
 * Cumplen doble funcion: son la leyenda de los colores (que hasta ahora solo
 * estaban explicados en el README) y el control de filtrado.
 * Solo se pintan las categorias con errores, para no mostrar ceros inutiles.
 */
export function renderizarFiltros(contenedor, conteo, activa, doc = document) {
  contenedor.replaceChildren();
  if (!conteo.total) return;

  const pastilla = (categoria, etiqueta, numero) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = `filtro${categoria ? ` categoria-${categoria}` : ''}`;
    if ((activa || '') === categoria) b.classList.add('activo');
    b.dataset.categoria = categoria;
    b.setAttribute('aria-pressed', String((activa || '') === categoria));

    const txt = doc.createElement('span');
    txt.textContent = etiqueta;
    const num = doc.createElement('span');
    num.className = 'filtro-numero';
    num.textContent = String(numero);
    b.append(txt, num);
    return b;
  };

  contenedor.appendChild(pastilla('', 'Todos', conteo.total));
  for (const [categoria, etiqueta] of Object.entries(ETIQUETAS)) {
    if (conteo[categoria] > 0) {
      contenedor.appendChild(pastilla(categoria, etiqueta, conteo[categoria]));
    }
  }
}

/**
 * Chips del diccionario personal.
 *
 * Las palabras entran al diccionario desde el texto de paginas web, asi que
 * valen las mismas precauciones que en la lista de errores: nada de innerHTML.
 */
export function renderizarChips(contenedor, palabras, doc = document) {
  contenedor.replaceChildren();

  for (const palabra of palabras) {
    const chip = doc.createElement('span');
    chip.className = 'chip';
    chip.dataset.palabra = palabra;

    const texto = doc.createElement('span');
    texto.className = 'chip-texto';
    texto.textContent = palabra;

    const quitar = doc.createElement('button');
    quitar.type = 'button';
    quitar.className = 'chip-quitar';
    quitar.textContent = '×';
    quitar.setAttribute('aria-label', `Quitar "${palabra}" del diccionario`);

    chip.append(texto, quitar);
    contenedor.appendChild(chip);
  }
}

/**
 * Estados del panel cuando no hay una lista de errores que mostrar.
 *
 * Cada situacion merece su propio icono y su propio tono: "aun no has
 * revisado" y "no hay errores" son mensajes opuestos y antes compartian la
 * misma caja de texto gris.
 *
 * Los trazados son del juego de iconos Lucide, el mismo de los botones.
 */
export const ESTADOS = {
  inicial: [
    'M11.1 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.589 3.588A2.4 2.4 0 0 1 20 8v3.25',
    'M14 2v5a1 1 0 0 0 1 1h5',
    'm21 22-2.88-2.88',
    'CIRCULO:16,17,3',
  ],
  exito: ['M21.801 10A10 10 0 1 1 17 3.335', 'm9 11 3 3L22 4'],
  aviso: [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  bloqueado: ['CIRCULO:12,12,10', 'm4.9 4.9 14.2 14.2'],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function crearIcono(trazos, doc) {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  for (const [atributo, valor] of Object.entries({
    width: '28', height: '28', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.75',
    'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) {
    svg.setAttribute(atributo, valor);
  }

  for (const trazo of trazos) {
    if (trazo.startsWith('CIRCULO:')) {
      const [cx, cy, r] = trazo.slice(8).split(',');
      const circulo = doc.createElementNS(SVG_NS, 'circle');
      circulo.setAttribute('cx', cx);
      circulo.setAttribute('cy', cy);
      circulo.setAttribute('r', r);
      svg.appendChild(circulo);
    } else {
      const path = doc.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', trazo);
      svg.appendChild(path);
    }
  }
  return svg;
}

export function renderizarEstado(contenedor, { tipo, titulo, detalle }, doc = document) {
  contenedor.replaceChildren();

  const clave = ESTADOS[tipo] ? tipo : 'inicial';

  const caja = doc.createElement('div');
  caja.className = `estado estado-${clave}`;
  caja.appendChild(crearIcono(ESTADOS[clave], doc));

  const h = doc.createElement('p');
  h.className = 'estado-titulo';
  h.textContent = titulo;
  caja.appendChild(h);

  if (detalle) {
    const d = doc.createElement('p');
    d.className = 'estado-detalle';
    d.textContent = detalle;
    caja.appendChild(d);
  }

  contenedor.appendChild(caja);
}
