import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { fetchJSON, postJSON } from '../api.js';
import Pie3D from '../components/Pie3D.jsx';
import ZoomableAreaChart from '../components/ZoomableAreaChart.jsx';
import CorrelationHeatmap from '../components/CorrelationHeatmap.jsx';

const TERMINAL_COLORS = ['#33ff00', '#ffb000', '#33ff33', '#ff3333', '#b3ffb3', '#ff9900', '#66ff66', '#ffcc00', '#00ff66', '#99ff33'];

const coinNames = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', litecoin: 'LTC',
  cardano: 'ADA', polkadot: 'DOT', chainlink: 'LINK', 'avalanche-2': 'AVAX',
};

const fmtHashrate = (h) => {
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  return `${(h / 1e12).toFixed(1)} TH/s`;
};

const fadeUp = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState([]);
  const [pools, setPools] = useState([]);
  const [coins, setCoins] = useState([]);
  const [correlations, setCorrelations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetchJSON('/api/stats'),
      fetchJSON('/api/overview'),
      fetchJSON('/api/pools'),
      fetchJSON('/api/coins'),
      fetchJSON('/api/correlations'),
    ])
      .then(([s, o, p, c, corrs]) => { setStats(s); setOverview(o); setPools(p); setCoins(c); setCorrelations(corrs); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await postJSON('/api/refresh');
      const [s, o, p, c, corrs] = await Promise.all([
        fetchJSON('/api/stats'),
        fetchJSON('/api/overview'),
        fetchJSON('/api/pools'),
        fetchJSON('/api/coins'),
        fetchJSON('/api/correlations'),
      ]);
      setStats(s); setOverview(o); setPools(p); setCoins(c); setCorrelations(corrs);
    } catch (err) { console.error(err); }
    setRefreshing(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent" />
    </div>
  );

  if (!stats) return (
    <motion.div {...fadeUp} className="text-center py-20">
      <p className="text-term-muted mb-4">No data yet.</p>
      <button onClick={handleRefresh} disabled={refreshing}
        className="btn-bracket px-8 py-3 font-medium disabled:opacity-50 transition-all">
        {refreshing ? 'Fetching...' : 'Fetch All Data'}
      </button>
    </motion.div>
  );

  const pieData = stats.hashrateDistribution
    .filter((d) => d.avg_hashrate > 0)
    .slice(0, 10)
    .map((d) => ({ name: d.pool_name, slug: d.pool_slug, value: d.avg_hashrate }));

  const barData = stats.avgByCoin.map((d) => ({
    coin: coinNames[d.coin_id] ?? d.coin_id,
    avg: d.avg_corr,
  }));

  const highestCorr = stats.topPositive?.[0];
  const lowestCorr = stats.topNegative?.[0];

  return (
    <motion.div initial="initial" animate="animate" className="space-y-8">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between">
        <h2 className="text-3xl font-bold term-glow">DASHBOARD</h2>
        <button onClick={handleRefresh} disabled={refreshing}
          className="btn-bracket active px-5 py-2.5 text-sm font-medium disabled:opacity-50 transition-all">
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </motion.div>

      {/* Highest / Lowest Correlation Cards */}
      <motion.div {...fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {[
          { label: 'HIGHEST CORRELATION', data: highestCorr, colorClass: 'text-term-fg' },
          { label: 'LOWEST CORRELATION', data: lowestCorr, colorClass: 'text-term-red' },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="terminal-window p-6">
            <p className="text-term-muted text-sm">{card.label}</p>
            {card.data ? (
              <>
                <p className="text-2xl font-bold mt-2 font-mono">{card.data.pool_name} / {coinNames[card.data.coin_id] ?? card.data.coin_id}</p>
                <p className={`font-mono text-sm mt-1 ${card.colorClass}`}>r = {card.data.correlation?.toFixed(4)}</p>
              </>
            ) : (
              <p className="text-2xl font-bold mt-2 font-mono">-</p>
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Overview: Radar + Avg Hashrate vs Avg Crypto Price */}
      {(overview.length > 0 || (stats.avgByCoin?.length > 0)) && (
        <motion.div {...fadeUp} className="terminal-window p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 bg-term-fg" />
            <h3 className="text-sm sm:text-lg font-semibold tracking-wide uppercase text-gray-300">
              MARKET INTELLIGENCE
            </h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
            {/* Left: Radar avg correlation profile */}
            {stats.avgByCoin?.length > 0 && (
              <div className="lg:col-span-2 flex flex-col items-center">
                <p className="text-xs text-term-gray uppercase tracking-wider mb-3">AVG CORRELATION PROFILE</p>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={stats.avgByCoin.map((d) => ({
                      crypto: coinNames[d.coin_id] ?? d.coin_id,
                      correlation: d.avg_corr ?? 0,
                    }))}
                    margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                  >
                    <PolarGrid stroke="#1f521f" />
                    <PolarAngleAxis
                      dataKey="crypto"
                      tick={({ x, y, payload }) => {
                        const d = stats.avgByCoin.find((c) => (coinNames[c.coin_id] ?? c.coin_id) === payload.value);
                        const color = d?.avg_corr >= 0 ? '#33ff00' : '#ff3333';
                        return (
                          <g>
                            <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={11} fontWeight={600}>
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
                        borderRadius: 0,
                        fontSize: 12,
                        color: '#e5e7eb',
                      }}
                      formatter={(v) => v.toFixed(4)}
                    />
                    <Radar
                      name="Avg Correlation"
                      dataKey="correlation"
                      stroke="#33ff00"
                      fill="#33ff00"
                      fillOpacity={0.15}
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#33ff00', stroke: '#0e1726', strokeWidth: 2 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Right: Hashrate vs Avg Crypto Price */}
            {overview.length > 0 && (
              <div className={stats.avgByCoin?.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <p className="text-xs text-term-gray uppercase tracking-wider mb-3">
                  AVG HASHRATE VS AVG CRYPTO PRICE
                </p>
                <ZoomableAreaChart
                  data={overview}
                  height={300}
                  leftAxis={{ color: '#33ff00', formatter: fmtHashrate }}
                  rightAxis={{ color: '#ffb000', formatter: (v) => `$${v.toLocaleString()}` }}
                  series={[
                    { dataKey: 'hashrate', color: '#33ff00', name: 'Avg Hashrate', yAxisId: 'left' },
                    { dataKey: 'price', color: '#ffb000', name: 'Avg Crypto Price', yAxisId: 'right' },
                  ]}
                  source="Hashrate: blockchain.info | Prices: CoinGecko"
                />
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Pool Cards */}
      {pools.length > 0 && (
        <motion.div {...fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold term-glow">MINING POOLS</h3>
            <Link to="/pools" className="text-term-fg hover:text-term-fg text-sm transition-colors">
              VIEW_ALL &rarr;
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {pools.slice(0, 8).map((pool, i) => (
              <motion.div key={pool.slug} initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}>
                <Link to={`/pool/${pool.slug}`}
                  className="terminal-window p-4 flex flex-col items-center gap-2 text-center min-w-[110px] group">
                  <div className="w-11 h-11 bg-term-dim border border-term-muted p-1.5 flex items-center justify-center group-hover:bg-term-dim transition-colors">
                    <img src={pool.logo} alt={pool.name} className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                    <div style={{ display: 'none' }}
                      className="w-full h-full items-center justify-center text-lg font-bold text-term-fg">
                      {pool.name.charAt(0)}
                    </div>
                  </div>
                  <p className="text-xs font-semibold group-hover:text-term-fg transition-colors leading-tight">{pool.name}</p>
                  <p className="text-term-gray text-[10px] font-mono">
                    {pool.avg_hashrate ? fmtHashrate(pool.avg_hashrate) : '-'}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Coin Cards */}
      {coins.length > 0 && (
        <motion.div {...fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold term-glow">CRYPTOCURRENCIES</h3>
            <Link to="/coins" className="text-term-fg hover:text-term-fg text-sm transition-colors">
              VIEW_ALL &rarr;
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {coins.map((coin, i) => (
              <motion.div key={coin.id} initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}>
                <Link to={`/coin/${coin.id}`}
                  className="terminal-window p-4 flex flex-col items-center gap-2 text-center min-w-[110px] group">
                  <div className="w-10 h-10 bg-term-dim border border-term-muted p-1 flex items-center justify-center group-hover:bg-term-dim transition-colors">
                    {coin.logo ? (
                      <img src={coin.logo} alt={coin.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-lg font-bold text-term-fg">{coin.symbol?.[0] ?? '?'}</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold group-hover:text-term-fg transition-colors">
                    {coin.name}
                    <span className="text-term-gray ml-1 text-[10px]">{coin.symbol}</span>
                  </p>
                  <p className="text-term-gray text-[10px] font-mono">
                    {coin.price_usd != null ? `$${coin.price_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pie + Bar */}
      <motion.div {...fadeUp} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="terminal-window p-4 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold mb-4 term-glow">HASHRATE DISTRIBUTION</h3>
          <Pie3D
            data={pieData}
            colors={TERMINAL_COLORS}
            onClickSlice={(i) => {
              const slug = pieData[i].slug;
              if (slug !== 'others') navigate(`/pool/${slug}`);
            }}
          />
        </div>

        <div className="terminal-window p-4 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold mb-4 term-glow">AVG CORRELATION BY CRYPTO</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#33ff00" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#33ff00" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f521f" />
              <XAxis dataKey="coin" stroke="#1f521f" tick={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }} />
              <YAxis stroke="#1f521f" tick={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }} domain={[-1, 1]} />
              <Tooltip cursor={false} contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f521f', borderRadius: 0, color: '#e5e7eb' }} />
              <Bar dataKey="avg" fill="url(#barGrad)" radius={[0, 0, 0, 0]} animationDuration={1200} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Correlation Heatmap */}
      {correlations.length > 0 && (
        <motion.div {...fadeUp}>
          <div className="terminal-window p-4 sm:p-5">
            <div className="terminal-titlebar flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-term-fg" />
              <h3 className="text-sm sm:text-lg font-semibold term-glow">POOL-CRYPTO CORRELATION MATRIX</h3>
            </div>
            <p className="text-term-muted text-xs mb-3">Click any cell to see the overlaid time-series chart. Click a pool name for its detail page.</p>
            <CorrelationHeatmap correlations={correlations} coins={coins.map((c) => c.id)} pools={pools} />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
