import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchJSON } from '../api.js';
import ZoomableAreaChart from '../components/ZoomableAreaChart.jsx';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';

const COIN_COLORS = {
  bitcoin: '#f7931a', ethereum: '#627eea', solana: '#14f195', litecoin: '#bfbbbb',
  cardano: '#0033ad', polkadot: '#e6007a', chainlink: '#2a5ada', 'avalanche-2': '#e84142',
};

const COIN_LOGOS = {
  bitcoin: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  ethereum: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  solana: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  litecoin: 'https://assets.coingecko.com/coins/images/2/large/litecoin.png',
  cardano: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
  polkadot: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
  chainlink: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
  'avalanche-2': 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
};

const coinNames = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', litecoin: 'LTC',
  cardano: 'ADA', polkadot: 'DOT', chainlink: 'LINK', 'avalanche-2': 'AVAX',
};

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

function alignHashratePrice(hashrates, prices) {
  if (!hashrates.length || !prices.length) return [];
  const priceMap = new Map();
  for (const p of prices) {
    const hourTs = Math.round(p.timestamp / 3600) * 3600;
    if (!priceMap.has(hourTs)) priceMap.set(hourTs, p.price_usd);
  }
  const points = [];
  for (const h of hashrates) {
    const hourTs = Math.round(h.timestamp / 3600) * 3600;
    let bestTs = null, bestDist = Infinity;
    for (let offset = -12; offset <= 12; offset++) {
      const candidate = hourTs + offset * 3600;
      if (priceMap.has(candidate) && Math.abs(offset) < bestDist) {
        bestDist = Math.abs(offset); bestTs = candidate;
      }
    }
    if (bestTs !== null) {
      points.push({ timestamp: h.timestamp, hashrate: h.hashrate, price: priceMap.get(bestTs) });
    }
  }
  return points;
}

const fadeUp = { initial: { opacity: 0 }, animate: { opacity: 1 } };

export default function PoolDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [pool, setPool] = useState(null);
  const [poolList, setPoolList] = useState([]);
  const [correlations, setCorrelations] = useState([]);
  const [coinPrices, setCoinPrices] = useState({});
  const [vsAvg, setVsAvg] = useState([]);
  const [hashrates, setHashrates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharedRange, setSharedRange] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setSharedRange(null);
      try {
        const [pools, corrData, coins, vsAvgData, hrData] = await Promise.all([
          fetchJSON('/api/pools'),
          fetchJSON(`/api/correlations/${slug}`),
          fetchJSON('/api/coins'),
          fetchJSON(`/api/pool-vs-avg/${slug}`),
          fetchJSON(`/api/pools/${slug}/hashrate`),
        ]);

        setPoolList(pools);
        setPool(pools.find((p) => p.slug === slug));
        setCorrelations(corrData);
        setVsAvg(vsAvgData.points ?? []);
        setHashrates(hrData);

        const priceEntries = await Promise.all(
          coins.map(async (coin) => [coin.id, await fetchJSON(`/api/prices/${coin.id}`)])
        );
        setCoinPrices(Object.fromEntries(priceEntries));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, [slug]);

  const handleSyncedRangeChange = useCallback((newRange, sourceData) => {
    if (!sourceData?.length) return;
    const startPct = newRange[0] / sourceData.length;
    const endPct = newRange[1] / sourceData.length;
    setSharedRange({ startPct, endPct });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent rounded-full" />
    </div>
  );
  if (!pool) return <p className="text-term-muted text-center py-20">Pool not found</p>;

  const poolIdx = poolList.findIndex((p) => p.slug === slug);
  const prevPool = poolIdx > 0 ? poolList[poolIdx - 1] : poolList[poolList.length - 1];
  const nextPool = poolIdx < poolList.length - 1 ? poolList[poolIdx + 1] : poolList[0];

  const corrMap = {};
  for (const c of correlations) corrMap[c.coin_id] = c;
  const trackedCoins = correlations.map((c) => c.coin_id);

  const topCorr = correlations.length > 0
    ? correlations.reduce((a, b) => Math.abs(a.correlation) > Math.abs(b.correlation) ? a : b)
    : null;

  const getExternalRange = (data) => {
    if (!sharedRange || !data?.length) return undefined;
    const startIdx = Math.round(sharedRange.startPct * data.length);
    const endIdx = Math.round(sharedRange.endPct * data.length);
    return [Math.max(0, startIdx), Math.min(data.length - 1, endIdx)];
  };

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.div {...fadeUp} className="flex items-center justify-between">
        <Link to="/pools" className="text-term-fg hover:text-term-fg transition-colors text-sm">&larr; Pools</Link>
        {poolList.length > 1 && (
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(`/pool/${prevPool.slug}`)}
              className="btn-bracket px-3 py-2 text-xs font-medium"
              title={prevPool.name}>
              &larr; {prevPool.name}
            </button>
            <button onClick={() => navigate(`/pool/${nextPool.slug}`)}
              className="btn-bracket px-3 py-2 text-xs font-medium"
              title={nextPool.name}>
              {nextPool.name} &rarr;
            </button>
          </div>
        )}
      </motion.div>

      {/* Pool info card */}
      <motion.div {...fadeUp} className="terminal-window p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-term-dim p-2 flex items-center justify-center flex-shrink-0">
            <img src={pool.logo} alt={pool.name} className="w-full h-full object-contain"
              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div style={{ display: 'none' }}
              className="w-full h-full items-center justify-center text-2xl font-bold text-term-fg">
              {pool.name.charAt(0)}
            </div>
          </div>
          <h2 className="text-2xl font-bold term-glow">{pool.name}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
          <div>
            <p className="text-term-muted text-sm">Avg Hashrate</p>
            <p className="text-xl font-mono mt-1">
              {pool.avg_hashrate ? `${(pool.avg_hashrate / 1e18).toFixed(2)} EH/s` : '-'}
            </p>
          </div>
          <div>
            <p className="text-term-muted text-sm">Strongest Correlation</p>
            {topCorr ? (
              <div className="mt-1">
                <Link to={`/pair/${slug}/${topCorr.coin_id}`}
                  className="text-xl font-mono hover:text-term-fg transition-colors">
                  <span className={corrColor(topCorr.correlation)}>r = {topCorr.correlation?.toFixed(4)}</span>
                  <span className="text-term-gray text-sm ml-2">({coinNames[topCorr.coin_id] ?? topCorr.coin_id})</span>
                </Link>
              </div>
            ) : <p className="text-xl font-mono mt-1">-</p>}
          </div>
        </div>
      </motion.div>

      {/* Intelligence Panel: Correlation Profile + Hashrate vs Avg Price */}
      {(correlations.length > 0 || vsAvg.length > 0) && (
        <motion.div {...fadeUp} transition={{ delay: 0.05 }} className="terminal-window p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-term-fg" />
            <h3 className="text-lg font-semibold tracking-wide uppercase text-term-muted">
              Intelligence Briefing
            </h3>
            <span className="text-term-muted text-xs font-mono ml-2">{pool.name}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left: Radar correlation profile */}
            {correlations.length > 0 && (
              <div className="lg:col-span-2 flex flex-col items-center">
                <p className="text-xs text-term-gray uppercase tracking-wider mb-3">CORRELATION PROFILE</p>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart
                    data={correlations.map((c) => ({
                      crypto: coinNames[c.coin_id] ?? c.coin_id,
                      correlation: c.correlation ?? 0,
                      sign: c.correlation >= 0 ? '+' : '',
                    }))}
                    margin={{ top: 10, right: 20, bottom: 10, left: 20 }}
                  >
                    <PolarGrid stroke="#1f521f" />
                    <PolarAngleAxis
                      dataKey="crypto"
                      tick={({ x, y, payload }) => {
                        const c = correlations.find((cr) => (coinNames[cr.coin_id] ?? cr.coin_id) === payload.value);
                        const color = c?.correlation >= 0 ? '#33ff00' : '#ff4444';
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
            {/* Right: Hashrate vs Avg Crypto Price */}
            {vsAvg.length > 0 && (
              <div className={correlations.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-term-gray uppercase tracking-wider">
                    HASHRATE VS AVG CRYPTO PRICE
                  </p>
                </div>
                <ZoomableAreaChart
                  data={vsAvg}
                  height={300}
                  leftAxis={{ color: '#ffffff', formatter: fmtHashrate }}
                  rightAxis={{ color: '#ffb000', formatter: (v) => `$${v.toLocaleString()}` }}
                  series={[
                    { dataKey: 'hashrate', color: '#ffffff', name: `${pool.name} Hashrate`, yAxisId: 'left' },
                    { dataKey: 'price', color: '#ffb000', name: 'Avg Crypto Price', yAxisId: 'right' },
                  ]}
                  externalRange={getExternalRange(vsAvg)}
                  onRangeChange={handleSyncedRangeChange}
                  source={`Hashrate: blockchain.info | Prices: CoinGecko`}
                />
              </div>
            )}
          </div>

          {/* Per-coin mini charts grid */}
          {trackedCoins.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-term-fg" />
                <p className="text-xs text-term-gray uppercase tracking-wider">ASSET CORRELATION MATRIX</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {trackedCoins.map((coinId, idx) => {
                  const c = corrMap[coinId];
                  const prices = coinPrices[coinId] ?? [];
                  const points = alignHashratePrice(hashrates, prices);
                  const color = COIN_COLORS[coinId] ?? '#888';

                  return (
                    <motion.div key={coinId} initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}
                      className="bg-term-dim border border-term-muted rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          {COIN_LOGOS[coinId] && (
                            <img src={COIN_LOGOS[coinId]} alt={coinId} className="w-3.5 h-3.5 rounded-full" />
                          )}
                          <span className="text-xs font-semibold" style={{ color }}>{coinNames[coinId] ?? coinId}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[10px] ${corrColor(c?.correlation)}`}>
                            r={c?.correlation?.toFixed(3) ?? 'N/A'}
                          </span>
                          <Link to={`/pair/${slug}/${coinId}`} className="text-term-muted hover:text-term-fg transition-colors">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          </Link>
                        </div>
                      </div>
                      <ZoomableAreaChart
                        data={points}
                        height={140}
                        leftAxis={{ color: '#ffffff', formatter: (v) => v >= 1e15 ? `${(v/1e15).toFixed(0)}P` : `${(v/1e12).toFixed(0)}T` }}
                        rightAxis={{ color, formatter: (v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v.toFixed(0)}` }}
                        series={[
                          { dataKey: 'hashrate', color: '#ffffff', name: 'Hashrate', yAxisId: 'left' },
                          { dataKey: 'price', color, name: `${coinNames[coinId]} Price`, yAxisId: 'right' },
                        ]}
                        externalRange={getExternalRange(points)}
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

      {trackedCoins.length === 0 && (
        <p className="text-term-gray text-center py-10">No correlation data available.</p>
      )}
    </motion.div>
  );
}
