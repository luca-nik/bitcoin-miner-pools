import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

const fmtDate = (ts) => {
  if (ts == null || isNaN(ts)) return '';
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: '#0a0a0a',
      border: '1px solid #1f521f',
      fontSize: 11,
      fontFamily: '"JetBrains Mono", monospace',
      color: '#33ff00',
      padding: '10px 14px',
      minWidth: 140,
    }}>
      <p style={{ marginBottom: 6, color: '#4a6741', fontSize: 10 }}>{fmtDate(label)}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < payload.length - 1 ? 4 : 0 }}>
          <span style={{
            display: 'inline-block',
            width: 12,
            height: 3,
            backgroundColor: entry.color,
            flexShrink: 0,
          }} />
          <span style={{ color: '#4a6741', flex: 1 }}>{entry.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: '#33ff00', fontWeight: 600 }}>
            {typeof entry.value === 'number' ? entry.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function RangeSlider({ data, range, onChange }) {
  const trackRef = useRef(null);
  const dragging = useRef(null);

  const len = Math.max(1, data.length - 1);
  const leftPct = (range[0] / len) * 100;
  const rightPct = (range[1] / len) * 100;

  const idxToPct = (idx) => (idx / len) * 100;
  const pctToIdx = (pct) => Math.round((pct / 100) * len);

  const handleMouseDown = (handle) => (e) => {
    e.preventDefault();
    dragging.current = handle;
    const onMove = (ev) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
      const idx = pctToIdx(pct);
      if (dragging.current === 'left') {
        onChange([Math.min(idx, range[1] - 1), range[1]]);
      } else if (dragging.current === 'right') {
        onChange([range[0], Math.max(idx, range[0] + 1)]);
      } else if (dragging.current === 'mid') {
        const span = range[1] - range[0];
        const newStart = Math.max(0, Math.min(len - span, idx - Math.round(span / 2)));
        onChange([newStart, newStart + span]);
      }
    };
    const onUp = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleTouchStart = (handle) => (e) => {
    e.preventDefault();
    dragging.current = handle;
    const onMove = (ev) => {
      if (!trackRef.current || !ev.touches[0]) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((ev.touches[0].clientX - rect.left) / rect.width) * 100));
      const idx = pctToIdx(pct);
      if (dragging.current === 'left') {
        onChange([Math.min(idx, range[1] - 1), range[1]]);
      } else if (dragging.current === 'right') {
        onChange([range[0], Math.max(idx, range[0] + 1)]);
      }
    };
    const onEnd = () => {
      dragging.current = null;
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const startDate = fmtDate(data[range[0]]?.timestamp);
  const endDate = fmtDate(data[range[1]]?.timestamp);

  // Generate 5 tick marks along the full data range
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const idx = Math.round(f * len);
    return { pct: f * 100, label: fmtDate(data[idx]?.timestamp) };
  });

  return (
    <div style={{ paddingLeft: 10, paddingRight: 60, marginTop: 6 }}>
      {/* Date range display */}
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] font-mono text-term-fg">{startDate}</span>
        <span className="text-[10px] font-mono text-term-muted">
          {range[1] - range[0] + 1} / {data.length} pts
        </span>
        <span className="text-[10px] font-mono text-term-fg">{endDate}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-5 border border-term-muted cursor-crosshair select-none"
        style={{ backgroundColor: '#0d1a0d' }}
      >
        {/* Dimmed left region */}
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: `${leftPct}%`, backgroundColor: 'rgba(15,40,15,0.6)' }}
        />
        {/* Selected region */}
        <div
          className="absolute top-0 h-full"
          style={{
            left: `${leftPct}%`,
            width: `${rightPct - leftPct}%`,
            backgroundColor: 'rgba(51,255,0,0.08)',
            borderLeft: '1px solid #33ff00',
            borderRight: '1px solid #33ff00',
            zIndex: 5,
          }}
          onMouseDown={handleMouseDown('mid')}
        />
        {/* Dimmed right region */}
        <div
          className="absolute top-0 right-0 h-full"
          style={{ width: `${100 - rightPct}%`, backgroundColor: 'rgba(15,40,15,0.6)' }}
        />

        {/* Left handle */}
        <div
          onMouseDown={handleMouseDown('left')}
          onTouchStart={handleTouchStart('left')}
          className="absolute top-1/2 -translate-y-1/2 cursor-ew-resize"
          style={{ left: `${leftPct}%`, zIndex: 10, width: 24, marginLeft: -12 }}
        >
          <div className="w-1.5 h-7 bg-term-fg mx-auto" style={{ border: '1px solid #0a0a0a' }} />
        </div>
        {/* Right handle */}
        <div
          onMouseDown={handleMouseDown('right')}
          onTouchStart={handleTouchStart('right')}
          className="absolute top-1/2 -translate-y-1/2 cursor-ew-resize"
          style={{ left: `${rightPct}%`, zIndex: 10, width: 24, marginLeft: -12 }}
        >
          <div className="w-1.5 h-7 bg-term-fg mx-auto" style={{ border: '1px solid #0a0a0a' }} />
        </div>
      </div>

      {/* Tick marks */}
      <div className="relative h-3 mt-0.5">
        {ticks.map((t, i) => (
          <span key={i}
            className="absolute text-[9px] font-mono text-term-muted"
            style={{ left: `${t.pct}%`, transform: 'translateX(-50%)' }}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ZoomableChart({
  data,
  series = [],
  height = 300,
  leftAxis,
  rightAxis,
  externalRange,
  onRangeChange,
  source,
}) {
  const [internalRange, setInternalRange] = useState(null);

  useEffect(() => {
    setInternalRange(null);
  }, [data]);

  const range = externalRange ?? internalRange ?? [0, Math.max(0, data.length - 1)];

  const visible = useMemo(
    () => data.slice(range[0], range[1] + 1),
    [data, range]
  );

  const handleSliderChange = useCallback((newRange) => {
    if (onRangeChange) {
      onRangeChange(newRange, data);
    } else {
      setInternalRange(newRange);
    }
  }, [onRangeChange, data]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={visible} margin={{ top: 5, right: 50, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f521f" />
          <XAxis
            dataKey="timestamp"
            tickFormatter={fmtDate}
            stroke="#1f521f"
            tick={{ fontSize: 10, fill: '#33ff00', fontFamily: '"JetBrains Mono", monospace' }}
            tickLine={{ stroke: '#1f521f' }}
          />
          {leftAxis && (
            <YAxis yAxisId="left" orientation="left" stroke={leftAxis.color}
              tick={{ fontSize: 10, fill: leftAxis.color, fontFamily: '"JetBrains Mono", monospace' }}
              tickFormatter={leftAxis.formatter} />
          )}
          {rightAxis && (
            <YAxis yAxisId="right" orientation="right" stroke={rightAxis.color}
              tick={{ fontSize: 10, fill: rightAxis.color, fontFamily: '"JetBrains Mono", monospace' }}
              tickFormatter={rightAxis.formatter} />
          )}
          <Tooltip content={<CustomTooltip />} cursor={false} allowEscapeViewBox={{ x: false, y: true }} />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              yAxisId={s.yAxisId ?? 'left'}
              type="monotone"
              dataKey={s.dataKey}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              name={s.name}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend with line indicators */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 mt-2">
        {series.map((s) => (
          <div key={s.dataKey} className="flex items-center gap-2 text-xs text-term-gray">
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>

      {/* Custom range slider */}
      {data.length > 5 && (
        <RangeSlider data={data} range={range} onChange={handleSliderChange} />
      )}

      {/* Data source banner */}
      {source && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <span className="text-term-muted text-[9px] font-mono uppercase">SRC:</span>
          <span className="text-term-gray text-[9px] font-mono">{source}</span>
        </div>
      )}
    </div>
  );
}
