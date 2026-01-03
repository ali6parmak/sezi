const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let mainWindow
let backendProcess
const isDev = process.env.NODE_ENV === 'development'

// Get the path to Python and the backend
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend')
  }
  // In production, backend is in resources
  return path.join(process.resourcesPath, 'backend')
}

function getPythonPath() {
  // Try to find Python
  const pythonCommands = process.platform === 'win32' 
    ? ['python', 'python3', 'py']
    : ['python3', 'python']
  
  return pythonCommands[0] // Will be validated when starting
}

function startBackend() {
  const backendPath = getBackendPath()
  const pythonPath = getPythonPath()
  
  console.log('Starting backend from:', backendPath)
  
  // Check if we're using bundled Python (for production)
  const venvPython = process.platform === 'win32'
    ? path.join(backendPath, 'venv', 'Scripts', 'python.exe')
    : path.join(backendPath, 'venv', 'bin', 'python')
  
  const pythonExecutable = fs.existsSync(venvPython) ? venvPython : pythonPath
  
  backendProcess = spawn(pythonExecutable, ['main.py'], {
    cwd: backendPath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.error(`Backend Error: ${data}`)
  })

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err)
    dialog.showErrorBox(
      'Backend Error',
      `Failed to start the backend server.\n\nPlease ensure Python is installed.\n\nError: ${err.message}`
    )
  })

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Sezi',
    icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0a0e17',
    show: false // Don't show until ready
  })

  // Remove menu bar
  mainWindow.setMenuBarVisibility(false)

  // Wait for backend to be ready
  const checkBackend = async () => {
    try {
      const response = await fetch('http://localhost:8000/')
      if (response.ok) {
        // Backend is ready, load the app
        if (isDev) {
          mainWindow.loadURL('http://localhost:5173')
        } else {
          mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
        }
        mainWindow.show()
      } else {
        setTimeout(checkBackend, 500)
      }
    } catch (err) {
      setTimeout(checkBackend, 500)
    }
  }

  // Start checking after a short delay
  setTimeout(checkBackend, 1000)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// App lifecycle
app.whenReady().then(() => {
  startBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Kill backend process
  if (backendProcess) {
    backendProcess.kill()
  }
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill()
  }
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  dialog.showErrorBox('Error', error.message)
})

