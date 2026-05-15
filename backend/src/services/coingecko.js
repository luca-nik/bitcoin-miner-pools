import db from '../db.js';

const BASE = 'https://api.coingecko.com/api/v3';

const COINS = [
  'bitcoin',
  'ethereum',
  'solana',
  'litecoin',
  'cardano',
  'polkadot',
  'chainlink',
  'avalanche-2',
];

const COIN_NAMES = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  litecoin: 'LTC',
  cardano: 'ADA',
  polkadot: 'DOT',
  chainlink: 'LINK',
  'avalanche-2': 'AVAX',
};

export { COINS, COIN_NAMES };

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchPriceHistory(coinId, days = 'max') {
  const url = `${BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);

  if (res.status === 429) {
    console.warn(`CoinGecko rate limited for ${coinId}, waiting 60s...`);
    await delay(60000);
    return fetchPriceHistory(coinId, days);
  }

  if (!res.ok) throw new Error(`CoinGecko ${coinId}: ${res.status}`);
  const data = await res.json();

  const prices = data.prices ?? [];

  const insert = db.prepare(
    'INSERT OR REPLACE INTO crypto_prices (coin_id, timestamp, price_usd) VALUES (?, ?, ?)'
  );

  const insertMany = db.transaction((items) => {
    for (const [tsMs, price] of items) {
      const ts = Math.floor(tsMs / 1000);
      insert.run(coinId, ts, price);
    }
  });

  insertMany(prices);
  console.log(`  ${coinId}: ${prices.length} price points`);
  return prices;
}

export async function fetchAllPrices(days = 365) {
  console.log(`Fetching prices for ${COINS.length} coins (last ${days} days)...`);

  for (const coin of COINS) {
    try {
      await fetchPriceHistory(coin, days);
      await delay(2100);
    } catch (err) {
      console.error(`Error fetching ${coin}:`, err.message);
      await delay(5000);
    }
  }
}

export async function fetchCurrentPrices() {
  const ids = COINS.join(',');
  const url = `${BASE}/simple/price?ids=${ids}&vs_currencies=usd`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko current prices: ${res.status}`);
  return res.json();
}
