import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

/**
 * BPM: valoarea detectată automat, corectată manual sau bătută cu mâna.
 * Dublare/înjumătățire pentru cazurile în care analiza alege ritmul greșit.
 */
export default function BpmBar({ deck, disabled, onSetBpm, onResetBpm, onBeatOffset, onResetBeatOffset }) {
  const tapsRef = useRef([]);
  const [draft, setDraft] = useState("");
  const bpm = deck.bpm;
  const beatLen = bpm ? 60 / (bpm * (deck.tempo || 1)) : 0;

  const tap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length && now - taps[taps.length - 1] > 2500) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      const avg = sum / (taps.length - 1);
      const value = Math.round((60000 / avg) * 10) / 10;
      if (value > 40 && value < 260) onSetBpm(value);
    }
  };

  const commit = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (isFinite(v) && v >= 40 && v <= 260) onSetBpm(Math.round(v * 10) / 10);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">BPM</span>
        <span className="font-heading text-lg font-bold tabular-nums leading-none">
          {bpm ? bpm.toFixed(1) : "—"}
        </span>
        {bpm && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {deck.bpmManual ? "manual" : "detectat"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] font-bold" disabled={disabled || !bpm} onClick={() => onSetBpm(Math.round(bpm * 2 * 10) / 10)} title="Dublează ritmul">
            ×2
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] font-bold" disabled={disabled || !bpm} onClick={() => onSetBpm(Math.round((bpm / 2) * 10) / 10)} title="Înjumătățește ritmul">
            ÷2
          </Button>
          <Button size="sm" variant={deck.bpmManual ? "default" : "outline"} className="h-7 px-2 text-[10px] font-bold" disabled={disabled} onClick={tap}>
            TAP
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          onBlur={() => draft && commit()}
          inputMode="decimal"
          placeholder="ex. 128"
          disabled={disabled}
          className="h-7 w-20 rounded-md border border-input bg-transparent px-2 text-xs tabular-nums outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
        />
        <span className="text-[10px] text-muted-foreground">BPM manual</span>
        {deck.bpmManual && deck.bpmDetected && (
          <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[10px]" onClick={onResetBpm}>
            Înapoi la {deck.bpmDetected.toFixed(1)}
          </Button>
        )}
      </div>

      {bpm && (
        <div className="flex items-center gap-2 border-t border-border/40 pt-2">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">GRID</span>
          <span className="font-heading text-xs font-bold tabular-nums">
            {Math.round((deck.beatOffset || 0) * 1000)} ms
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] font-bold"
              disabled={disabled}
              onClick={() => onBeatOffset((deck.beatOffset || 0) - beatLen / 16)}
              title="Mută grid-ul înapoi"
            >
              ◀
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[10px] font-bold"
              disabled={disabled}
              onClick={() => onBeatOffset((deck.beatOffset || 0) + beatLen / 2)}
              title="Mută grid-ul cu jumătate de bătaie (contratimp)"
            >
              ½
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px] font-bold"
              disabled={disabled}
              onClick={() => onBeatOffset((deck.beatOffset || 0) + beatLen / 16)}
              title="Mută grid-ul înainte"
            >
              ▶
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              disabled={disabled}
              onClick={onResetBeatOffset}
              title="Revino la grid-ul detectat"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {!bpm && !disabled && (
        <p className="text-[10px] text-muted-foreground">
          Analiza nu a găsit un ritm clar. Introdu-l manual sau folosește TAP.
        </p>
      )}
    </div>
  );
}