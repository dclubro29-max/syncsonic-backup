import React from "react";
import { RefreshCw, RotateCcw, Tv as TvIcon, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import ControlSlider from "@/components/ui-kit/ControlSlider";
import StatusPill from "@/components/ui-kit/StatusPill";
import { isHdmiOutput } from "@/lib/outputs";
import { useDj } from "@/lib/djContext";

/**
 * Sunetul pe televizor, prin cablu HDMI. Televizorul e o ieșire ca oricare
 * alta: primește același mix pe același ceas audio. Doar întârzierea de
 * procesare a imaginii (modul „Joc” al televizorului) trebuie compensată.
 */
export default function TvOutputCard() {
  const dj = useDj();
  const tvs = dj.speakers.filter((s) => !s.systemDefault && isHdmiOutput(s.label));
  const active = new Map((dj.outputs || []).map((out) => [out.deviceId, out]));

  return (
    <Surface className="p-5">
      <SurfaceHead
        icon={TvIcon}
        title="Sunetul în televizor"
        hint="Alege televizorul ca ieșire și reglează întârzierea până nu mai auzi ecou."
        action={
          <Button size="sm" variant="outline" onClick={dj.refreshSpeakers} disabled={dj.loadingDevices}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reîmprospătează
          </Button>
        }
      />

      {tvs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          Nu apare încă nicio ieșire HDMI. Conectează cablul, alege în sistem „Extinde ecranul”,
          apoi reîmprospătează lista. Pe telefon, adaptorul HDMI este văzut doar dacă sistemul îl
          expune browserului.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {tvs.map((tv) => {
            const out = active.get(tv.deviceId);
            return (
              <li key={tv.deviceId} className="rounded-xl border border-border/60 bg-background/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{tv.label}</span>
                  {out ? (
                    <StatusPill tone="live" dot>Activ</StatusPill>
                  ) : (
                    <Button size="sm" onClick={() => dj.toggleSpeaker(tv.deviceId)}>
                      Trimite mixul aici
                    </Button>
                  )}
                </div>

                {out && (
                  <div className="mt-3 space-y-3">
                    <ControlSlider
                      label="Întârziere televizor"
                      value={out.delay}
                      min={0}
                      max={500}
                      step={5}
                      display={`${out.delay} ms`}
                      onChange={(value) => dj.setOutputDelay(tv.deviceId, value[0])}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => dj.playTestTone(tv.deviceId)}>
                        <Volume2 className="mr-1.5 h-3.5 w-3.5" />
                        Test sunet
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dj.setOutputDelay(tv.deviceId, 0)}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Fără întârziere
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => dj.toggleSpeaker(tv.deviceId)}>
                        Scoate
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}