import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { qrMatrix } from '@/lib/qrCode';

export default function CalibrationQr({ value, className }) {
  const matrix = useMemo(() => {
    try { return qrMatrix(value); } catch (error) { return null; }
  }, [value]);

  if (!matrix) return null;
  const size = matrix.length;

  return (
    <div className={cn('rounded-2xl bg-white p-3 shadow-panel', className)}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full"
        shapeRendering="crispEdges"
        role="img"
        aria-label="Cod QR pentru calibrarea cu telefonul"
      >
        <rect width={size} height={size} fill="#ffffff" />
        {matrix.map((row, y) => row.map((dark, x) => (
          dark ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#111111" /> : null
        )))}
      </svg>
    </div>
  );
}