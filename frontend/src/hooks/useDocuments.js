import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../utils/api'

export function useDocuments() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/documents/recent?limit=10`)
      const data = await res.json()
      setDocuments(data.documents || [])
      setError(null)
    } catch (err) {
      setError('Failed to load documents')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const uploadDocument = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.detail || 'Upload failed')
    }

    const data = await res.json()
    await fetchDocuments() // Refresh list
    return data
  }

  const deleteDocument = async (documentId) => {
    await fetch(`${API_BASE}/documents/${documentId}`, {
      method: 'DELETE'
    })
    await fetchDocuments()
  }

  return {
    documents,
    loading,
    error,
    uploadDocument,
    deleteDocument,
    refresh: fetchDocuments
  }
}

export function useDocument(documentId) {
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!documentId) return

    const fetchDocument = async () => {
      try {
        setLoading(true)
        const res = await fetch(`${API_BASE}/documents/${documentId}`)
        
        if (!res.ok) {
          throw new Error('Document not found')
        }
        
        const data = await res.json()
        setDocument(data)
        setError(null)
      } catch (err) {
        setError(err.message)
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [documentId])

  const saveProgress = async (page, position, mode, completed = false) => {
    try {
      await fetch(`${API_BASE}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: parseInt(documentId),
          current_page: page,
          current_position: position,
          reading_mode: mode,
          completed
        })
      })
    } catch (err) {
      console.error('Failed to save progress:', err)
    }
  }

  const updateStats = async (wordsRead, timeSpent) => {
    try {
      await fetch(`${API_BASE}/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: parseInt(documentId),
          words_read: wordsRead,
          time_spent_seconds: timeSpent
        })
      })
    } catch (err) {
      console.error('Failed to update stats:', err)
    }
  }

  return {
    document,
    loading,
    error,
    saveProgress,
    updateStats
  }
}

