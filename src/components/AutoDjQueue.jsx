import React from "react";
import { ListMusic, X } from "lucide-react";
import { Label } from "@/components/ui/label";

/** Coada vizibilă a Auto DJ-ului: ce urmează, cu posibilitatea de a scoate o piesă. */
export default function AutoDjQueue({ upcoming = [], onRemove, currentName, lockedTrackId }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-xs font-medium">
          <ListMusic className="h-3.5 w-3.5" />
          Urmează
        </Label>
        <span className="text-[11px] tabular-nums text-muted-foreground">{upcoming.length}</span>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {currentName
            ? "Coada se completează când se apropie finalul piesei curente."
            : "Pornește Auto DJ ca să vezi ce urmează."}
        </p>
      ) : (
        <ol className="space-y-1">
          {upcoming.slice(0, 8).map((track, i) => (
            <li key={track.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
              <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[11px]">{track.name}</span>
              <button
                type="button"
                onClick={() => onRemove(track.id)}
                disabled={track.id === lockedTrackId}
                title={track.id === lockedTrackId ? 'Piesa este deja în tranziție' : 'Scoate din coadă'}
                aria-label={`Scoate „${track.name}” din coadă`}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}