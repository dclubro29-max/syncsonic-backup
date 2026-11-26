import React, { useEffect, useRef, useState } from "react";
import { Activity } from "lucide-react";
import { useDj } from "@/lib/djContext";
import StatusPill from "@/components/ui-kit/StatusPill";

const WINDOW_MS = 10000;
const toDb = (peak) => (peak > 0 ? Math.max(-60, 20 * Math.log10(peak)) : -60);
const barWidth = (db) => `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
const dbText = (db) => (db <= -60 ? "—" : `${db.toFixed(1)} dBFS`);

function MeterRow({ label, value, tone }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{dbText(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-inset">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ${tone === "post" ? "bg-success" : "bg-primary"}`}
          style={{ width: barWidth(value) }}
        />
      </div>
    </div>
  );
}

/**
 * Vârful real la intrarea și la ieșirea limiterului, plus cât de des lucrează.
 * Numerele vin din analizoarele și compressorul Web Audio, nu dintr-o estimare.
 */
export default function MasterSignalDiagnostics() {
  const dj = useDj();
  const [reading, setReading] = useState({ pre: -60, post: -60, reduction: 0, activeRatio: 0, interventions: 0 });
  const windowRef = useRef({ samples: 0, active: 0, wasActive: false, interventions: 0, startedAt: 0 });

  useEffect(() => {
    let raf;
    let lastRead = 0;
    let lastPublish = 0;
    let maxPre = 0;
    let maxPost = 0;
    let maxReduction = 0;
    const tick = (time) => {
      // Citim la ~30 Hz ca să prindem vârfurile scurte fără să încărcăm firul
      // audio; publicăm maximumul ferestrei la ~8 Hz.
      if (time - lastRead < 33) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastRead = time;
      const prePeak = dj.getPreLimiterMeter?.()?.peak ?? 0;
      const postPeak = dj.getPostLimiterMeter?.()?.peak ?? 0;
      const reduction = dj.getLimiterReduction?.() ?? 0;
      if (prePeak > maxPre) maxPre = prePeak;
      if (postPeak > maxPost) maxPost = postPeak;
      if (reduction > maxReduction) maxReduction = reduction;

      const window = windowRef.current;
      if (!window.startedAt) window.startedAt = time;
      const active = reduction >= 0.1;
      window.samples += 1;
      if (active) window.active += 1;
      if (active && !window.wasActive) window.interventions += 1;
      window.wasActive = active;

      if (time - lastPublish >= 120) {
        lastPublish = time;
        const activeRatio = window.samples ? window.active / window.samples : 0;
        setReading({
          pre: toDb(maxPre),
          post: toDb(maxPost),
          reduction: maxReduction,
          activeRatio,
          interventions: window.interventions,
        });
        maxPre = 0;
        maxPost = 0;
        maxReduction = 0;
        if (time - window.startedAt >= WINDOW_MS) {
          windowRef.current = { samples: 0, active: 0, wasActive: active, interventions: 0, startedAt: time };
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dj.getPreLimiterMeter, dj.getPostLimiterMeter, dj.getLimiterReduction]);

  const delta = reading.pre <= -60 || reading.post <= -60 ? null : reading.post - reading.pre;

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="caps flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Master · înainte / după limiter
        </p>
        <StatusPill tone={dj.limiterOn ? "ready" : "neutral"} dot>
          {dj.limiterOn ? "Limiter pornit" : "Limiter oprit"}
        </StatusPill>
      </div>

      <div className="mt-3 space-y-3">
        <MeterRow label="Vârf înainte de limiter" value={reading.pre} />
        <MeterRow label="Vârf după limiter" value={reading.post} tone="post" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-muted-foreground">Reducere acum</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums">{reading.reduction.toFixed(1)} dB</p>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-muted-foreground">Limiter activ</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums">{Math.round(reading.activeRatio * 100)}% · 10 s</p>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-muted-foreground">Intervenții</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums">{reading.interventions} / 10 s</p>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-muted-foreground">Diferență vârf</p>
          <p className="mt-0.5 font-mono text-sm tabular-nums">{delta == null ? "—" : `${delta.toFixed(1)} dB`}</p>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Vârful „după” este măsurat imediat la ieșirea limiterului, înainte de volumul master.
        Frecvența vine din reducerea raportată de limiter. O diferență mare între „înainte” și „după”
        înseamnă că limiterul lucrează mult; una mică înseamnă rezervă.
      </p>
    </div>
  );
}