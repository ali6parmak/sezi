import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  FileText, 
  Clock, 
  Trash2, 
  BookOpen,
  Zap,
  Settings,
  Upload,
  Heart
} from 'lucide-react'
import { useDocuments } from '../hooks/useDocuments'
import { useSettings } from '../context/SettingsContext'
import SettingsModal from '../components/SettingsModal'
import '../styles/Home.css'

export default function Home() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const { documents, loading, uploadDocument, deleteDocument } = useDocuments()
  const { settings } = useSettings()
  
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a PDF file')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const result = await uploadDocument(file)
      navigate(`/read/${result.document_id}`)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    // SQLite returns timestamps without timezone, treat as UTC
    // Append 'Z' if not present to indicate UTC
    const utcDateString = dateString.endsWith('Z') ? dateString : dateString + 'Z'
    const date = new Date(utcDateString)
    const now = new Date()
    const diff = now - date
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    
    return date.toLocaleDateString()
  }

  const getProgress = (doc) => {
    if (!doc.total_words || !doc.current_position) return 0
    const progress = (doc.current_position / doc.total_words) * 100
    // Show at least "<1%" if there's any progress (to indicate reading has started)
    if (progress > 0 && progress < 1) return '<1'
    return Math.round(progress)
  }

  const getProgressDisplay = (doc) => {
    const progress = getProgress(doc)
    if (doc.completed) return 'Completed'
    if (progress === '<1') return '<1%'
    return `${progress}%`
  }

  const getProgressValue = (doc) => {
    if (!doc.total_words || !doc.current_position) return 0
    return (doc.current_position / doc.total_words) * 100
  }

  return (
    <div className="home page">
      {/* Header */}
      <header className="home-header">
        <div className="container">
          <div className="header-content">
            <motion.div 
              className="logo"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="logo-icon">
                <Zap size={28} />
              </div>
              <div className="logo-text">
                <h1>Sezi</h1>
                <span>Speed Reading for PDFs</span>
              </div>
            </motion.div>

            <div className="header-actions">
              <motion.button 
                className="btn btn-ghost btn-icon donate-btn"
                onClick={() => navigate('/donate')}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                title="Support Sezi"
              >
                <Heart size={20} />
              </motion.button>
              <motion.button 
                className="btn btn-ghost btn-icon"
                onClick={() => setShowSettings(true)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                title="Settings"
              >
                <Settings size={22} />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        <div className="container">
          {/* Upload Section */}
          <motion.section 
            className="upload-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div 
              className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".pdf"
                onChange={handleInputChange}
                hidden
              />
              
              {uploading ? (
                <div className="upload-loading">
                  <div className="spinner"></div>
                  <p>Processing PDF...</p>
                </div>
              ) : (
                <>
                  <div className="upload-icon">
                    <Plus size={32} />
                  </div>
                  <h3>Open a PDF Document</h3>
                  <p>Click to browse or drag and drop</p>
                </>
              )}
            </div>

            <AnimatePresence>
              {uploadError && (
                <motion.div 
                  className="upload-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {uploadError}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* Recent Documents */}
          <motion.section 
            className="documents-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="section-header">
              <h2>
                <Clock size={20} />
                Recent Documents
              </h2>
            </div>

            {loading ? (
              <div className="documents-loading">
                <div className="spinner"></div>
              </div>
            ) : documents.length === 0 ? (
              <div className="documents-empty">
                <FileText size={48} strokeWidth={1} />
                <p>No documents yet</p>
                <span>Upload a PDF to get started</span>
              </div>
            ) : (
              <div className="documents-grid">
                <AnimatePresence>
                  {documents.map((doc, index) => (
                    <motion.article 
                      key={doc.id}
                      className="document-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => navigate(`/read/${doc.id}`)}
                    >
                      <div className="doc-icon">
                        <BookOpen size={24} />
                      </div>
                      
                      <div className="doc-info">
                        <h3 className="doc-title" title={doc.file_name}>
                          {doc.file_name}
                        </h3>
                        <div className="doc-meta">
                          <span>{doc.total_pages} pages</span>
                          <span>•</span>
                          <span>{doc.total_words?.toLocaleString()} words</span>
                          {doc.current_page && doc.current_page > 1 && (
                            <>
                              <span>•</span>
                              <span className="current-page">Page {doc.current_page}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="doc-progress">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: `${Math.max(getProgressValue(doc), 1)}%` }}
                          />
                        </div>
                        <span className="progress-text">
                          {getProgressDisplay(doc)}
                        </span>
                      </div>

                      <div className="doc-footer">
                        <span className="doc-date">
                          {formatDate(doc.last_opened)}
                        </span>
                        <button 
                          className="btn btn-ghost btn-icon doc-delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteDocument(doc.id)
                          }}
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.section>

          {/* Features */}
          <motion.section 
            className="features-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">⚡</div>
                <h3>Speed Reading</h3>
                <p>Read faster without moving your eyes across lines</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">👁️</div>
                <h3>Bionic Reading</h3>
                <p>Highlighted word parts guide your eyes naturally</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💾</div>
                <h3>Auto-Save</h3>
                <p>Your progress is saved automatically</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🎨</div>
                <h3>Customizable</h3>
                <p>Adjust fonts, colors, and speed to your preference</p>
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  )
}

