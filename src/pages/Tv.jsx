import React from "react";
import { Cast } from "lucide-react";
import PageHeader from "@/components/ui-kit/PageHeader";
import StatusPill from "@/components/ui-kit/StatusPill";
import TvOutputCard from "@/components/tv/TvOutputCard";
import TvScreenCard from "@/components/tv/TvScreenCard";
import { isHdmiOutput } from "@/lib/outputs";
import { useDj } from "@/lib/djContext";

export default function Tv() {
  const dj = useDj();
  const detected = dj.speakers.filter((s) => !s.systemDefault && isHdmiOutput(s.label));
  const activeIds = new Set((dj.outputs || []).map((out) => out.deviceId));
  const active = detected.filter((tv) => activeIds.has(tv.deviceId));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ecran"
        title="Televizor prin HDMI"
        icon={Cast}
        description="Mixul și vizualul pe televizor, prin cablu, cu întârzierea reglată ca să nu apară ecou."
        actions={
          <>
            <StatusPill tone={detected.length ? (active.length ? "live" : "ready") : "warn"} dot>
              {detected.length === 0
                ? "nicio ieșire HDMI"
                : active.length
                  ? `TV activ${active.length > 1 ? ` · ${active.length}` : ""}`
                  : "TV detectat, neconectat"}
            </StatusPill>
            <StatusPill tone="neutral">{active.length} în mix</StatusPill>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TvOutputCard />
        <TvScreenCard />
      </div>

      <p className="rounded-2xl border border-info/25 bg-info/[0.06] px-4 py-3 text-sm leading-relaxed text-info">
        Prin cablu, televizorul primește exact fluxul aplicației — aceeași calitate și același ritm,
        fără sincronizare separată. Ecoul apare doar când televizorul întârzie imaginea: pornește
        modul „Joc” și compensează din întârzierea ieșirii.
      </p>
    </div>
  );
}