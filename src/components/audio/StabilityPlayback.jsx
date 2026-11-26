import React from 'react';
import { Shield } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';
import StabilityDeckRow from '@/components/audio/StabilityDeckRow';
import StabilityMixControls from '@/components/audio/StabilityMixControls';

export default function StabilityPlayback() {
  const dj = useDj();
  const error = dj.outputError || dj.playbackError || dj.playbackProtection.error ||
    (dj.autoDj.status.phase === 'error' ? dj.autoDj.status.message : null);
  return <main className="audio-stability min-h-screen bg-background px-4 py-8 text-foreground sm:px-8">
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold"><Shield className="h-5 w-5 text-primary" /> Mod stabilitate</h1>
          <p className="text-sm text-muted-foreground">Doar redare și mixaj de bază.</p>
        </div>
        <Button variant="outline" onClick={() => dj.setStabilityMode(false)}>Revino la interfața completă</Button>
      </header>
      <section className="space-y-2 rounded-xl border border-border bg-card p-5 text-sm">
        <p>Efecte, EQ, masterizare, limiter, analiză BPM, sampler și înregistrare: oprite.</p>
        <p className="text-muted-foreground">Fără spectru, forme de undă, contoare animate sau actualizări continue ale poziției.</p>
        <p>{dj.outputCount ? `${dj.outputCount} ieșiri active` : dj.selectedSpeakers.length ? 'Boxele selectate nu au pornit încă' : 'Ieșirea implicită a sistemului'} · volumele și întârzierile de sincronizare se păstrează.</p>
        <p className="text-muted-foreground">Canale de ieșire separate, pornire pe rând și recuperare individuală. Adăugarea unei boxe nu reconstruiește fluxurile celorlalte.</p>
        <p className="text-xs text-muted-foreground">{dj.playbackProtection.clockNotice || (dj.playbackProtection.isolatedClock ? 'Ceasul mixerului este fixat pe o ieșire internă identificată, separat de boxele Bluetooth. ' : '')} Izolarea limitează întreruperile provocate de aplicație; conexiunile Bluetooth și driverele rămân dependente de sistem.</p>
      </section>
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-card p-3 text-sm text-destructive">{error}</p>}
      {!dj.tracks.length && <p className="text-sm text-muted-foreground">Biblioteca este goală. Revino la interfața completă pentru a adăuga piese.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => dj.ensureAudio().catch(() => {})}>Activează sunetul</Button>
        <span className="text-sm text-muted-foreground">Browserul poate cere o atingere înainte de redare.</span>
      </div>
      <StabilityMixControls />
      <div className="grid gap-4 sm:grid-cols-2">
        {dj.decks.map((deck, index) => <StabilityDeckRow key={index} index={index} />)}
      </div>
    </div>
  </main>;
}