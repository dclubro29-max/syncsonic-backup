import React from "react";
import { Slider } from "@/components/ui/slider";
import EqControls from "@/components/deck/EqControls";
import BpmBar from "@/components/deck/BpmBar";
import EffectsPanel from "@/components/deck/EffectsPanel";
import LoopControls from "@/components/deck/LoopControls";

/** Reglajele secundare ale unui deck, într-un panou extensibil. */
export default function DeckAdvanced({ deck, disabled, hasTrack, actions }) {
  return (
    <div className="space-y-4 border-t border-border/60 pt-3">
      <EqControls
        deck={deck}
        disabled={!hasTrack}
        onEq={actions.onEq}
        onTempo={actions.onTempo}
        onTrim={actions.onTrim}
        onVolume={actions.onVolume}
      />

      <div className="border-t border-border/60 pt-3">
        <BpmBar
          deck={deck}
          disabled={!hasTrack}
          onSetBpm={actions.onSetBpm}
          onResetBpm={actions.onResetBpm}
          onBeatOffset={actions.onBeatOffset}
          onResetBeatOffset={actions.onResetBeatOffset}
        />
      </div>

      <div className="border-t border-border/60 pt-3">
        <LoopControls
          deck={deck}
          hasBpm={!!deck.bpm}
          disabled={!hasTrack}
          onBoundary={actions.onLoopBoundary}
          onBeatLoop={actions.onBeatLoop}
          onClear={actions.onClearLoop}
          onRepeat={actions.onRepeat}
        />
      </div>

      <div className="border-t border-border/60 pt-3">
        <EffectsPanel fx={deck.fx} disabled={!hasTrack} onChange={actions.onFx} onReset={actions.onResetFx} />
      </div>

      <div className="flex items-center gap-3 border-t border-border/60 pt-3">
        <span className="w-14 shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground">VOL</span>
        <Slider
          value={[Math.round(deck.volume * 100)]}
          max={100}
          step={1}
          onValueChange={(v) => actions.onVolume(v[0] / 100)}
          disabled={!hasTrack}
          className="flex-1"
        />
        <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground">
          {Math.round(deck.volume * 100)}%
        </span>
      </div>
    </div>
  );
}