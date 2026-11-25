import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import StartOption from "@/components/start/StartOption";
import StartOutputsStep from "@/components/start/StartOutputsStep";
import PartyCheckDialog from "@/components/PartyCheckDialog";
import { usePartyCheck } from "@/hooks/usePartyCheck";
import { PRESETS } from "@/components/AutoDjPresets";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/lib/trackStore";
import {
  ArrowLeft,
  ArrowRight,
  PartyPopper,
  Shuffle,
  ListOrdered,
  Sliders,
  Disc3,
  Tv,
  Volume2,
  AlertTriangle,
  Check,
} from "lucide-react";

const STEPS = ["Piesele", "Ieșiri audio", "Test sunet", "Mod de mixare", "Pornire"];

// Variante scurte, doar pentru pașii de aici.
const PRESET_HINT = {
  max: 'Speed-up / slow-down, beatmatch și EQ, fără efecte peste piese.',
  lin: "Tranziții lungi, fără efecte.",
  energic: "Tranziții scurte, cu ecou.",
  fara: "Doar crossfade curat.",
};

/** Pregătirea petrecerii, în cinci pași scurți. */
export default function Start() {
  const dj = useDj();
  const navigate = useNavigate();
  const check = usePartyCheck();
  const [step, setStep] = useState(0);
  const [autoMode, setAutoMode] = useState(true);
  const [preset, setPreset] = useState('max');
  const [destination, setDestination] = useState("party");

  const trackCount = dj.tracks.length;
  const totalSize = dj.tracks.reduce((sum, t) => sum + (t.size || 0), 0);
  const selectedOutputs = dj.selectedSpeakers.length;
  const canContinue = step !== 0 || trackCount > 0;

  const start = () => {
    if (autoMode) {
      if (preset === 'max') dj.autoDj.startMax();
      else { dj.autoDj.setConfig(PRESETS[preset].config); dj.autoDj.setOn(true); }
    } else {
      dj.autoDj.setOn(false);
    }
    navigate(destination === "party" ? "/party" : "/mixer");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Ritualul de dinainte"
        title="Pregătește petrecerea"
        icon={PartyPopper}
        description="Cinci pași scurți până la muzică."
      />

      <div>
        <ol className="hidden gap-1.5 sm:grid sm:grid-cols-5">
          {STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  current
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : done
                      ? "border-border/60 bg-surface-raised/50 text-muted-foreground"
                      : "border-border/40 text-muted-foreground/60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${
                    done
                      ? "border-success/40 bg-success/15 text-success"
                      : current
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/60"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className="truncate">{label}</span>
              </li>
            );
          })}
        </ol>
        <div className="space-y-1.5 sm:hidden">
          <div className="h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Pasul {step + 1} din {STEPS.length} · {STEPS[step]}
          </p>
        </div>
      </div>

      <section className="panel p-5 sm:p-6">
        <div className="space-y-5">
          {step === 0 && (
            <>
              <h2 className="font-heading text-lg font-semibold">Aleg piesele</h2>
              {trackCount === 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3">
                  <p className="flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                    Biblioteca e goală.
                  </p>
                  <Button asChild size="sm" variant="outline" className="border-warning/30">
                    <Link to="/library">Adaugă piese</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {trackCount} piese · {formatSize(totalSize)}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <StartOption
                      selected={dj.autoDj.config.shuffle}
                      icon={Shuffle}
                      title="Aleatoriu"
                      hint="Amestecă ordinea. Recomandat."
                      onClick={() => dj.autoDj.setConfig({ shuffle: true })}
                    />
                    <StartOption
                      selected={!dj.autoDj.config.shuffle}
                      icon={ListOrdered}
                      title="În ordine"
                      hint="Exact cum apar în bibliotecă."
                      onClick={() => dj.autoDj.setConfig({ shuffle: false })}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-heading text-lg font-semibold">Ieșirile audio</h2>
              <StartOutputsStep variant="select" />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-heading text-lg font-semibold">Testez sunetul</h2>
              <StartOutputsStep variant="test" />
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-heading text-lg font-semibold">Cum mixezi?</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <StartOption
                  selected={!autoMode}
                  icon={Sliders}
                  title="Manual"
                  hint="Alegi tu piesele."
                  onClick={() => setAutoMode(false)}
                />
                <StartOption
                  selected={autoMode}
                  icon={Disc3}
                  title="Auto DJ"
                  hint="Mixează singur, pe tempo."
                  onClick={() => setAutoMode(true)}
                />
              </div>

              {autoMode && (
                <div className="space-y-2">
                  <p className="caps">Cât de energic</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(PRESETS).map(([id, p]) => (
                      <StartOption
                        key={id}
                        selected={preset === id}
                        icon={p.icon}
                        title={p.label}
                        hint={PRESET_HINT[id]}
                        onClick={() => {
                          setPreset(id);
                          dj.autoDj.setConfig(p.config);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="font-heading text-lg font-semibold">Pornire</h2>
              <dl className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background/40 text-sm">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">Piese</dt>
                  <dd className="num">{trackCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">Ieșiri</dt>
                  <dd className="num">{selectedOutputs || "implicită"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <dt className="text-muted-foreground">Mixare</dt>
                  <dd>{autoMode ? `Auto DJ · ${PRESETS[preset].label}` : "Manuală"}</dd>
                </div>
              </dl>

              <div className="grid gap-2 sm:grid-cols-2">
                <StartOption
                  selected={destination === "party"}
                  icon={Tv}
                  title="Mod Party (TV)"
                  hint="Ecran întreg, pentru televizor."
                  onClick={() => setDestination("party")}
                />
                <StartOption
                  selected={destination === "mixer"}
                  icon={Sliders}
                  title="Mixer"
                  hint="Deck-uri și crossfader la vedere."
                  onClick={() => setDestination("mixer")}
                />
              </div>

              <Button
                size="lg"
                className="h-12 w-full gap-2 text-sm font-semibold"
                disabled={!trackCount}
                onClick={() => check.run(start)}
              >
                <Volume2 className="h-4 w-4" />
                Pornește petrecerea
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Înainte de pornire rulează un test rapid al sunetului.
              </p>
            </>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="gap-2"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi
        </Button>
        {step < STEPS.length - 1 && (
          <Button className="gap-2" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continuă
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <PartyCheckDialog
        open={check.open}
        checks={check.checks}
        onConfirm={check.confirm}
        onCancel={check.cancel}
        onTestSound={check.testSound}
      />
    </div>
  );
}