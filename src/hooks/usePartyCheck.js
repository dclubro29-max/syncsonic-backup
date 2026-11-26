import { useCallback, useState } from "react";
import { useDj } from "@/lib/djContext";

/**
 * Testul de dinainte de petrecere: verifică motorul audio, piesele, ieșirile și
 * volumul, apoi lasă pornirea să continue doar după ce utilizatorul vede
 * rezultatul. Totul se calculează local, fără niciun apel extern.
 */
export function usePartyCheck() {
  const dj = useDj();
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState([]);
  const [pending, setPending] = useState(null);

  const run = useCallback(
    async (action) => {
      let engineOk = false;
      try {
        const ctx = await dj.ensureAudio();
        engineOk = !!ctx && ctx.state === "running";
      } catch (e) {
        engineOk = false;
      }

      const trackCount = dj.tracks.length;
      const outputCount = dj.outputCount;
      const volume = dj.masterVolume;

      setChecks([
        {
          id: "engine",
          ok: engineOk,
          label: engineOk ? "Motorul audio pornește" : "Motorul audio nu a răspuns încă",
          hint: "Apasă o dată oriunde pe pagină, apoi reia testul.",
        },
        {
          id: "tracks",
          ok: trackCount > 0,
          label: trackCount > 0 ? `${trackCount} piese în bibliotecă` : "Biblioteca e goală",
          hint: "Adaugă piese ca să ai ce mixa.",
          to: "/library",
        },
        {
          id: "outputs",
          ok: outputCount > 0,
          label:
            outputCount > 0
              ? `${outputCount} ${outputCount === 1 ? "ieșire activă" : "ieșiri active"}`
              : "Se folosește ieșirea implicită",
          hint: "Alege boxele pentru sunet pe mai multe ieșiri.",
          to: "/speakers",
        },
        {
          id: "volume",
          ok: volume > 0.02,
          label: `Volum master ${Math.round(volume * 100)}%`,
          hint: "Ridică volumul master, altfel petrecerea nu se aude.",
        },
      ]);

      setPending(() => action);
      setOpen(true);
    },
    [dj]
  );

  const confirm = useCallback(() => {
    const action = pending;
    setOpen(false);
    setPending(null);
    action?.();
  }, [pending]);

  const cancel = useCallback(() => {
    setOpen(false);
    setPending(null);
  }, []);

  const testSound = useCallback(() => dj.playTestTone(null, 500), [dj.playTestTone]);

  return { open, checks, run, confirm, cancel, testSound };
}