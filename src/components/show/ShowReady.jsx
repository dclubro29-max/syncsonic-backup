import React from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { PARTY_MAX_CONFIG } from "@/lib/djMaxConfig";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/ui-kit/StatusPill";
import {
  Activity, AlertTriangle, Flame, Gauge, Library, Play, Square, Volume2,
} from "lucide-react";

function Row({ icon: Icon, ok, title, detail, to }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          ok
            ? "border-success/30 bg-success/10 text-success"
            : "border-warning/30 bg-warning/10 text-warning"
        }`}
      >
        {ok ? <Icon className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {detail}
          {to && !ok && (
            <>
              {" · "}
              <Link to={to} className="font-medium text-primary underline-offset-4 hover:underline">
                rezolvă
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Verificarea dinaintea setului: arată într-o privire ce lipsește ca sunetul să
 * fie sigur pe toate boxele, apoi pornește tot setul dintr-un singur buton —
 * DJ MAX ULTRA, cu tranziții lungi aliniate pe frază și limiter activ.
 */
export default function ShowReady() {
  const dj = useDj();
  const auto = dj.autoDj;

  const speakerCount = dj.selectedSpeakers?.length || 0;
  const trackCount = dj.tracks.length;
  const aligned = (dj.outputs || []).filter((o) => o.delay > 0).length;
  const masterLevel = Math.round((dj.masterVolume || 0) * 100);
  const running = auto.on && auto.status?.phase !== "error";

  const hasSpeakers = speakerCount > 0;
  const audible = masterLevel > 3;
  const hasLibrary = trackCount >= 2;
  const canStart = hasSpeakers && audible && hasLibrary;
  const ready = canStart && !dj.outputError && !dj.playbackError;

  const startShow = () => {
    dj.ensureAudio?.();
    auto.startMax(PARTY_MAX_CONFIG);
  };

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Flame className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-sm font-semibold">Spectacol</h2>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Tot ce ține de sunet, verificat o dată. Un buton pornește setul.
            </p>
          </div>
        </div>
        <StatusPill tone={running ? "live" : ready ? "ready" : "warn"} dot pulse={running}>
          {running ? "În desfășurare" : ready ? "Pregătit" : "De verificat"}
        </StatusPill>
      </div>

      <div className="space-y-4 px-4 py-3">
        <div className="grid gap-x-6 gap-y-0 sm:grid-cols-2">
          <Row
            icon={Volume2}
            ok={hasSpeakers}
            title={hasSpeakers ? `${speakerCount} ${speakerCount === 1 ? "boxă activă" : "boxe active"}` : "Nicio boxă selectată"}
            detail={hasSpeakers ? "Sunetul pleacă pe toate ieșirile alese." : "Sunetul merge pe ieșirea implicită a sistemului."}
            to="/speakers"
          />
          <Row
            icon={Gauge}
            ok={audible}
            title={`Volum master ${masterLevel}%`}
            detail={audible ? "Nivelul e în intervalul de redare." : "Masterul e aproape de zero — setul nu se aude."}
            to="/speakers"
          />
          <Row
            icon={Activity}
            ok={aligned > 0}
            title={aligned > 0 ? "Boxele sunt aliniate" : "Alinierea nu a fost făcută"}
            detail={aligned > 0
              ? `${aligned} ${aligned === 1 ? "ieșire are" : "ieșiri au"} întârziere măsurată, fără ecou între boxe.`
              : "Fără aliniere, boxele depărtate întârzie față de cele apropiate."}
            to="/speakers"
          />
          <Row
            icon={Library}
            ok={hasLibrary}
            title={hasLibrary ? `${trackCount} piese în bibliotecă` : "Biblioteca e aproape goală"}
            detail={hasLibrary ? "Auto DJ are din ce alege pentru tot setul." : "Adaugă cel puțin două piese ca să poată mixa."}
            to="/library"
          />
        </div>

        {(dj.playbackError || dj.outputError) && (
          <p role="alert" className="rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2 text-[11px] leading-relaxed text-warning">
            {dj.playbackError || dj.outputError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!canStart ? (
            <Button asChild className="h-11 flex-1 gap-2 text-sm font-semibold">
              <Link to={!hasSpeakers || !audible ? "/speakers" : "/library"}>
                <AlertTriangle className="h-4 w-4" />
                Rezolvă ce lipsește
              </Link>
            </Button>
          ) : running ? (
            <Button
              variant="destructive"
              className="h-11 flex-1 gap-2 text-sm font-semibold"
              onClick={() => auto.setOn(false)}
            >
              <Square className="h-4 w-4" />
              Oprește spectacolul
            </Button>
          ) : (
            <Button className="h-11 flex-1 gap-2 text-sm font-semibold" onClick={startShow}>
              <Play className="h-4 w-4" />
              {dj.outputError || dj.playbackError ? 'Reîncearcă Party MAX' : 'Pornește Party MAX'}
            </Button>
          )}
          {running && (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {auto.status.phase === 'mixing' ? 'Tranziție în curs' : 'Auto DJ activ'} · tranziție {Math.round(auto.config.crossfade)}s
            </span>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          „Pornește Party MAX” activează mixarea automată și efectele de la pornire:
          filtru, ecou, reverb și build → drop, inclusiv fără analiza BPM.
          Tranziția este de până la 12s; limiterul rămâne activ, iar volumul master rămâne cel ales.
        </p>
      </div>
    </section>
  );
}