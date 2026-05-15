import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Dashboard from './pages/Dashboard.jsx'
import Correlations from './pages/Correlations.jsx'
import Pools from './pages/Pools.jsx'
import Coins from './pages/Coins.jsx'
import Analysis from './pages/Analysis.jsx'
import PoolDetail from './pages/PoolDetail.jsx'
import CoinDetail from './pages/CoinDetail.jsx'
import PairChart from './pages/PairChart.jsx'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/pools', label: 'Pools' },
  { to: '/coins', label: 'Coins' },
  { to: '/analysis', label: 'Analysis' },
]

const linkClass = ({ isActive }) =>
  `px-3 py-1.5 text-xs uppercase tracking-wider transition-all duration-150 ${
    isActive
      ? 'bg-term-fg text-term-bg font-bold'
      : 'text-term-fg hover:bg-term-fg hover:text-term-bg'
  }`

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-term-bg text-term-fg font-mono">
      <div className="crt-overlay" />

      <nav className="sticky top-0 z-50 bg-term-bg border-b border-term-muted px-4 sm:px-6 py-3 flex items-center justify-between">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm font-bold tracking-widest term-glow"
        >
          {'>'} BTC_POOL_CORR
        </motion.h1>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-4">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-term-fg p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden bg-term-bg border-b border-term-muted overflow-hidden z-40"
          >
            <div className="flex flex-col px-4 py-2 gap-1">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={linkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pools" element={<Pools />} />
          <Route path="/coins" element={<Coins />} />
          <Route path="/correlations" element={<Correlations />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/pool/:slug" element={<PoolDetail />} />
          <Route path="/coin/:coinId" element={<CoinDetail />} />
          <Route path="/pair/:poolSlug/:coinId" element={<PairChart />} />
        </Routes>
      </main>
    </div>
  )
}
