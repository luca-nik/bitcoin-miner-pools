import db from './db.js';
import { fetchPools, fetchAllPoolHashrates } from './services/mempool.js';
import { fetchAllPrices, fetchCurrentPrices, COINS, COIN_NAMES } from './services/coingecko.js';
import { computeAllCorrelations } from './correlation.js';

const POOL_LOGO_BASE = 'https://raw.githubusercontent.com/mempool/mining-pool-logos/master/';

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

const COIN_SYMBOLS = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', litecoin: 'LTC',
  cardano: 'ADA', polkadot: 'DOT', chainlink: 'LINK', 'avalanche-2': 'AVAX',
};

const POOL_URLS = {
  foundryusa: 'https://foundrydigital.com',
  antpool: 'https://www.antpool.com',
  f2pool: 'https://www.f2pool.com',
  viabtc: 'https://www.viabtc.com',
  binancepool: 'https://pool.binance.com',
  braiinspool: 'https://braiins.com/pool',
  marapool: 'https://marathon.com',
  spiderpool: 'https://spiderpool.com',
  luxor: 'https://luxor.tech',
  btccom: 'https://pool.btc.com',
  binancepool: 'https://pool.binance.com',
  emcdpool: 'https://emcd.io',
  sbicrypto: 'https://www.sbicrypto.com',
  okexpool: 'https://www.okx.com',
  huobipool: 'https://www.hpt.com',
  ocean: 'https://ocean.xyz',
  nicehash: 'https://www.nicehash.com',
  poolin: 'https://www.poolin.com',
  bitfury: 'https://bitfury.com',
  secpool: 'https://www.secpool.com',
  kucoinpool: 'https://pool.kucoin.com',
  rawpool: 'https://rawpool.com',
  arkpool: 'https://arkpool.io',
  terrapool: 'https://terrapool.io',
  bitcoincom: 'https://pool.bitcoin.com',
  dcdata: 'https://dcdata.co',
};

const COIN_URLS = {
  bitcoin: 'https://bitcoin.org',
  ethereum: 'https://ethereum.org',
  solana: 'https://solana.com',
  litecoin: 'https://litecoin.org',
  cardano: 'https://cardano.org',
  polkadot: 'https://polkadot.network',
  chainlink: 'https://chain.link',
  'avalanche-2': 'https://avax.network',
};

export function registerRoutes(app) {
  // Pools with correlation data (shown in dashboard cards, pool detail, etc.)
  app.get('/api/pools', async () => {
    const rows = db.prepare(`
      SELECT p.slug, p.name, p.unique_id, COUNT(h.timestamp) as data_points,
             AVG(h.hashrate) as avg_hashrate,
             COUNT(DISTINCT c.coin_id) as corr_count
      FROM pools p
      JOIN pool_hashrates h ON p.slug = h.pool_slug
      LEFT JOIN correlations c ON c.pool_slug = p.slug
      WHERE p.name != 'Unknown'
      GROUP BY p.slug
      HAVING corr_count > 0
      ORDER BY avg_hashrate DESC
    `).all();
    return rows.map((r) => ({ ...r, logo: `${POOL_LOGO_BASE}${r.slug}.svg`, url: POOL_URLS[r.slug] ?? null }));
  });

  // All pools including those without correlations (for hashrate distribution)
  app.get('/api/pools/all', async () => {
    const rows = db.prepare(`
      SELECT p.slug, p.name, p.unique_id, COUNT(h.timestamp) as data_points,
             AVG(h.hashrate) as avg_hashrate,
             COUNT(DISTINCT c.coin_id) as corr_count
      FROM pools p
      JOIN pool_hashrates h ON p.slug = h.pool_slug
      LEFT JOIN correlations c ON c.pool_slug = p.slug
      WHERE p.name != 'Unknown'
      GROUP BY p.slug
      ORDER BY avg_hashrate DESC
    `).all();
    return rows.map((r) => ({
      ...r,
      logo: `${POOL_LOGO_BASE}${r.slug}.svg`,
      url: POOL_URLS[r.slug] ?? null,
      has_correlations: r.corr_count > 0,
    }));
  });

  app.get('/api/pools/:slug/hashrate', async (req) => {
    const { slug } = req.params;
    return db.prepare(`
      SELECT timestamp, hashrate
      FROM pool_hashrates
      WHERE pool_slug = ?
      ORDER BY timestamp
    `).all(slug);
  });

  app.get('/api/prices/:coinId', async (req) => {
    const { coinId } = req.params;
    return db.prepare(`
      SELECT timestamp, price_usd
      FROM crypto_prices
      WHERE coin_id = ?
      ORDER BY timestamp
    `).all(coinId);
  });

  app.get('/api/correlations', async () => {
    return db.prepare(`
      SELECT c.*, p.name as pool_name
      FROM correlations c
      JOIN pools p ON c.pool_slug = p.slug
      WHERE p.name != 'Unknown'
      ORDER BY ABS(c.correlation) DESC
    `).all();
  });

  app.get('/api/correlations/:poolSlug', async (req) => {
    const { poolSlug } = req.params;
    return db.prepare(`
      SELECT c.*, p.name as pool_name
      FROM correlations c
      JOIN pools p ON c.pool_slug = p.slug
      WHERE c.pool_slug = ? AND p.name != 'Unknown'
      ORDER BY ABS(c.correlation) DESC
    `).all(poolSlug);
  });

  app.get('/api/pair/:poolSlug/:coinId', async (req) => {
    const { poolSlug, coinId } = req.params;

    const hashrates = db.prepare(`
      SELECT timestamp, hashrate
      FROM pool_hashrates
      WHERE pool_slug = ?
      ORDER BY timestamp
    `).all(poolSlug);

    const prices = db.prepare(`
      SELECT timestamp, price_usd
      FROM crypto_prices
      WHERE coin_id = ?
      ORDER BY timestamp
    `).all(coinId);

    // Align on nearest timestamps
    const priceMap = new Map();
    for (const p of prices) {
      const hourTs = Math.round(p.timestamp / 3600) * 3600;
      if (!priceMap.has(hourTs)) priceMap.set(hourTs, p.price_usd);
    }

    const points = [];
    for (const h of hashrates) {
      const hourTs = Math.round(h.timestamp / 3600) * 3600;
      let bestTs = null;
      let bestDist = Infinity;
      for (let offset = -12; offset <= 12; offset++) {
        const candidate = hourTs + offset * 3600;
        if (priceMap.has(candidate) && Math.abs(offset) < bestDist) {
          bestDist = Math.abs(offset);
          bestTs = candidate;
        }
      }
      if (bestTs !== null) {
        points.push({
          timestamp: h.timestamp,
          hashrate: h.hashrate,
          price: priceMap.get(bestTs),
        });
      }
    }

    const corr = db.prepare(`
      SELECT correlation, sample_count FROM correlations
      WHERE pool_slug = ? AND coin_id = ?
    `).get(poolSlug, coinId);

    const poolInfo = db.prepare('SELECT name FROM pools WHERE slug = ?').get(poolSlug);

    return {
      poolSlug,
      poolName: poolInfo?.name ?? poolSlug,
      coinId,
      coinName: COIN_NAMES[coinId] ?? coinId,
      correlation: corr?.correlation ?? null,
      sampleCount: corr?.sample_count ?? points.length,
      points,
    };
  });

  app.get('/api/stats', async () => {
    const topPositive = db.prepare(`
      SELECT c.pool_slug, p.name as pool_name, c.coin_id, c.correlation
      FROM correlations c JOIN pools p ON c.pool_slug = p.slug
      WHERE c.sample_count >= 5 AND p.name != 'Unknown'
      ORDER BY c.correlation DESC LIMIT 5
    `).all();

    const topNegative = db.prepare(`
      SELECT c.pool_slug, p.name as pool_name, c.coin_id, c.correlation
      FROM correlations c JOIN pools p ON c.pool_slug = p.slug
      WHERE c.sample_count >= 5 AND p.name != 'Unknown'
      ORDER BY c.correlation ASC LIMIT 5
    `).all();

    const poolCount = db.prepare(`
      SELECT COUNT(DISTINCT pool_slug) as count FROM pool_hashrates h
      JOIN pools p ON h.pool_slug = p.slug WHERE p.name != 'Unknown'
    `).get().count;
    const corrCount = db.prepare(`
      SELECT COUNT(*) as count FROM correlations c
      JOIN pools p ON c.pool_slug = p.slug WHERE p.name != 'Unknown'
    `).get().count;

    // Average correlation per coin
    const avgByCoin = db.prepare(`
      SELECT c.coin_id, AVG(c.correlation) as avg_corr, COUNT(*) as pool_count
      FROM correlations c
      JOIN pools p ON c.pool_slug = p.slug
      WHERE c.sample_count >= 5 AND p.name != 'Unknown'
      GROUP BY c.coin_id
      ORDER BY ABS(avg_corr) DESC
    `).all();

    // Pool hashrate distribution for pie chart — includes all pools + Others bucket
    const allPoolHashrates = db.prepare(`
      SELECT h.pool_slug, p.name as pool_name, AVG(h.hashrate) as avg_hashrate,
             COUNT(DISTINCT c.coin_id) as corr_count
      FROM pool_hashrates h
      JOIN pools p ON h.pool_slug = p.slug
      LEFT JOIN correlations c ON c.pool_slug = h.pool_slug
      WHERE p.name != 'Unknown'
      GROUP BY h.pool_slug
      ORDER BY avg_hashrate DESC
    `).all();

    // Get slugs of pools with correlations
    const activePoolSlugs = new Set(
      allPoolHashrates.filter((p) => p.corr_count > 0).map((p) => p.pool_slug)
    );

    const hashrateDistribution = [];
    let othersHashrate = 0;
    for (const p of allPoolHashrates) {
      if (activePoolSlugs.has(p.pool_slug)) {
        hashrateDistribution.push({ pool_slug: p.pool_slug, pool_name: p.pool_name, avg_hashrate: p.avg_hashrate });
      } else {
        othersHashrate += p.avg_hashrate;
      }
    }
    if (othersHashrate > 0) {
      hashrateDistribution.push({ pool_slug: 'others', pool_name: 'Others', avg_hashrate: othersHashrate });
    }

    return {
      poolCount,
      corrCount,
      topPositive,
      topNegative,
      avgByCoin,
      hashrateDistribution,
    };
  });

  app.post('/api/refresh', async (req, reply) => {
    try {
      console.log('Starting data refresh...');

      console.log('1/4 Fetching pools...');
      await fetchPools();

      console.log('2/4 Fetching pool hashrates...');
      await fetchAllPoolHashrates();

      console.log('3/4 Fetching crypto prices...');
      await fetchAllPrices();

      console.log('4/4 Computing correlations...');
      const computed = computeAllCorrelations();

      return { success: true, correlationsComputed: computed };
    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  app.get('/api/coins', async () => {
    let currentPrices = {};
    try {
      currentPrices = await fetchCurrentPrices();
    } catch { /* ignore rate limit */ }

    return COINS.map((id) => ({
      id,
      name: COIN_NAMES[id] ?? id,
      symbol: COIN_SYMBOLS[id] ?? id.toUpperCase(),
      logo: COIN_LOGOS[id] ?? null,
      price_usd: currentPrices[id]?.usd ?? null,
      url: COIN_URLS[id] ?? null,
    }));
  });

  app.get('/api/overview', async () => {
    // Average hashrate across all pools per day
    const avgHashrate = db.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as timestamp,
        AVG(hashrate) as hashrate
      FROM pool_hashrates
      WHERE pool_slug IN (SELECT slug FROM pools WHERE name != 'Unknown')
      GROUP BY (timestamp / 86400)
      ORDER BY timestamp
    `).all();

    // BTC price per day
    const btcPrice = db.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as timestamp,
        AVG(price_usd) as price
      FROM crypto_prices
      WHERE coin_id = 'bitcoin'
      GROUP BY (timestamp / 86400)
      ORDER BY timestamp
    `).all();

    // Align on common timestamps
    const priceMap = new Map();
    for (const p of btcPrice) priceMap.set(p.timestamp, p.price);

    const points = [];
    for (const h of avgHashrate) {
      // Find closest day within 7 days
      let bestTs = null;
      let bestDist = Infinity;
      for (let offset = -7; offset <= 7; offset++) {
        const candidate = h.timestamp + offset * 86400;
        if (priceMap.has(candidate) && Math.abs(offset) < bestDist) {
          bestDist = Math.abs(offset);
          bestTs = candidate;
        }
      }
      if (bestTs !== null) {
        points.push({
          timestamp: h.timestamp,
          hashrate: h.hashrate,
          price: priceMap.get(bestTs),
        });
      }
    }

    return points;
  });

  app.get('/api/pool-vs-avg/:slug', async (req) => {
    const { slug } = req.params;

    // Pool hashrate per day
    const poolHr = db.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as timestamp,
        AVG(hashrate) as hashrate
      FROM pool_hashrates
      WHERE pool_slug = ?
      GROUP BY (timestamp / 86400)
      ORDER BY timestamp
    `).all(slug);

    // BTC price per day
    const btcPrice = db.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as timestamp,
        AVG(price_usd) as price
      FROM crypto_prices
      WHERE coin_id = 'bitcoin'
      GROUP BY (timestamp / 86400)
      ORDER BY timestamp
    `).all();

    const priceMap = new Map();
    for (const p of btcPrice) priceMap.set(p.timestamp, p.price);

    const points = [];
    for (const h of poolHr) {
      let bestTs = null;
      let bestDist = Infinity;
      for (let offset = -7; offset <= 7; offset++) {
        const candidate = h.timestamp + offset * 86400;
        if (priceMap.has(candidate) && Math.abs(offset) < bestDist) {
          bestDist = Math.abs(offset);
          bestTs = candidate;
        }
      }
      if (bestTs !== null) {
        points.push({
          timestamp: h.timestamp,
          hashrate: h.hashrate,
          price: priceMap.get(bestTs),
        });
      }
    }

    const poolInfo = db.prepare('SELECT name FROM pools WHERE slug = ?').get(slug);
    return { poolName: poolInfo?.name ?? slug, points };
  });

  app.get('/api/coin-vs-avg/:coinId', async (req) => {
    const { coinId } = req.params;

    const coinPrices = db.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as timestamp,
        AVG(price_usd) as price
      FROM crypto_prices
      WHERE coin_id = ?
      GROUP BY (timestamp / 86400)
      ORDER BY timestamp
    `).all(coinId);

    const avgHashrate = db.prepare(`
      SELECT
        (timestamp / 86400) * 86400 as timestamp,
        AVG(hashrate) as hashrate
      FROM pool_hashrates
      GROUP BY (timestamp / 86400)
      ORDER BY timestamp
    `).all();

    const priceMap = new Map();
    for (const p of coinPrices) priceMap.set(p.timestamp, p.price);

    const points = [];
    for (const h of avgHashrate) {
      let bestTs = null, bestDist = Infinity;
      for (let offset = -7; offset <= 7; offset++) {
        const candidate = h.timestamp + offset * 86400;
        if (priceMap.has(candidate) && Math.abs(offset) < bestDist) {
          bestDist = Math.abs(offset);
          bestTs = candidate;
        }
      }
      if (bestTs !== null) {
        points.push({
          timestamp: h.timestamp,
          hashrate: h.hashrate,
          price: priceMap.get(bestTs),
        });
      }
    }
    return { coinId, points };
  });

  app.get('/api/coin-detail/:coinId', async (req) => {
    const { coinId } = req.params;

    const prices = db.prepare(`
      SELECT timestamp, price_usd
      FROM crypto_prices
      WHERE coin_id = ?
      ORDER BY timestamp
    `).all(coinId);

    // All pool hashrates aligned with this coin's prices — only pools with correlations
    const poolHashrates = db.prepare(`
      SELECT h.pool_slug, p.name as pool_name,
             (h.timestamp / 86400) * 86400 as timestamp,
             AVG(h.hashrate) as hashrate
      FROM pool_hashrates h
      JOIN pools p ON h.pool_slug = p.slug
      WHERE p.name != 'Unknown'
        AND h.pool_slug IN (SELECT DISTINCT pool_slug FROM correlations WHERE coin_id = ?)
      GROUP BY h.pool_slug, (h.timestamp / 86400)
      ORDER BY h.pool_slug, timestamp
    `).all(coinId);

    // Correlations for this coin
    const correlations = db.prepare(`
      SELECT c.pool_slug, p.name as pool_name, c.correlation, c.sample_count
      FROM correlations c
      JOIN pools p ON c.pool_slug = p.slug
      WHERE c.coin_id = ? AND p.name != 'Unknown'
      ORDER BY ABS(c.correlation) DESC
    `).all(coinId);

    // Build price map for alignment
    const priceMap = new Map();
    for (const p of prices) {
      const dayTs = Math.round(p.timestamp / 86400) * 86400;
      priceMap.set(dayTs, p.price_usd);
    }

    // Group pool hashrates by pool
    const poolMap = new Map();
    for (const row of poolHashrates) {
      if (!poolMap.has(row.pool_slug)) {
        poolMap.set(row.pool_slug, { slug: row.pool_slug, name: row.pool_name, points: [] });
      }
      poolMap.get(row.pool_slug).points.push({ timestamp: row.timestamp, hashrate: row.hashrate });
    }

    // Align each pool's hashrate with coin prices
    const poolSeries = [];
    for (const [slug, poolData] of poolMap) {
      const aligned = [];
      for (const h of poolData.points) {
        let bestTs = null, bestDist = Infinity;
        for (let offset = -7; offset <= 7; offset++) {
          const candidate = h.timestamp + offset * 86400;
          if (priceMap.has(candidate) && Math.abs(offset) < bestDist) {
            bestDist = Math.abs(offset);
            bestTs = candidate;
          }
        }
        if (bestTs !== null) {
          aligned.push({ timestamp: h.timestamp, hashrate: h.hashrate, price: priceMap.get(bestTs) });
        }
      }
      if (aligned.length > 0) {
        poolSeries.push({ ...poolData, points: aligned });
      }
    }

    // Sort poolSeries by absolute correlation descending
    const corrLookup = new Map(correlations.map((c) => [c.pool_slug, Math.abs(c.correlation)]));
    poolSeries.sort((a, b) => (corrLookup.get(b.slug) ?? 0) - (corrLookup.get(a.slug) ?? 0));

    return {
      coinId,
      coinName: COIN_NAMES[coinId] ?? coinId,
      symbol: COIN_SYMBOLS[coinId] ?? coinId.toUpperCase(),
      logo: COIN_LOGOS[coinId] ?? null,
      correlations,
      poolSeries,
      prices: prices.map((p) => ({ timestamp: p.timestamp, price: p.price_usd })),
    };
  });
}
