import { useState, useRef } from 'react';

const DEPTH = 30;
const LAYERS = 12;

function darken(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

function slicePath(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle < 0.001) return '';
  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${start.x},${start.y} A${r},${r} 0 ${large} 1 ${end.x},${end.y} Z`;
}

export default function Pie3D({ data, colors, onClickSlice }) {
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const containerRef = useRef(null);

  const total = data.reduce((s, d) => s + d.value, 0);
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const s = { ...d, startAngle: angle, endAngle: angle + sweep, color: colors[i % colors.length], index: i };
    angle += sweep;
    return s;
  });

  const cx = 200;
  const cy = 160;
  const radius = 130;

  const handleMouseMove = (e, i) => {
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setHovered(i);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 400, height: 420, margin: '0 auto', perspective: '800px' }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 400"
        style={{ transform: 'rotateX(45deg)', transformOrigin: '200px 200px' }}
      >
        {Array.from({ length: LAYERS }).map((_, layer) => {
          const yOff = (layer / LAYERS) * DEPTH;
          const darkFactor = 0.3 + (layer / LAYERS) * 0.3;
          return (
            <g key={`layer-${layer}`} transform={`translate(0, ${yOff})`}>
              {slices.map((s, i) => (
                <path
                  key={i}
                  d={slicePath(cx, cy, radius, s.startAngle, s.endAngle)}
                  fill={darken(s.color, darkFactor)}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="0.5"
                />
              ))}
            </g>
          );
        })}
        {slices.map((s, i) => (
          <path
            key={`top-${i}`}
            d={slicePath(cx, cy, radius, s.startAngle, s.endAngle)}
            fill={s.color}
            stroke="rgba(0,0,0,0.2)"
            strokeWidth="1"
            style={{
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              transform: hovered === i ? 'scale(1.04)' : 'scale(1)',
              transformOrigin: `${cx}px ${cy}px`,
            }}
            onMouseEnter={(e) => handleMouseMove(e, i)}
            onMouseMove={(e) => handleMouseMove(e, i)}
            onMouseLeave={() => { setHovered(null); setTooltipPos(null); }}
            onClick={() => onClickSlice?.(s.index)}
          />
        ))}
        {slices.map((s, i) => {
          const midAngle = (s.startAngle + s.endAngle) / 2;
          const labelR = radius * 0.65;
          const lx = cx + labelR * Math.cos(midAngle);
          const ly = cy + labelR * Math.sin(midAngle);
          const pct = ((s.value / total) * 100).toFixed(0);
          if (pct < 5) return null;
          return (
            <text
              key={`lbl-${i}`}
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="#0a0a0a"
              fontSize="11"
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              {pct}%
            </text>
          );
        })}
      </svg>

      {hovered !== null && tooltipPos && (
        <div style={{
          position: 'absolute',
          left: tooltipPos.x + 15,
          top: tooltipPos.y - 10,
          background: '#0a0a0a',
          border: '1px solid #1f521f',
          padding: '10px 14px',
          pointerEvents: 'none',
          zIndex: 50,
          minWidth: 150,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11,
          color: '#33ff00',
        }}>
          <p style={{ color: slices[hovered].color, fontWeight: 600, fontSize: 12, margin: 0, textShadow: '0 0 5px rgba(51,255,0,0.3)' }}>
            {slices[hovered].name}
          </p>
          <p style={{ color: '#33ff00', fontSize: 11, margin: '4px 0 0' }}>
            {formatHR(slices[hovered].value)}
          </p>
          <p style={{ color: '#4a6741', fontSize: 10, margin: '2px 0 0' }}>
            {((slices[hovered].value / total) * 100).toFixed(1)}% of total
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 overflow-hidden" style={{ marginTop: -10 }}>
        {data.slice(0, 10).map((d, i) => (
          <button
            key={d.slug ?? d.name}
            onClick={() => d.slug !== 'others' && onClickSlice?.(i)}
            className={`flex items-center gap-1 text-[10px] transition-colors font-mono whitespace-nowrap ${d.slug !== 'others' ? 'text-term-gray hover:text-term-fg cursor-pointer' : 'text-term-muted cursor-default'}`}
          >
            <span className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            {d.name.length > 10 ? d.name.slice(0, 9) + '.' : d.name}
            <span className="text-term-muted">{((d.value / total) * 100).toFixed(0)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatHR(h) {
  if (h >= 1e18) return `${(h / 1e18).toFixed(2)} EH/s`;
  if (h >= 1e15) return `${(h / 1e15).toFixed(2)} PH/s`;
  if (h >= 1e12) return `${(h / 1e12).toFixed(2)} TH/s`;
  return `${h.toFixed(0)} H/s`;
}
