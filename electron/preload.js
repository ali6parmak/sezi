// Preload script for Electron
// This runs in a sandboxed environment with access to Node.js APIs

const { contextBridge } = require('electron')

// Expose protected methods that allow the renderer process to use
// specific features without exposing full Node.js APIs
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true
})

