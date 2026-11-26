import React, { useRef } from "react";
import { formatTime } from "@/lib/audioAnalysis";

/**
 * 4 hot cues. Click pe un pad gol = memorează poziția.
 * Click pe un pad plin = sari la poziție. Ține apăsat = suprascrie.
 */
export default function HotCues({ cues, disabled, onJump, onSet, onClear }) {
  const timerRef = useRef(null);
  const firedRef = useRef(false);

  const down = (slot) => {
    firedRef.current = false;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onSet(slot);
    }, 550);
  };

  const up = (slot) => {
    clearTimeout(timerRef.current);
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    if (cues[slot] == null) onSet(slot);
    else onJump(slot);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="caps">Hot cues</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          ține apăsat = suprascrie
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {cues.map((t, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onPointerDown={() => down(i)}
            onPointerUp={() => up(i)}
            onPointerLeave={() => clearTimeout(timerRef.current)}
            title={t == null ? `Memorează hot cue ${i + 1}` : `Hot cue ${i + 1} · ${formatTime(t)} (ține apăsat pentru a suprascrie)`}
            className={`group relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border font-mono text-[10px] font-semibold tabular-nums transition-colors disabled:opacity-40 ${
              t == null
                ? "border-border/70 bg-surface-raised/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                : "border-warning/45 bg-warning/10 text-warning"
            }`}
          >
            <span>{t == null ? `HC${i + 1}` : formatTime(t)}</span>
            {t != null && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear(i);
                }}
                onPointerUp={(e) => e.stopPropagation()}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] leading-none text-destructive-foreground group-hover:flex"
              >
                ×
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}