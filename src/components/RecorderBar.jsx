import React from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/ui-kit/StatusPill";
import { Circle, Square, AlertTriangle, ArrowRight } from "lucide-react";
import { isRecordingSupported } from "@/hooks/useRecorder";

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function RecorderBar() {
  const dj = useDj();
  const supported = isRecordingSupported();

  return (
    <section className="panel-quiet px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={dj.isRecording ? "destructive" : "default"}
          className="gap-2"
          disabled={!supported}
          onClick={() => (dj.isRecording ? dj.stop() : dj.start())}
        >
          {dj.isRecording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4 fill-current" />}
          {dj.isRecording ? "Oprește înregistrarea" : "Înregistrează mixul"}
        </Button>

        <span className="num rounded-lg border border-border/60 bg-surface-inset/60 px-2.5 py-1 text-sm text-foreground">
          {fmt(dj.elapsed)}
        </span>

        {dj.isRecording && (
          <StatusPill tone="danger" dot pulse>
            REC
          </StatusPill>
        )}

        <Button asChild variant="ghost" size="sm" className="ml-auto gap-1.5 text-muted-foreground">
          <Link to="/mixes">
            Mixurile mele
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {!supported && (
        <p className="mt-3 flex items-start gap-2 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Browserul tău nu permite înregistrarea audio. Folosește Chrome sau Edge.
        </p>
      )}
      {dj.error && <p className="mt-3 text-[11px] text-destructive">{dj.error}</p>}
      {dj.isRecording && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Înregistrarea continuă chiar dacă schimbi pagina. Se salvează local, la oprire.
        </p>
      )}
    </section>
  );
}