import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJSON } from '../api.js';
import ZoomableAreaChart from '../components/ZoomableAreaChart.jsx';

const fmtHashrate = (h) => {
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  return `${(h / 1e12).toFixed(1)} TH/s`;
};

export default function PairChart() {
  const { poolSlug, coinId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [normalized, setNormalized] = useState(false);

  useEffect(() => {
    fetchJSON(`/api/pair/${poolSlug}/${coinId}`)
      .then(setData).catch(console.error).finally(() => setLoading(false));
  }, [poolSlug, coinId]);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent rounded-full" />
    </div>
  );
  if (!data) return <p className="text-term-muted text-center py-20">No data found</p>;

  const corrColor = data.correlation != null
    ? (data.correlation >= 0 ? 'term-glow' : 'text-term-red')
    : 'text-term-muted';

  let chartData = data.points;
  if (normalized && chartData.length) {
    const firstH = chartData[0].hashrate;
    const firstP = chartData[0].price;
    chartData = chartData.map((p) => ({
      timestamp: p.timestamp,
      hashrate: firstH ? ((p.hashrate - firstH) / firstH) * 100 : 0,
      price: firstP ? ((p.price - firstP) / firstP) * 100 : 0,
    }));
  }

  const leftFmt = normalized ? (v) => `${v.toFixed(0)}%` : fmtHashrate;
  const rightFmt = normalized ? (v) => `${v.toFixed(0)}%` : (v) => `$${v.toLocaleString()}`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-term-muted">
        <Link to="/correlations" className="text-term-fg hover:text-term-fg transition-colors">&larr; Correlations</Link>
        <span className="text-term-gray">/</span>
        <Link to={`/pool/${poolSlug}`} className="text-term-fg hover:text-term-fg transition-colors">{data.poolName}</Link>
        <span className="text-term-gray">/</span>
        <span>{data.coinName}</span>
      </div>

      <div className="terminal-window p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">
            <span className="term-glow">{data.poolName}</span>
            <span className="text-term-gray mx-2">vs</span>
            <span className="term-glow-amber">{data.coinName}</span>
          </h2>
          <div className="flex items-center gap-4 sm:gap-6">
            <div>
              <p className="text-term-muted text-xs sm:text-sm">Pearson Correlation</p>
              <p className={`text-xl sm:text-2xl font-bold font-mono ${corrColor}`}>
                {data.correlation != null ? data.correlation.toFixed(4) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-term-muted text-xs sm:text-sm">Data Points</p>
              <p className="text-xl sm:text-2xl font-bold font-mono">{data.sampleCount}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setNormalized(false)}
            className={`btn-bracket px-4 py-2 text-sm font-medium ${!normalized ? 'active' : ''}`}>
            Absolute Values
          </button>
          <button onClick={() => setNormalized(true)}
            className={`btn-bracket px-4 py-2 text-sm font-medium ${normalized ? 'active' : ''}`}>
            Normalized (% change)
          </button>
        </div>

        <ZoomableAreaChart
          data={chartData}
          height={280}
          leftAxis={{ color: '#ffffff', formatter: leftFmt }}
          rightAxis={{ color: '#ffffff', formatter: rightFmt }}
          series={[
            { dataKey: 'hashrate', color: '#ffffff', name: `${data.poolName} Hashrate`, yAxisId: 'left' },
            { dataKey: 'price', color: '#ffb000', name: `${data.coinName} Price`, yAxisId: 'right' },
          ]}
          source="Hashrate: blockchain.info | Price: CoinGecko"
        />
      </div>
    </motion.div>
  );
}
