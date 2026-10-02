"""
Compone una hoja comparativa de las variantes del logotipo como un unico PNG.

Se hace en imagen y no en HTML porque el modo oscuro forzado de Chrome
invierte los colores de fondo de una pagina e invalida justo lo que hay que
comparar: como se ve cada icono sobre una barra clara y sobre una oscura.
El contenido de una imagen no se invierte.
"""
import os
import importlib.util

# El modulo lleva guion en el nombre, asi que no se puede importar por nombre.
_ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generar-iconos.py')
_spec = importlib.util.spec_from_file_location('generar_iconos', _ruta)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
dibujar, reducir, escribir_png = _mod.dibujar, _mod.reducir, _mod.escribir_png

VARIANTES = ['azul', 'A', 'B', 'C']

CLARO = (0xF1, 0xF3, 0xF4)   # barra de herramientas, tema claro
OSCURO = (0x20, 0x21, 0x24)  # barra de herramientas, tema oscuro
PAPEL = (0xFF, 0xFF, 0xFF)

COL = 170          # ancho de cada columna
ALTO_BARRA = 64
ALTO_GRANDE = 170
SEPARADOR = (0xD0, 0xD4, 0xD8)


def lienzo(ancho, alto, color):
    return [[color for _ in range(ancho)] for _ in range(alto)]


def pegar(destino, icono, x0, y0):
    """Compone el icono RGBA sobre el lienzo opaco."""
    for dy, fila in enumerate(icono):
        for dx, (r, g, b, a) in enumerate(fila):
            if a == 0:
                continue
            fr, fg, fb = destino[y0 + dy][x0 + dx]
            k = a / 255.0
            destino[y0 + dy][x0 + dx] = (
                round(fr + (r - fr) * k),
                round(fg + (g - fg) * k),
                round(fb + (b - fb) * k),
            )


def ampliar(icono, factor):
    """Ampliacion por vecino mas cercano, para ver el pixelado tal cual es."""
    return [[px for px in fila for _ in range(factor)] for fila in icono for _ in range(factor)]


def main():
    print('generando variantes (tarda un poco)...')
    iconos = {}
    for v in VARIANTES:
        iconos[(v, 16)] = reducir(dibujar(16 * 8, 'compacto', v), 8)
        iconos[(v, 128)] = reducir(dibujar(128 * 3, 'normal', v), 3)
        print('  ', v, 'listo')

    ancho = COL * len(VARIANTES)
    alto = ALTO_BARRA * 2 + ALTO_GRANDE
    hoja = lienzo(ancho, alto, PAPEL)

    for banda, (y0, fondo) in enumerate(((0, CLARO), (ALTO_BARRA, OSCURO))):
        for y in range(y0, y0 + ALTO_BARRA):
            for x in range(ancho):
                hoja[y][x] = fondo

        for i, v in enumerate(VARIANTES):
            cx = COL * i
            # Tamano real (16 px), que es como se vera en la barra.
            pegar(hoja, iconos[(v, 16)], cx + 34, y0 + (ALTO_BARRA - 16) // 2)
            # El mismo a 4x, sin suavizar, para ver el detalle.
            pegar(hoja, ampliar(iconos[(v, 16)], 3), cx + 74, y0 + (ALTO_BARRA - 48) // 2)

    # Linea que separa las barras de la zona de muestras grandes.
    for x in range(ancho):
        hoja[ALTO_BARRA * 2][x] = SEPARADOR

    y0 = ALTO_BARRA * 2 + 1
    for i, v in enumerate(VARIANTES):
        pegar(hoja, iconos[(v, 128)], COL * i + (COL - 128) // 2, y0 + 20)

    filas = [[(r, g, b, 255) for (r, g, b) in fila] for fila in hoja]
    n = escribir_png('logos-propuestos/comparativa.png', filas)
    print('\nlogos-propuestos/comparativa.png  %d bytes  (%dx%d)' % (n, ancho, alto))
    print('columnas, de izquierda a derecha:', ' | '.join(VARIANTES))


if __name__ == '__main__':
    main()
