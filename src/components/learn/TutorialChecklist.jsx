import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { getRecordings } from "@/lib/recordingStore";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Check, Circle } from "lucide-react";

/** Tutorial interactiv: fiecare pas se bifează din starea reală a mixerului. */
export default function TutorialChecklist() {
  const dj = useDj();
  const [recordings, setRecordings] = useState(0);
  const [deckA, deckB] = dj.decks;

  useEffect(() => {
    let mounted = true;
    getRecordings().then((items) => mounted && setRecordings(items.length));
    return () => {
      mounted = false;
    };
  }, []);

  const steps = [
    { title: "Adaugă o piesă în bibliotecă", done: dj.tracks.length > 0, to: "/library", cta: "Bibliotecă" },
    { title: "Încarcă o piesă pe deckul A", done: !!deckA.track, to: "/", cta: "Mixer" },
    { title: "Pornește redarea pe A", done: deckA.isPlaying, to: "/", cta: "Mixer" },
    { title: "Încarcă a doua piesă pe B", done: !!deckB.track, to: "/", cta: "Mixer" },
    { title: "Pornește B și potrivește tempo", done: deckB.isPlaying, to: "/", cta: "Mixer" },
    {
      title: "Mută crossfaderul spre B",
      done: Math.abs(dj.crossfade - 0.5) > 0.06,
      to: "/",
      cta: "Mixer",
    },
    {
      title: "Înregistrează un mix",
      done: recordings > 0,
      to: "/mixes",
      cta: "Mixurile mele",
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <section className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="caps">Progres live</p>
          <h2 className="mt-1 font-heading text-lg font-semibold">
            {done} din {steps.length} pași finalizați
          </h2>
        </div>
        <span className="chip">{Math.round((done / steps.length) * 100)}%</span>
      </div>

      <Progress value={(done / steps.length) * 100} className="mt-4 h-1.5" />

      <ol className="mt-5 space-y-1.5">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/30 px-3 py-2.5"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                step.done
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-border/70 text-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {step.done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2" />}
            </span>
            <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                step.done ? "text-muted-foreground line-through" : ""
              }`}
            >
              {step.title}
            </span>
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-[11px] text-muted-foreground">
              <Link to={step.to}>
                {step.cta}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}