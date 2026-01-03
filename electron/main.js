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

// Find Python executable on the system
function findPython() {
  const isWin = process.platform === 'win32'
  
  // Try different Python commands
  const commands = isWin
    ? [
        { cmd: 'py', args: ['-3', '--version'] },
        { cmd: 'python', args: ['--version'] },
        { cmd: 'python3', args: ['--version'] }
      ]
    : [
        { cmd: 'python3', args: ['--version'] },
        { cmd: 'python', args: ['--version'] }
      ]
  
  for (const { cmd, args } of commands) {
    try {
      const fullCmd = `${cmd} ${args.join(' ')}`
      console.log('Trying:', fullCmd)
      const result = execSync(fullCmd, { 
        encoding: 'utf8', 
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
        windowsHide: true
      })
      console.log('Result:', result.trim())
      if (result.includes('Python 3')) {
        // For 'py -3', we return 'py' and handle the -3 flag separately
        return { cmd, needsFlag: cmd === 'py' }
      }
    } catch (e) {
      console.log('Failed:', cmd, e.message)
      continue
    }
  }
  return null
}

// Check Python version
function checkPythonVersion(pythonInfo) {
  try {
    const versionCmd = pythonInfo.needsFlag 
      ? `${pythonInfo.cmd} -3 --version`
      : `${pythonInfo.cmd} --version`
    
    const result = execSync(versionCmd, { 
      encoding: 'utf8',
      timeout: 10000,
      windowsHide: true
    })
    const match = result.match(/Python (\d+)\.(\d+)/)
    if (match) {
      const major = parseInt(match[1])
      const minor = parseInt(match[2])
      return major === 3 && minor >= 9
    }
  } catch (e) {
    console.error('Version check failed:', e.message)
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
async function setupRuntime(pythonInfo) {
  const sourcePath = getBackendSourcePath()
  const runtimePath = getRuntimePath()
  const venvPath = path.join(runtimePath, 'venv')
  const setupMarker = path.join(runtimePath, '.setup-complete-v3')
  const isWin = process.platform === 'win32'

  // In dev mode, assume venv is already set up
  if (isDev) {
    return path.join(venvPath, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')
  }

  const pythonExe = path.join(venvPath, isWin ? 'Scripts' : 'bin', isWin ? 'python.exe' : 'python')

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
    // Build the venv command based on platform and python type
    let venvCmd
    if (pythonInfo.needsFlag) {
      venvCmd = `${pythonInfo.cmd} -3 -m venv "${venvPath}"`
    } else {
      venvCmd = `"${pythonInfo.cmd}" -m venv "${venvPath}"`
    }
    
    console.log('Creating venv with:', venvCmd)
    execSync(venvCmd, { 
      cwd: runtimePath,
      stdio: 'pipe',
      timeout: 120000,
      windowsHide: true
    })
  } catch (e) {
    console.error('Failed to create venv:', e.message)
    throw new Error(`Failed to create Python environment: ${e.message}`)
  }

  // Get pip path
  const pipExe = isWin ? 'pip.exe' : 'pip'
  const pipPath = path.join(venvPath, isWin ? 'Scripts' : 'bin', pipExe)

  // Verify pip exists
  if (!fs.existsSync(pipPath)) {
    throw new Error(`Pip not found at: ${pipPath}`)
  }

  // Install dependencies
  updateSplashStatus('Installing dependencies (this may take a minute)...')
  try {
    const reqPath = path.join(runtimePath, 'requirements.txt')
    const pipCmd = `"${pipPath}" install --no-cache-dir -r "${reqPath}"`
    console.log('Installing deps with:', pipCmd)
    
    execSync(pipCmd, {
      cwd: runtimePath,
      stdio: 'pipe',
      timeout: 600000,
      windowsHide: true,
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

// Check if backend is ready using http module
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

  const env = { 
    ...process.env, 
    PYTHONUNBUFFERED: '1',
    PYTHONDONTWRITEBYTECODE: '1',
    SEZI_PORT: BACKEND_PORT.toString()
  }

  backendProcess = spawn(pythonExe, ['main.py'], {
    cwd: runtimePath,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    windowsHide: true
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

// Get the frontend path
function getFrontendPath() {
  if (isDev) {
    return null
  }
  
  const possiblePaths = [
    path.join(__dirname, '..', 'frontend', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app', 'frontend', 'dist', 'index.html'),
    path.join(app.getAppPath(), 'frontend', 'dist', 'index.html')
  ]
  
  for (const p of possiblePaths) {
    console.log('Checking frontend path:', p)
    if (fs.existsSync(p)) {
      console.log('Found frontend at:', p)
      return p
    }
  }
  
  console.log('App path:', app.getAppPath())
  console.log('__dirname:', __dirname)
  console.log('resourcesPath:', process.resourcesPath)
  
  return possiblePaths[0]
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
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false
    },
    backgroundColor: '#0a0e17',
    show: false
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL)
  })

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading')
  })

  if (isDev || process.env.SEZI_DEBUG) {
    mainWindow.webContents.openDevTools()
  }

  if (isDev) {
    console.log('Loading dev server: http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
  } else {
    const frontendPath = getFrontendPath()
    console.log('Loading frontend from:', frontendPath)
    
    if (!fs.existsSync(frontendPath)) {
      console.error('Frontend file not found:', frontendPath)
      dialog.showErrorBox('Error', `Frontend not found at: ${frontendPath}`)
      app.quit()
      return
    }
    
    mainWindow.loadFile(frontendPath)
  }

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show')
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow.show()
  })

  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('Forcing window show after timeout')
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
        splashWindow = null
      }
      mainWindow.show()
    }
  }, 5000)

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
    if (process.platform === 'win32') {
      // On Windows, use taskkill to ensure child processes are killed
      try {
        execSync(`taskkill /pid ${backendProcess.pid} /T /F`, { windowsHide: true })
      } catch (e) {
        backendProcess.kill()
      }
    } else {
      backendProcess.kill()
    }
    backendProcess = null
  }
}

// Main startup sequence
async function startApp() {
  createSplashWindow()
  
  try {
    updateSplashStatus('Checking Python installation...')
    const pythonInfo = findPython()
    
    if (!pythonInfo) {
      throw new Error(
        'Python 3.9+ is required but not found.\n\n' +
        'Please install Python from https://python.org\n' +
        'Make sure to check "Add Python to PATH" during installation.'
      )
    }

    if (!checkPythonVersion(pythonInfo)) {
      throw new Error(
        'Python 3.9 or higher is required.\n\n' +
        'Please update Python from https://python.org'
      )
    }

    const pythonExe = await setupRuntime(pythonInfo)

    updateSplashStatus('Starting backend server...')
    startBackend(pythonExe)

    updateSplashStatus('Waiting for server to be ready...')
    const backendReady = await waitForBackend(60)
    
    if (!backendReady) {
      throw new Error(
        'Backend server failed to start.\n\n' +
        'Please ensure no other application is using port ' + BACKEND_PORT
      )
    }

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

// Disable hardware acceleration before app is ready
app.disableHardwareAcceleration()

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
