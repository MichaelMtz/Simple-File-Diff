'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only surface the renderer is allowed to touch. No direct fs / node access.
contextBridge.exposeInMainWorld('fileDiff', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  compareFolders: (left, right) => ipcRenderer.invoke('fs:compareFolders', left, right),
  join: (root, rel) => ipcRenderer.invoke('fs:join', root, rel),
});
