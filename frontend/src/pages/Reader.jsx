import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Settings,
  Maximize,
  Minimize,
  Type,
  List,
  BookOpen,
  Timer,
  FileText
} from 'lucide-react'
import { useDocument } from '../hooks/useDocuments'
import { useSettings } from '../context/SettingsContext'
import SettingsModal from '../components/SettingsModal'
import '../styles/Reader.css'

export default function Reader() {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { document: doc, loading, error, saveProgress, updateStats } = useDocument(documentId)
  const { settings } = useSettings()

  // Reading state
  const [mode, setMode] = useState('word') // 'word', 'sentence', or 'page'
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [speed, setSpeed] = useState(settings.reading_speed)
  const [showPageInput, setShowPageInput] = useState(false)
  const [pageInputValue, setPageInputValue] = useState('')

  // Timer refs
  const timerRef = useRef(null)
  const sessionStartRef = useRef(null)
  const wordsReadRef = useRef(0)
  
  // Refs for tracking latest position (for cleanup/unmount saves)
  const latestPositionRef = useRef({ page: 1, index: 0, mode: 'word' })
  const progressBarRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  // Get current content based on mode
  const getCurrentContent = useCallback(() => {
    if (!doc?.document?.pages) return []
    const page = doc.document.pages[currentPage - 1]
    if (!page) return []
    if (mode === 'word') return page.words
    if (mode === 'sentence') return page.sentences
    // For 'page' mode, return the full page text as a single item array
    return [page.text]
  }, [doc, currentPage, mode])

  const content = getCurrentContent()
  const currentItem = content[currentIndex] || ''
  const totalPages = doc?.document?.total_pages || 1

  // Calculate progress
  const pageProgress = content.length > 0 
    ? Math.round((currentIndex / content.length) * 100) 
    : 0
  
  const overallProgress = doc?.stats?.total_words 
    ? Math.round((calculateTotalPosition() / doc.stats.total_words) * 100)
    : 0

  function calculateTotalPosition() {
    if (!doc?.document?.pages) return 0
    let total = 0
    for (let i = 0; i < currentPage - 1; i++) {
      total += doc.document.pages[i].words.length
    }
    total += currentIndex
    return total
  }

  // Load saved progress - convert absolute position back to page/index
  useEffect(() => {
    if (doc?.info && doc?.document?.pages) {
      const savedPage = doc.info.current_page || 1
      const savedAbsolutePosition = doc.info.current_position || 0
      const savedMode = doc.info.reading_mode || 'word'
      
      // Convert absolute position to page-specific index
      let cumulative = 0
      let targetPage = 1
      let targetIndex = 0
      
      for (let i = 0; i < doc.document.pages.length; i++) {
        const pageWords = doc.document.pages[i].words.length
        if (cumulative + pageWords > savedAbsolutePosition) {
          targetPage = i + 1
          targetIndex = savedAbsolutePosition - cumulative
          break
        }
        cumulative += pageWords
        if (i === doc.document.pages.length - 1) {
          // If we've gone past all pages, set to last position
          targetPage = doc.document.pages.length
          targetIndex = pageWords - 1
        }
      }
      
      // For fresh start (position 0), find first page with content
      if (savedAbsolutePosition === 0) {
        // Find first page that has words
        const firstPageWithContent = doc.document.pages.findIndex(page => page.words.length > 0)
        if (firstPageWithContent !== -1) {
          targetPage = firstPageWithContent + 1
        } else {
          targetPage = savedPage
        }
        targetIndex = 0
      }
      
      setCurrentPage(targetPage)
      setCurrentIndex(Math.max(0, targetIndex))
      setMode(savedMode)
    }
  }, [doc])

  // Update speed when settings change
  useEffect(() => {
    setSpeed(settings.reading_speed)
  }, [settings.reading_speed])

  // Auto-play logic
  useEffect(() => {
    // If current page has no content, find next page with content
    if (isPlaying && content.length === 0 && doc?.document?.pages) {
      for (let i = currentPage; i < doc.document.pages.length; i++) {
        if (doc.document.pages[i].words.length > 0) {
          setCurrentPage(i + 1)
          setCurrentIndex(0)
          return
        }
      }
      // No more content, stop playing
      setIsPlaying(false)
      return
    }

    if (isPlaying && content.length > 0) {
      // Calculate interval based on WPM and mode
      const baseInterval = 60000 / speed // ms per word at given WPM
      let interval
      if (mode === 'page') {
        // For page mode, calculate based on word count of the page
        const pageWordCount = currentItem.split(/\s+/).length || 1
        interval = baseInterval * pageWordCount
      } else if (mode === 'sentence') {
        interval = baseInterval * (currentItem.split(' ').length || 1) * 0.8 // Sentences need more time
      } else {
        interval = baseInterval
      }

      timerRef.current = setTimeout(() => {
        if (currentIndex < content.length - 1) {
          setCurrentIndex(prev => prev + 1)
          wordsReadRef.current += mode === 'word' ? 1 : (currentItem.split(' ').length || 1)
        } else if (currentPage < totalPages) {
          // Find next page with content
          let nextPage = currentPage + 1
          for (let i = currentPage; i < doc.document.pages.length; i++) {
            if (doc.document.pages[i].words.length > 0) {
              nextPage = i + 1
              break
            }
          }
          setCurrentPage(nextPage)
          setCurrentIndex(0)
          if (mode === 'page') {
            const pageWordCount = doc?.document?.pages[currentPage - 1]?.words?.length || 0
            wordsReadRef.current += pageWordCount
          }
        } else {
          // End of document
          setIsPlaying(false)
          saveProgress(currentPage, currentIndex, mode, true)
        }
      }, interval)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [isPlaying, currentIndex, currentPage, content, mode, speed, currentItem, totalPages, doc])

  // Calculate absolute position (total words read across all pages)
  const getAbsolutePosition = useCallback(() => {
    if (!doc?.document?.pages) return 0
    let total = 0
    for (let i = 0; i < currentPage - 1; i++) {
      total += doc.document.pages[i].words.length
    }
    total += currentIndex
    return total
  }, [doc, currentPage, currentIndex])

  // Keep track of latest position for unmount save
  useEffect(() => {
    latestPositionRef.current = { 
      page: currentPage, 
      index: currentIndex, 
      mode,
      absolutePosition: getAbsolutePosition()
    }
  }, [currentPage, currentIndex, mode, getAbsolutePosition])

  // Save progress with debounce on any position change
  useEffect(() => {
    if (!doc?.info?.id) return
    
    const debounceTimer = setTimeout(() => {
      // Save absolute position for accurate progress display on home page
      saveProgress(currentPage, getAbsolutePosition(), mode)
    }, 1000) // Save 1 second after last change
    
    return () => clearTimeout(debounceTimer)
  }, [currentPage, currentIndex, mode, doc, getAbsolutePosition])

  // Also save periodically, on visibility change, and on unmount
  useEffect(() => {
    if (!doc?.info?.id) return

    const apiBase = import.meta.env.DEV ? '/api' : 'http://localhost:8000/api'
    
    const saveCurrentPosition = () => {
      const { page, absolutePosition, mode: latestMode } = latestPositionRef.current
      const data = JSON.stringify({
        document_id: parseInt(doc.info.id),
        current_page: page,
        current_position: absolutePosition,
        reading_mode: latestMode,
        completed: false
      })
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${apiBase}/progress`, new Blob([data], { type: 'application/json' }))
      }
    }

    // Save when tab becomes hidden (user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentPosition()
      }
    }

    // Save before page unload (closing browser/tab)
    const handleBeforeUnload = () => {
      saveCurrentPosition()
    }

    const saveInterval = setInterval(() => {
      const { absolutePosition } = latestPositionRef.current
      saveProgress(currentPage, absolutePosition, mode)
    }, 10000) // Periodic save every 10 seconds as backup

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Save progress when leaving the page
    return () => {
      clearInterval(saveInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      saveCurrentPosition()
    }
  }, [doc])

  // Track session stats
  useEffect(() => {
    if (isPlaying && !sessionStartRef.current) {
      sessionStartRef.current = Date.now()
    }

    return () => {
      if (sessionStartRef.current && wordsReadRef.current > 0) {
        const sessionDuration = Math.round((Date.now() - sessionStartRef.current) / 1000)
        updateStats(wordsReadRef.current, sessionDuration)
        sessionStartRef.current = null
        wordsReadRef.current = 0
      }
    }
  }, [isPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showSettings) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          setIsPlaying(prev => !prev)
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlePrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          handleNext()
          break
        case 'ArrowUp':
          e.preventDefault()
          setSpeed(prev => Math.min(prev + 25, 800))
          break
        case 'ArrowDown':
          e.preventDefault()
          setSpeed(prev => Math.max(prev - 25, 50))
          break
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false)
            document.exitFullscreen?.()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSettings, isFullscreen])

  // Fullscreen handling
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Helper to find next page with content
  const findNextPageWithContent = (fromPage) => {
    if (!doc?.document?.pages) return fromPage
    for (let i = fromPage; i < doc.document.pages.length; i++) {
      if (doc.document.pages[i].words.length > 0) {
        return i + 1
      }
    }
    return fromPage // No content found, stay on current
  }

  // Helper to find previous page with content
  const findPrevPageWithContent = (fromPage) => {
    if (!doc?.document?.pages) return fromPage
    for (let i = fromPage - 2; i >= 0; i--) {
      if (doc.document.pages[i].words.length > 0) {
        return i + 1
      }
    }
    return fromPage // No content found, stay on current
  }

  // Navigation handlers
  const handlePrevious = () => {
    setIsPlaying(false)
    if (mode === 'page') {
      // In page mode, previous goes to previous page with content
      if (currentPage > 1) {
        const prevPage = findPrevPageWithContent(currentPage)
        setCurrentPage(prevPage)
        setCurrentIndex(0)
      }
    } else if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    } else if (currentPage > 1) {
      // Find previous page with content
      const prevPage = findPrevPageWithContent(currentPage)
      setCurrentPage(prevPage)
      // Will set to last index of previous page after content updates
      const prevPageContent = mode === 'word' 
        ? doc.document.pages[prevPage - 1].words 
        : doc.document.pages[prevPage - 1].sentences
      setCurrentIndex(Math.max(0, prevPageContent.length - 1))
    }
  }

  const handleNext = () => {
    if (mode === 'page') {
      // In page mode, next goes to next page with content
      if (currentPage < totalPages) {
        const nextPage = findNextPageWithContent(currentPage)
        setCurrentPage(nextPage)
        setCurrentIndex(0)
      }
    } else if (currentIndex < content.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else if (currentPage < totalPages) {
      // Find next page with content
      const nextPage = findNextPageWithContent(currentPage)
      setCurrentPage(nextPage)
      setCurrentIndex(0)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setIsPlaying(false)
      const prevPage = findPrevPageWithContent(currentPage)
      setCurrentPage(prevPage)
      setCurrentIndex(0)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setIsPlaying(false)
      const nextPage = findNextPageWithContent(currentPage)
      setCurrentPage(nextPage)
      setCurrentIndex(0)
    }
  }

  // Go to specific page
  const handleGoToPage = (e) => {
    e.preventDefault()
    const pageNum = parseInt(pageInputValue)
    if (pageNum >= 1 && pageNum <= totalPages) {
      setIsPlaying(false)
      setCurrentPage(pageNum)
      setCurrentIndex(0)
      setShowPageInput(false)
      setPageInputValue('')
    }
  }

  // Handle progress bar position update (for both click and drag)
  const updateProgressFromPosition = useCallback((clientX) => {
    if (!doc?.document?.pages || !progressBarRef.current) return
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const percentage = clickX / rect.width
    
    // Calculate total words and target position
    const totalWords = doc.stats?.total_words || 0
    const targetPosition = Math.floor(percentage * totalWords)
    
    // Find which page and index this corresponds to
    let cumulative = 0
    for (let i = 0; i < doc.document.pages.length; i++) {
      const pageWords = doc.document.pages[i].words.length
      if (cumulative + pageWords > targetPosition) {
        setIsPlaying(false)
        setCurrentPage(i + 1)
        // For page mode, always index 0; for word mode, set exact index; for sentence mode, estimate
        if (mode === 'page') {
          setCurrentIndex(0)
        } else if (mode === 'word') {
          setCurrentIndex(Math.min(targetPosition - cumulative, pageWords - 1))
        } else {
          const sentenceCount = doc.document.pages[i].sentences.length
          const pageProgress = (targetPosition - cumulative) / pageWords
          setCurrentIndex(Math.min(Math.floor(pageProgress * sentenceCount), sentenceCount - 1))
        }
        break
      }
      cumulative += pageWords
    }
  }, [doc, mode])

  // Handle progress bar click
  const handleProgressClick = (e) => {
    updateProgressFromPosition(e.clientX)
  }

  // Handle progress bar drag start
  const handleProgressDragStart = (e) => {
    e.preventDefault()
    setIsDragging(true)
    setIsPlaying(false)
    updateProgressFromPosition(e.clientX)
  }

  // Handle progress bar drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e) => {
      updateProgressFromPosition(e.clientX)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    // Handle touch events
    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        updateProgressFromPosition(e.touches[0].clientX)
      }
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, updateProgressFromPosition])

  // Handle back navigation with save
  const handleBack = async () => {
    // Save current position before leaving (using absolute position)
    await saveProgress(currentPage, getAbsolutePosition(), mode)
    navigate('/')
  }

  // Get bionic reading parts - with trailing punctuation separated for visibility
  const getBionicParts = (word) => {
    if (!word) return { highlighted: '', rest: '', punctuation: '' }
    
    // Extract trailing punctuation (periods, question marks, exclamation marks, etc.)
    const punctuationMatch = word.match(/([.!?;:,]+)$/)
    const punctuation = punctuationMatch ? punctuationMatch[1] : ''
    const cleanWord = punctuation ? word.slice(0, -punctuation.length) : word
    
    const length = cleanWord.length
    
    if (length === 0) return { highlighted: '', rest: '', punctuation }
    if (length === 1) return { highlighted: cleanWord, rest: '', punctuation }
    if (length === 2) return { highlighted: cleanWord[0], rest: cleanWord[1], punctuation }
    if (length === 3) return { highlighted: cleanWord.slice(0, 2), rest: cleanWord.slice(2), punctuation }
    
    const highlightLen = Math.max(1, Math.ceil(length * 0.45))
    return {
      highlighted: cleanWord.slice(0, highlightLen),
      rest: cleanWord.slice(highlightLen),
      punctuation
    }
  }

  // Render bionic text
  const renderBionicText = (text) => {
    const words = text.split(/\s+/)
    return (
      <span className="bionic-text">
        {words.map((word, idx) => {
          const { highlighted, rest, punctuation } = getBionicParts(word)
          return (
            <span key={idx} className="bionic-word">
              <span className="bionic-highlight">{highlighted}</span>
              <span className="bionic-rest">{rest}</span>
              {punctuation && <span className="bionic-punctuation">{punctuation}</span>}
              {idx < words.length - 1 && ' '}
            </span>
          )
        })}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="reader-loading">
        <div className="spinner"></div>
        <p>Loading document...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="reader-error">
        <h2>Error loading document</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Go Back
        </button>
      </div>
    )
  }

  // Estimated time remaining
  const wordsRemaining = (doc?.stats?.total_words || 0) - calculateTotalPosition()
  const minutesRemaining = Math.ceil(wordsRemaining / speed)

  return (
    <div 
      className={`reader page ${isFullscreen ? 'fullscreen' : ''}`}
      style={{
        '--reading-font': settings.font_family,
        '--reading-size': `${settings.font_size}px`,
        '--reading-color': settings.font_color,
        '--reading-bg': settings.background_color,
        '--highlight-color': settings.highlight_color
      }}
    >
      {/* Header */}
      <header className={`reader-header ${isPlaying ? 'hidden' : ''}`}>
        <button className="btn btn-ghost" onClick={handleBack}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>

        <div className="header-title">
          <h1>{doc?.document?.file_name}</h1>
        </div>

        <div className="header-actions">
          <button 
            className="btn btn-ghost btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={20} />
          </button>
          <button 
            className="btn btn-ghost btn-icon"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </header>

      {/* Main Reading Area */}
      <main className="reader-main">
        <div 
          className="reading-display"
          onClick={() => setIsPlaying(prev => !prev)}
        >
          <div className={`reading-content ${mode === 'page' ? 'page-mode' : ''}`}>
            {mode === 'word' ? (
              renderBionicText(currentItem)
            ) : mode === 'sentence' ? (
              <span className="sentence-text">
                {renderBionicText(currentItem)}
              </span>
            ) : (
              <div className="page-text">
                {renderBionicText(currentItem)}
              </div>
            )}
          </div>

          {/* Click hint */}
          {!isPlaying && currentIndex === 0 && currentPage === 1 && (
            <motion.div 
              className="reading-hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Press <kbd>Space</kbd> or click to start
            </motion.div>
          )}
        </div>

        {/* Progress indicator - clickable and draggable */}
        <div className="progress-indicator">
          <div 
            ref={progressBarRef}
            className={`progress-bar-container interactive ${isDragging ? 'dragging' : ''}`}
            onClick={handleProgressClick}
            onMouseDown={handleProgressDragStart}
            onTouchStart={(e) => {
              e.preventDefault()
              setIsDragging(true)
              setIsPlaying(false)
              if (e.touches.length > 0) {
                updateProgressFromPosition(e.touches[0].clientX)
              }
            }}
            title="Click or drag to jump to position"
          >
            <div 
              className="progress-bar-fill"
              style={{ width: `${overallProgress}%` }}
            />
            <div 
              className="progress-bar-thumb"
              style={{ left: `${overallProgress}%` }}
            />
          </div>
        </div>
      </main>

      {/* Controls */}
      <footer className={`reader-controls ${isPlaying && isFullscreen ? 'hidden' : ''}`}>
        <div className="controls-container">
          {/* Mode Toggle */}
          <div className="control-group mode-toggle">
            <button
              className={`mode-btn ${mode === 'word' ? 'active' : ''}`}
              onClick={() => { setMode('word'); setCurrentIndex(0); setIsPlaying(false); }}
            >
              <Type size={18} />
              <span>Words</span>
            </button>
            <button
              className={`mode-btn ${mode === 'sentence' ? 'active' : ''}`}
              onClick={() => { setMode('sentence'); setCurrentIndex(0); setIsPlaying(false); }}
            >
              <List size={18} />
              <span>Sentences</span>
            </button>
            <button
              className={`mode-btn ${mode === 'page' ? 'active' : ''}`}
              onClick={() => { setMode('page'); setCurrentIndex(0); setIsPlaying(false); }}
            >
              <FileText size={18} />
              <span>Pages</span>
            </button>
          </div>

          {/* Playback Controls */}
          <div className="control-group playback-controls">
            <button 
              className="btn btn-ghost btn-icon"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              title="Previous Page"
            >
              <ChevronLeft size={24} />
            </button>
            
            <button 
              className="btn btn-ghost btn-icon"
              onClick={handlePrevious}
              disabled={mode === 'page' ? currentPage <= 1 : (currentIndex <= 0 && currentPage <= 1)}
              title={mode === 'page' ? 'Previous Page' : 'Previous'}
            >
              <SkipBack size={20} />
            </button>

            <button 
              className="btn btn-primary play-btn"
              onClick={() => setIsPlaying(prev => !prev)}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} />}
            </button>

            <button 
              className="btn btn-ghost btn-icon"
              onClick={handleNext}
              disabled={mode === 'page' ? currentPage >= totalPages : (currentIndex >= content.length - 1 && currentPage >= totalPages)}
              title={mode === 'page' ? 'Next Page' : 'Next'}
            >
              <SkipForward size={20} />
            </button>

            <button 
              className="btn btn-ghost btn-icon"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              title="Next Page"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Speed Control */}
          <div className="control-group speed-control">
            <label>
              <Timer size={16} />
              <span>{speed} WPM</span>
            </label>
            <input
              type="range"
              min="50"
              max="800"
              step="25"
              value={speed}
              onChange={(e) => setSpeed(parseInt(e.target.value))}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-item page-selector">
            {showPageInput ? (
              <form onSubmit={handleGoToPage} className="page-input-form">
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(e) => setPageInputValue(e.target.value)}
                  placeholder={currentPage.toString()}
                  autoFocus
                  onBlur={() => { setShowPageInput(false); setPageInputValue(''); }}
                  className="page-input"
                />
                <span>/ {totalPages}</span>
              </form>
            ) : (
              <button 
                className="page-btn"
                onClick={() => setShowPageInput(true)}
                title="Click to go to page"
              >
                <BookOpen size={14} />
                <span>Page {currentPage} of {totalPages}</span>
              </button>
            )}
          </div>
          <div className="status-item">
            {mode === 'page' ? (
              <span>{doc?.document?.pages[currentPage - 1]?.words?.length || 0} words on this page</span>
            ) : (
              <span>{mode === 'word' ? 'Word' : 'Sentence'} {currentIndex + 1} of {content.length}</span>
            )}
          </div>
          <div className="status-item">
            <Timer size={14} />
            <span>~{minutesRemaining} min remaining</span>
          </div>
          <div className="status-item progress-percent">
            {overallProgress}% complete
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  )
}

