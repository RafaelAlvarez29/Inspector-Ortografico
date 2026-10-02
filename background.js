import { construirLotes } from './lib/batching.js';
import { revisarLotes } from './lib/revision.js';

// El service worker MV3 se detiene tras ~30s de inactividad, asi que el estado
// no puede vivir en una variable global: se pierde entre aperturas del popup.
const clave = (tabId) => `errores-${tabId}`;

async function leerErrores(tabId) {
  const datos = await chrome.storage.session.get(clave(tabId));
  return datos[clave(tabId)] || [];
}

const guardarErrores = (tabId, errores) =>
  chrome.storage.session.set({ [clave(tabId)]: errores });

const borrarErrores = (tabId) => chrome.storage.session.remove(clave(tabId));

chrome.tabs.onRemoved.addListener((tabId) => borrarErrores(tabId));

chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
  const tabId = mensaje.tabId ?? sender.tab?.id;
  if (!tabId) return;

  switch (mensaje.accion) {
    // El fetch vive aqui y no en la pagina: evita la CSP del sitio revisado y
    // centraliza el control de ritmo para toda la extension.
    case 'revisarTextos':
      revisarLotes(construirLotes(mensaje.textos), {
        idioma: mensaje.idioma,
        // El popup puede estar cerrado: el aviso de avance es best-effort.
        onProgreso: (hechos, total) =>
          chrome.runtime.sendMessage({ accion: 'progreso', hechos, total }).catch(() => {}),
      }).then(sendResponse);
      return true;

    case 'guardarErrores':
      guardarErrores(tabId, mensaje.datos);
      return;

    case 'obtenerErrores':
      leerErrores(tabId).then((datos) => sendResponse({ datos }));
      return true;

    case 'limpiarRevision':
      borrarErrores(tabId);
      return;

    case 'exportarCSV':
      leerErrores(tabId).then((errores) => exportarCSV(errores, tabId));
      return;
  }
});

function escapar(valor) {
  return `"${String(valor ?? '').replace(/"/g, '""')}"`;
}

async function exportarCSV(errores, tabId) {
  if (errores.length === 0) {
    const aviso = 'No hay errores para exportar. Realiza una revision primero.';
    chrome.runtime
      .sendMessage({ accion: 'alerta', mensaje: aviso })
      .catch(() => chrome.tabs.sendMessage(tabId, { accion: 'alerta', mensaje: aviso }));
    return;
  }

  const filas = errores.map((e) =>
    [e.palabra, e.mensaje, (e.sugerencias || []).join(', '), e.categoria, e.url, e.fecha]
      .map(escapar)
      .join(',')
  );

  // El BOM ayuda a Excel a reconocer UTF-8. Se usa data: URL porque el service
  // worker MV3 no tiene acceso a URL.createObjectURL.
  const csv = '﻿' + 'Palabra,Mensaje,Sugerencias,Categoria,URL,Fecha\n' + filas.join('\n');

  await chrome.downloads.download({
    url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
    filename: `reporte_ortografia_${new Date().toISOString().slice(0, 10)}.csv`,
  });
}
