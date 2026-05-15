import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJSON } from '../api.js';

const fadeUp = { initial: { opacity: 0 }, animate: { opacity: 1 } };

export default function Coins() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJSON('/api/coins').then(setCoins).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent" />
    </div>
  );

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.h2 {...fadeUp} className="text-2xl font-bold term-glow tracking-widest">CRYPTOCURRENCIES</motion.h2>

      <motion.div {...fadeUp}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {coins.map((coin, i) => (
          <motion.div key={coin.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.03 * i }}>
            <div className="terminal-window p-5 flex flex-col items-center gap-3 text-center group relative">
              {coin.url && (
                <a href={coin.url} target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-2 right-2 text-term-muted hover:text-term-fg transition-colors opacity-0 group-hover:opacity-100"
                  title={`Visit ${coin.name}`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              )}
              <Link to={`/coin/${coin.id}`} className="contents">
                <div className="w-14 h-14 bg-term-dim border border-term-muted p-1.5 flex items-center justify-center group-hover:border-term-fg transition-colors">
                  {coin.logo ? (
                    <img src={coin.logo} alt={coin.name} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-2xl font-bold text-term-fg">{coin.symbol?.[0] ?? '?'}</span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm group-hover:text-term-fg transition-colors">
                    {coin.name}
                    <span className="text-term-gray ml-1.5 text-xs">{coin.symbol}</span>
                  </p>
                  <p className="text-term-muted text-xs font-mono mt-1">
                    {coin.price_usd != null ? `$${coin.price_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                  </p>
                </div>
              </Link>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
