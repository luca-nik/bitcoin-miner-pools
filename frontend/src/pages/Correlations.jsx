import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchJSON } from '../api.js';
import CorrelationHeatmap from '../components/CorrelationHeatmap.jsx';

export default function Correlations() {
  const [correlations, setCorrelations] = useState([]);
  const [pools, setPools] = useState([]);
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJSON('/api/correlations'),
      fetchJSON('/api/pools'),
      fetchJSON('/api/coins'),
    ])
      .then(([corrs, poolsData, coinsData]) => {
        setCorrelations(corrs);
        setPools(poolsData);
        setCoins(coinsData.map((c) => c.id));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="w-10 h-10 border-2 border-term-fg border-t-transparent" />
    </div>
  );

  if (correlations.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
        <p className="text-term-muted">{'>'} NO CORRELATION DATA AVAILABLE. RUN REFRESH FIRST.</p>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-2xl font-bold term-glow tracking-widest">POOL-CRYPTO CORRELATIONS</h2>
      <p className="text-term-gray text-xs">{'>'} Click any cell to see the overlaid time-series chart. Click a pool name for its detail page.</p>
      <div className="terminal-window p-5">
        <CorrelationHeatmap correlations={correlations} coins={coins} pools={pools} />
      </div>
    </motion.div>
  );
}
