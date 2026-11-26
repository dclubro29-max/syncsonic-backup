import React, { lazy, Suspense, useEffect } from "react";
import { useDj } from "@/lib/djContext";
import SpeakerPicker from "@/components/SpeakerPicker";
import PreSetCheck from "@/components/speakers/PreSetCheck";
import SoundBalance from "@/components/speakers/SoundBalance";
import PlaybackProtection from '@/components/speakers/PlaybackProtection';
import IsolatedTest from "@/components/IsolatedTest";
import OutputBands from "@/components/OutputBands";
import CueOutput from "@/components/CueOutput";
import OutputModeSelector from "@/components/speakers/OutputModeSelector";
import OutputStatusList from "@/components/speakers/OutputStatusList";
import BeatTestPanel from "@/components/speakers/BeatTestPanel";
import AudioDiagnosticsPanel from "@/components/speakers/AudioDiagnosticsPanel";
import PageHeader from "@/components/ui-kit/PageHeader";
import PageLoader from "@/components/layout/PageLoader";

const AlignmentFlow = lazy(() => import("@/components/speakers/AlignmentFlow"));
import StatusPill from "@/components/ui-kit/StatusPill";
import { Button } from "@/components/ui/button";
import { AlignCenter, Bluetooth, Info, PlayCircle } from "lucide-react";
import { HDMI_NOTE, SYSTEM_DEFAULT_ID, isCommunicationsOutput, isHdmiOutput } from "@/lib/outputs";

export default function Speakers() {
  const dj = useDj();
  const commsPresent = dj.speakers.some((speaker) => isCommunicationsOutput(speaker.label));
  const hdmiPresent = dj.speakers.some((speaker) => !speaker.systemDefault && isHdmiOutput(speaker.label));
  const systemSelected = dj.selectedSpeakers.includes(SYSTEM_DEFAULT_ID);
  const systemOutput = (dj.outputs || []).find((output) => output.deviceId === SYSTEM_DEFAULT_ID) || (dj.outputs || [])[0];

  // Trezim motorul audio ca ieșirile selectate să fie create imediat și să apară în liste.
  const ensureAudio = dj.ensureAudio;
  useEffect(() => {
    ensureAudio().catch(() => {});
  }, [ensureAudio]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sunet"
        title="Boxe și sunet"
        icon={Bluetooth}
        description="Unde se aude, test cu beat, aliniere automată și reglaje avansate."
        actions={
          <>
            <StatusPill tone={dj.outputCount > 0 ? "live" : "warn"} dot>
              {dj.outputCount > 0
                ? `${dj.outputCount} ${dj.outputCount === 1 ? "ieșire activă" : "ieșiri active"}`
                : systemSelected ? "Ieșirea sistemului selectată" : "nicio ieșire selectată"}
            </StatusPill>
            <StatusPill tone="neutral">
              {dj.speakers.length} {dj.speakers.length === 1 ? "dispozitiv detectat" : "dispozitive detectate"}
            </StatusPill>
          </>
        }
      />

      <section className="space-y-3">
        <p className="caps">Alege ieșirea</p>
        <OutputModeSelector />

      {dj.outputMode === 'separate' && (
        <SpeakerPicker
          speakers={dj.speakers}
          selected={dj.selectedSpeakers}
          onToggle={dj.toggleSpeaker}
          onSelectAll={dj.setAllSpeakers}
          onRefresh={dj.refreshSpeakers}
          onRequestLabels={dj.requestLabels}
          loading={dj.loadingDevices}
          supported={dj.setSinkSupported}
        />
      )}

      {dj.outputMode === 'system' && (
        <section className="panel-quiet p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="caps">Ieșirea sistemului</p>
            <StatusPill tone={systemOutput?.state === 'active' ? 'live' : 'warn'} dot>
              {systemOutput ? systemOutput.state : 'se pregătește'}
            </StatusPill>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sunetul pleacă pe ieșirea aleasă în telefon sau laptop. Un grup de boxe care apare ca o singură ieșire se aude corect aici, dar nu poate primi întârzieri separate.
          </p>
          {systemOutput && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {systemOutput.delay || 0} ms întârziere · volum {Math.round((systemOutput.volume ?? 1) * 100)}%
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => dj.testBeat('system').catch(() => {})}>
              <PlayCircle className="h-4 w-4" /> Testează grupul
            </Button>
            <button type="button" className="chip" onClick={() => dj.refreshSpeakers()}>Reîmprospătează ieșirile</button>
            {!dj.setSinkSupported && <span className="chip border-warning/40 text-warning">Browserul nu permite ieșiri separate</span>}
          </div>
        </section>
      )}

      {dj.labelRequestNotice && <p role="status" className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">{dj.labelRequestNotice}</p>}

        <OutputStatusList />
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          className="h-12 gap-2"
          onClick={() => document.getElementById("beat-test")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <PlayCircle className="h-4 w-4" />
          Testează sunetul
        </Button>
        <Button
          variant="outline"
          className="h-12 gap-2 border-border/80"
          onClick={() => document.getElementById("alignment")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <AlignCenter className="h-4 w-4" />
          Aliniază boxele
        </Button>
      </div>

      <div id="beat-test" className="scroll-mt-20">
        <BeatTestPanel />
      </div>
      <div id="alignment" className="scroll-mt-20">
        <Suspense fallback={<PageLoader />}>
          <AlignmentFlow />
        </Suspense>
      </div>

      <details className="panel p-5">
        <summary className="cursor-pointer font-heading text-sm font-semibold">Avansat</summary>
        <div className="mt-5 space-y-6">
          <AudioDiagnosticsPanel />
          <PlaybackProtection />
          <PreSetCheck />
          <SoundBalance />
          <CueOutput />
          <OutputBands />
          <IsolatedTest />
        </div>
      </details>

      <section className="panel-quiet p-5">
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-primary">
            <Info className="h-4 w-4" />
          </span>
          <div className="space-y-3">
            {hdmiPresent && (
              <p className="rounded-lg border border-info/25 bg-info/[0.06] px-3 py-2.5 text-info">
                <strong className="font-medium">Televizorul prin HDMI</strong> apare în listă ca o
                ieșire obișnuită — {HDMI_NOTE}
              </p>
            )}
            <p>
              <strong className="font-medium text-foreground">Conectarea Bluetooth</strong> se face
              în setările telefonului sau laptopului, nu în aplicație. Aplicația poate selecta doar
              ieșirile pe care browserul le expune și le permite, și nu poate garanta schimbarea
              profilului Bluetooth al sistemului.
            </p>
            {commsPresent && (
              <div>
                <p className="mb-2">
                  Dacă boxa apare doar cu o ieșire de comunicații, alege ieșirea de redare stereo din
                  setările sistemului, apoi revino aici:
                </p>
                <ul className="ml-4 list-disc space-y-1">
                  <li><strong className="font-medium text-foreground">Windows</strong>: Setări → Sistem → Sunet → alege „Stereo (…)”. În Proprietăți → Setări dispozitiv, debifează „Handsfree Telephony”.</li>
                  <li><strong className="font-medium text-foreground">macOS</strong>: expune de obicei o singură ieșire — deconectează și reconectează boxa.</li>
                  <li><strong className="font-medium text-foreground">Android</strong>: Setări → Bluetooth → dispozitivul tău → activează „Media audio”, nu doar „Phone audio”.</li>
                </ul>
              </div>
            )}
            <p>
              Dacă sistemul arată boxele ca o singură ieșire, nu putem aplica întârzieri separate —
              reglajele individuale nu ar avea efect. Alinierea automată compensează doar întârzieri
              măsurate stabil; Bluetooth poate varia ulterior. Pentru un eveniment, o conexiune
              pe cablu sau un sistem de boxe sincronizat hardware este varianta mai sigură.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}