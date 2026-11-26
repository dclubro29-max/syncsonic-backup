import React, { useState } from "react";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { DEMO_TRACKS, makeDemoTrack } from "@/lib/demoTracks";
import { Loader2, Download, Music4, Info, ExternalLink, Compass } from "lucide-react";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";

export default function Discover() {
  const dj = useDj();
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState(null);

  const addDemo = async (demo) => {
    setBusy(demo.id);
    setMessage(null);
    try {
      // Generare locală — fără fișiere externe, fără restricții de licență
      await new Promise((r) => setTimeout(r, 30));
      const { blob } = makeDemoTrack({ bpm: demo.bpm, bars: 8, style: demo.style });
      const file = new File([blob], `${demo.name}.wav`, { type: "audio/wav" });
      await dj.addFiles([file]);
      setMessage(`„${demo.name}" a fost adăugată în bibliotecă.`);
    } catch {
      setMessage("Piesa demo nu a putut fi generată.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Repertoriu"
        title="Descoperă"
        icon={Compass}
        description="Piese pe care le poți folosi imediat și informații despre restul repertoriului."
      />

      {message && (
        <div role="status" className="rounded-xl border border-primary/25 bg-primary/[0.07] px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className="caps">Piese demo · generate local</p>
          <StatusPill tone="neutral">{DEMO_TRACKS.length} piese</StatusPill>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {DEMO_TRACKS.map((demo) => (
            <article key={demo.id} className="panel flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-primary">
                    <Music4 className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium">{demo.name}</span>
                </div>
                <span className="num rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {demo.bpm} BPM
                </span>
              </div>
              <p className="flex-1 text-[11px] leading-relaxed text-muted-foreground">{demo.description}</p>
              <Button
                size="sm"
                className="gap-2"
                disabled={busy === demo.id}
                onClick={() => addDemo(demo)}
              >
                {busy === demo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Adaugă în bibliotecă
              </Button>
            </article>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sunt ritmuri simple sintetizate în browser, fără drepturi de autor. Le poți folosi liber
          pentru a exersa tranzițiile. Nu sunt piese muzicale complete.
        </p>
      </section>

      <Surface tone="quiet" className="p-5">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-primary">
            <Info className="h-4 w-4" />
          </span>
          <div className="space-y-3">
            <p>
              <strong className="font-medium text-foreground">Muzică comercială:</strong> hiturile
              din serviciile de streaming nu pot fi mixate sau înregistrate în aplicație. Abonamentul
              la un serviciu de streaming nu îți dă dreptul să procesezi catalogul lui.
            </p>
            <p>
              Pentru piesele pe care ai dreptul să le folosești, încarcă fișierul din{" "}
              <strong className="font-medium text-foreground">Bibliotecă</strong> — rămâne local și
              îl poți reda imediat.
            </p>
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
              <ExternalLink className="h-3.5 w-3.5" />
              Nu adăugăm linkuri inventate către surse externe. Dacă vrei un catalog online real,
              trebuie configurat un serviciu licențiat.
            </p>
          </div>
        </div>
      </Surface>
    </div>
  );
}