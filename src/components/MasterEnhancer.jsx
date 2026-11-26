import React from "react";
import { useDj } from "@/lib/djContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { MASTER_PRESETS } from "@/lib/masterChain";

function ParamSlider({ label, hint, value, min, max, step, format, onChange, disabled }) {
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

const db = (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} dB`;
const pct = (v) => `${Math.round(v * 100)}%`;

export default function MasterEnhancer() {
  const dj = useDj();
  const m = dj.masterEnhance;
  const set = dj.setMasterEnhance;
  const off = !m.enabled;

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur-xl">
      <CardHeader className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 font-heading text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              Îmbunătățire sunet
            </CardTitle>
            <CardDescription className="mt-1 text-[11px] leading-relaxed">
              Lanț de masterizare pe ieșire: EQ, bass mono, lățime stereo, claritate și protecție.
              Comută „B · Fidel” din panoul de mai sus ca să compari.
            </CardDescription>
          </div>
          <Switch checked={m.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 pt-0">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Preseturi
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MASTER_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.desc}
                onClick={() => dj.applyMasterPreset(p.id)}
                className="rounded-xl border border-border px-3 py-2 text-left text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                {p.label}
                <span className="mt-0.5 block text-[10px] font-normal leading-snug text-muted-foreground">
                  {p.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            EQ master
          </p>
          <ParamSlider
            label="Bass"
            value={m.eqLow}
            min={-12}
            max={12}
            step={0.5}
            format={db}
            disabled={off}
            onChange={(v) => set({ eqLow: v })}
          />
          <ParamSlider
            label="Medii"
            value={m.eqMid}
            min={-12}
            max={12}
            step={0.5}
            format={db}
            disabled={off}
            onChange={(v) => set({ eqMid: v })}
          />
          <ParamSlider
            label="Înalte"
            value={m.eqHigh}
            min={-12}
            max={12}
            step={0.5}
            format={db}
            disabled={off}
            onChange={(v) => set({ eqHigh: v })}
          />
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Scenă stereo
          </p>
          <ParamSlider
            label="Bass mono"
            hint="Sub această frecvență semnalul devine mono. Bass mai strâns, fără anulări de fază pe boxele mici."
            value={m.bassMono}
            min={0}
            max={300}
            step={10}
            format={(v) => (v < 10 ? "oprit" : `${Math.round(v)} Hz`)}
            disabled={off}
            onChange={(v) => set({ bassMono: v })}
          />
          <ParamSlider
            label="Lățime stereo"
            hint="Sub 100% îngustează, peste 100% lărgește scena. Prea lat poate suna artificial pe boxe apropiate."
            value={m.width}
            min={0.4}
            max={1.8}
            step={0.05}
            format={pct}
            disabled={off}
            onChange={(v) => set({ width: v })}
          />
        </div>

        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Claritate și nivel
          </p>
          <ParamSlider
            label="Claritate (exciter)"
            hint="Adaugă armonice doar în zona înaltă. Scoate detaliile în față, util la volum mic."
            value={m.exciter}
            min={0}
            max={1}
            step={0.05}
            format={pct}
            disabled={off}
            onChange={(v) => set({ exciter: v })}
          />
          <ParamSlider
            label="Protecție (soft-clip)"
            hint="Prinde vârfurile peste 0 dBFS fără să taie brusc. 0% înseamnă complet transparent."
            value={m.drive}
            min={0}
            max={1}
            step={0.05}
            format={pct}
            disabled={off}
            onChange={(v) => set({ drive: v })}
          />
          <ParamSlider
            label="Nivel de ieșire"
            hint="Împinge semnalul în limiter pentru un master mai tare. Limiter-ul rămâne protecția finală."
            value={m.outGain}
            min={0.6}
            max={1.4}
            step={0.02}
            format={pct}
            disabled={off}
            onChange={(v) => set({ outGain: v })}
          />
        </div>

        <p className="rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          Lanțul lucrează pe ieșirea master, după deck-uri și crossfader, deci nu modifică reglajele
          tale. „Sunet original” și „B · Fidel” îl scot complet din traseu, ca să poți auzi diferența
          pe aceeași piesă.
        </p>
      </CardContent>
    </Card>
  );
}