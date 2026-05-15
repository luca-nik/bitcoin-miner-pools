import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJSON } from '../api.js';

const TERMINAL_COLORS = ['#33ff00', '#ffb000', '#33ff33', '#ff3333', '#b3ffb3', '#ff9900', '#66ff66', '#ffcc00', '#00ff66', '#99ff33', '#88ff00', '#ff6600', '#44ff44', '#ddaa00'];

const fmtHashrate = (h) => {
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  return `${(h / 1e12).toFixed(1)} TH/s`;
};

const fadeUp = { initial: { opacity: 0 }, animate: { opacity: 1 } };

export default function Pools() {
  const [allPools, setAllPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchJSON('/api/pools/all').then(setAllPools).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent" />
    </div>
  );

  const totalHashrate = allPools.reduce((s, p) => s + (p.avg_hashrate || 0), 0);

  const poolSegments = allPools
    .filter((p) => p.avg_hashrate > 0)
    .slice(0, 10)
    .map((p) => ({
      name: p.name,
      slug: p.slug,
      value: p.avg_hashrate,
      pct: totalHashrate > 0 ? (p.avg_hashrate / totalHashrate) * 100 : 0,
    }));

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.h2 {...fadeUp} className="text-3xl font-bold term-glow">MINING POOLS</motion.h2>

      {/* Hashrate distribution — single stacked bar */}
      {totalHashrate > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="terminal-window p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold term-glow">HASHRATE DISTRIBUTION</h3>
            <span className="text-term-muted text-xs font-mono">TOTAL: {fmtHashrate(totalHashrate)}</span>
          </div>

          {/* Single stacked bar */}
          <div className="w-full h-10 flex overflow-hidden border border-term-muted">
            {poolSegments.map((seg, i) => (
              <button
                key={seg.slug}
                className="h-full relative group transition-opacity hover:opacity-80"
                style={{ width: `${seg.pct}%`, backgroundColor: TERMINAL_COLORS[i % TERMINAL_COLORS.length] }}
                onClick={() => navigate(`/pool/${seg.slug}`)}
                title={`${seg.name}: ${seg.pct.toFixed(1)}% (${fmtHashrate(seg.value)})`}
              >
                {seg.pct >= 6 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-term-bg font-mono truncate px-1">
                    {seg.pct.toFixed(1)}%
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {poolSegments.map((seg, i) => (
              <button
                key={seg.slug}
                onClick={() => navigate(`/pool/${seg.slug}`)}
                className="flex items-center gap-1.5 text-xs text-term-gray hover:text-term-fg transition-colors font-mono cursor-pointer"
              >
                <span className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: TERMINAL_COLORS[i % TERMINAL_COLORS.length] }} />
                {seg.name}
                <span className="text-term-muted">{seg.pct.toFixed(1)}%</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active pool cards (with chart data) */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <h3 className="text-lg font-semibold mb-3 term-glow">ACTIVE POOLS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {allPools.filter((p) => p.has_correlations).map((pool, i) => {
            const pct = totalHashrate > 0 ? ((pool.avg_hashrate || 0) / totalHashrate) * 100 : 0;
            return (
              <motion.div key={pool.slug}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + 0.05 * i }}>
                <div className="terminal-window p-5 flex flex-col items-center gap-3 text-center group relative">
                  {pool.url && (
                    <a href={pool.url} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-2 right-2 text-term-muted hover:text-term-fg transition-colors opacity-0 group-hover:opacity-100"
                      title={`Visit ${pool.name}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  )}
                  <Link to={`/pool/${pool.slug}`} className="contents">
                    <div className="w-14 h-14 bg-term-dim border border-term-muted p-2 flex items-center justify-center group-hover:bg-term-dim transition-colors">
                      <img src={pool.logo} alt={pool.name} className="w-full h-full object-contain"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                      <div style={{ display: 'none' }}
                        className="w-full h-full items-center justify-center text-2xl font-bold text-term-fg">
                        {pool.name.charAt(0)}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm group-hover:text-term-fg transition-colors">{pool.name}</p>
                      <p className="text-term-muted text-xs font-mono mt-1">
                        {pool.avg_hashrate ? fmtHashrate(pool.avg_hashrate) : '-'}
                      </p>
                      <p className="text-term-gray text-[10px] font-mono mt-0.5">
                        {pct.toFixed(1)}% of total
                      </p>
                    </div>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Inactive pools (no chart data) */}
      {allPools.filter((p) => !p.has_correlations).length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
          <h3 className="text-lg font-semibold mb-3 text-term-gray">{`{ } HISTORICAL POOLS -- NO RECENT DATA`}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allPools.filter((p) => !p.has_correlations).map((pool, i) => {
              const pct = totalHashrate > 0 ? ((pool.avg_hashrate || 0) / totalHashrate) * 100 : 0;
              return (
                <motion.div key={pool.slug}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 + 0.03 * i }}>
                  <div className="terminal-window p-5 flex flex-col items-center gap-3 text-center opacity-50 relative">
                    {pool.url && (
                      <a href={pool.url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-2 right-2 text-term-muted hover:text-term-fg transition-colors opacity-0 group-hover:opacity-100"
                        title={`Visit ${pool.name}`}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    )}
                    <div className="w-14 h-14 bg-term-dim border border-term-muted p-2 flex items-center justify-center">
                      <img src={pool.logo} alt={pool.name} className="w-full h-full object-contain opacity-50"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                      <div style={{ display: 'none' }}
                        className="w-full h-full items-center justify-center text-2xl font-bold text-term-gray">
                        {pool.name.charAt(0)}
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-term-gray">{pool.name}</p>
                      <p className="text-term-muted text-xs font-mono mt-1">
                        {pool.avg_hashrate ? fmtHashrate(pool.avg_hashrate) : '-'}
                      </p>
                      <p className="text-term-muted text-[10px] font-mono mt-0.5">
                        {pct.toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
