import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BANDS, DEFAULT_BAND, getBand } from "@/lib/bands";
import { SlidersHorizontal } from "lucide-react";

/**
 * Aceeași bandă pe fiecare boxă. Benzile au niveluri diferite (bass-ul are +1.8),
 * deci boxele împărțite pe benzi diferite nu pot suna egal ca tărie.
 */
export default function SoundBandLevel({ outputs, setOutputBand }) {
  const bands = outputs.map((o) => o.band || DEFAULT_BAND);
  const same = bands.length > 0 && bands.every((b) => b === bands[0]);
  const [target, setTarget] = useState(bands[0] || DEFAULT_BAND);

  useEffect(() => {
    if (same && bands[0] !== target) setTarget(bands[0]);
  }, [same, bands[0]]);

  const spread = [...new Set(bands.map((b) => getBand(b).label))];

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          Aceeași bandă pe toate boxele
        </Label>
        <span
          className={`text-[11px] ${same ? "text-muted-foreground" : "font-medium text-amber-600 dark:text-amber-400"}`}
        >
          {bands.length === 0
            ? "nici o boxă activă"
            : same
              ? `toate pe „${getBand(bands[0]).label}”`
              : `diferă: ${spread.join(", ")}`}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Select value={target} onValueChange={setTarget} disabled={!outputs.length}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Bandă pentru toate boxele">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BANDS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={!outputs.length}
          onClick={() => outputs.forEach((o) => setOutputBand(o.deviceId, target))}
        >
          Trimite la toate
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        „Complet” dă fiecărei boxe tot sunetul, deci toate sună la fel. Împărțirea pe benzi
        (bass / vocale / înalte) e pentru efect, nu pentru nivel egal.
      </p>
    </div>
  );
}