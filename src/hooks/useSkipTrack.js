import { useCallback } from "react";
import { useDj } from "@/lib/djContext";
import { useRepeatGuard } from "@/components/mixer/RepeatLockProvider";

/**
 * „Următoarea piesă": cu Auto DJ pornit, pornește tranziția imediat;
 * fără Auto DJ, încarcă piesa următoare din bibliotecă pe deckul care cântă.
 */
export function useSkipTrack() {
  const dj = useDj();
  const guard = useRepeatGuard();
  const autoDjOn = dj.autoDj.on;

  const skip = useCallback(() => {
    if (autoDjOn) {
      dj.autoDj.skip();
      return;
    }
    const list = dj.tracks;
    if (!list.length) return;
    const playing = dj.decks.findIndex((d) => d.isPlaying);
    const target = playing >= 0 ? playing : 0;
    const current = dj.decks[target]?.track;
    const index = current ? list.findIndex((t) => t.id === current.id) : -1;
    const next = list[(index + 1) % list.length];
    if (!next) return;
    guard.guardDeck(target, () => {
      Promise.resolve(dj.loadToDeck(target, next)).then(() => dj.togglePlay(target));
    });
  }, [autoDjOn, dj, guard]);

  return { skip, canSkip: autoDjOn || dj.tracks.length > 0, autoDjOn };
}