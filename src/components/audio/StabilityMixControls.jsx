import React from 'react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';
import { useRepeatGuard } from '@/components/mixer/RepeatLockProvider';

export default function StabilityMixControls() {
  const dj = useDj();
  const guard = useRepeatGuard();
  return <section className="space-y-5 rounded-xl border border-border bg-card p-5" aria-label="Mixaj de bază">
    <label className="flex items-center gap-3 text-sm">
      <span>A</span><input type="range" aria-label="Crossfader A și B" min="0" max="1" step="0.01"
        disabled={dj.autoDj.on} value={dj.crossfade} onChange={(event) => dj.setCrossfade(Number(event.target.value))}
        className="flex-1 accent-primary" /><span>B</span>
    </label>
    <label className="flex flex-wrap items-center gap-3 text-sm">
      <span>Volum master{dj.volumeLock !== null ? ' · blocat' : ''}</span>
      <input type="range" aria-label="Volum master" min="0" max="1" step="0.01" disabled={dj.volumeLock !== null}
        value={dj.masterVolume} onChange={(event) => dj.setMasterVolume(Number(event.target.value))} className="flex-1 accent-primary" />
      <span className="font-mono text-xs">{Math.round(dj.masterVolume * 100)}%</span>
    </label>
    <div className="flex flex-wrap gap-2">
      <Button variant={dj.autoDj.on ? 'secondary' : 'outline'} disabled={!dj.tracks.length}
        onClick={() => dj.autoDj.setOn(!dj.autoDj.on)}>{dj.autoDj.on ? 'Oprește Auto DJ' : 'Auto DJ simplu'}</Button>
      <Button variant="outline" disabled={!dj.autoDj.on || dj.autoDj.status.phase === 'mixing' || dj.autoDj.status.phase === 'error'}
        onClick={dj.autoDj.skip}>Următoarea</Button>
      <Button variant="destructive" onClick={() => guard.guardAll(dj.panicStop)}>Oprește tot sunetul</Button>
    </div>
    <p className="text-xs text-muted-foreground">Auto DJ folosește doar treceri de volum, fără efecte sau beatmatch.</p>
  </section>;
}