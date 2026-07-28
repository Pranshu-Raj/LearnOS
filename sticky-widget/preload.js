const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetAPI', {
  getVaultTopics: () => ipcRenderer.invoke('get-vault-topics'),
  updateTopicFrontmatter: (filename, updates) => ipcRenderer.invoke('update-topic-frontmatter', { filename, updates }),
  triggerReplan: () => ipcRenderer.invoke('trigger-replan'),
  closeApp: () => ipcRenderer.invoke('close-app'),
  minimizeApp: () => ipcRenderer.invoke('minimize-app')
});
