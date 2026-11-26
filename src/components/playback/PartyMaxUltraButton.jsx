import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { PARTY_MAX_ULTRA_CONFIG } from "@/lib/djMaxConfig";
import { formatTime } from "@/lib/audioAnalysis";
import { ChevronDown, Crown, Loader2 } from "lucide-react";

const DECK = ["A", "B", "C", "D"];
const PHASE = {
  off: "Oprit",
  empty: "Bibliotecă goală",
  starting: "Pornesc",
  playing: "Redau",
  preparing: "Pregătesc următoarea",
  mixing: "În tranziție",
  error: "Problemă",
};

/** Un singur mod de petrecere, pornit direct din Redare și vizibil în tot studio-ul. */
export default function PartyMaxUltraButton({ dj, nextName }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const auto = dj.autoDj;
  const active = !!auto?.on && !!auto?.config?.partyMax;
  const canMix = (dj.tracks?.length || 0) >= 2;
  const upcoming = auto?.upcoming?.[0]?.name || nextName;
  const status = auto?.status || {};
  const exitAt = active ? auto.getExitPosition?.() : null;
  const activeDeck = dj.decks?.[status.activeDeck ?? 0] || null;
  const confidence = Number(activeDeck?.bpmConfidence);

  const toggle = async () => {
    if (busy) return;
    if (active) {
      auto.setOn(false);
      return;
    }
    if (!canMix) {
      toast({
        title: "Adaugă încă o piesă pentru mix automat",
        description: "Party MAX Ultra are nevoie de cel puțin două piese în bibliotecă.",
      });
      return;
    }
    setBusy(true);
    try {
      auto.startMax(PARTY_MAX_ULTRA_CONFIG);
    } catch (error) {
      toast({
        title: "Party MAX Ultra nu a pornit",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant={active ? "default" : "outline"}
        className={`h-12 w-full gap-2 ${active ? "shadow-glow" : "border-border/80"}`}
        onClick={toggle}
        disabled={busy}
        aria-pressed={active}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
        {active ? "Party MAX Ultra activ" : "Party MAX Ultra"}
      </Button>

      <p className="min-h-4 text-center text-[11px] leading-relaxed text-muted-foreground" aria-live="polite">
        {!canMix
          ? "Adaugă încă o piesă pentru mix automat. Redarea normală rămâne disponibilă."
          : active && upcoming
            ? `Urmează: ${upcoming}`
            : "Mix automat local, cu protecția refrenului și a drop-ului."}
      </p>

      {active ? (
        <details className="group rounded-xl border border-border/60 bg-card/40 px-3.5 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium text-muted-foreground">
            Diagnostic Party MAX Ultra
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <dt className="text-muted-foreground">Ieșire din</dt>
            <dd className="text-right font-medium">Deck {DECK[status.activeDeck ?? 0]}</dd>
            <dt className="text-muted-foreground">Intrare în</dt>
            <dd className="text-right font-medium">
              Deck {DECK[(status.activeDeck ?? 0) === 0 ? 1 : 0]}
            </dd>
            <dt className="text-muted-foreground">Stare</dt>
            <dd className="text-right font-medium">{PHASE[status.phase] || "Oprit"}</dd>
            <dt className="text-muted-foreground">Tranziție</dt>
            <dd className="text-right font-medium">{status.mixStyle || "pregătită"}</dd>
            <dt className="text-muted-foreground">Încredere</dt>
            <dd className="text-right font-medium">
              {Number.isFinite(confidence) && confidence > 0
                ? `${Math.round(confidence * 100)}% · ${status.aligned ? "beatmatch" : "fără beatmatch"}`
                : status.aligned ? "beatmatch confirmat" : "fără beatmatch"}
            </dd>
            <dt className="text-muted-foreground">Ieșire la</dt>
            <dd className="text-right font-medium">
              {Number.isFinite(exitAt) ? formatTime(exitAt) : "finalul piesei"}
            </dd>
          </dl>
          {status.message ? (
            <p className="mt-2 border-t border-border/50 pt-2 text-[11px] leading-relaxed text-muted-foreground">
              {status.message}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}