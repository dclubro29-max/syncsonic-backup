import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clapperboard, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useDj } from "@/lib/djContext";

/**
 * Imaginea filmului rămâne aici, dar sunetul nu iese din element:
 * intră în magistrala master a motorului, deci ajunge pe boxele selectate,
 * cu întârzierea și banda fiecăreia.
 */
export default function MovieStage({ source, onReplace }) {
  const dj = useDj();
  const videoRef = useRef(null);
  const attachRef = useRef(dj.attachMovieElement);
  const detachRef = useRef(dj.detachMovie);
  attachRef.current = dj.attachMovieElement;
  detachRef.current = dj.detachMovie;

  const [volume, setVolume] = useState(1);
  const [error, setError] = useState(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return undefined;
    let alive = true;
    attachRef.current(element).catch((e) => {
      if (alive) setError(e?.message || "Sunetul filmului nu a putut fi conectat la boxe.");
    });
    return () => {
      alive = false;
      try {
        element.pause();
      } catch {
        /* filmul poate fi deja oprit */
      }
      detachRef.current();
    };
  }, [source.url]);

  const changeVolume = (value) => {
    const element = videoRef.current;
    setVolume(value);
    if (element) element.volume = value;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-black">
        <video
          ref={videoRef}
          src={source.url}
          controls
          playsInline
          preload="metadata"
          onPlay={() => dj.ensureAudio()}
          className="max-h-[58vh] w-full bg-black"
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-medium">{source.name}</p>
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={([v]) => changeVolume(v)}
              className="w-32"
              aria-label="Volum film"
            />
            <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(volume * 100)}%
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={onReplace}>
              Alt film
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Clapperboard className="h-4 w-4 text-primary" />
          {dj.outputCount > 0 ? (
            <span>
              Sunetul iese prin {dj.outputCount} {dj.outputCount === 1 ? "boxă" : "boxe"}.
            </span>
          ) : (
            <span>Nicio boxă selectată — sunetul iese pe ieșirea implicită.</span>
          )}
          <Link to="/speakers" className="font-medium text-primary hover:underline">
            Boxe și întârziere
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}