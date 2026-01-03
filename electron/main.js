const { app, BrowserWindow, dialog, shell } = require('electron')
const { spawn, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const http = require('http')

let mainWindow
let backendProcess
let splashWindow
const isDev = process.env.NODE_ENV === 'development'

// Use a non-common port to avoid conflicts
const BACKEND_PORT = 51735
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`

// Get user data path for storing venv and data
function getUserDataPath() {
  return app.getPath('userData')
}

// Get the path to the backend source
function getBackendSourcePath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend')
  }
  return path.join(process.resourcesPath, 'backend')
}

// Get the path where we'll set up the runtime environment
function getRuntimePath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend')
  }
  return path.join(getUserDataPath(), 'backend')
}

// Find Python executable
function findPython() {
  const commands = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python']
  
  for (const cmd of commands) {
    try {
      const result = execSync(`${cmd} --version`, { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })
      if (result.includes('Python 3')) {
        return cmd
      }
    } catch (e) {
      continue
    }
  }
  return null
}

// Check Python version
function checkPythonVersion(pythonCmd) {
  try {
    const result = execSync(`${pythonCmd} --version`, { 
      encoding: 'utf8',
      timeout: 5000
    })
    const match = result.match(/Python (\d+)\.(\d+)/)
    if (match) {
      const major = parseInt(match[1])
      const minor = parseInt(match[2])
      return major === 3 && minor >= 9
    }
  } catch (e) {
    return false
  }
  return false
}

// Create splash/loading window
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0a0e17 0%, #1a2332 100%);
          color: #e2e8f0;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          overflow: hidden;
        }
        .logo {
          font-size: 48px;
          font-weight: bold;
          background: linear-gradient(135deg, #f97316, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 24px;
        }
        .status {
          font-size: 14px;
          color: #94a3b8;
          margin-bottom: 16px;
          text-align: center;
          padding: 0 20px;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #1e293b;
          border-top-color: #f97316;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="logo">Sezi</div>
      <div class="status" id="status">Starting...</div>
      <div class="spinner"></div>
      <script>
        const { ipcRenderer } = require('electron')
        ipcRenderer.on('status', (e, msg) => {
          document.getElementById('status').textContent = msg
        })
      </script>
    </body>
    </html>
  `

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHTML)}`)
}

function updateSplashStatus(message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status', message)
  }
  console.log('Status:', message)
}

// Setup the runtime environment
async function setupRuntime(pythonCmd) {
  const sourcePath = getBackendSourcePath()
  const runtimePath = getRuntimePath()
  const venvPath = path.join(runtimePath, 'venv')
  const setupMarker = path.join(runtimePath, '.setup-complete-v2')

  // In dev mode, assume venv is already set up
  if (isDev) {
    return path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin', 
      process.platform === 'win32' ? 'python.exe' : 'python')
  }

  const pythonExe = path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin', 
    process.platform === 'win32' ? 'python.exe' : 'python')

  // Check if already set up
  if (fs.existsSync(setupMarker) && fs.existsSync(pythonExe)) {
    console.log('Runtime already set up')
    return pythonExe
  }

  updateSplashStatus('Setting up environment...')

  // Create runtime directory
  if (!fs.existsSync(runtimePath)) {
    fs.mkdirSync(runtimePath, { recursive: true })
  }

  // Copy backend files
  updateSplashStatus('Copying application files...')
  copyDirSync(sourcePath, runtimePath, ['venv', '__pycache__', 'data', '.pyc'])

  // Create data directory
  const dataPath = path.join(runtimePath, 'data', 'uploads')
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }

  // Create virtual environment
  updateSplashStatus('Creating Python environment...')
  try {
    execSync(`"${pythonCmd}" -m venv "${venvPath}"`, { 
      cwd: runtimePath,
      stdio: 'pipe',
      timeout: 120000
    })
  } catch (e) {
    console.error('Failed to create venv:', e.message)
    throw new Error(`Failed to create Python environment: ${e.message}`)
  }

  // Get pip path
  const pipPath = path.join(venvPath, process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'pip.exe' : 'pip')

  // Install dependencies
  updateSplashStatus('Installing dependencies (this may take a minute)...')
  try {
    const reqPath = path.join(runtimePath, 'requirements.txt')
    execSync(`"${pipPath}" install --no-cache-dir -r "${reqPath}"`, {
      cwd: runtimePath,
      stdio: 'pipe',
      timeout: 600000,
      env: { ...process.env, PIP_DISABLE_PIP_VERSION_CHECK: '1' }
    })
  } catch (e) {
    console.error('Failed to install dependencies:', e.message)
    throw new Error(`Failed to install dependencies: ${e.message}`)
  }

  // Mark setup as complete
  fs.writeFileSync(setupMarker, new Date().toISOString())
  
  return pythonExe
}

// Recursive copy directory
function copyDirSync(src, dest, excludes = []) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    if (excludes.some(ex => entry.name === ex || entry.name.endsWith(ex))) {
      continue
    }

    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, excludes)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

// Check if backend is ready using http module (more reliable than fetch in Electron)
function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${BACKEND_URL}/`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// Wait for backend to be ready
async function waitForBackend(maxAttempts = 60) {
  console.log('Waiting for backend to be ready...')
  
  for (let i = 0; i < maxAttempts; i++) {
    const isReady = await checkBackendHealth()
    if (isReady) {
      console.log(`Backend ready after ${i + 1} attempts`)
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log('Backend failed to respond after', maxAttempts, 'attempts')
  return false
}

// Start the backend server
function startBackend(pythonExe) {
  const runtimePath = getRuntimePath()
  
  console.log('Starting backend with Python:', pythonExe)
  console.log('Working directory:', runtimePath)
  console.log('Backend URL:', BACKEND_URL)

  // Set environment variable for port
  const env = { 
    ...process.env, 
    PYTHONUNBUFFERED: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    SEZI_PORT: BACKEND_PORT.toString()
  }

  backendProcess = spawn(pythonExe, ['main.py'], {
    cwd: runtimePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend: ${data.toString().trim()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.log(`Backend: ${data.toString().trim()}`)
  })

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend process:', err)
  })

  backendProcess.on('close', (code) => {
    console.log(`Backend exited with code ${code}`)
    backendProcess = null
  })

  return backendProcess
}

// Create main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Sezi',
    icon: path.join(__dirname, '..', 'build-resources', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0a0e17',
    show: false
  })

  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// Cleanup function
function cleanup() {
  if (backendProcess) {
    console.log('Killing backend process...')
    backendProcess.kill()
    backendProcess = null
  }
}

// Main startup sequence
async function startApp() {
  createSplashWindow()
  
  try {
    // Find Python
    updateSplashStatus('Checking Python installation...')
    const pythonCmd = findPython()
    
    if (!pythonCmd) {
      throw new Error(
        'Python 3.9+ is required but not found.\n\n' +
        'Please install Python from https://python.org\n' +
        'Make sure to check "Add Python to PATH" during installation.'
      )
    }

    if (!checkPythonVersion(pythonCmd)) {
      throw new Error(
        'Python 3.9 or higher is required.\n\n' +
        'Please update Python from https://python.org'
      )
    }

    // Setup runtime environment
    const pythonExe = await setupRuntime(pythonCmd)

    // Start backend
    updateSplashStatus('Starting backend server...')
    startBackend(pythonExe)

    // Wait for backend with status updates
    updateSplashStatus('Waiting for server to be ready...')
    const backendReady = await waitForBackend(60)
    
    if (!backendReady) {
      throw new Error(
        'Backend server failed to start.\n\n' +
        'Please ensure no other application is using port ' + BACKEND_PORT
      )
    }

    // Create main window
    updateSplashStatus('Loading application...')
    createMainWindow()

  } catch (error) {
    console.error('Startup error:', error)
    
    cleanup()
    
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }

    dialog.showErrorBox(
      'Sezi - Startup Error',
      error.message || 'An unexpected error occurred during startup.'
    )
    
    app.quit()
  }
}

// App lifecycle
app.whenReady().then(startApp)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startApp()
  }
})

app.on('window-all-closed', () => {
  cleanup()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', cleanup)
app.on('quit', cleanup)

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  cleanup()
  dialog.showErrorBox('Error', error.message)
})

process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
