import React from "react";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Speaker, MonitorSpeaker, Mic, Volume2, PhoneCall } from "lucide-react";
import { isCommunicationsOutput, SYSTEM_DEFAULT_OUTPUT } from "@/lib/outputs";

/** Pașii „Ieșiri audio" și „Test sunet" din pregătirea petrecerii. */
export default function StartOutputsStep({ variant = "select" }) {
  const dj = useDj();
  const selectable = dj.speakers.filter((s) => !s.systemDefault);
  const selected = dj.speakers.filter((s) => dj.selectedSpeakers.includes(s.deviceId));
  const allSelected =
    selectable.length > 0 && selectable.every((s) => dj.selectedSpeakers.includes(s.deviceId));

  if (variant === "test") {
    const targets = selected.length ? selected : [SYSTEM_DEFAULT_OUTPUT];
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {targets.map((sp) => (
            <div
              key={sp.deviceId}
              className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-4 py-3"
            >
              <span className="min-w-0 flex-1 break-words text-sm">{sp.label}</span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-2"
                onClick={() => dj.playTestTone(sp.systemDefault ? undefined : sp.deviceId)}
              >
                <Volume2 className="h-3.5 w-3.5" />
                Testează
              </Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Un beep scurt confirmă că sunetul ajunge în boxă.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-2" onClick={dj.refreshSpeakers}>
          <RefreshCw className={`h-3.5 w-3.5 ${dj.loadingDevices ? "animate-spin" : ""}`} />
          Actualizează lista
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-2"
          disabled={!selectable.length}
          onClick={() =>
            dj.setAllSpeakers(
              allSelected
                ? []
                : selectable
                    .filter((s) => !isCommunicationsOutput(s.label))
                    .map((s) => s.deviceId)
            )
          }
        >
          <Speaker className="h-3.5 w-3.5" />
          {allSelected ? "Deselectează tot" : "Toate boxele"}
        </Button>
        <Button size="sm" variant="ghost" className="gap-2" onClick={dj.requestLabels}>
          <Mic className="h-3.5 w-3.5" />
          Afișează numele boxelor
        </Button>
      </div>

      <div className="space-y-2">
        {dj.speakers.map((sp) => {
          const on = dj.selectedSpeakers.includes(sp.deviceId);
          const comms = isCommunicationsOutput(sp.label);
          const Icon = sp.systemDefault ? MonitorSpeaker : Speaker;
          return (
            <div
              key={sp.deviceId}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                on ? "border-primary/40 bg-primary/5" : "border-border bg-background/40"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm leading-snug">{sp.label}</p>
                {comms && (
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-400">
                    <PhoneCall className="h-3 w-3" />
                    Posibil pentru apeluri — sunet înfundat
                  </p>
                )}
              </div>
              <Switch
                className="shrink-0"
                checked={on}
                onCheckedChange={() => dj.toggleSpeaker(sp.deviceId)}
              />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Numele boxelor apar doar dacă permiți o dată microfonul. Fără nicio selecție, sunetul merge
        pe ieșirea implicită.
      </p>
    </div>
  );
}