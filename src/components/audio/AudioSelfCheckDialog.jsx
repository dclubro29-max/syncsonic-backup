import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { AUDIO_CHECK_MS, AUDIO_CHECK_STEPS, pickSelfCheckDeck, runAudioSelfCheck } from "@/lib/audioSelfCheck";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, Circle, Loader2, MinusCircle, Play, Square } from "lucide-react";

const TONE = {
  ok: { icon: CheckCircle2, className: "text-success", label: "se aude" },
  weak: { icon: AlertTriangle, className: "text-warning", label: "slab" },
  fail: { icon: AlertTriangle, className: "text-destructive", label: "nu se aude" },
  skip: { icon: MinusCircle, className: "text-muted-foreground", label: "sărit" },
  running: { icon: Loader2, className: "animate-spin text-primary", label: "verific" },
};

/**
 * Verificarea audio de ~2 minute. Rulează efectele reale pe piesa încărcată și
 * măsoară ieșirea, ca să se vadă negru pe alb unde se pierde sunetul.
 */
export default function AudioSelfCheckDialog({ open, onOpenChange }) {
  const dj = useDj();
  const [steps, setSteps] = useState({});
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const startRef = useRef(0);
  const deck = pickSelfCheckDeck(dj);

  const onStep = useCallback(
    (id, patch) => setSteps((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } })),
    []
  );

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setElapsed(Date.now() - startRef.current), 400);
    return () => clearInterval(timer);
  }, [running]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (deck === null) return;
    setError(null);
    setSteps({});
    setElapsed(0);
    setRunning(true);
    startRef.current = Date.now();
    if (dj.autoDj?.on) dj.autoDj.setOn(false);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await runAudioSelfCheck({ dj, deck, onStep, signal: controller.signal });
    } catch (e) {
      if (e?.name !== "AbortError") setError("Verificarea s-a oprit neașteptat. Reia testul.");
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }, [dj, deck, onStep]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const results = AUDIO_CHECK_STEPS.map((item) => steps[item.id]?.status).filter(Boolean);
  const finished = results.length === AUDIO_CHECK_STEPS.length;
  const passed = Object.values(steps).filter((s) => s.status === "ok").length;
  const failed = Object.values(steps).filter((s) => s.status === "fail").length;
  const progress = running ? Math.min(100, (elapsed / AUDIO_CHECK_MS) * 100) : finished ? 100 : 0;
  const remaining = Math.max(0, Math.ceil((AUDIO_CHECK_MS - elapsed) / 1000));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) stop();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Verificare audio · 2 minute</DialogTitle>
          <DialogDescription>
            Motorul cântă piesa de pe deck și măsoară ieșirea la fiecare pas: EQ, echo, reverb,
            filtre, bass împărțit, crossfader, limiter și boxe.
          </DialogDescription>
        </DialogHeader>

        {deck === null ? (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
            Nu e nicio piesă încărcată pe deckuri, deci nu am ce măsura.{" "}
            <Link to="/library" className="font-semibold underline underline-offset-4">
              Încarcă o piesă din bibliotecă
            </Link>{" "}
            și revino.
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="num rounded-md border border-border/70 px-2 py-1 text-foreground">
              Deck {deck === 0 ? "A" : String.fromCharCode(65 + deck)}
            </span>
            <span className="min-w-0 flex-1 truncate">{dj.decks[deck]?.track?.name}</span>
            {running && <span className="num tabular-nums">~{remaining}s</span>}
          </div>
        )}

        <div className="space-y-3">
          <Progress value={progress} />
          <ol className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
            {AUDIO_CHECK_STEPS.map((item) => {
              const status = steps[item.id]?.status;
              const tone = TONE[status];
              const Icon = tone?.icon || Circle;
              return (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <Icon className={`h-4 w-4 shrink-0 ${tone?.className || "text-muted-foreground/50"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{item.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {steps[item.id]?.detail || item.hint}
                    </p>
                  </div>
                  {status && status !== "running" && (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        status === "ok"
                          ? "border-success/40 text-success"
                          : status === "fail"
                            ? "border-destructive/40 text-destructive"
                            : "border-border text-muted-foreground"
                      }`}
                    >
                      {tone.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>

          {finished && !error && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {failed === 0
                ? `Toate cele ${passed} verigă verificate ajung în boxe.`
                : `${failed} ${failed === 1 ? "verigă nu ajunge" : "verigi nu ajung"} în boxe — vezi rândurile roșii.`}
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {running ? (
            <Button variant="outline" className="gap-1.5" onClick={stop}>
              <Square className="h-3.5 w-3.5" />
              Oprește
            </Button>
          ) : (
            <Button className="gap-1.5" onClick={start} disabled={deck === null}>
              <Play className="h-3.5 w-3.5" />
              {finished ? "Reia verificarea" : "Începe verificarea"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}