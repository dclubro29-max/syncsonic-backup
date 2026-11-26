import React from 'react';
import { Progress } from '@/components/ui/progress';
import { formatSize } from '@/lib/trackStore';

export default function TransferProgress({ progress }) {
  if (!progress) return null;
  const { done, total, bytes = 0, totalBytes = 0, speed = 0, eta, name } = progress;
  const percent = totalBytes ? bytes / totalBytes * 100 : total ? done / total * 100 : 0;
  return (
    <div className="space-y-1.5" aria-live="polite">
      <Progress value={Math.min(100, percent)} className="h-1.5" />
      <p className="break-words text-[11px] text-muted-foreground">
        {Math.round(percent)}% · {done}/{total} piese
        {totalBytes > 0 && ` · ${formatSize(bytes) || '0 B'} / ${formatSize(totalBytes)}`}
        {speed > 0 && ` · ${(speed / 1024 / 1024).toFixed(1)} MB/s`}
        {eta != null && eta > 0 && ` · ~${eta < 60 ? `${eta} sec` : `${Math.ceil(eta / 60)} min`}`}
      </p>
      {name && <p className="truncate text-[10px] text-muted-foreground">{name}</p>}
      <p className="text-[10px] text-muted-foreground">Progres confirmat de destinatar. La reluare, piesele salvate sunt omise.</p>
    </div>
  );
}