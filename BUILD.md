# Building Sezi Desktop App

This guide will help you build Sezi as a standalone desktop application for Windows, macOS, and Linux.

## Prerequisites

### All Platforms
- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/)
- **Python 3.9+**: Download from [python.org](https://python.org/)
- **Git**: For cloning the repository

### Windows Additional Requirements
- **Visual Studio Build Tools**: For native dependencies
  ```powershell
  # Install with winget
  winget install Microsoft.VisualStudio.2022.BuildTools
  ```

### macOS Additional Requirements
- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```

### Linux Additional Requirements
- **Build essentials**:
  ```bash
  # Ubuntu/Debian
  sudo apt install build-essential rpm

  # Fedora
  sudo dnf install @development-tools rpm-build

  # Arch
  sudo pacman -S base-devel rpm-tools
  ```

---

## Quick Build (Recommended)

### 1. Clone and Setup

```bash
git clone https://github.com/ali6parmak/sezi.git
cd sezi

# Install root dependencies
npm install

# Setup frontend
cd frontend
npm install
cd ..

# Setup backend
cd backend
python -m venv venv

# Activate venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

### 2. Build for Your Platform

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# All platforms (requires multi-platform build tools)
npm run build:all
```

### 3. Find Your Installer

Built installers will be in the `release/` directory:

| Platform | File Type | Location |
|----------|-----------|----------|
| Windows | `.exe` (installer) | `release/Sezi Setup 1.0.0.exe` |
| Windows | `.exe` (portable) | `release/Sezi 1.0.0.exe` |
| macOS | `.dmg` | `release/Sezi-1.0.0.dmg` |
| Linux | `.AppImage` | `release/Sezi-1.0.0.AppImage` |
| Linux | `.deb` | `release/sezi_1.0.0_amd64.deb` |
| Linux | `.rpm` | `release/sezi-1.0.0.x86_64.rpm` |

---

## Detailed Build Steps

### Step 1: Prepare the Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates a production build in `frontend/dist/`.

### Step 2: Prepare the Backend

```bash
cd backend
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate     # Windows

pip install -r requirements.txt
cd ..
```

### Step 3: Install Electron Dependencies

```bash
npm install
```

### Step 4: Build the App

```bash
# For your current platform
npm run build

# Or specify platform
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

---

## Creating App Icons

For professional-looking installers, create icons in these formats:

### Icon Requirements

| Platform | Format | Size |
|----------|--------|------|
| Windows | `.ico` | 256x256 (multi-resolution) |
| macOS | `.icns` | 1024x1024 |
| Linux | `.png` | 512x512, 256x256, 128x128, etc. |

### Quick Icon Setup

1. Create a folder `build-resources/` in the project root
2. Add your icons:
   - `build-resources/icon.ico` (Windows)
   - `build-resources/icon.icns` (macOS)
   - `build-resources/icons/` folder with PNG files (Linux)

You can use online converters like [icoconvert.com](https://icoconvert.com/) to create these from a PNG.

---

## Troubleshooting

### "Python not found" error
Ensure Python is in your PATH:
```bash
# Check Python installation
python --version
# or
python3 --version
```

### Backend fails to start
The app needs Python with the required packages. Make sure:
1. Python 3.9+ is installed
2. The virtual environment has all dependencies:
   ```bash
   cd backend
   source venv/bin/activate
   pip install -r requirements.txt
   ```

### Windows: "electron-builder" fails
Install Visual Studio Build Tools:
```powershell
npm install --global windows-build-tools
```

### macOS: App is damaged / can't be opened
This happens with unsigned apps. Users can bypass with:
```bash
xattr -cr /Applications/Sezi.app
```

### Linux: AppImage won't run
Make it executable:
```bash
chmod +x Sezi-1.0.0.AppImage
./Sezi-1.0.0.AppImage
```

---

## Code Signing (Optional)

For distributing to users without security warnings:

### Windows
1. Get a code signing certificate from a CA (Comodo, DigiCert, etc.)
2. Add to `package.json`:
   ```json
   "build": {
     "win": {
       "certificateFile": "path/to/certificate.pfx",
       "certificatePassword": "your-password"
     }
   }
   ```

### macOS
1. Enroll in Apple Developer Program ($99/year)
2. Create a Developer ID certificate
3. Add to environment:
   ```bash
   export CSC_NAME="Developer ID Application: Your Name (XXXXXXXXXX)"
   ```

### Linux
Code signing is not required for Linux distributions.

---

## Distribution

### GitHub Releases
1. Create a new release on GitHub
2. Upload the installers from `release/`
3. Users can download the appropriate file for their OS

### Direct Download
Host the installers on your website and link to them.

### Package Managers (Advanced)

#### Windows - Chocolatey
Create a `.nuspec` file and submit to Chocolatey community.

#### macOS - Homebrew
Create a Cask formula and submit to homebrew-cask.

#### Linux - Package Repositories
Submit `.deb` to Ubuntu PPA or `.rpm` to COPR.

---

## Development Mode

For development with hot-reload:

```bash
# Terminal 1: Start backend
cd backend
source venv/bin/activate
python main.py

# Terminal 2: Start frontend dev server
cd frontend
npm run dev

# Terminal 3: Start Electron in dev mode
npm run dev
```

---

## Building Without Electron (Web Only)

If you just want to run as a web app:

```bash
# Backend
cd backend
source venv/bin/activate
python main.py

# Frontend (separate terminal)
cd frontend
npm run build
npm run preview  # Serves the built app
```

Then open `http://localhost:4173` in your browser.
