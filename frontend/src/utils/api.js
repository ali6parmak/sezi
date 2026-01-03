// API utility for handling requests in both dev and production modes

const API_BASE = import.meta.env.DEV 
  ? '/api'  // In dev, Vite proxy handles this
  : 'http://localhost:51735/api'  // In production (Electron), connect directly

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(error.detail || 'Request failed')
  }
  
  return response.json()
}

export async function uploadFile(endpoint, file) {
  const url = `${API_BASE}${endpoint}`
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await fetch(url, {
    method: 'POST',
    body: formData
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(error.detail || 'Upload failed')
  }
  
  return response.json()
}

export { API_BASE }

