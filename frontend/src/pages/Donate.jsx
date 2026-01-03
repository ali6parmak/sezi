import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  Heart, 
  Coffee, 
  Copy, 
  Check, 
  ExternalLink,
  Sparkles,
  Code,
  Zap
} from 'lucide-react'
import '../styles/Donate.css'

const TRON_WALLET = 'TDXAb11RgvPygUta726B2gJCytKvGbYasG'

export default function Donate() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(TRON_WALLET)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="donate page">
      <header className="donate-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
      </header>

      <main className="donate-main">
        <motion.div 
          className="donate-hero"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="hero-icon">
            <Heart className="heart-icon" />
          </div>
          <h1>Support Sezi</h1>
          <p className="hero-subtitle">
            Sezi is free and open source. Your support helps keep the project alive and growing.
          </p>
        </motion.div>

        <motion.div 
          className="donate-content"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Why Donate */}
          <section className="donate-section why-donate">
            <h2>Why Donate?</h2>
            <div className="reasons-grid">
              <div className="reason-card">
                <Coffee className="reason-icon" />
                <h3>Fuel Development</h3>
                <p>Support ongoing development and new features</p>
              </div>
              <div className="reason-card">
                <Code className="reason-icon" />
                <h3>Keep It Free</h3>
                <p>Help keep Sezi free for everyone</p>
              </div>
              <div className="reason-card">
                <Zap className="reason-icon" />
                <h3>Faster Updates</h3>
                <p>Enable more frequent updates and improvements</p>
              </div>
            </div>
          </section>

          {/* Crypto Donation */}
          <section className="donate-section crypto-section">
            <div className="crypto-header">
              <Sparkles className="crypto-icon" />
              <h2>Donate with Crypto</h2>
            </div>
            
            <div className="wallet-card">
              <div className="wallet-type">
                <img 
                  src="https://cryptologos.cc/logos/tron-trx-logo.svg" 
                  alt="TRON" 
                  className="crypto-logo"
                />
                <span className="wallet-name">TRON (TRX)</span>
              </div>
              
              <div className="wallet-address-container">
                <code className="wallet-address">{TRON_WALLET}</code>
                <button 
                  className={`copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  title="Copy address"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              <div className="qr-section">
                <div className="qr-placeholder">
                  {/* QR Code - using a simple text representation */}
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${TRON_WALLET}&bgcolor=0f172a&color=f97316`}
                    alt="TRON Wallet QR Code"
                    className="qr-code"
                  />
                </div>
                <p className="qr-hint">Scan with your wallet app</p>
              </div>

              <div className="supported-tokens">
                <span className="supported-label">Accepted tokens:</span>
                <span className="token-badge">TRX</span>
                <span className="token-badge">USDT</span>
                <span className="token-badge">USDC</span>
                <span className="token-badge">Any TRC-20</span>
              </div>
            </div>
          </section>

          {/* Thank You Message */}
          <section className="donate-section thank-you">
            <motion.div 
              className="thank-you-card"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Heart className="thank-icon" />
              <h3>Thank You!</h3>
              <p>
                Every donation, big or small, makes a difference. 
                Your support means the world to me and helps make Sezi better for everyone.
              </p>
              <p className="signature">— Ali</p>
            </motion.div>
          </section>

          {/* Other Ways to Support */}
          <section className="donate-section other-ways">
            <h2>Other Ways to Support</h2>
            <div className="support-options">
              <a 
                href="https://github.com/ali6parmak/sezi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="support-link"
              >
                <span>⭐ Star on GitHub</span>
                <ExternalLink size={14} />
              </a>
              <a 
                href="https://github.com/ali6parmak/sezi/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="support-link"
              >
                <span>🐛 Report bugs & suggest features</span>
                <ExternalLink size={14} />
              </a>
              <a 
                href="https://github.com/ali6parmak/sezi" 
                target="_blank" 
                rel="noopener noreferrer"
                className="support-link"
              >
                <span>📢 Share with friends</span>
                <ExternalLink size={14} />
              </a>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  )
}

