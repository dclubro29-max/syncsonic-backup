import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { cn } from '@/lib/utils';

/** Nivelul din aplicație, măsurat după volumul ramurii, înainte de ieșirea fizică. */
export default function OutputLevelMeter({ deviceId, active }) {
  const dj = useDj();
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    if (!active) {
      setPeak(0);
      return;
    }
    const read = () => {
      const level = dj.getOutputLevel?.(deviceId);
      setPeak(level?.peak || 0);
    };
    read();
    const timer = setInterval(read, 120);
    return () => clearInterval(timer);
  }, [deviceId, active, dj.getOutputLevel]);

  const percent = active ? Math.min(100, Math.round(peak * 100)) : 0;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" aria-hidden="true" />
          Semnal în aplicație
        </span>
        <span className="font-mono tabular-nums">{active ? `${percent}%` : '—'}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-150',
            percent > 2 ? 'bg-success' : 'bg-muted-foreground/30'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}