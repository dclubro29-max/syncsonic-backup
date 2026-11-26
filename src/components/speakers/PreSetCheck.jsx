import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import PreSetRow from "@/components/speakers/PreSetRow";
import { useDj } from "@/lib/djContext";
import { PlayCircle, ShieldCheck } from "lucide-react";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";

const labelOf = (speakers, id) =>
  speakers.find((s) => s.deviceId === id)?.label || "Boxă fără nume";

/**
 * Verificarea de dinaintea setului: spune, într-o privire, ce e gata și ce lipsește
 * pentru toate boxele selectate. Nu schimbă nimic — doar citește starea motorului.
 */
export default function PreSetCheck() {
  const dj = useDj();
  const [testing, setTesting] = useState(false);

  const active = dj.outputs || [];
  const selected = dj.selectedSpeakers || [];
  const missing = selected.filter((id) => !active.some((o) => o.deviceId === id));
  const delayed = active.filter((o) => (o.delay || 0) > 0).length;
  const auto = dj.autoDj;

  // Test pe rând: un sunet scurt în fiecare boxă, ca să poți merge prin sală.
  const testEach = async () => {
    if (testing || !active.length) return;
    setTesting(true);
    try {
      for (const output of active) {
        await dj.playTestTone(output.deviceId, 320);
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={ShieldCheck}
        title="Verificare înainte de set"
        hint={`${active.length} din ${selected.length} boxe pornite${
          delayed > 0 ? ` · ${delayed} cu întârziere setată` : " · fără întârziere setată"
        }`}
        action={<StatusPill tone={active.length && !missing.length ? "live" : "warn"} dot>{active.length && !missing.length ? "pregătit" : "de verificat"}</StatusPill>}
      />
      <div className="mt-4 space-y-2">
        <PreSetRow
          status={active.length && !missing.length ? "ok" : "warn"}
          title={
            !selected.length
              ? "Nicio boxă selectată"
              : missing.length
                ? `${missing.length} ${missing.length === 1 ? "boxă nu a pornit" : "boxe nu au pornit"}`
                : `Toate cele ${active.length} boxe selectate sunt active`
          }
          detail={
            missing.length
              ? `Vezi: ${missing.map((id) => labelOf(dj.speakers, id)).join(", ")}. Reselectează ieșirea sau verifică legătura.`
              : active.length
                ? "Fiecare boxă are volum, bandă de frecvențe și întârziere separate."
                : "Alege boxele mai sus ca sunetul să iasă pe ele."
          }
        />

        <PreSetRow
          status={delayed > 0 || active.length < 2 ? "ok" : "info"}
          title={
            active.length < 2
              ? "Întârzierea contează de la 2 boxe în sus"
              : delayed > 0
                ? `${delayed} din ${active.length} boxe au întârziere setată`
                : "Nicio boxă nu are întârziere setată"
          }
          detail="Dacă auzi ecou între boxe, întârzie puțin boxa care cântă prima (Calibrare boxe, mai jos)."
        />

        <PreSetRow
          status={dj.limiterOn ? "ok" : "warn"}
          title={dj.limiterOn ? "Protecția la clipping e pornită" : "Protecția la clipping e oprită"}
          detail="Limiterul prinde doar vârfurile; cu el oprit, un bass puternic poate distorsiona pe boxele mici."
        />

        <PreSetRow
          status={(dj.masterVolume || 0) > 0.02 ? "ok" : "warn"}
          title={`Volum master ${Math.round((dj.masterVolume || 0) * 100)}%${dj.volumeLock ? " · blocat" : ""}`}
          detail={
            (dj.masterVolume || 0) > 0.02
              ? "Volumul master se aplică peste volumul fiecărei boxe."
              : "Volumul master e aproape de zero sau oprit de la „Oprește tot sunetul”."
          }
        />

        <PreSetRow
          status="info"
          title={
            auto.on
              ? `Auto DJ pornit${auto.config?.performanceMode === "max" ? " · DJ MAX" : ""}`
              : "Auto DJ oprit — poți porni manual pe deckuri"
          }
          detail={
            auto.on
              ? `Tranziții de ${Math.round(auto.config?.crossfade || 0)}s · ${auto.config?.beatmatch ? "potrivește tempo-ul" : "fără beatmatch"}. Oprește Auto DJ înainte de calibrare.`
              : "Verifică boxele în liniște, apoi pornește muzica."
          }
        />

        {selected.length >= 3 && (
          <div className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-[11px] leading-relaxed text-warning">
            Cu {selected.length} boxe simultan, majoritatea telefoanelor și laptopurilor țin doar
            1–2 boxe Bluetooth active deodată. Ține boxele pe cablu pe ieșiri separate și lasă
            Bluetooth-ul pe o singură ieșire — fiecare boxă selectată aici are propriul volum și
            propria întârziere.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            variant="secondary"
            className="gap-2"
            onClick={testEach}
            disabled={testing || !active.length}
          >
            <PlayCircle className="h-4 w-4" />
            {testing ? "Testez pe rând…" : "Test pe rând, în fiecare boxă"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Un sunet scurt în fiecare, pe rând, ca să auzi dacă toate cântă.
          </span>
        </div>
      </div>
    </Surface>
  );
}