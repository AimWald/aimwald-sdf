'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('questWin', {
  close: () => ipcRenderer.send('close-quest-window')
});
