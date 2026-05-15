import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function corrBgStyle(r) {
  if (r == null) return { background: '#0a0a0a' };
  const abs = Math.abs(r);
  if (r >= 0) {
    return { background: `rgba(51,255,0,${abs * 0.4 + 0.03})` };
  }
  return { background: `rgba(255,51,51,${abs * 0.4 + 0.03})` };
}

export default function CorrelationHeatmap({ correlations, coins, pools }) {
  const navigate = useNavigate();

  const byPool = {};
  for (const c of correlations) {
    if (!byPool[c.pool_slug]) byPool[c.pool_slug] = {};
    byPool[c.pool_slug][c.coin_id] = c;
  }

  const coinNames = {
    bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', litecoin: 'LTC',
    cardano: 'ADA', polkadot: 'DOT', chainlink: 'LINK', 'avalanche-2': 'AVAX',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-3 px-4 text-term-muted font-medium sticky left-0 z-10" style={{ background: '#0a0a0a' }}>POOL</th>
            {coins.map((coin) => (
              <th key={coin} className="py-3 px-4 text-term-muted font-medium text-center whitespace-nowrap">
                <Link to={`/coin/${coin}`} className="hover:text-term-fg transition-colors">
                  {coinNames[coin] ?? coin}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pools.map((pool, pi) => {
            const row = byPool[pool.slug] ?? {};
            return (
              <motion.tr
                key={pool.slug}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: pi * 0.03 }}
                className="border-t border-term-muted"
              >
                <td className="py-2 px-4 text-term-fg font-medium sticky left-0 z-10 whitespace-nowrap" style={{ background: '#0a0a0a' }}>
                  <button
                    onClick={() => navigate(`/pool/${pool.slug}`)}
                    className="hover:text-term-bright transition-colors"
                  >
                    {pool.name}
                  </button>
                </td>
                {coins.map((coin) => {
                  const c = row[coin];
                  const r = c?.correlation;
                  return (
                    <td
                      key={coin}
                      className="py-2 px-4 text-center cursor-pointer font-mono transition-all duration-150"
                      style={{
                        ...corrBgStyle(r),
                        textShadow: r != null && Math.abs(r) > 0.3 ? '0 0 5px rgba(51,255,0,0.5)' : 'none',
                      }}
                      onClick={() => navigate(`/pair/${pool.slug}/${coin}`)}
                      title={r != null ? `r = ${r.toFixed(4)}` : 'No data'}
                    >
                      {r != null ? r.toFixed(2) : '-'}
                    </td>
                  );
                })}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
