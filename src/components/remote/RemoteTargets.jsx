import React from "react";
import StatusPill from "@/components/ui-kit/StatusPill";
import { Laptop, Smartphone } from "lucide-react";

function presence(device) {
  const age = Date.now() - (Number(device?.updated_at) || 0);
  if (age < 60000) return { label: "Conectat", tone: "live" };
  if (age < 180000) return { label: "Reconectare", tone: "warn" };
  return { label: "Offline", tone: "danger" };
}

/** Dispozitivele care pot fi comandate de pe telefon. */
export default function RemoteTargets({ devices, myId, selectedId, onSelect, large }) {
  const others = devices.filter((device) => device.device_id !== myId);

  return (
    <section className={`panel ${large ? "p-5" : "p-4 sm:p-5"}`}>
      <p className="caps">Gazda</p>
      {others.length === 0 ? (
        <p className={`mt-2 leading-relaxed text-muted-foreground ${large ? "text-sm" : "text-[12px]"}`}>
          Deschide aplicația pe laptop, cu același cont, ca să apară aici.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {others.map((device) => {
            const status = presence(device);
            const active = device.device_id === selectedId;
            const Icon = /iPhone|Android|Mac/.test(device.label || "") ? Smartphone : Laptop;
            return (
              <button
                key={device.device_id}
                type="button"
                onClick={() => onSelect(device.device_id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3.5 text-left transition-colors ${
                  large ? "py-4" : "py-3"
                } ${
                  active ? "border-primary/60 bg-primary/10" : "border-border/70 hover:bg-accent/60"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate font-medium ${large ? "text-base" : "text-sm"}`}>
                    {device.label || device.device_id}
                  </span>
                  <span className="num block text-[11px] text-muted-foreground">
                    {device.track_count || 0} piese
                  </span>
                </span>
                <StatusPill tone={status.tone} dot>{status.label}</StatusPill>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}