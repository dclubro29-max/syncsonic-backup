import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatSize } from "@/lib/trackStore";
import { parseTrackName } from "@/lib/trackName";
import { Loader2, Music2, Palette, Play, Plus, Sparkles } from "lucide-react";

export default function PlaybackEmpty({ tracks, busy, onDemo, onFiles, onPlay }) {
  const empty = tracks.length === 0;

  return (
    <section className="mx-auto w-full max-w-[520px] px-1">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-border/60 bg-surface-raised text-primary shadow-panel">
          <Music2 className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-heading text-[clamp(1.55rem,6vw,2.2rem)] font-semibold tracking-[-0.04em]">
          {empty ? "Biblioteca este goală" : "Alege prima piesă"}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {empty
            ? "Pornește imediat un demo generat local sau adaugă fișierele tale. Nu ai nevoie de cont și nu se încarcă nimic pe server."
            : "Pornește o piesă din bibliotecă. Fișierele rămân pe acest dispozitiv."}
        </p>
      </div>

      {empty ? (
        <div className="mt-7 grid gap-2.5">
          <Button className="h-14 gap-2 text-[15px]" onClick={onDemo} disabled={!!busy}>
            {busy === "demo" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Redă demo
          </Button>
          <Button asChild variant="outline" className="h-14 gap-2 border-border/80 text-[15px]">
            <label className="cursor-pointer">
              {busy === "files" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Adaugă muzică
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  onFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {tracks.slice(0, 8).map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-3">
              <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{parseTrackName(item.name).title}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{formatSize(item.size)}</p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onPlay(item)}>
                <Play className="h-3.5 w-3.5" />
                Redă
              </Button>
            </div>
          ))}
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            <Button variant="outline" className="h-12 gap-2 border-border/80" onClick={onDemo} disabled={!!busy}>
              {busy === "demo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Redă demo
            </Button>
            <Button asChild variant="outline" className="h-12 gap-2 border-border/80">
              <label className="cursor-pointer">
                {busy === "files" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adaugă muzică
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    onFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
        </div>
      )}

      <Button asChild variant="ghost" className="mt-3 w-full gap-2 text-muted-foreground">
        <Link to="/appearance">
          <Palette className="h-4 w-4" />
          Schimbă aspectul
        </Link>
      </Button>
    </section>
  );
}