import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Volume2 } from "lucide-react";

/** Un singur nivel de volum, trimis la toate boxele deodată — fără boxe mai tari. */
export default function SoundVolumeLevel({ outputs, setOutputVolume }) {
  const levels = outputs.map((o) => Math.round((o.volume ?? 1) * 100));
  const same = levels.length > 0 && levels.every((v) => v === levels[0]);
  const [target, setTarget] = useState(levels[0] ?? 80);

  // Cât timp boxele sunt egale, cursorul arată nivelul lor real.
  useEffect(() => {
    if (same && levels[0] !== target) setTarget(levels[0]);
  }, [same, levels[0]]);

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Volume2 className="h-3.5 w-3.5 text-primary" />
          Volum egal pe toate boxele
        </Label>
        <span
          className={`text-[11px] tabular-nums ${same ? "text-muted-foreground" : "font-medium text-amber-600 dark:text-amber-400"}`}
        >
          {levels.length === 0
            ? "nici o boxă activă"
            : same
              ? `toate la ${levels[0]}%`
              : `diferă: ${Math.min(...levels)}% … ${Math.max(...levels)}%`}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Slider
          aria-label="Volum egal pe toate boxele"
          value={[target]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => setTarget(v)}
          disabled={!outputs.length}
          className="min-w-40 flex-1"
        />
        <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{target}%</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!outputs.length}
          onClick={() => outputs.forEach((o) => setOutputVolume(o.deviceId, target / 100))}
        >
          Trimite la toate
        </Button>
      </div>
    </div>
  );
}