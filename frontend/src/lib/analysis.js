/**
 * Pearson correlation coefficient between two arrays.
 * Returns null if insufficient valid pairs (< 5).
 */
export function pearson(xs, ys) {
  const pairs = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null && isFinite(xs[i]) && isFinite(ys[i])) {
      pairs.push([xs[i], ys[i]]);
    }
  }
  if (pairs.length < 5) return null;

  const n = pairs.length;
  const sumX = pairs.reduce((s, p) => s + p[0], 0);
  const sumY = pairs.reduce((s, p) => s + p[1], 0);
  const sumXY = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const sumX2 = pairs.reduce((s, p) => s + p[0] * p[0], 0);
  const sumY2 = pairs.reduce((s, p) => s + p[1] * p[1], 0);

  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  if (denom === 0) return null;

  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Compute percent changes from an array.
 * Returns array of same length; first element is null.
 */
export function pctChanges(values) {
  return values.map((v, i) => {
    if (i === 0 || v == null || values[i - 1] == null || values[i - 1] === 0) return null;
    return (v - values[i - 1]) / Math.abs(values[i - 1]);
  });
}

/**
 * Shift an array by `lag` positions.
 * Positive lag = shift right (delay): element[i] gets old element[i - lag].
 * Fills gaps with null.
 */
export function lagArray(arr, lag) {
  if (lag === 0) return [...arr];
  const result = new Array(arr.length).fill(null);
  for (let i = 0; i < arr.length; i++) {
    const src = i - lag;
    if (src >= 0 && src < arr.length) {
      result[i] = arr[src];
    }
  }
  return result;
}

/**
 * Align two time-series by timestamp.
 * Returns { timestamps, seriesA, seriesB } with matched values.
 */
export function alignByTimestamp(dataA, dataB, tsKey = 'timestamp') {
  const mapB = new Map();
  for (const d of dataB) {
    const ts = d[tsKey];
    if (ts != null && !mapB.has(ts)) mapB.set(ts, d);
  }

  const timestamps = [];
  const seriesA = [];
  const seriesB = [];

  for (const d of dataA) {
    const ts = d[tsKey];
    if (ts == null) continue;
    const match = mapB.get(ts);
    if (match) {
      timestamps.push(ts);
      seriesA.push(d);
      seriesB.push(match);
    }
  }

  return { timestamps, seriesA, seriesB };
}

/**
 * Compute lagged correlations for a set of lag values.
 * `getValues(series)` extracts the numeric array from each aligned series element.
 * Returns array of { lag, correlation, sampleCount }.
 */
export function laggedCorrelations(alignedA, alignedB, getA, getB, lags) {
  const valsA = alignedA.map(getA);
  const valsB = alignedB.map(getB);

  return lags.map((lag) => {
    const shiftedB = lagArray(valsB, lag);
    const corr = pearson(valsA, shiftedB);
    const validPairs = valsA.filter((v, i) => v != null && shiftedB[i] != null).length;
    return { lag, correlation: corr, sampleCount: validPairs };
  });
}

/**
 * Find the lag with the strongest absolute correlation.
 */
export function bestLag(results) {
  const valid = results.filter((r) => r.correlation != null);
  if (valid.length === 0) return null;
  return valid.reduce((best, r) =>
    Math.abs(r.correlation) > Math.abs(best.correlation) ? r : best
  );
}
