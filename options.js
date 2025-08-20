document.addEventListener('DOMContentLoaded', () => {
    const diccionarioTextarea = document.getElementById('diccionario');
    const guardarBtn = document.getElementById('guardar');
    const statusDiv = document.getElementById('status');

    // Cargar las palabras guardadas cuando se abre la página
    chrome.storage.sync.get(['diccionarioPersonal'], (result) => {
        if (result.diccionarioPersonal && Array.isArray(result.diccionarioPersonal)) {
            diccionarioTextarea.value = result.diccionarioPersonal.join('\n');
        }
    });

    // Guardar las palabras al hacer clic en el botón
    guardarBtn.addEventListener('click', () => {
        const palabras = diccionarioTextarea.value.split('\n')
            .map(p => p.trim().toLowerCase()) // Guardar en minúsculas
            .filter(p => p.length > 0);
        
        // Eliminar duplicados
        const palabrasUnicas = [...new Set(palabras)];

        chrome.storage.sync.set({ diccionarioPersonal: palabrasUnicas }, () => {
            statusDiv.textContent = '¡Diccionario guardado con éxito!';
            statusDiv.style.opacity = '1';
            setTimeout(() => {
                statusDiv.style.opacity = '0';
            }, 2000);
        });
    });
});