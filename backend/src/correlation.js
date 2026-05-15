import db from './db.js';
import { COINS } from './services/coingecko.js';

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;

  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  const denom = Math.sqrt(sumX2 * sumY2);
  if (denom === 0) return 0;
  return sumXY / denom;
}

export function computeAllCorrelations() {
  const pools = db.prepare('SELECT DISTINCT pool_slug FROM pool_hashrates').all();
  const now = Math.floor(Date.now() / 1000);
  let computed = 0;

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO correlations (pool_slug, coin_id, correlation, sample_count, computed_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const doAll = db.transaction(() => {
    for (const { pool_slug } of pools) {
      for (const coinId of COINS) {
        const prices = db.prepare(`
          SELECT timestamp, price_usd
          FROM crypto_prices
          WHERE coin_id = ?
          ORDER BY timestamp
        `).all(coinId);

        if (prices.length < 10) continue;

        // Build a price lookup: Map<timestamp_rounded_to_hour, price>
        const priceMap = new Map();
        for (const p of prices) {
          const hourTs = Math.round(p.timestamp / 3600) * 3600;
          if (!priceMap.has(hourTs)) priceMap.set(hourTs, p.price_usd);
        }

        const hashrates = db.prepare(`
          SELECT timestamp, hashrate
          FROM pool_hashrates
          WHERE pool_slug = ?
          ORDER BY timestamp
        `).all(pool_slug);

        const xs = [];
        const ys = [];

        for (const h of hashrates) {
          // Find closest price within 12 hours
          const hourTs = Math.round(h.timestamp / 3600) * 3600;
          const searchRange = 12; // hours
          let bestTs = null;
          let bestDist = Infinity;

          for (let offset = -searchRange; offset <= searchRange; offset++) {
            const candidate = hourTs + offset * 3600;
            if (priceMap.has(candidate)) {
              if (Math.abs(offset) < bestDist) {
                bestDist = Math.abs(offset);
                bestTs = candidate;
              }
            }
          }

          if (bestTs !== null) {
            xs.push(h.hashrate);
            ys.push(priceMap.get(bestTs));
          }
        }

        if (xs.length >= 5) {
          const r = pearson(xs, ys);
          upsert.run(pool_slug, coinId, r, xs.length, now);
          computed++;
        }
      }
    }
  });

  doAll();
  console.log(`Computed ${computed} correlations`);
  return computed;
}
