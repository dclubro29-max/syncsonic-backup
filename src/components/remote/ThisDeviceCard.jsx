import React from "react";
import { Monitor, Radio } from "lucide-react";

/** Dispozitivul curent: cel care poate primi și reda comenzile. */
export default function ThisDeviceCard({ device, label }) {
  const online = device && Date.now() - (device.updated_at || 0) < 60000;

  return (
    <section className="panel p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface-raised">
          <Monitor className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="caps">Acest dispozitiv</p>
          <p className="truncate font-heading text-sm font-semibold">{label}</p>
        </div>
        <span className={`chip ${online ? "border-success/40 text-success" : "border-border/70"}`}>
          <Radio className="h-3 w-3" aria-hidden="true" />
          {online ? "conectat" : "inactiv"}
        </span>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        {device?.track_count
          ? `${device.track_count} piese publicate pentru telecomandă. Ține aplicația deschisă aici ca să pornească muzica.`
          : "Adaugă piese în bibliotecă, apoi ține aplicația deschisă aici ca să primească telecomenzile."}
      </p>
    </section>
  );
}