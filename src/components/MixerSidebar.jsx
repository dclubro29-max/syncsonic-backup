import React from "react";
import { useDj } from "@/lib/djContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PartyPanel from "@/components/PartyPanel";
import AutoDjPanel from "@/components/AutoDjPanel";
import MasterPanel from "@/components/MasterPanel";
import MasterEnhancer from "@/components/MasterEnhancer";
import ConcertPanel from "@/components/ConcertPanel";
import Sampler from "@/components/Sampler";
import { useRepeatGuard } from "@/components/mixer/RepeatLockProvider";

/**
 * Panourile laterale ale mixerului, grupate în taburi: un singur grup e vizibil
 * o dată, ca mixerul să rămână aerisit. Deck-urile primesc tot spațiul.
 */
export default function MixerSidebar() {
  const dj = useDj();
  const guard = useRepeatGuard();

  return (
    <Tabs defaultValue="auto" className="space-y-3">
      <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl border border-border/70 bg-surface-inset/60 p-1">
        <TabsTrigger
          value="auto"
          className="rounded-lg text-[11px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          Auto
        </TabsTrigger>
        <TabsTrigger
          value="master"
          className="rounded-lg text-[11px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          Master
        </TabsTrigger>
        <TabsTrigger
          value="sampler"
          className="rounded-lg text-[11px] font-semibold uppercase tracking-wider data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          Sampler
        </TabsTrigger>
      </TabsList>

      <TabsContent value="auto" className="space-y-3">
        <PartyPanel />
        <AutoDjPanel />
      </TabsContent>

      <TabsContent value="master" className="space-y-3">
        <MasterPanel
          getMasterMeter={dj.getMasterMeter}
          getLimiterReduction={dj.getLimiterReduction}
          limiterOn={dj.limiterOn}
          onLimiterToggle={dj.setLimiter}
          neutral={dj.neutral}
          onNeutral={dj.setNeutral}
          abBypass={dj.abBypass}
          onAbToggle={dj.setAbBypass}
          onPanic={() => guard.guardAll(dj.panicStop)}
        />
        <MasterEnhancer />
        <ConcertPanel />
      </TabsContent>

      <TabsContent value="sampler" className="space-y-3">
        {dj.advanced ? (
          <Sampler />
        ) : (
          <p className="rounded-xl border border-dashed border-border/70 bg-card/40 p-5 text-xs leading-relaxed text-muted-foreground">
            Samplerul e disponibil în modul avansat. Comută pe „Avansat" sus, în dreapta.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}