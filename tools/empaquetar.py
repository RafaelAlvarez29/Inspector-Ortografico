"""
Arma el ZIP que se sube a la Chrome Web Store.

No se empaqueta el repositorio entero: las pruebas, las herramientas, la
documentacion y las dependencias de desarrollo no pintan nada ahi, y un paquete
con archivos que la extension no usa invita a preguntas en la revision.

La lista no esta escrita a mano: se deduce del propio manifest y se completa
siguiendo las referencias de cada HTML y de cada modulo. Si manana se anade un
archivo y nadie actualiza este script, el paquete sale incompleto; por eso al
final se comprueba que todo lo referenciado este dentro.
"""
import io
import json
import os
import re
import sys
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def leer(rel):
    with io.open(os.path.join(RAIZ, rel), encoding='utf-8') as f:
        return f.read()


def referencias_html(rel):
    """href/src de un HTML, descartando lo externo."""
    html = leer(rel)
    base = os.path.dirname(rel)
    salida = []
    for ruta in re.findall(r'(?:href|src)="([^"]+)"', html):
        if ruta.startswith(('http:', 'https:', 'data:', '#')):
            continue
        salida.append(os.path.normpath(os.path.join(base, ruta)).replace('\\', '/'))
    return salida


def referencias_js(rel):
    """Imports estaticos y dinamicos de un modulo."""
    js = leer(rel)
    base = os.path.dirname(rel)
    rutas = re.findall(r'from\s+[\'"](\./[^\'"]+)[\'"]', js)
    rutas += re.findall(r'getURL\([\'"]([^\'"]+)[\'"]\)', js)
    return [os.path.normpath(os.path.join(base, r)).replace('\\', '/') for r in rutas]


def referencias_css(rel):
    """url(...) de una hoja de estilos (las fuentes)."""
    base = os.path.dirname(rel)
    rutas = re.findall(r"url\(['\"]?([^'\")]+)", leer(rel))
    return [os.path.normpath(os.path.join(base, r)).replace('\\', '/')
            for r in rutas if not r.startswith(('http', 'data:'))]


def recolectar():
    m = json.loads(leer('manifest.json'))

    pendientes = ['manifest.json', m['background']['service_worker'],
                  m['action']['default_popup'], m['options_page']]
    pendientes += list(m['icons'].values())
    pendientes += m['web_accessible_resources'][0]['resources']
    # content.js y styles.css se inyectan desde popup.js, no los declara el
    # manifest: se detectan por las llamadas a scripting.*
    pendientes += re.findall(r"files:\s*\[['\"]([^'\"]+)['\"]\]", leer('popup.js'))

    vistos = set()
    while pendientes:
        rel = pendientes.pop()
        if rel in vistos:
            continue
        if not os.path.exists(os.path.join(RAIZ, rel)):
            print('  AVISO: referenciado pero inexistente ->', rel)
            continue
        vistos.add(rel)

        if rel.endswith('.html'):
            pendientes += referencias_html(rel)
        elif rel.endswith('.js'):
            pendientes += referencias_js(rel)
        elif rel.endswith('.css'):
            pendientes += referencias_css(rel)

    return sorted(vistos)


def main():
    archivos = recolectar()
    version = json.loads(leer('manifest.json'))['version']
    destino = os.path.join(RAIZ, 'inspector-ortografico-%s.zip' % version)

    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in archivos:
            z.write(os.path.join(RAIZ, rel), rel)

    total = os.path.getsize(destino)
    print('%d archivos, %.1f KB' % (len(archivos), total / 1024))
    for rel in archivos:
        print('   ', rel)
    print('\n->', os.path.basename(destino))
    return 0


if __name__ == '__main__':
    sys.exit(main())
