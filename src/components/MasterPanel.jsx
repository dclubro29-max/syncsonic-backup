import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import LevelMeter from "@/components/LevelMeter";
import { ShieldCheck, Ear, Square, Activity } from "lucide-react";

export default function MasterPanel({
  getMasterMeter,
  getLimiterReduction,
  limiterOn,
  onLimiterToggle,
  neutral,
  onNeutral,
  abBypass,
  onAbToggle,
  onPanic,
}) {
  const [gr, setGr] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    let raf;
    let last = 0;
    const tick = (t) => {
      if (t - last > 100) {
        last = t;
        const r = getLimiterReduction ? getLimiterReduction() : 0;
        setGr((prev) => (Math.abs(prev - r) > 0.05 ? r : prev));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    rafRef.current = raf;
    return () => cancelAnimationFrame(raf);
  }, [getLimiterReduction]);

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="font-heading text-xs font-semibold tracking-widest text-muted-foreground">
            MASTER &amp; PROTECȚIE
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            reducere {gr.toFixed(1)} dB
          </span>
        </div>

        <LevelMeter getMeter={getMasterMeter} className="mb-5" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div className="min-w-0">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Limiter de protecție
              </Label>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Intervine doar la peak-uri aproape de 0 dBFS. Reducerea afișată e reală, măsurată de la compressor.
              </p>
            </div>
            <Switch checked={limiterOn} onCheckedChange={onLimiterToggle} />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
            <div className="min-w-0">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Ear className="h-4 w-4 text-primary" />
                Sunet original
              </Label>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Bypass complet: tempo 1×, EQ 0 dB, efecte oprite, limiter oprit. Reglajele tale se restaurează la dezactivare.
              </p>
            </div>
            <Switch checked={neutral} onCheckedChange={onNeutral} />
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Ear className="h-4 w-4 text-primary" />
              Comparație A/B
            </Label>
            <span className="text-[11px] text-muted-foreground">mai tare ≠ mai bun</span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            Comută instant între redarea ta procesată (A) și semnalul fidel, neutru (B). Controalele nu se schimbă.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={!abBypass ? "default" : "outline"}
              onClick={() => onAbToggle(false)}
              className="w-full"
            >
              A · Procesat
            </Button>
            <Button
              variant={abBypass ? "default" : "outline"}
              onClick={() => onAbToggle(true)}
              className="w-full"
            >
              B · Fidel
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="destructive" onClick={onPanic} className="gap-2">
            <Square className="h-4 w-4" />
            Oprește tot sunetul
          </Button>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Contoarele arată nivelul real măsurat, nu o estimare.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}