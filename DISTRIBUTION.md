# Sezi - Distribution & Release Guide

This guide covers how to release Sezi as an open source project and distribute it as a standalone application.

---

## 📦 Open Source Release (GitHub)

### 1. Prepare Your Repository

```bash
# Initialize git (if not already done)
cd sezi
git init

# Add all files
git add .
git commit -m "Initial commit: Sezi speed reading application"
```

### 2. Push to GitHub

```bash
git remote add origin https://github.com/ali6parmak/sezi.git
git branch -M main
git push -u origin main
```

---

## 🖥️ Desktop Application (Standalone)

### Option 1: Electron Wrapper (Recommended for cross-platform)

The project already includes an Electron wrapper that bundles both frontend and backend.

```bash
# Install dependencies
npm install

# Build for your platform
npm run build:win   # Windows
npm run build:mac   # macOS  
npm run build:linux # Linux
```

### Option 2: Tauri (Smaller, Rust-based)

Tauri creates much smaller binaries than Electron:

```bash
# Install Tauri CLI
cargo install tauri-cli

# Initialize Tauri in your project
npm create tauri-app
```

### Option 3: PyInstaller + Static Frontend

Bundle the Python backend with PyInstaller and serve the frontend statically:

```bash
# Install PyInstaller
pip install pyinstaller

# Build the frontend
cd frontend
npm run build

# Create a single-file executable
cd ../backend
pyinstaller --onefile --add-data "../frontend/dist:frontend" main.py
```

---

## 🐳 Docker Distribution

### Dockerfile

Create `Dockerfile`:

```dockerfile
# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build final image
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port
EXPOSE 8000

# Start server
CMD ["python", "backend/main.py"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  sezi:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - sezi-data:/app/backend/data
    restart: unless-stopped

volumes:
  sezi-data:
```

### Build and Run

```bash
# Build
docker build -t sezi .

# Run
docker run -p 8000:8000 -v sezi-data:/app/backend/data sezi

# Or with docker-compose
docker-compose up -d
```

---

## 📱 Web Deployment (Cloud)

### Vercel + Railway/Render

1. **Frontend on Vercel:**
   ```bash
   cd frontend
   npm i -g vercel
   vercel
   ```

2. **Backend on Railway/Render:**
   - Connect your GitHub repo
   - Set build command: `pip install -r requirements.txt`
   - Set start command: `python main.py`
   - Set environment variables as needed

### Self-hosted (VPS)

```bash
# On your server
git clone https://github.com/ali6parmak/sezi.git
cd sezi

# Setup backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Setup frontend
cd ../frontend
npm install
npm run build

# Run with PM2 or systemd
pm2 start "cd backend && python main.py" --name sezi-backend
pm2 start "cd frontend && npm run preview" --name sezi-frontend
```

---

## 🏷️ Creating Releases

### GitHub Releases

1. Tag your version:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```

2. The GitHub Actions workflow will automatically:
   - Build for Windows, macOS, and Linux
   - Create a release with all installers attached

### Manual Release

If you need to create a release manually:

1. Go to GitHub → Releases → "Create a new release"
2. Upload built binaries from the `release/` directory

---

## 📋 Checklist Before Release

- [ ] Update version number in `package.json`
- [ ] Update `README.md` with latest features
- [ ] Test on Windows, macOS, and Linux
- [ ] Create screenshots/demo GIF for README
- [ ] Write changelog for the release
- [ ] Test the Docker build
- [ ] Verify all dependencies are correctly specified

---

## 🎯 Recommended Release Strategy

1. **Start with GitHub** - Get community feedback
2. **Add Docker support** - Easy for self-hosters
3. **Create Electron app** - For desktop users who want a native experience
4. **Optional: Publish to package managers** - Homebrew, AUR, Chocolatey

Good luck with your release! 🚀
