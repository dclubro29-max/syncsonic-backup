import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import SpeakerOutputRow from "@/components/speakers/SpeakerOutputRow";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";
import {
  RefreshCw,
  Bluetooth,
  AlertTriangle,
  PhoneCall,
  Info,
  Speaker,
} from "lucide-react";
import {
  COMMS_NOTE,
  SYSTEM_DEFAULT_OUTPUT,
  deviceGroupKey,
  isCommunicationsOutput,
} from "@/lib/outputs";

export default function SpeakerPicker({
  speakers,
  selected,
  onToggle,
  onSelectAll,
  onRefresh,
  onRequestLabels,
  loading,
  supported,
}) {
  const outputs = useMemo(() => speakers.filter((s) => !s.systemDefault), [speakers]);
  const systemDefault = speakers.find((s) => s.systemDefault) || SYSTEM_DEFAULT_OUTPUT;

  // Browserul ascunde numele dispozitivelor până primește accesul cel puțin o dată.
  const needsPermission =
    outputs.length === 0 || outputs.some((s) => !s.label || s.label === "Boxă Bluetooth" || s.label.includes("nume ascuns"));
  const commsPresent = outputs.some((s) => isCommunicationsOutput(s.label));

  // „Toate boxele" selectează doar ieșirile de redare, niciodată cele de apeluri.
  const selectableIds = useMemo(
    () => outputs.filter((s) => !isCommunicationsOutput(s.label)).map((s) => s.deviceId),
    [outputs]
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  const groups = useMemo(() => {
    const map = new Map();
    outputs.forEach((sp) => {
      const key = deviceGroupKey(sp.label) || sp.deviceId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(sp);
    });
    return Array.from(map.values());
  }, [outputs]);

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={Bluetooth}
        title="Boxe conectate"
        hint={`${outputs.length} ieșiri detectate · volum separat 0–100%, păstrat local`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={allSelected ? "secondary" : "outline"}
              size="sm"
              className="border-border/80"
              onClick={() => onSelectAll(allSelected ? [] : selectableIds)}
              disabled={!selectableIds.length}
              title="Selectează ieșirile de redare, fără cele pentru apeluri"
            >
              {allSelected ? "Deselectează toate" : "Toate boxele"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={loading}
              aria-label="Reîmprospătează lista de boxe"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="mt-4 space-y-4">
        {!supported && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Browserul tău nu suportă rutarea separată pe boxe (setSinkId). Folosește Chrome sau
              Edge (desktop/Android) pentru funcția multi-boxă.
            </span>
          </div>
        )}

        {needsPermission && (
          <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 px-4 py-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {outputs.length === 0
                ? "Browserul nu arată încă nicio boxă. Conectează boxele în setările Bluetooth ale telefonului sau laptopului, apoi apasă „Arată numele boxelor”."
                : "Numele boxelor apar doar după ce permiți accesul."}{" "}
              Permisiunea deschide o singură dată microfonul, exclusiv pentru a citi lista de
              dispozitive, și îl închide imediat după.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="border-border/80" onClick={onRequestLabels} disabled={loading}>
                Arată numele boxelor
              </Button>
              <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
                Reîmprospătează lista
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dacă lista rămâne goală, deschide aplicația direct în Chrome sau Edge, nu într-un cadru
              încorporat.
            </p>
          </div>
        )}

        {commsPresent && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-xs leading-relaxed text-warning">
            <PhoneCall className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{COMMS_NOTE}</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="caps">Punct de comparație</p>
            <StatusPill tone="neutral">{outputs.length} detectate</StatusPill>
          </div>
          <SpeakerOutputRow
            sp={systemDefault}
            isOn={selected.includes(systemDefault.deviceId)}
            onToggle={onToggle}
          />
        </div>

        {groups.map((group, gi) => (
          <div key={gi} className="space-y-2">
            {group.length > 1 && (
              <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Sistemul expune {group.length} ieșiri pentru același dispozitiv. Pentru redare alege
                varianta fără „Comunicații”, „Hands-Free” sau „Headset”.
              </p>
            )}
            {group.map((sp) => (
              <SpeakerOutputRow
                key={sp.deviceId}
                sp={sp}
                isOn={selected.includes(sp.deviceId)}
                onToggle={onToggle}
              />
            ))}
          </div>
        ))}

        {outputs.length === 0 && !needsPermission && (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 px-4 py-6 text-xs text-muted-foreground">
            <Speaker className="h-4 w-4" />
            Nicio boxă detectată momentan.
          </p>
        )}
      </div>
    </Surface>
  );
}