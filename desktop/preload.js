const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('taskdrop', {
  getItems: () => ipcRenderer.invoke('checklist:get-items'),
  setCompleted: (id, completed) => ipcRenderer.invoke('checklist:set-completed', id, completed),
  clearCompleted: () => ipcRenderer.invoke('checklist:clear-completed'),
  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (enabled) => ipcRenderer.invoke('autostart:set', enabled),
  onItemsUpdated: (callback) => {
    const listener = (_event, items) => callback(items);
    ipcRenderer.on('checklist:items-updated', listener);
    return () => ipcRenderer.removeListener('checklist:items-updated', listener);
  },
  getOverlayItems: () => ipcRenderer.invoke('overlay:get-items'),
  completeOverlayItem: (id) => ipcRenderer.invoke('overlay:complete', id),
  onOverlayItemsUpdated: (callback) => {
    const listener = (_event, items) => callback(items);
    ipcRenderer.on('overlay:items-updated', listener);
    return () => ipcRenderer.removeListener('overlay:items-updated', listener);
  }
});
