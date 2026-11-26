import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import StatusPill from "@/components/ui-kit/StatusPill";
import OutputTestRow from "@/components/speakers/OutputTestRow";
import { SYSTEM_DEFAULT_ID } from "@/lib/outputs";

// Alinierea cu microfonul se descarcă doar când este deschisă.
const AlignmentFlow = lazy(() => import("@/components/speakers/AlignmentFlow"));
import {
  AlignCenter,
  ArrowLeft,
  Bluetooth,
  Check,
  Info,
  Loader2,
  PlayCircle,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ShieldOff,
  Volume2,
} from "lucide-react";

const CONFIRM_KEY = "musicsync.outputConfirmed";

const readConfirmed = () => {
  try {
    return JSON.parse(localStorage.getItem(CONFIRM_KEY) || "{}") || {};
  } catch (error) {
    return {};
  }
};

/**
 * Panoul de jos pentru ieșirea audio. Alege boxa, ascultă beatul, apoi
 * deschide alinierea doar dacă sistemul expune boxele separat.
 */
export default function OutputPanel({ className = "" }) {
  const dj = useDj();
  const [alignment, setAlignment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(readConfirmed);
  const [testing, setTesting] = useState(null);
  const testTimer = useRef(null);

  useEffect(() => () => {
    if (testTimer.current) clearTimeout(testTimer.current);
    dj.stopTestBeat();
  }, [dj.stopTestBeat]);

  const outputs = dj.selectedSpeakerObjs || [];
  const labelFor = (deviceId) =>
    dj.speakers.find((speaker) => speaker.deviceId === deviceId)?.label ||
    outputs.find((speaker) => speaker.deviceId === deviceId)?.label ||
    "Ieșire audio";
  const currentLabel = outputs.length === 0
    ? "Nicio ieșire activă"
    : outputs.length === 1
      ? outputs[0].label || "Ieșirea sistemului"
      : `${outputs.length} ieșiri active`;
  const systemSelected = dj.selectedSpeakers.includes(SYSTEM_DEFAULT_ID);
  const testTarget = dj.outputMode === "system" || !dj.outputs?.length ? "system" : "all";
  const testLabel = testTarget === "system"
    ? "ieșirea sistemului"
    : `${dj.outputs.length} ${dj.outputs.length === 1 ? "ieșire" : "ieșiri"}`;
  const separateSpeakers = dj.speakers.filter((speaker) => !speaker.systemDefault);
  const canAlign = dj.outputMode === "separate" && (dj.outputs || []).length >= 2;
  const allFailed = outputs.length > 0 && outputs.every((speaker) => {
    const output = (dj.outputs || []).find((item) => item.deviceId === speaker.deviceId);
    return output?.state === "failed";
  });

  const testSound = async () => {
    setBusy(true);
    setNotice("");
    try {
      await dj.testBeat(testTarget);
      setNotice(`Beat trimis către ${testLabel}. Confirmă prin ascultare.`);
    } catch (error) {
      setNotice(error.message || "Beat-ul nu a pornit.");
    } finally {
      setBusy(false);
    }
  };

  const markConfirmed = (deviceId, heard) => {
    setConfirmed((previous) => {
      const next = { ...previous };
      if (heard) next[deviceId] = Date.now();
      else delete next[deviceId];
      try {
        localStorage.setItem(CONFIRM_KEY, JSON.stringify(next));
      } catch (error) {
        /* storage unavailable */
      }
      return next;
    });
  };

  const runTest = async (deviceId) => {
    if (!deviceId) return;
    if (testTimer.current) clearTimeout(testTimer.current);
    setTesting(deviceId);
    setNotice("");
    try {
      await dj.testBeat(deviceId);
      setNotice(`Beat scurt trimis către ${labelFor(deviceId)}. Ascultă și confirmă.`);
      testTimer.current = setTimeout(() => {
        dj.stopTestBeat();
        setTesting(null);
      }, 4500);
    } catch (error) {
      setNotice(error.message || "Beat-ul nu a pornit.");
      setTesting(null);
    }
  };

  const retryOutput = async (deviceId) => {
    setNotice("");
    try {
      await dj.retryOutput?.(deviceId);
    } catch (error) {
      setNotice(error.message || "Boxa nu a putut fi reîncercată.");
      return;
    }
    await runTest(deviceId);
  };

  const testOutput = async (deviceId) => {
    const output = (dj.outputs || []).find((item) => item.deviceId === deviceId);
    if (output?.state === "failed") {
      try {
        await dj.retryOutput?.(deviceId);
      } catch (error) {
        setNotice(error.message || "Boxa nu a putut fi reîncercată.");
        return;
      }
    }
    await runTest(deviceId);
  };

  const setOutputVolume = (deviceId, value) => {
    dj.setOutputVolume(deviceId, value);
  };

  return (
    <Sheet onOpenChange={(open) => { if (!open) setAlignment(false); }}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className={`h-14 w-full justify-start gap-3 border-border/80 px-4 text-left ${className}`}
          aria-label="Se aude pe — alege ieșirea audio"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Volume2 className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Se aude pe…
            </span>
            <span className="block truncate text-sm font-medium">{currentLabel}</span>
          </span>
          <StatusPill tone={dj.outputCount > 0 ? "live" : "warn"} dot>
            {dj.outputCount > 0 ? "activ" : "verifică"}
          </StatusPill>
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto pb-8">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-heading">
            {alignment ? "Aliniază boxele" : "Se aude pe…"}
          </SheetTitle>
          <SheetDescription>
            {alignment
              ? "Măsor diferența dintre boxe cu microfonul, apoi îți arăt Înainte → După."
              : "Alege ieșirea, ascultă un beat local, apoi reglează doar dacă e nevoie."}
          </SheetDescription>
        </SheetHeader>

        {alignment ? (
          <div className="mt-5 space-y-4">
            <Button variant="ghost" className="gap-2 px-0" onClick={() => setAlignment(false)}>
              <ArrowLeft className="h-4 w-4" />
              Înapoi la ieșiri
            </Button>
            <Suspense
              fallback={(
                <div className="flex min-h-[160px] items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="sr-only">Se încarcă alinierea…</span>
                </div>
              )}
            >
              <AlignmentFlow />
            </Suspense>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="caps">Ieșirea curentă</p>
                <StatusPill tone={dj.outputCount > 0 ? "live" : "warn"} dot>
                  {dj.outputCount > 0 ? `${dj.outputCount} active` : "niciuna activă"}
                </StatusPill>
              </div>
              <p className="mt-2 text-sm font-medium">{currentLabel}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {systemSelected
                  ? "Telefonul sau laptopul alege ieșirea. Un grup de boxe care apare ca o singură ieșire se aude corect aici."
                  : "Fiecare boxă are volum și întârziere proprii. Dacă browserul nu o expune separat, folosește ieșirea sistemului."}
              </p>
              {!dj.setSinkSupported && (
                <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-warning">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Browserul nu permite ieșiri separate. Alege ieșirea sistemului sau folosește Chrome/Edge pe desktop.
                </p>
              )}
              <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                {outputs.length ? outputs.map((speaker) => {
                  const output = (dj.outputs || []).find((item) => item.deviceId === speaker.deviceId);
                  const connected = dj.speakers.some((item) => item.deviceId === speaker.deviceId);
                  return (
                    <OutputTestRow
                      key={speaker.deviceId}
                      deviceId={speaker.deviceId}
                      label={labelFor(speaker.deviceId)}
                      output={output}
                      systemDefault={speaker.deviceId === SYSTEM_DEFAULT_ID}
                      connected={connected}
                      confirmedAt={confirmed[speaker.deviceId] || 0}
                      busy={testing === speaker.deviceId}
                      onTest={testOutput}
                      onConfirm={(id) => markConfirmed(id, true)}
                      onReject={(id) => markConfirmed(id, false)}
                      onRetry={retryOutput}
                      onSetVolume={setOutputVolume}
                    />
                  );
                }) : (
                  <p className="rounded-xl border border-dashed border-border/70 px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                    Nicio ieșire selectată. Alege o boxă mai jos sau folosește ieșirea sistemului.
                  </p>
                )}
              </div>
              {dj.outputError ? (
                <div role="alert" className="mt-3 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-3.5 py-3 text-[11px] leading-relaxed text-destructive">
                  <p>{dj.outputError}</p>
                </div>
              ) : null}
              {allFailed ? (
                <div className="mt-3 rounded-xl border border-warning/30 bg-warning/[0.06] px-3.5 py-3 text-[11px] leading-relaxed text-warning">
                  <p>Toate ieșirile selectate s-au oprit. Poți continua pe ieșirea sistemului; sunetul poate ajunge în difuzoarele laptopului.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-9 border-warning/40 text-warning"
                    onClick={() => (dj.continueOnSystem ? dj.continueOnSystem() : dj.setOutputMode("system"))}
                  >
                    Continuă pe ieșirea sistemului
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-3.5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Mod sigur</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Păstrează piesa, poziția, coada, volumul și mixul master. Oprește efectele, analiza și vizualizările.
                    Dacă o boxă cade, revine doar ramura acelei boxe, iar celelalte continuă.
                  </p>
                </div>
              </div>
              <Button
                variant={dj.stabilityMode ? "default" : "outline"}
                className="mt-3 h-10 w-full gap-2 border-border/80"
                onClick={() => dj.setStabilityMode(!dj.stabilityMode)}
                disabled={dj.calibrationBusy || dj.emergencyPlayback}
              >
                {dj.stabilityMode ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                {dj.stabilityMode ? "Oprește Mod sigur" : "Intră în Mod sigur"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={dj.outputMode === "system" ? "default" : "outline"}
                className="h-11"
                onClick={() => dj.setOutputMode("system")}
              >
                Ieșirea sistemului
              </Button>
              <Button
                variant={dj.outputMode === "separate" ? "default" : "outline"}
                className="h-11"
                onClick={() => dj.setOutputMode("separate")}
                disabled={!dj.setSinkSupported}
              >
                Ieșiri separate
              </Button>
            </div>

            {dj.outputMode === "separate" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="caps">Boxe disponibile</p>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => dj.refreshSpeakers()}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reîmprospătează
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => dj.requestLabels()}>
                      <Bluetooth className="h-3.5 w-3.5" />
                      Nume
                    </Button>
                  </div>
                </div>
                {separateSpeakers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 px-4 py-4 text-xs leading-relaxed text-muted-foreground">
                    Nicio boxă separată detectată. Conectează boxa în setările telefonului, apoi apasă Reîmprospătează.
                  </p>
                ) : (
                  separateSpeakers.map((speaker) => {
                    const selected = dj.selectedSpeakers.includes(speaker.deviceId);
                    return (
                      <button
                        key={speaker.deviceId}
                        type="button"
                        onClick={() => dj.toggleSpeaker(speaker.deviceId)}
                        aria-pressed={selected}
                        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                          selected
                            ? "border-primary/40 bg-primary/[0.07]"
                            : "border-border/60 bg-background/40 hover:border-foreground/20"
                        }`}
                      >
                        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-surface-raised text-muted-foreground"}`}>
                          {selected ? <Check className="h-4 w-4" /> : <Bluetooth className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{speaker.label || "Boxă"}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {selected ? "primește muzica" : "atinge pentru a auzi aici"}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <p className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Grupul de boxe este o singură ieșire. Schimbarea boxelor sau a grupului se face în setările telefonului; aplicația poate doar reda și testa prin ieșirea aleasă.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="h-12 gap-2" onClick={testSound} disabled={busy || dj.calibrationBusy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Testează sunetul
              </Button>
              <Button
                variant="outline"
                className="h-12 gap-2 border-border/80"
                onClick={() => setAlignment(true)}
              >
                <AlignCenter className="h-4 w-4" />
                Aliniază boxele
              </Button>
            </div>

            <div aria-live="polite" className="min-h-5 text-xs leading-relaxed text-muted-foreground">
              {notice || (canAlign
                ? "Testul folosește un beat generat local, merge și cu biblioteca goală."
                : "Pentru aliniere individuală ai nevoie de două ieșiri separate.")}
            </div>

            <Button asChild variant="ghost" className="w-full gap-2 text-muted-foreground">
              <Link to="/speakers">
                <Settings2 className="h-4 w-4" />
                Reglaje avansate
              </Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}