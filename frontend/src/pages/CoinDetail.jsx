import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  const [loading, setLoading] = useState(true);
  const [selectedPools, setSelectedPools] = useState('all');

  useEffect(() => {
    fetchJSON(`/api/coin-detail/${coinId}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [coinId]);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="text-term-muted text-center py-20">Coin not found</p>;

  // Merge all pool points into unified time-series for overlay chart
  const allTimestamps = new Set();
  for (const pool of data.poolSeries) {
    for (const p of pool.points) allTimestamps.add(p.timestamp);
  }
  const sortedTs = [...allTimestamps].sort((a, b) => a - b);
  const tsPriceMap = new Map();
  for (const pool of data.poolSeries) {
    for (const p of pool.points) {
      if (!tsPriceMap.has(p.timestamp)) tsPriceMap.set(p.timestamp, p.price);
    }
  }

  const displayedPools = selectedPools === 'top5'
    ? data.poolSeries.slice(0, 5)
    : data.poolSeries;

  const overlayData = sortedTs.map((ts) => {
    const row = { timestamp: ts, price: tsPriceMap.get(ts) };
    for (const pool of displayedPools) {
      const match = pool.points.find((p) => p.timestamp === ts);
      row[`${pool.slug}_hashrate`] = match ? match.hashrate : null;
    }
    return row;
  }).filter((row) => row.price != null);

  const overlaySeries = [
    { dataKey: 'price', color: '#ffffff', name: `${data.coinName} Price`, yAxisId: 'right' },
    ...displayedPools.map((pool, i) => ({
      dataKey: `${pool.slug}_hashrate`,
      color: TERMINAL_POOL_COLORS[i % TERMINAL_POOL_COLORS.length],
      name: `${pool.name} Hashrate`,
      yAxisId: 'left',
    })),
  ];

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.div {...fadeUp} className="flex items-center gap-3 text-sm">
        <Link to="/coins" className="text-term-fg hover:text-term-fg transition-colors">&larr; Coins</Link>
      </motion.div>

      {/* Coin header */}
      <motion.div {...fadeUp} className="terminal-window p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
        <div className="w-16 h-16 rounded-full bg-term-dim border border-term-muted p-1.5 flex items-center justify-center flex-shrink-0">
          {data.logo ? (
            <img src={data.logo} alt={data.coinName} className="w-full h-full object-contain rounded-full" />
          ) : (
            <span className="text-3xl font-bold term-glow-amber">{data.symbol?.[0] ?? '?'}</span>
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold term-glow">
            {data.coinName}
            <span className="text-term-gray text-lg ml-2">{data.symbol}</span>
          </h2>
          <p className="text-term-muted text-sm mt-1">{data.correlations.length} pool correlations</p>
        </div>
      </motion.div>

      {/* Price trend + pool hashrate overlay */}
      {overlayData.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.1 }} className="terminal-window p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              <span className="term-glow-amber">{data.coinName}</span>
              <span className="text-term-gray mx-2">vs</span>
              <span className="term-glow">Pool Hashrates</span>
            </h3>
            <div className="flex gap-2">
              <button onClick={() => setSelectedPools('all')}
                className={`btn-bracket px-3 py-1.5 text-xs font-medium ${selectedPools === 'all' ? 'active' : ''}`}>
                All Pools
              </button>
              <button onClick={() => setSelectedPools('top5')}
                className={`btn-bracket px-3 py-1.5 text-xs font-medium ${selectedPools === 'top5' ? 'active' : ''}`}>
                Top 5
              </button>
            </div>
          </div>
          <ZoomableAreaChart
            data={overlayData}
            height={350}
            leftAxis={{ color: '#33ff00', formatter: fmtHashrate }}
            rightAxis={{ color: '#ffffff', formatter: (v) => `$${v.toLocaleString()}` }}
            series={overlaySeries}
            source="Hashrate: blockchain.info | Price: CoinGecko"
          />
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3">
            {displayedPools.map((pool, i) => (
              <Link key={pool.slug} to={`/pool/${pool.slug}`}
                className="flex items-center gap-1.5 text-xs text-term-muted hover:text-white transition-colors">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: TERMINAL_POOL_COLORS[i % TERMINAL_POOL_COLORS.length] }} />
                {pool.name}
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* Per-pool correlation cards */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
        <h3 className="text-lg font-semibold mb-3">Pool Correlations</h3>
        <div className="space-y-2">
          {data.correlations.map((c, i) => (
            <motion.div key={c.pool_slug}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}>
              <Link to={`/pair/${c.pool_slug}/${coinId}`}
                className="flex justify-between items-center py-3 px-4 rounded-xl border border-term-muted hover:border-term-fg transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-term-dim border border-term-muted p-1 flex items-center justify-center">
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
