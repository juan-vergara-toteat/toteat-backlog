// =====================================================================
// Sparkline — inline SVG, sin dependencias.
// Renderiza la última secuencia de observaciones como una línea de
// tendencia. Cuando no hay datos: dejamos un trazo sutil punteado para
// no mostrar el placeholder "—".
// =====================================================================

type SparklineProps = {
  values: number[];
  direction: 'up' | 'down';
  width?: number;
  height?: number;
};

export function Sparkline({ values, direction, width = 120, height = 30 }: SparklineProps) {
  // Empty state: no observations yet → muted dashed baseline
  if (!values || values.length === 0) {
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
           style={{ display: 'block' }}>
        <line
          x1={2} x2={width - 2} y1={height / 2} y2={height / 2}
          stroke="var(--line-2)" strokeWidth={1} strokeDasharray="3,3"
        />
      </svg>
    );
  }

  // Single observation: draw a dot in the middle
  if (values.length === 1) {
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
           style={{ display: 'block' }}>
        <circle cx={width / 2} cy={height / 2} r={2.5} fill="var(--coral)" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const step = innerW / (values.length - 1);

  const points = values.map((v, i) => {
    const x = padX + i * step;
    // Higher value → smaller y (top of svg). Direction doesn't flip the
    // axis: we always show the actual trajectory; the arrow on the card
    // already encodes "up is good" / "down is good".
    const y = padY + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const polylinePts = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  // Soft area fill below the line (alpha-blended coral)
  const areaPath =
    `M ${points[0][0].toFixed(2)},${(height - padY).toFixed(2)} ` +
    points.map(([x, y]) => `L ${x.toFixed(2)},${y.toFixed(2)}`).join(' ') +
    ` L ${points[points.length - 1][0].toFixed(2)},${(height - padY).toFixed(2)} Z`;

  const [lastX, lastY] = points[points.length - 1];

  // Mute the trend color slightly when the trajectory is going against
  // the desired direction. Net delta = last - first.
  const netDelta = values[values.length - 1] - values[0];
  const goingRightWay = direction === 'up' ? netDelta >= 0 : netDelta <= 0;
  const stroke = goingRightWay ? 'var(--coral)' : 'var(--muted)';

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
         style={{ display: 'block' }}>
      <path d={areaPath} fill={stroke} fillOpacity={0.12} />
      <polyline
        points={polylinePts}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={stroke} />
    </svg>
  );
}
