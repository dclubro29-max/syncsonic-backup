import React, { useEffect, useState } from "react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import StatusPill from "@/components/ui-kit/StatusPill";
import { formatTime } from "@/lib/audioAnalysis";
import { parseTrackName } from "@/lib/trackName";
import { Crown, Music2, Pause, Play, SkipForward, Volume2, VolumeX } from "lucide-react";

/** Starea gazdei, citită de pe telefon; progresul avansează local între actualizări. */
const COMMAND_STATUS = {
  pending: { label: "Se trimite", tone: "neutral" },
  preparing: { label: "Se pregătește", tone: "ready" },
  mixing: { label: "În mix", tone: "deckB" },
  done: { label: "Redare", tone: "live" },
  skipped: { label: "Neexecutat", tone: "warn" },
  failed: { label: "Nu a pornit", tone: "danger" },
};

export default function RemoteNowPlaying({ device, command, large, busy, onToggle, onNext, onVolume }) {
  const now = device?.now_playing || null;
  const [clock, setClock] = useState(Date.now());
  const [volume, setVolume] = useState(Math.round((now?.master_volume ?? 1) * 100));

  useEffect(() => {
    if (!now?.is_playing) return undefined;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [now?.is_playing, now?.track_id]);

  useEffect(() => {
    if (now?.master_volume != null) setVolume(Math.round(now.master_volume * 100));
  }, [now?.master_volume]);

  if (!now) {
    return (
      <section className={`panel ${large ? "p-6" : "p-5"}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-raised text-primary">
            <Music2 className="h-5 w-5" />
          </span>
          <div>
            <p className="caps">Gazda</p>
            <p className={`mt-1 font-heading font-semibold ${large ? "text-xl" : "text-base"}`}>
              {device?.label || "Alege laptopul"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Pornește o piesă pe laptop și ține aplicația deschisă. Starea apare aici imediat.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { artist, title } = parseTrackName(now.track_name || "");
  const duration = Number(now.duration) || 0;
  const elapsed = now.is_playing
    ? (Number(now.progress) || 0) + (clock - (Number(now.updated_at) || clock)) / 1000
    : Number(now.progress) || 0;
  const progress = duration ? Math.min(duration, Math.max(0, elapsed)) : Math.max(0, elapsed);
  const age = Date.now() - (Number(device?.updated_at) || Number(now.updated_at) || 0);
  const online = age < 60000;
  const reconnecting = !online && age < 180000;

  return (
    <section className={`panel bg-gradient-to-b from-primary/10 via-card to-card ${large ? "p-6" : "p-5"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="caps">Gazda</p>
          <p className={`mt-1 truncate font-heading font-semibold ${large ? "text-xl" : "text-base"}`}>
            {device?.label || "Dispozitiv"}
          </p>
        </div>
        <StatusPill tone={online ? "live" : reconnecting ? "warn" : "danger"} dot>
          {online ? "Conectat" : reconnecting ? "Reconectare" : "Offline"}
        </StatusPill>
      </div>

      <div className={`mt-5 flex gap-4 ${large ? "flex-col" : "items-center"}`}>
        <div className={`shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-surface-raised ${
          large ? "h-40 w-40" : "h-20 w-20"
        }`}>
          {now.cover ? (
            <Image src={now.cover} alt={`Coperta piesei ${title}`} fittingType="fill" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Music2 className={large ? "h-10 w-10" : "h-7 w-7"} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className={`truncate font-heading font-semibold ${large ? "text-2xl" : "text-lg"}`}>{title}</h2>
          {artist ? <p className={`truncate text-muted-foreground ${large ? "text-base" : "text-sm"}`}>{artist}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {command && COMMAND_STATUS[command.status] ? (
              <StatusPill tone={COMMAND_STATUS[command.status].tone} dot>
                {COMMAND_STATUS[command.status].label}
              </StatusPill>
            ) : null}
            {now.party_max ? (
              <StatusPill tone="ready" icon={Crown}>Party MAX Ultra</StatusPill>
            ) : null}
            {now.auto_dj && !now.party_max ? <StatusPill tone="neutral">Auto DJ</StatusPill> : null}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        <Slider value={[progress]} max={duration || 1} step={1} disabled aria-label="Progresul piesei" />
        <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
          <span>{formatTime(progress)}</span>
          <span>{duration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      <div className="relative mx-auto mt-5 grid w-fit grid-cols-[3rem_auto_3rem] items-center gap-3 rounded-full border border-border/60 bg-background/40 p-2">
        <span aria-hidden="true" />
        <Button
          size="icon"
          className={`rounded-full shadow-glow motion-safe:transition-transform motion-safe:active:scale-95 ${large ? "h-20 w-20" : "h-16 w-16"}`}
          onClick={onToggle}
          disabled={busy || !online}
          aria-busy={busy}
          aria-label={now.is_playing ? "Pauză" : "Redă"}
        >
          {now.is_playing ? (
            <Pause className={large ? "h-8 w-8" : "h-7 w-7"} />
          ) : (
            <Play className={`ml-0.5 ${large ? "h-8 w-8" : "h-7 w-7"}`} />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full border-transparent bg-transparent motion-safe:transition-transform motion-safe:active:scale-95"
          onClick={onNext}
          disabled={busy || !online}
          aria-label="Următoarea"
        >
          <SkipForward className={large ? "h-6 w-6" : "h-5 w-5"} />
        </Button>
      </div>

      <div className="mt-5 flex items-center gap-3">
        {volume > 0 ? <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" /> : <VolumeX className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <Slider
          value={[volume]}
          max={100}
          step={1}
          disabled={!online}
          onValueChange={([value]) => setVolume(value)}
          onValueCommit={([value]) => onVolume?.(value / 100)}
          aria-label="Volum pe gazdă"
        />
        <span className="num w-9 text-right text-[11px] text-muted-foreground">{volume}%</span>
      </div>
    </section>
  );
}
