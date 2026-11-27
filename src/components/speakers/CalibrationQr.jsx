import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { QR_MAX_BYTES, qrMatrix } from '@/lib/qrCode';

export default function CalibrationQr({ value, className, label = 'Cod QR pentru calibrarea cu telefonul' }) {
  const matrix = useMemo(() => (
    new TextEncoder().encode(value).length <= QR_MAX_BYTES ? qrMatrix(value) : null
  ), [value]);

  if (!matrix) return (
    <a href={value} className="text-xs underline">
      Deschide linkul
    </a>
  );
  const size = matrix.length;
  const quietZone = 4;

  return (
    <div className={cn('rounded-2xl bg-white p-3 shadow-panel', className)}>
      <svg
        viewBox={`${-quietZone} ${-quietZone} ${size + 2 * quietZone} ${size + 2 * quietZone}`}
        className="h-full w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label={label}
      >
        <rect x={-quietZone} y={-quietZone} width={size + 2 * quietZone} height={size + 2 * quietZone} fill="#ffffff" />
        {matrix.map((row, y) => row.map((dark, x) => (
          dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111111" /> : null
        )))}
      </svg>
    </div>
  );
}
