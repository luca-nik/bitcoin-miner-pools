import { describe, it, expect } from 'vitest';
import { pearson, pctChanges, lagArray, alignByTimestamp, laggedCorrelations, bestLag } from '../lib/analysis.js';

describe('pearson', () => {
  it('returns null for fewer than 5 pairs', () => {
    expect(pearson([1, 2, 3, 4], [1, 2, 3, 4])).toBeNull();
  });

  it('returns 1 for perfectly correlated series', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(pearson(xs, xs)).toBeCloseTo(1, 10);
  });

  it('returns -1 for perfectly anti-correlated series', () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const ys = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expect(pearson(xs, ys)).toBeCloseTo(-1, 10);
  });

  it('returns 0 for uncorrelated series', () => {
    const xs = [1, -1, 1, -1, 1, -1, 1, -1];
    const ys = [1, 1, -1, -1, 1, 1, -1, -1];
    expect(pearson(xs, ys)).toBeCloseTo(0, 10);
  });

  it('handles nulls gracefully', () => {
    const xs = [1, null, 3, 4, 5, 6, 7, 8];
    const ys = [1, 2, null, 4, 5, 6, 7, 8];
    const result = pearson(xs, ys);
    expect(result).not.toBeNull();
    // 6 valid pairs
    expect(result).toBeCloseTo(1, 10);
  });

  it('handles all-null arrays', () => {
    expect(pearson([null, null, null, null, null], [null, null, null, null, null])).toBeNull();
  });

  it('returns null for constant series (zero denom)', () => {
    expect(pearson([5, 5, 5, 5, 5], [1, 2, 3, 4, 5])).toBeNull();
  });
});

describe('pctChanges', () => {
  it('returns null for first element', () => {
    const result = pctChanges([10, 20, 30]);
    expect(result[0]).toBeNull();
  });

  it('computes correct percent changes', () => {
    const result = pctChanges([100, 110, 99, 0]);
    expect(result[1]).toBeCloseTo(0.1);
    expect(result[2]).toBeCloseTo(-0.1);
    expect(result[3]).toBeCloseTo(-1);
  });

  it('returns null for division by zero', () => {
    const result = pctChanges([0, 10]);
    expect(result[1]).toBeNull();
  });

  it('handles nulls', () => {
    const result = pctChanges([null, 10, 20]);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBeCloseTo(1.0);
  });
});

describe('lagArray', () => {
  it('returns copy for lag 0', () => {
    const arr = [1, 2, 3];
    const result = lagArray(arr, 0);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(arr);
  });

  it('shifts right for positive lag', () => {
    const result = lagArray([1, 2, 3, 4, 5], 2);
    expect(result).toEqual([null, null, 1, 2, 3]);
  });

  it('fills with nulls for lag > length', () => {
    const result = lagArray([1, 2], 5);
    expect(result).toEqual([null, null]);
  });
});

describe('alignByTimestamp', () => {
  it('aligns on matching timestamps', () => {
    const a = [
      { timestamp: 100, val: 1 },
      { timestamp: 200, val: 2 },
      { timestamp: 300, val: 3 },
    ];
    const b = [
      { timestamp: 200, val: 20 },
      { timestamp: 300, val: 30 },
      { timestamp: 400, val: 40 },
    ];
    const result = alignByTimestamp(a, b);
    expect(result.timestamps).toEqual([200, 300]);
    expect(result.seriesA).toEqual([{ timestamp: 200, val: 2 }, { timestamp: 300, val: 3 }]);
    expect(result.seriesB).toEqual([{ timestamp: 200, val: 20 }, { timestamp: 300, val: 30 }]);
  });

  it('returns empty for no overlap', () => {
    const a = [{ timestamp: 100, val: 1 }];
    const b = [{ timestamp: 200, val: 2 }];
    const result = alignByTimestamp(a, b);
    expect(result.timestamps).toEqual([]);
  });
});

describe('laggedCorrelations', () => {
  it('computes correlations for each lag', () => {
    const n = 30;
    const data = Array.from({ length: n }, (_, i) => ({
      hashrate: 100 + i * 2 + Math.random() * 5,
      price: 50 + i * 3 + Math.random() * 5,
    }));

    const results = laggedCorrelations(
      data, data,
      (d) => d.hashrate, (d) => d.price,
      [0, 1, 3]
    );

    expect(results).toHaveLength(3);
    expect(results[0].lag).toBe(0);
    expect(results[1].lag).toBe(1);
    expect(results[2].lag).toBe(3);

    // All should be highly correlated (trending series)
    for (const r of results) {
      expect(r.correlation).not.toBeNull();
      expect(r.correlation).toBeGreaterThan(0.8);
    }
  });

  it('returns null for insufficient data at large lags', () => {
    const data = Array.from({ length: 6 }, (_, i) => ({
      hashrate: i,
      price: i * 2,
    }));

    const results = laggedCorrelations(
      data, data,
      (d) => d.hashrate, (d) => d.price,
      [0, 60]
    );

    expect(results[0].correlation).not.toBeNull();
    // lag 60 with only 6 points: after shifting, very few valid pairs
    expect(results[1].sampleCount).toBeLessThan(5);
    expect(results[1].correlation).toBeNull();
  });
});

describe('bestLag', () => {
  it('finds the strongest absolute correlation', () => {
    const results = [
      { lag: 0, correlation: 0.3, sampleCount: 100 },
      { lag: 7, correlation: -0.8, sampleCount: 90 },
      { lag: 14, correlation: 0.5, sampleCount: 80 },
    ];
    const best = bestLag(results);
    expect(best.lag).toBe(7);
    expect(best.correlation).toBe(-0.8);
  });

  it('returns null for all-null results', () => {
    const results = [
      { lag: 0, correlation: null, sampleCount: 0 },
      { lag: 7, correlation: null, sampleCount: 0 },
    ];
    expect(bestLag(results)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(bestLag([])).toBeNull();
  });
});
