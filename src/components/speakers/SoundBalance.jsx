import React from "react";
import SoundVolumeLevel from "@/components/speakers/SoundVolumeLevel";
import SoundBandLevel from "@/components/speakers/SoundBandLevel";
import { useDj } from "@/lib/djContext";
import { Timer } from "lucide-react";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";

/**
 * Echilibrare rapidă: aceeași tărie și aceeași bandă pe fiecare boxă.
 * Pentru decalajul dintre boxe (una înainte, alta în urmă) rămâne calibrarea.
 */
export default function SoundBalance() {
  const dj = useDj();
  const outputs = dj.outputs || [];

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={Timer}
        title="Sunet egal pe toate boxele"
        hint="O singură tărie și o singură bandă pentru toate — trimisă din două apăsări"
      />
      <div className="mt-4 space-y-3">
        <SoundVolumeLevel outputs={outputs} setOutputVolume={dj.setOutputVolume} />
        <SoundBandLevel outputs={outputs} setOutputBand={dj.setOutputBand} />

        <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong className="font-medium text-foreground">Dacă una e în urmă și alta în față</strong>,
          nu e vorba de nivel, ci de întârziere: boxa care se aude mai devreme primește întârziere,
          cea care se aude mai târziu rămâne la 0 ms. Bluetooth-ul adaugă de obicei 100–300 ms față
          de cablu. Calibrarea automată (mai jos) măsoară cu microfonul și întârzie singură boxele
          rapide.
        </div>
      </div>
    </Surface>
  );
}