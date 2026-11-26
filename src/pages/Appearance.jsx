import React from "react";
import { Check, Palette, Play, RotateCcw, Sparkles } from "lucide-react";
import { useSkin } from "@/lib/SkinContext";
import { PULSE_MODES } from "@/lib/appearance";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";
import { Button } from "@/components/ui/button";

export default function Appearance() {
  const { skins, skin, setSkin, pulseMode, setPulseMode } = useSkin();
  const current = skins.find((item) => item.id === skin) || skins[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Aspect"
        title="Skinul aplicației"
        icon={Palette}
        description="Aceeași structură, patru atmosfere. Comenzile rămân în aceleași poziții."
        actions={<StatusPill tone="neutral" dot>{current.name} activ</StatusPill>}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {skins.map((item) => {
          const active = item.id === skin;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSkin(item.id)}
              aria-pressed={active}
              className={`group overflow-hidden rounded-2xl border text-left transition-colors ${
                active ? "border-primary/50 bg-primary/[0.06]" : "border-border/60 bg-card/60 hover:border-foreground/20"
              }`}
            >
              <div className="relative h-40 overflow-hidden border-b border-border/50 p-4" style={{ background: item.swatches[0] }}>
                <div
                  className="absolute -right-8 -top-10 h-40 w-40 rounded-full blur-2xl"
                  style={{ background: item.swatches[2], opacity: 0.45 }}
                />
                <div
                  className="absolute -bottom-16 left-8 h-36 w-36 rounded-full blur-2xl"
                  style={{ background: item.swatches[3], opacity: 0.35 }}
                />
                <div className="relative flex h-full flex-col justify-between">
                  <span className="flex items-center gap-2 font-heading text-sm font-semibold" style={{ color: item.ink }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: item.swatches[2] }} />
                    {item.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-16 w-16 shrink-0 rounded-xl border"
                      style={{
                        background: item.swatches[1],
                        borderColor: item.id === 'daylight' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.2)',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="h-2 w-24 rounded-full" style={{ background: item.ink, opacity: 0.8 }} />
                      <div className="mt-2 h-1.5 w-16 rounded-full" style={{ background: item.ink, opacity: 0.4 }} />
                      <div className="mt-3 flex items-center gap-2">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full"
                          style={{ background: item.swatches[2], color: item.swatches[0] }}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                        </span>
                        <div className="h-1 flex-1 rounded-full" style={{ background: item.ink, opacity: 0.2 }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {item.swatches.map((color) => (
                      <span
                        key={color}
                        className="h-5 w-5 rounded-md border"
                        style={{
                          background: color,
                          borderColor: item.id === 'daylight' ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.2)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.hint}</p>
                </div>
                {active ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {skin === "pulse" ? (
        <Surface className="p-5 sm:p-6">
          <SurfaceHead
            icon={Sparkles}
            title="Intensitatea Pulse"
            hint="Coperta și fundalul citesc nivelul mixului master. Nu modifică sunetul."
            action={<StatusPill tone="live" dot>activ</StatusPill>}
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {PULSE_MODES.map((mode) => {
              const active = pulseMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPulseMode(mode.id)}
                  aria-pressed={active}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    active ? "border-primary/40 bg-primary/[0.07]" : "border-border/60 bg-background/40 hover:border-foreground/20"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {mode.label}
                    {active ? <Check className="h-4 w-4 text-primary" /> : null}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">{mode.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Mișcarea redusă din sistem este respectată automat. În modul stabilitate, Pulse păstrează paleta și oprește animația.
          </p>
        </Surface>
      ) : (
        <Surface tone="quiet" className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-raised text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold">Pulse reacționează la mix</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Alege skinul Pulse ca să vezi coperta și fundalul respirând cu muzica.
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-border/80" onClick={() => setSkin("pulse")}>
            Alege Pulse
          </Button>
        </Surface>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Skinul se păstrează pe acest dispozitiv. Cu un cont conectat, alegerea se salvează și în cont când sincronizarea este disponibilă.
        </p>
        <Button variant="outline" className="gap-2 border-border/80" onClick={() => setSkin("studio")}>
          <RotateCcw className="h-4 w-4" />
          Revino la Studio
        </Button>
      </div>
    </div>
  );
}