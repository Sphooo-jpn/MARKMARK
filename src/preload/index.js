import { contextBridge, ipcRenderer } from 'electron'

/**
 * Minimal, safe API surface exposed to the renderer.
 * No Node primitives leak through; everything goes over IPC.
 */
const api = {
  // --- launch / open ---
  getLaunchFile: () => ipcRenderer.invoke('app:get-launch-file'),
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),

  // --- save ---
  saveFile: (path, content) => ipcRenderer.invoke('file:save', path, content),
  saveFileAs: (content, suggestedName) =>
    ipcRenderer.invoke('file:save-as', content, suggestedName),

  // --- window state ---
  setDirty: (dirty) => ipcRenderer.send('state:dirty', dirty),
  setTitle: (title) => ipcRenderer.send('state:title', title),
  forceClose: () => ipcRenderer.send('window:force-close'),

  // --- events from main ---
  onFileOpened: (cb) => {
    const listener = (_e, payload) => cb(payload)
    ipcRenderer.on('file:opened', listener)
    return () => ipcRenderer.removeListener('file:opened', listener)
  },
  onMenuAction: (cb) => {
    const listener = (_e, action) => cb(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  }
}

contextBridge.exposeInMainWorld('markmark', api)
