import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const fmtDate = (ts) => {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const fmtHashrate = (h) => {
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  if (h >= 1e12) return `${(h / 1e12).toFixed(1)} TH/s`;
  return `${h.toFixed(0)} H/s`;
};

export default function TimeSeriesChart({ points, normalized = false, poolName, coinName }) {
  if (!points?.length) return <p className="text-term-muted text-sm">{'>'} NO DATA AVAILABLE</p>;

  let data;
  if (normalized) {
    const firstH = points[0].hashrate;
    const firstP = points[0].price;
    data = points.map((p) => ({
      timestamp: p.timestamp,
      hashrate: firstH ? ((p.hashrate - firstH) / firstH) * 100 : 0,
      price: firstP ? ((p.price - firstP) / firstP) * 100 : 0,
    }));
  } else {
    data = points;
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 10, right: 40, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f521f" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={fmtDate}
          stroke="#1f521f"
          tick={{ fontSize: 10, fill: '#33ff00', fontFamily: '"JetBrains Mono", monospace' }}
        />
        <YAxis
          yAxisId="hashrate"
          orientation="left"
          stroke="#33ff00"
          tick={{ fontSize: 10, fill: '#33ff00', fontFamily: '"JetBrains Mono", monospace' }}
          tickFormatter={normalized ? (v) => `${v.toFixed(0)}%` : fmtHashrate}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          stroke="#ffb000"
          tick={{ fontSize: 10, fill: '#ffb000', fontFamily: '"JetBrains Mono", monospace' }}
          tickFormatter={normalized ? (v) => `${v.toFixed(0)}%` : (v) => `$${v.toLocaleString()}`}
        />
        <Tooltip
          cursor={false}
          contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #1f521f', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#33ff00' }}
          labelFormatter={fmtDate}
          formatter={(value, name) => {
            if (normalized) return [`${value.toFixed(2)}%`, name];
            if (name.includes('Hashrate')) return [fmtHashrate(value), name];
            return [`$${value.toLocaleString()}`, name];
          }}
        />
        <Legend />
        <Line
          yAxisId="hashrate"
          type="monotone"
          dataKey="hashrate"
          name={`${poolName} Hashrate`}
          stroke="#33ff00"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="price"
          name={`${coinName} Price`}
          stroke="#ffb000"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
