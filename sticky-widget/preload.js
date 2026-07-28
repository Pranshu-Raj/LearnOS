const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getTopics: () => ipcRenderer.invoke('get-topics'),
    updateTopic: (filename, newFm) => ipcRenderer.invoke('update-topic', { filename, newFm }),
    closeApp: () => window.close() 
});
