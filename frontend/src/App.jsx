import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Reader from './pages/Reader'
import Donate from './pages/Donate'
import { SettingsProvider } from './context/SettingsContext'

function App() {
  return (
    <SettingsProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/read/:documentId" element={<Reader />} />
          <Route path="/donate" element={<Donate />} />
        </Routes>
      </div>
    </SettingsProvider>
  )
}

export default App

