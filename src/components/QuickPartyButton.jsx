import React from "react";
import { useDj } from "@/lib/djContext";
import { usePartyCheck } from "@/hooks/usePartyCheck";
import PartyCheckDialog from "@/components/PartyCheckDialog";
import { Button } from "@/components/ui/button";
import { Volume2, Square } from "lucide-react";
import { PARTY_MAX_CONFIG } from '@/lib/djMaxConfig';

/**
 * „Concert tăcut": pornește petrecerea cu un singur click.
 * Înainte de pornire rulează testul, apoi Auto DJ preia mixarea singur, iar
 * volumul master rămâne blocat la nivelul ales.
 */
export default function QuickPartyButton() {
  const dj = useDj();
  const check = usePartyCheck();
  const running = dj.autoDj.on && dj.autoDj.config.partyMax && dj.autoDj.config.performance;

  const toggle = () => {
    if (running) {
      dj.autoDj.setOn(false);
      return;
    }
    check.run(() => {
      if (dj.volumeLock === null) dj.toggleVolumeLock();
      dj.autoDj.startMax(PARTY_MAX_CONFIG);
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant={running ? "default" : "outline"}
        className="gap-1.5"
        onClick={toggle}
        disabled={dj.emergencyPlayback}
        title={
          running
            ? "Oprește petrecerea automată"
            : "Pornește Party MAX: mixare automată, filtru, ecou, reverb și build → drop, fără schimbarea volumului master"
        }
      >
        {running ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        {running ? "Oprește Party MAX" : "Party MAX"}
      </Button>

      <PartyCheckDialog
        open={check.open}
        checks={check.checks}
        onConfirm={check.confirm}
        onCancel={check.cancel}
        onTestSound={check.testSound}
      />
    </>
  );
}