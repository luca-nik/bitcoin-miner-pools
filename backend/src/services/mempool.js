import db from '../db.js';

const BASE = 'https://mempool.space';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchPools() {
  const res = await fetch(`${BASE}/api/v1/mining/pools`);
  if (!res.ok) throw new Error(`mempool pools: ${res.status}`);
  const pools = await res.json();

  const upsert = db.prepare(
    'INSERT OR REPLACE INTO pools (slug, name, unique_id) VALUES (?, ?, ?)'
  );

  const insertMany = db.transaction((items) => {
    for (const p of items) {
      upsert.run(p.slug, p.name, p.unique_id ?? null);
    }
  });

  insertMany(pools);
  console.log(`Fetched ${pools.length} pools from mempool.space`);
  return pools;
}

export async function fetchPoolHashrate(slug) {
  const res = await fetch(`${BASE}/api/v1/mining/pool/${slug}/hashrate`);
  if (!res.ok) {
    console.warn(`Pool hashrate ${slug}: ${res.status}`);
    return [];
  }
  const data = await res.json();

  const entries = Array.isArray(data) ? data : data.hashrates ?? [];

  const insert = db.prepare(
    'INSERT OR REPLACE INTO pool_hashrates (pool_slug, timestamp, hashrate) VALUES (?, ?, ?)'
  );

  const insertMany = db.transaction((items) => {
    for (const e of items) {
      const ts = typeof e.timestamp === 'number' && e.timestamp > 1e12
        ? Math.floor(e.timestamp / 1000)
        : e.timestamp;
      insert.run(slug, ts, e.avgHashrate ?? e.hashrate ?? 0);
    }
  });

  insertMany(entries);
  console.log(`  ${slug}: ${entries.length} hashrate points`);
  await delay(500);
  return entries;
}

export async function fetchAllPoolHashrates() {
  const pools = db.prepare('SELECT slug FROM pools ORDER BY slug').all();

  // Fetch top pools by checking timeline for block counts
  const timelineRes = await fetch(`${BASE}/api/v1/mining/pools/timeline`);
  let topSlugs = pools.map((p) => p.slug);

  if (timelineRes.ok) {
    const timeline = await timelineRes.json();
    const poolData = timeline.pools ?? [];
    // Take top 15 pools by blockCount
    topSlugs = poolData
      .sort((a, b) => (b.blockCount ?? 0) - (a.blockCount ?? 0))
      .slice(0, 15)
      .map((p) => p.slug);
  }

  console.log(`Fetching hashrates for top ${topSlugs.length} pools...`);
  await delay(500);

  for (const slug of topSlugs) {
    try {
      await fetchPoolHashrate(slug);
    } catch (err) {
      console.error(`Error fetching ${slug}:`, err.message);
    }
  }
}

export async function fetchGlobalHashrate(interval = '3d') {
  const res = await fetch(`${BASE}/api/v1/mining/hashrate/${interval}`);
  if (!res.ok) throw new Error(`mempool hashrate: ${res.status}`);
  return res.json();
}
