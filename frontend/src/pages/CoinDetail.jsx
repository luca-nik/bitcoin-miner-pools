import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { fetchJSON } from '../api.js';
import ZoomableAreaChart from '../components/ZoomableAreaChart.jsx';

const POOL_LOGO_BASE = 'https://raw.githubusercontent.com/mempool/mining-pool-logos/master/';

const TERMINAL_POOL_COLORS = [
  '#33ff00', '#ffb000', '#33ff33', '#ff9900', '#66ff66',
  '#ffcc00', '#00ff66', '#99ff33', '#b3ffb3', '#cccc00',
  '#88ff00', '#ff6600', '#44ff44', '#ddaa00',
];

const fmtHashrate = (h) => {
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  return `${(h / 1e12).toFixed(1)} TH/s`;
};

function corrColor(r) {
  if (r >= 0.5) return 'text-term-fg';
  if (r >= 0) return 'text-term-bright';
  if (r >= -0.5) return 'text-term-red';
  return 'text-term-red';
}

const fadeUp = { initial: { opacity: 0 }, animate: { opacity: 1 } };

export default function CoinDetail() {
  const { coinId } = useParams();
  const [data, setData] = useState(null);
  const [vsAvg, setVsAvg] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharedRange, setSharedRange] = useState(null);

  useEffect(() => {
    setLoading(true);
    setSharedRange(null);
    Promise.all([
      fetchJSON(`/api/coin-detail/${coinId}`),
      fetchJSON(`/api/coin-vs-avg/${coinId}`),
    ])
      .then(([d, avgData]) => {
        setData(d);
        setVsAvg(avgData.points ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [coinId]);

  const handleSyncedRangeChange = useCallback((newRange, sourceData) => {
    if (!sourceData?.length) return;
    const startPct = newRange[0] / sourceData.length;
    const endPct = newRange[1] / sourceData.length;
    setSharedRange({ startPct, endPct });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent" />
    </div>
  );
  if (!data) return <p className="text-term-muted text-center py-20">Coin not found</p>;

  const getExternalRange = (d) => {
    if (!sharedRange || !d?.length) return undefined;
    const startIdx = Math.round(sharedRange.startPct * d.length);
    const endIdx = Math.round(sharedRange.endPct * d.length);
    return [Math.max(0, startIdx), Math.min(d.length - 1, endIdx)];
  };

  const correlations = data.correlations;
  const poolSeries = data.poolSeries;
  const corrMap = {};
  for (const c of correlations) corrMap[c.pool_slug] = c;

  const topCorr = correlations.length > 0
    ? correlations.reduce((a, b) => Math.abs(a.correlation) > Math.abs(b.correlation) ? a : b)
    : null;

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.div {...fadeUp} className="flex items-center gap-3 text-sm">
        <Link to="/coins" className="text-term-fg hover:text-term-fg transition-colors">&larr; Coins</Link>
      </motion.div>

      {/* Coin header */}
      <motion.div {...fadeUp} className="terminal-window p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-term-dim border border-term-muted p-1.5 flex items-center justify-center flex-shrink-0">
            {data.logo ? (
              <img src={data.logo} alt={data.coinName} className="w-full h-full object-contain rounded-full" />
            ) : (
              <span className="text-3xl font-bold term-glow-amber">{data.symbol?.[0] ?? '?'}</span>
            )}
          </div>
          <h2 className="text-2xl font-bold term-glow">
            {data.coinName}
            <span className="text-term-gray text-lg ml-2">{data.symbol}</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
          <div>
            <p className="text-term-muted text-sm">Tracked Pools</p>
            <p className="text-xl font-mono mt-1">{correlations.length}</p>
          </div>
          <div>
            <p className="text-term-muted text-sm">Strongest Correlation</p>
            {topCorr ? (
              <div className="mt-1">
                <Link to={`/pair/${topCorr.pool_slug}/${coinId}`}
                  className="text-xl font-mono hover:text-term-fg transition-colors">
                  <span className={corrColor(topCorr.correlation)}>r = {topCorr.correlation?.toFixed(4)}</span>
                  <span className="text-term-gray text-sm ml-2">({topCorr.pool_name})</span>
                </Link>
              </div>
            ) : <p className="text-xl font-mono mt-1">-</p>}
          </div>
        </div>
      </motion.div>

      {/* Intelligence Panel: Radar + Avg Hashrate vs Coin Price */}
      {(correlations.length > 0 || vsAvg.length > 0) && (
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="terminal-window p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-term-fg" />
            <h3 className="text-sm sm:text-lg font-semibold tracking-wide uppercase text-term-muted">
              Intelligence Briefing
            </h3>
            <span className="text-term-muted text-xs font-mono ml-2">{data.coinName}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Left: Radar correlation profile */}
            {correlations.length > 0 && (
              <div className="lg:col-span-2 flex flex-col items-center">
                <p className="text-xs text-term-gray uppercase tracking-wider mb-3">POOL CORRELATION PROFILE</p>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={correlations.map((c) => {
                      const short = c.pool_name.length > 8 ? c.pool_name.slice(0, 7) + '.' : c.pool_name;
                      return { pool: short, correlation: c.correlation ?? 0 };
                    })}
                    margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                  >
                    <PolarGrid stroke="#1f521f" />
                    <PolarAngleAxis
                      dataKey="pool"
                      tick={({ x, y, payload }) => {
                        const c = correlations.find((cr) => {
                          const short = cr.pool_name.length > 8 ? cr.pool_name.slice(0, 7) + '.' : cr.pool_name;
                          return short === payload.value;
                        });
                        const color = c?.correlation >= 0 ? '#33ff00' : '#ff4444';
                        return (
                          <g>
                            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={10} fontWeight={600}>
                              {payload.value}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[-1, 1]}
                      tick={{ fill: '#1f521f', fontSize: 8 }}
                      tickCount={5}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #1f521f',
                        fontSize: 12,
                        fontFamily: '"JetBrains Mono", monospace',
                        color: '#33ff00',
                      }}
                      formatter={(v) => v.toFixed(4)}
                    />
                    <Radar
                      name="Correlation"
                      dataKey="correlation"
                      stroke="#33ff00"
                      fill="#33ff00"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#33ff00', stroke: '#0a0a0a', strokeWidth: 2 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Right: Avg Hashrate vs Coin Price */}
            {vsAvg.length > 0 && (
              <div className={correlations.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <p className="text-xs text-term-gray uppercase tracking-wider mb-3">
                  AVG HASHRATE VS {data.symbol} PRICE
                </p>
                <ZoomableAreaChart
                  data={vsAvg}
                  height={300}
                  leftAxis={{ color: '#33ff00', formatter: fmtHashrate }}
                  rightAxis={{ color: '#ffffff', formatter: (v) => `$${v.toLocaleString()}` }}
                  series={[
                    { dataKey: 'hashrate', color: '#33ff00', name: 'Avg Pool Hashrate', yAxisId: 'left' },
                    { dataKey: 'price', color: '#ffffff', name: `${data.coinName} Price`, yAxisId: 'right' },
                  ]}
                  externalRange={getExternalRange(vsAvg)}
                  onRangeChange={handleSyncedRangeChange}
                  source="Hashrate: blockchain.info | Price: CoinGecko"
                />
              </div>
            )}
          </div>

          {/* Per-pool mini charts grid */}
          {poolSeries.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-term-fg" />
                <p className="text-xs text-term-gray uppercase tracking-wider">POOL HASHRATE MATRIX</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {poolSeries.map((pool, idx) => {
                  const c = corrMap[pool.slug];
                  const color = TERMINAL_POOL_COLORS[idx % TERMINAL_POOL_COLORS.length];

                  return (
                    <motion.div key={pool.slug} initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}
                      className="bg-term-dim border border-term-muted p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <img src={`${POOL_LOGO_BASE}${pool.slug}.svg`} alt={pool.name}
                            className="w-3.5 h-3.5"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                          <span className="text-xs font-semibold" style={{ color }}>{pool.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[10px] ${corrColor(c?.correlation)}`}>
                            r={c?.correlation?.toFixed(3) ?? 'N/A'}
                          </span>
                          <Link to={`/pair/${pool.slug}/${coinId}`} className="text-term-muted hover:text-term-fg transition-colors">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </Link>
                        </div>
                      </div>
                      <ZoomableAreaChart
                        data={pool.points}
                        height={140}
                        leftAxis={{ color, formatter: (v) => v >= 1e15 ? `${(v/1e15).toFixed(0)}P` : `${(v/1e12).toFixed(0)}T` }}
                        rightAxis={{ color: '#ffffff', formatter: (v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v.toFixed(0)}` }}
                        series={[
                          { dataKey: 'hashrate', color, name: `${pool.name} Hashrate`, yAxisId: 'left' },
                          { dataKey: 'price', color: '#ffffff', name: `${data.symbol} Price`, yAxisId: 'right' },
                        ]}
                        externalRange={getExternalRange(pool.points)}
                        onRangeChange={handleSyncedRangeChange}
                        source="blockchain.info / CoinGecko"
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Per-pool correlation list */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
        <h3 className="text-sm sm:text-lg font-semibold mb-3">Pool Correlations</h3>
        <div className="space-y-2">
          {correlations.map((c, i) => (
            <motion.div key={c.pool_slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}>
              <Link to={`/pair/${c.pool_slug}/${coinId}`}
                className="flex justify-between items-center py-3 px-4 border border-term-muted hover:border-term-fg transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-term-dim border border-term-muted p-1 flex items-center justify-center">
                    <img src={`${POOL_LOGO_BASE}${c.pool_slug}.svg`} alt={c.pool_name}
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <span className="text-term-muted group-hover:text-white transition-colors font-medium">
                    {c.pool_name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-term-gray text-xs font-mono">{c.sample_count} pts</span>
                  <span className={`font-mono text-sm ${corrColor(c.correlation)}`}>
                    r = {c.correlation?.toFixed(4) ?? 'N/A'}
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
