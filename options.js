import { montarConfiguracion } from './lib/configuracion.js';
import { aplicarTema } from './lib/tema.js';

// La pagina independiente es solo un hueco: la vista de configuracion se monta
// aqui igual que dentro del panel, desde el mismo modulo.
document.addEventListener('DOMContentLoaded', async () => {
  const { tema } = await chrome.storage.sync.get(['tema']);
  aplicarTema(tema);
  montarConfiguracion(document.getElementById('config'));
});
