import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { fetchJSON } from '../api.js';
import { pearson, pctChanges, lagArray, laggedCorrelations, bestLag } from '../lib/analysis.js';

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

const LAGS = [0, 1, 3, 7, 14, 30, 60];
const LAG_LABELS = { 0: 'Same day', 1: '1 day', 3: '3 days', 7: '7 days', 14: '14 days', 30: '30 days', 60: '60 days' };

const fmtDate = (ts) => {
  if (ts == null || isNaN(ts)) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const fadeUp = { initial: { opacity: 0 }, animate: { opacity: 1 } };

function corrColor(r) {
  if (r == null) return 'text-term-muted';
  if (r >= 0.5) return 'text-term-fg';
  if (r >= 0) return 'text-term-bright';
  if (r >= -0.5) return 'text-term-red';
  return 'text-term-red';
}

function corrBarColor(r) {
  if (r == null) return '#1f521f';
  if (r >= 0) return `rgba(51,255,0,${Math.min(Math.abs(r) * 0.8 + 0.2, 1)})`;
  return `rgba(255,51,51,${Math.min(Math.abs(r) * 0.8 + 0.2, 1)})`;
}

function alignDailyHashratePrice(hashrates, prices) {
  const dayMap = new Map();
  for (const h of hashrates) {
    const dayTs = Math.floor(h.timestamp / 86400) * 86400;
    if (!dayMap.has(dayTs)) dayMap.set(dayTs, []);
    dayMap.get(dayTs).push(h.hashrate);
  }
  const dailyHashrate = [];
  for (const [ts, vals] of dayMap) {
    dailyHashrate.push({ timestamp: ts, hashrate: vals.reduce((a, b) => a + b, 0) / vals.length });
  }
  dailyHashrate.sort((a, b) => a.timestamp - b.timestamp);

  const priceMap = new Map();
  for (const p of prices) {
    const dayTs = Math.floor(p.timestamp / 86400) * 86400;
    if (!priceMap.has(dayTs)) priceMap.set(dayTs, p.price_usd);
  }

  const aligned = [];
  for (const h of dailyHashrate) {
    const price = priceMap.get(h.timestamp);
    if (price != null) {
      aligned.push({ timestamp: h.timestamp, hashrate: h.hashrate, price });
    }
  }
  aligned.sort((a, b) => a.timestamp - b.timestamp);
  return aligned;
}

function computeLagResults(aligned, currentMode) {
  if (aligned.length < 5) return [];
  if (currentMode === 'levels') {
    return laggedCorrelations(aligned, aligned, (d) => d.hashrate, (d) => d.price, LAGS);
  }
  const hrChanges = pctChanges(aligned.map((d) => d.hashrate));
  const priceChanges = pctChanges(aligned.map((d) => d.price));
  const changesData = aligned.map((d, i) => ({
    ...d,
    hashrateChange: hrChanges[i],
    priceChange: priceChanges[i],
  }));
  return laggedCorrelations(changesData, changesData, (d) => d.hashrateChange, (d) => d.priceChange, LAGS);
}

export default function Analysis() {
  const [pools, setPools] = useState([]);
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState('');
  const [selectedCoin, setSelectedCoin] = useState('bitcoin');
  const [mode, setMode] = useState('levels');
  const [dataLoading, setDataLoading] = useState(false);
  const [alignedData, setAlignedData] = useState([]);
  const [crossCryptoRaw, setCrossCryptoRaw] = useState({});

  useEffect(() => {
    Promise.all([fetchJSON('/api/pools'), fetchJSON('/api/coins')])
      .then(([p, c]) => {
        setPools(p);
        setCoins(c);
        if (p.length > 0) setSelectedPool(p[0].slug);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPool || !selectedCoin) return;
    let cancelled = false;
    setDataLoading(true);

    Promise.all([
      fetchJSON(`/api/pools/${selectedPool}/hashrate`),
      fetchJSON(`/api/prices/${selectedCoin}`),
    ])
      .then(([hashrates, prices]) => {
        if (cancelled) return;
        setAlignedData(alignDailyHashratePrice(hashrates, prices));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setDataLoading(false); });

    return () => { cancelled = true; };
  }, [selectedPool, selectedCoin]);

  useEffect(() => {
    if (!selectedPool || coins.length === 0) return;
    let cancelled = false;

    Promise.all(coins.map(async (coin) => {
      try {
        const [hashrates, prices] = await Promise.all([
          fetchJSON(`/api/pools/${selectedPool}/hashrate`),
          fetchJSON(`/api/prices/${coin.id}`),
        ]);
        const aligned = alignDailyHashratePrice(hashrates, prices);
        return [coin.id, { aligned, coin }];
      } catch {
        return null;
      }
    })).then((results) => {
      if (cancelled) return;
      const map = {};
      for (const r of results) {
        if (r) map[r[0]] = r[1];
      }
      setCrossCryptoRaw(map);
    });

    return () => { cancelled = true; };
  }, [selectedPool, coins]);

  const lagResults = useMemo(
    () => computeLagResults(alignedData, mode),
    [alignedData, mode]
  );

  const bestResult = useMemo(() => bestLag(lagResults), [lagResults]);

  const crossCrypto = useMemo(() => {
    return Object.entries(crossCryptoRaw).map(([coinId, { aligned, coin }]) => {
      const lagResults = computeLagResults(aligned, mode);
      const best = bestLag(lagResults);
      return {
        coinId,
        coinName: coin.name || coinNames[coinId],
        symbol: coin.symbol,
        logo: coin.logo,
        lagResults,
        best,
        sampleCount: aligned.length,
      };
    }).filter(Boolean);
  }, [crossCryptoRaw, mode]);

  const normalizedData = useMemo(() => {
    if (alignedData.length === 0) return [];
    if (mode === 'levels') {
      const firstH = alignedData[0].hashrate;
      const firstP = alignedData[0].price;
      return alignedData.map((d) => ({
        timestamp: d.timestamp,
        hashrate: firstH ? ((d.hashrate - firstH) / firstH) * 100 : 0,
        price: firstP ? ((d.price - firstP) / firstP) * 100 : 0,
      }));
    }
    const hrChanges = pctChanges(alignedData.map((d) => d.hashrate));
    const priceChanges = pctChanges(alignedData.map((d) => d.price));
    return alignedData.map((d, i) => ({
      timestamp: d.timestamp,
      hashrate: hrChanges[i] != null ? hrChanges[i] * 100 : null,
      price: priceChanges[i] != null ? priceChanges[i] * 100 : null,
    }));
  }, [alignedData, mode]);

  const poolName = pools.find((p) => p.slug === selectedPool)?.name ?? selectedPool;
  const coinName = coins.find((c) => c.id === selectedCoin)?.name ?? coinNames[selectedCoin] ?? selectedCoin;
  const coinColor = COIN_COLORS[selectedCoin] ?? '#ffb000';

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent" />
    </div>
  );

  return (
    <motion.div initial="initial" animate="animate" className="space-y-6">
      <motion.div {...fadeUp}>
        <h2 className="text-2xl font-bold term-glow tracking-widest">CORRELATION ANALYSIS</h2>
        <p className="text-term-muted text-xs mt-1">
          {'>'} Descriptive analysis of price / hashrate co-movement. Correlation measures association only -- it does not imply causality or forecasting power.
        </p>
      </motion.div>

      <motion.div {...fadeUp}
        className="terminal-window p-4 text-xs text-term-gray leading-relaxed">
        Positive values mean the two series tend to move together. Negative values mean they tend to move in opposite directions.
        "Best lag" indicates the delay with the strongest absolute association -- not a predictive signal.
        Results with fewer than 5 observations are excluded.
      </motion.div>

      {/* Controls */}
      <motion.div {...fadeUp}
        className="terminal-window p-5 flex flex-wrap items-center gap-4">
        <div>
          <label className="text-term-muted text-xs block mb-1">POOL</label>
          <select value={selectedPool} onChange={(e) => setSelectedPool(e.target.value)}
            className="bg-term-dim border border-term-muted px-3 py-2 text-xs text-term-fg focus:outline-none focus:border-term-fg"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {pools.map((p) => (
              <option key={p.slug} value={p.slug} style={{ background: '#0a0a0a' }}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-term-muted text-xs block mb-1">CRYPTO</label>
          <select value={selectedCoin} onChange={(e) => setSelectedCoin(e.target.value)}
            className="bg-term-dim border border-term-muted px-3 py-2 text-xs text-term-fg focus:outline-none focus:border-term-fg"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {coins.map((c) => (
              <option key={c.id} value={c.id} style={{ background: '#0a0a0a' }}>{coinNames[c.id] ?? c.id}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-term-muted text-xs block mb-1">MODE</label>
          <div className="flex gap-1">
            <button onClick={() => setMode('levels')}
              className={`btn-bracket ${mode === 'levels' ? 'active' : ''}`}>
              Levels
            </button>
            <button onClick={() => setMode('changes')}
              className={`btn-bracket ${mode === 'changes' ? 'active' : ''}`}>
              % Changes
            </button>
          </div>
        </div>
        <div className="ml-auto text-right">
          <p className="text-term-muted text-xs">OBSERVATIONS</p>
          <p className="text-lg font-mono font-bold term-glow">
            {dataLoading ? '...' : alignedData.length}
          </p>
          {alignedData.length < 5 && !dataLoading && (
            <p className="text-term-red text-xs">[ERR] INSUFFICIENT DATA</p>
          )}
        </div>
      </motion.div>

      {dataLoading && (
        <div className="flex items-center justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 border-2 border-term-fg border-t-transparent" />
        </div>
      )}

      {!dataLoading && alignedData.length >= 5 && (
        <>
          {/* Summary card */}
          <motion.div {...fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="terminal-window p-5">
              <p className="text-term-muted text-xs">SAME-DAY CORRELATION</p>
              <p className={`text-2xl font-mono font-bold mt-1 ${corrColor(lagResults[0]?.correlation)}`}>
                {lagResults[0]?.correlation != null ? lagResults[0].correlation.toFixed(4) : 'N/A'}
              </p>
              <p className="text-term-gray text-xs mt-1">{lagResults[0]?.sampleCount ?? 0} observations</p>
            </div>
            <div className="terminal-window p-5">
              <p className="text-term-muted text-xs">STRONGEST LAG ASSOCIATION</p>
              {bestResult ? (
                <>
                  <p className={`text-2xl font-mono font-bold mt-1 ${corrColor(bestResult.correlation)}`}>
                    r = {bestResult.correlation.toFixed(4)}
                  </p>
                  <p className="text-term-gray text-xs mt-1">{LAG_LABELS[bestResult.lag]} delay ({bestResult.sampleCount} obs)</p>
                </>
              ) : <p className="text-xl font-mono mt-1 text-term-muted">N/A</p>}
            </div>
            <div className="terminal-window p-5">
              <p className="text-term-muted text-xs">INTERPRETATION</p>
              <p className="text-xs mt-1 text-term-bright">
                {bestResult?.correlation == null ? 'Insufficient data' :
                  bestResult.correlation >= 0.5 ? 'Strong positive co-movement' :
                  bestResult.correlation >= 0.2 ? 'Moderate positive co-movement' :
                  bestResult.correlation >= -0.2 ? 'Weak or no association' :
                  bestResult.correlation >= -0.5 ? 'Moderate negative co-movement' :
                  'Strong negative co-movement'}
              </p>
              {bestResult && bestResult.lag > 0 && (
                <p className="text-term-gray text-xs mt-1">
                  Price movements precede hashrate by ~{LAG_LABELS[bestResult.lag]}
                </p>
              )}
            </div>
          </motion.div>

          {/* Normalized chart */}
          <motion.div {...fadeUp} className="terminal-window p-6">
            <div className="terminal-titlebar">
              {mode === 'levels' ? 'NORMALIZED' : '% CHANGE'}: {poolName} vs {coinName}
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={normalizedData} margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f521f" />
                  <XAxis dataKey="timestamp" tickFormatter={fmtDate}
                    stroke="#1f521f" tick={{ fontSize: 10, fill: '#33ff00', fontFamily: '"JetBrains Mono", monospace' }} />
                  <YAxis stroke="#1f521f" tick={{ fontSize: 10, fill: '#4a6741', fontFamily: '"JetBrains Mono", monospace' }}
                    tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f521f', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#33ff00' }}
                    labelFormatter={fmtDate}
                    formatter={(v) => v != null ? `${v.toFixed(2)}%` : 'N/A'}
                  />
                  <Line type="monotone" dataKey="hashrate" stroke="#33ff00" strokeWidth={2} dot={false}
                    name={`${poolName} ${mode === 'levels' ? '(norm)' : 'change'}`} />
                  <Line type="monotone" dataKey="price" stroke={coinColor} strokeWidth={2} dot={false}
                    name={`${coinName} ${mode === 'levels' ? '(norm)' : 'change'}`} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Correlation by lag chart */}
          <motion.div {...fadeUp} className="terminal-window p-6">
            <div className="terminal-titlebar">CORRELATION BY LAG</div>
            <p className="text-term-gray text-xs mt-4 mb-3">
              Pearson correlation between {mode === 'levels' ? 'price levels' : 'price % changes'} and hashrate {mode === 'levels' ? 'levels' : '% changes'} shifted by delay.
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={lagResults.map((r) => ({
                lag: LAG_LABELS[r.lag],
                correlation: r.correlation ?? 0,
                fill: corrBarColor(r.correlation),
              }))} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f521f" />
                <XAxis dataKey="lag" stroke="#1f521f" tick={{ fontSize: 10, fill: '#33ff00', fontFamily: '"JetBrains Mono", monospace' }} />
                <YAxis stroke="#1f521f" tick={{ fontSize: 10, fill: '#4a6741', fontFamily: '"JetBrains Mono", monospace' }} domain={[-1, 1]} />
                <ReferenceLine y={0} stroke="#1f521f" />
                <Tooltip
                  cursor={false}
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f521f', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#33ff00' }}
                  formatter={(v) => v.toFixed(4)}
                />
                <Bar dataKey="correlation" radius={[0, 0, 0, 0]} animationDuration={800}>
                  {lagResults.map((r, i) => (
                    <cell key={i} fill={corrBarColor(r.correlation)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Cross-crypto comparison table */}
          {crossCrypto.length > 0 && (
            <motion.div {...fadeUp} className="terminal-window p-6">
              <div className="terminal-titlebar">CROSS-CRYPTO COMPARISON -- {poolName}</div>
              <p className="text-term-gray text-xs mt-4 mb-3">
                Best lag association for each crypto against {poolName} hashrate ({mode === 'levels' ? 'levels' : '% changes'}). Sorted by strongest absolute correlation.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-term-muted">
                      <th className="text-left py-2 px-3 text-term-muted font-medium">CRYPTO</th>
                      <th className="text-right py-2 px-3 text-term-muted font-medium">BEST LAG</th>
                      <th className="text-right py-2 px-3 text-term-muted font-medium">CORRELATION</th>
                      <th className="text-right py-2 px-3 text-term-muted font-medium">OBS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crossCrypto
                      .sort((a, b) => Math.abs(b.best?.correlation ?? 0) - Math.abs(a.best?.correlation ?? 0))
                      .map((row) => (
                        <tr key={row.coinId} className="border-b border-term-muted hover:bg-term-dim transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              {row.logo && (
                                <img src={row.logo} alt={row.coinName} className="w-5 h-5" />
                              )}
                              <span className="text-term-fg">{row.coinName}</span>
                              <span className="text-term-muted text-xs">{row.symbol}</span>
                            </div>
                          </td>
                          <td className="text-right py-2.5 px-3 text-term-bright">
                            {row.best ? LAG_LABELS[row.best.lag] : '-'}
                          </td>
                          <td className={`text-right py-2.5 px-3 font-mono ${corrColor(row.best?.correlation)}`}>
                            {row.best?.correlation != null ? row.best.correlation.toFixed(4) : 'N/A'}
                          </td>
                          <td className="text-right py-2.5 px-3 text-term-gray font-mono">
                            {row.sampleCount}
                            {row.sampleCount < 5 && <span className="text-term-red ml-1">[LOW]</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </>
      )}

      {!dataLoading && alignedData.length < 5 && alignedData.length > 0 && (
        <motion.div {...fadeUp} className="terminal-window p-8 text-center">
          <p className="text-term-muted">[ERR] INSUFFICIENT OVERLAPPING DATA BETWEEN {poolName} AND {coinName}.</p>
          <p className="text-term-gray text-xs mt-1">{alignedData.length} observations found (minimum 5 required).</p>
        </motion.div>
      )}
    </motion.div>
  );
}
