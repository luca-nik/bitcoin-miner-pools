import { RadialBarChart, RadialBar, PolarRadiusAxis, Tooltip } from 'recharts';

const fmtHashrate = (h) => {
  if (h >= 1e18) return `${(h / 1e18).toFixed(1)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(1)} PH/s`;
  return `${(h / 1e12).toFixed(1)} TH/s`;
};

export default function RadialHashrate({ data, colors, onClickSegment }) {
  const totalHashrate = data.reduce((s, d) => s + d.value, 0);
  const totalFormatted = fmtHashrate(totalHashrate);

  const chartData = [{}];
  const poolKeys = [];
  for (let i = 0; i < data.length; i++) {
    const key = `pool_${i}`;
    chartData[0][key] = data[i].value;
    poolKeys.push({ key, name: data[i].name, slug: data[i].slug, color: colors[i % colors.length], value: data[i].value });
  }

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: 320, height: 200, position: 'relative' }}>
        <RadialBarChart
          data={chartData}
          startAngle={180}
          endAngle={0}
          innerRadius={60}
          outerRadius={100}
          width={320}
          height={200}
          barSize={40}
        >
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={false}
            contentStyle={{
              backgroundColor: '#0a0a0a',
              border: '1px solid #1f521f',
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              color: '#33ff00',
            }}
            formatter={(value, name) => {
              const pool = poolKeys.find((p) => p.key === name);
              return [fmtHashrate(value), pool?.name ?? name];
            }}
          />
          {poolKeys.map((pool) => (
            <RadialBar
              key={pool.key}
              dataKey={pool.key}
              fill={pool.color}
              stackId="a"
              cornerRadius={0}
              style={{ cursor: pool.slug !== 'others' ? 'pointer' : 'default' }}
              onClick={() => {
                if (pool.slug !== 'others') onClickSegment?.(poolKeys.indexOf(pool));
              }}
            />
          ))}
        </RadialBarChart>
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}>
          <p className="text-xl font-bold font-mono text-term-fg" style={{ textShadow: '0 0 5px rgba(51,255,0,0.5)' }}>{totalFormatted.split(' ')[0]}</p>
          <p className="text-xs text-term-muted">{totalFormatted.split(' ')[1]} total</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {data.map((d, i) => (
          <button
            key={d.slug}
            onClick={() => d.slug !== 'others' && onClickSegment?.(i)}
            className={`flex items-center gap-1.5 text-xs transition-colors font-mono ${d.slug !== 'others' ? 'text-term-gray hover:text-term-fg cursor-pointer' : 'text-term-muted cursor-default'}`}
          >
            <span className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            {d.name}
            <span className="text-term-muted">{((d.value / totalHashrate) * 100).toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
