"""
Genera los iconos de la extension sin dependencias externas.

Las figuras se definen con funciones de distancia con signo (SDF) y se dibujan
a una resolucion varias veces mayor que la final; al reducir por promedio se
obtiene el antialiasing. El PNG se escribe a mano con zlib.

Concepto del logotipo: una lupa cuyo cristal lleva recortado el subrayado
ondulado que todo editor usa para marcar una palabra mal escrita. Monocromo,
con el mismo color primario que la interfaz (--primary-color, #6366f1).
"""
import math
import struct
import zlib

BLANCO = (0xFF, 0xFF, 0xFF)

# Cada paleta define el degradado del disco, el borde opcional que lo separa
# de una barra de herramientas oscura, el tono del cristal y el de la onda.
PALETAS = {
    # Monocromatica: un solo color (el del sistema) y blanco. La lente es un
    # disco blanco solido y la onda se recorta en el, dejando ver el fondo.
    'mono': dict(mono=True, fondo=((0x63, 0x66, 0xF1), (0x63, 0x66, 0xF1)),
                 borde=None, cristal=(0xFF, 0xFF, 0xFF), onda=None),
    'azul': dict(fondo=((0x3B, 0x82, 0xF6), (0x1D, 0x4E, 0xD8)),
                 borde=None, cristal=(0xF8, 0xFA, 0xFC), onda=(0xEF, 0x44, 0x44)),
    'A': dict(fondo=((0x00, 0x00, 0x00), (0x00, 0x00, 0x00)),
              borde=None, cristal=(0xF8, 0xFA, 0xFC), onda=(0xEF, 0x44, 0x44)),
    'B': dict(fondo=((0x27, 0x27, 0x2A), (0x09, 0x09, 0x0B)),
              borde=((0x52, 0x52, 0x5B), 3), cristal=(0xF8, 0xFA, 0xFC),
              onda=(0xEF, 0x44, 0x44)),
    'C': dict(fondo=((0x27, 0x27, 0x2A), (0x09, 0x09, 0x0B)),
              borde=((0x52, 0x52, 0x5B), 3), cristal=(0xFF, 0xFF, 0xFF),
              onda=(0xFF, 0x3B, 0x30)),
}


# --- Funciones de distancia con signo (negativo = dentro) ---
def sdf_rect_redondeado(x, y, cx, cy, mitad_w, mitad_h, radio):
    dx = abs(x - cx) - (mitad_w - radio)
    dy = abs(y - cy) - (mitad_h - radio)
    fuera = math.hypot(max(dx, 0.0), max(dy, 0.0))
    return fuera + min(max(dx, dy), 0.0) - radio


def sdf_circulo(x, y, cx, cy, radio):
    return math.hypot(x - cx, y - cy) - radio


def sdf_anillo(x, y, cx, cy, radio, grosor):
    return abs(math.hypot(x - cx, y - cy) - radio) - grosor / 2.0


def sdf_capsula(x, y, ax, ay, bx, by, grosor):
    """Segmento de recta con extremos redondeados."""
    pax, pay = x - ax, y - ay
    bax, bay = bx - ax, by - ay
    denom = bax * bax + bay * bay
    h = 0.0 if denom == 0 else max(0.0, min(1.0, (pax * bax + pay * bay) / denom))
    return math.hypot(pax - bax * h, pay - bay * h) - grosor / 2.0


def sdf_onda(x, y, x0, x1, cy, amplitud, grosor, ciclos, muestras=140):
    """Distancia a una sinusoide, aproximada por una polilinea densa."""
    if x < x0 - grosor or x > x1 + grosor:
        return 1e9
    mejor = 1e9
    paso = (x1 - x0) / muestras
    for i in range(muestras):
        ax = x0 + paso * i
        bx = ax + paso
        ay = cy + amplitud * math.sin((ax - x0) / (x1 - x0) * ciclos * 2 * math.pi)
        by = cy + amplitud * math.sin((bx - x0) / (x1 - x0) * ciclos * 2 * math.pi)
        d = sdf_capsula(x, y, ax, ay, bx, by, grosor)
        if d < mejor:
            mejor = d
    return mejor


def mezclar(fondo, color, alfa):
    return tuple(f + (c - f) * alfa for f, c in zip(fondo, color))


def cobertura(d):
    """Convierte distancia en opacidad: el borde ocupa ~1 pixel del lienzo grande."""
    return max(0.0, min(1.0, 0.5 - d))


# A 16 px el dibujo normal se vuelve una mancha: la onda se pierde y el aro se
# confunde con el fondo. La variante compacta agranda la lente, engorda los
# trazos y reduce la onda a menos ciclos, que es lo que sigue leyendose.
PERFILES = {
    'normal': dict(lente=(54, 52), lente_r=30, aro=10,
                   mango_fin=(98, 96), mango=14,
                   onda_ancho=18, onda_amp=4.5, onda_grosor=6.0, onda_ciclos=2),
    # En monocromo la lente es maciza, asi que a 16 px se empasta con el mango
    # y la onda recortada se cierra. Lente mas chica, onda mas gruesa y de un
    # solo ciclo: menos informacion, pero la que queda se lee.
    'mono-compacto': dict(lente=(55, 52), lente_r=34, aro=10,
                          mango_fin=(101, 98), mango=16,
                          onda_ancho=17, onda_amp=8, onda_grosor=9, onda_ciclos=1.5),
    'compacto': dict(lente=(56, 54), lente_r=36, aro=13,
                     mango_fin=(100, 97), mango=17,
                     onda_ancho=21, onda_amp=6.5, onda_grosor=9.5, onda_ciclos=1.5),
}


def dibujar(lado, perfil='normal', paleta='azul'):
    """Devuelve un lienzo RGBA (lista de filas de tuplas) del tamano pedido."""
    p = PERFILES[perfil]
    pal = PALETAS[paleta]
    u = lado / 128.0  # todas las medidas estan pensadas sobre un lienzo de 128

    cx = cy = lado / 2.0
    lente_cx, lente_cy = p['lente'][0] * u, p['lente'][1] * u
    lente_r = p['lente_r'] * u
    aro = p['aro'] * u

    # El mango arranca en el borde del aro, a 45 grados hacia abajo-derecha.
    d = (lente_r + aro / 2 - 2 * u) / math.sqrt(2)
    mango_ax, mango_ay = lente_cx + d, lente_cy + d
    mango_bx, mango_by = p['mango_fin'][0] * u, p['mango_fin'][1] * u

    filas = []
    for py in range(lado):
        fila = []
        y = py + 0.5
        for px in range(lado):
            x = px + 0.5

            # Fondo circular: se deja medio pixel de margen para que el
            # borde antialiasado no quede cortado por el limite del lienzo.
            d_fondo = sdf_circulo(x, y, cx, cy, lado / 2 - 0.5)
            a_fondo = cobertura(d_fondo)
            if a_fondo <= 0:
                fila.append((0, 0, 0, 0))
                continue

            t = py / max(1, lado - 1)
            c0, c1 = pal['fondo']
            color = tuple(a + (b - a) * t for a, b in zip(c0, c1))
            fondo_plano = color

            # Borde: lo que evita que un disco oscuro se funda con una barra
            # de herramientas oscura. Se pinta como un anillo pegado al canto.
            if pal['borde']:
                col_borde, grosor = pal['borde']
                a_borde = cobertura(
                    sdf_anillo(x, y, cx, cy, lado / 2 - 0.5 - grosor * u / 2, grosor * u))
                if a_borde > 0:
                    color = mezclar(color, col_borde, a_borde)

            a_mango = cobertura(
                sdf_capsula(x, y, mango_ax, mango_ay, mango_bx, mango_by, p['mango'] * u)
            )
            a_onda = cobertura(
                sdf_onda(x, y, lente_cx - p['onda_ancho'] * u, lente_cx + p['onda_ancho'] * u,
                         lente_cy + 7 * u, p['onda_amp'] * u, p['onda_grosor'] * u,
                         p['onda_ciclos'])
            )

            if pal.get('mono'):
                # La lente es un disco blanco macizo; el mango se le une.
                a_lente = cobertura(sdf_circulo(x, y, lente_cx, lente_cy, lente_r + aro / 2))
                color = mezclar(color, pal['cristal'], max(a_lente, a_mango))

                # La onda se recorta: dentro de la lente devuelve el color del
                # fondo, que es lo que se ve a traves del hueco.
                hueco = min(a_onda, a_lente)
                if hueco > 0:
                    color = mezclar(color, fondo_plano, hueco)
            else:
                # Cristal: un velo claro para que la onda no vaya sobre el azul.
                a_cristal = cobertura(
                    sdf_circulo(x, y, lente_cx, lente_cy, lente_r - aro / 2))
                if a_cristal > 0:
                    color = mezclar(color, pal['cristal'], a_cristal * 0.93)

                sobre_cristal = min(a_onda, a_cristal)
                if sobre_cristal > 0:
                    color = mezclar(color, pal['onda'], sobre_cristal)

                a_aro = cobertura(sdf_anillo(x, y, lente_cx, lente_cy, lente_r, aro))
                a_lupa = max(a_mango, a_aro)
                if a_lupa > 0:
                    color = mezclar(color, BLANCO, a_lupa)

            r, g, b = (int(round(max(0, min(255, c)))) for c in color)
            fila.append((r, g, b, int(round(a_fondo * 255))))
        filas.append(fila)
    return filas


def reducir(filas, factor):
    """Promedia bloques de factor x factor (antialiasing)."""
    lado = len(filas) // factor
    salida = []
    for y in range(lado):
        fila = []
        for x in range(lado):
            r = g = b = a = 0
            for dy in range(factor):
                for dx in range(factor):
                    pr, pg, pb, pa = filas[y * factor + dy][x * factor + dx]
                    # Premultiplicado: evita halos oscuros en los bordes.
                    r += pr * pa
                    g += pg * pa
                    b += pb * pa
                    a += pa
            if a == 0:
                fila.append((0, 0, 0, 0))
            else:
                n = factor * factor
                fila.append((round(r / a), round(g / a), round(b / a), round(a / n)))
        salida.append(fila)
    return salida


def escribir_png(ruta, filas):
    # No se asume que la imagen sea cuadrada: los iconos lo son, pero la hoja
    # comparativa no, y una cabecera con las medidas mal da un PNG corrupto.
    alto = len(filas)
    ancho = len(filas[0]) if alto else 0
    crudo = bytearray()
    for fila in filas:
        crudo.append(0)  # filtro "None"
        for r, g, b, a in fila:
            crudo += bytes((r, g, b, a))

    def trozo(tipo, datos):
        return (struct.pack('>I', len(datos)) + tipo + datos
                + struct.pack('>I', zlib.crc32(tipo + datos) & 0xFFFFFFFF))

    png = (b'\x89PNG\r\n\x1a\n'
           + trozo(b'IHDR', struct.pack('>IIBBBBB', ancho, alto, 8, 6, 0, 0, 0))
           + trozo(b'IDAT', zlib.compress(bytes(crudo), 9))
           + trozo(b'IEND', b''))
    with open(ruta, 'wb') as f:
        f.write(png)
    return len(png)


if __name__ == '__main__':
    import sys
    paleta = sys.argv[1] if len(sys.argv) > 1 else 'azul'
    destino = sys.argv[2] if len(sys.argv) > 2 else 'icon%d.png'

    chico = 'mono-compacto' if paleta == 'mono' else 'compacto'
    for lado, factor, perfil in ((128, 4, 'normal'), (48, 8, 'normal'), (16, 8, chico)):
        grande = dibujar(lado * factor, perfil, paleta)
        final = reducir(grande, factor)
        ruta = destino % lado
        n = escribir_png(ruta, final)
        print('%-28s %d bytes' % (ruta, n))
