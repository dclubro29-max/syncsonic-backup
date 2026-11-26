import React, { useId } from 'react';
import { AudioLines } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import useProtectionReveal from '@/components/speakers/useProtectionReveal';

export default function PlaybackProtection() {
  const dj = useDj();
  const stats = dj.playbackProtection || {};
  const loading = dj.selectedSpeakers.length > 0 && !dj.outputCount && !dj.outputError;
  const count = stats.protectedOutputs || 0;
  const { ref, revealed, number } = useProtectionReveal(count, !loading);
  const grainId = useId().replace(/:/g, '');
  const message = stats.error || (count > 0
    ? stats.isolatedOutputs > 0
      ? 'Fiecare boxă are propriul flux stereo și propria recuperare. Pornirile sunt făcute pe rând; o boxă defectă este reîncercată separat, fără reconstruirea celorlalte canale.'
      : stats.nativeOutputs > 0
      ? 'Ieșirile cu redare nativă folosesc ceasul audio al fiecărei boxe, fără player intermediar. Reluarea nu resetează fluxurile active; o pierdere fizică a conexiunii poate întrerupe boxa afectată.'
      : 'Ieșirile audio sunt active în modul de compatibilitate. Reluarea intervine doar la pauză sau eroare, fără resetări bazate doar pe cronometrul playerului.'
    : 'Monitorizarea se activează la pornirea ieșirilor audio.');
  return (
    <section ref={ref} className="playback-protection" data-revealed={revealed || undefined} aria-label="Protecție împotriva întreruperilor">
      <div className="playback-protection-card" aria-busy={loading}>
        <svg className="playback-protection-grain" aria-hidden="true">
          <filter id={grainId}><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter={`url(#${grainId})`} />
        </svg>
        <div className="relative flex items-start justify-between gap-4">
          <h3 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Protecție audio</h3>
          <AudioLines className="playback-protection-accent h-12 w-12 shrink-0 text-primary" aria-hidden="true" />
        </div>
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-start leading-none" aria-label={`${count} ieșiri audio active`}>
            <span className="playback-protection-number" aria-hidden="true">{loading ? '—' : number.toLocaleString('ro-RO')}</span>
            <span className="ml-2 mt-2 font-body text-sm text-muted-foreground">ieșiri</span>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div><dt className="text-sm text-muted-foreground">Reluări automate</dt><dd className="num mt-1 text-base">{(stats.recoveries || 0).toLocaleString('ro-RO')}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Goluri raportate de browser</dt><dd className="num mt-1 text-base">{stats.renderUnderruns == null ? 'Indisponibil' : stats.renderUnderruns.toLocaleString('ro-RO')}</dd></div>
          </dl>
        </div>
      </div>
      <p className={`mt-3 text-sm leading-relaxed ${stats.error ? 'text-destructive' : 'text-muted-foreground'}`} role={stats.error ? 'alert' : undefined}>{loading ? 'Pregătesc ieșirile audio…' : message}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{stats.clockNotice || (stats.isolatedClock ? 'Ceasul mixerului este fixat pe o ieșire internă identificată. ' : '')} {stats.renderUnderruns > 0 ? `Browserul a raportat ${stats.renderUnderruns} goluri de randare (${Math.round(stats.renderUnderrunMs)} ms în total), de la pornirea motorului. ` : ''}Ieșire activă nu înseamnă continuitate confirmată în boxă; pierderile fizice Bluetooth nu sunt măsurate aici.</p>
    </section>
  );
}