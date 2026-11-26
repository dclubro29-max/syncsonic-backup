import React from "react";
import { Clock, Play } from "lucide-react";
import { clockText } from "@/lib/remoteControl";

const STATUS = {
  scheduled: { label: "Programat", cls: "border-warning/40 text-warning" },
  pending: { label: "Se pregătește", cls: "border-info/40 text-info" },
  preparing: { label: "Se pregătește", cls: "border-info/40 text-info" },
  mixing: { label: "În mix", cls: "border-primary/40 text-primary" },
  done: { label: "Redare", cls: "border-success/40 text-success" },
  skipped: { label: "Neexecutat", cls: "border-warning/40 text-warning" },
  failed: { label: "Nu a pornit", cls: "border-destructive/40 text-destructive" },
};

/** Ultimele comenzi trimise, cu starea lor. */
export default function RecentCommands({ commands }) {
  return (
    <section className="panel p-4 sm:p-5">
      <p className="caps">Comenzi trimise</p>
      {commands.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">Nicio comandă încă.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {commands.map((command) => {
            const status = STATUS[command.status] || STATUS.scheduled;
            return (
              <li key={command.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3.5 py-2.5">
                <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{command.track_name || "Piesă"}</span>
                  <span className="num flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                    {clockText(command.play_at)}
                  </span>
                  {command.error_message && <span className="mt-1 block text-xs text-destructive">{command.error_message}</span>}
                </span>
                <span className={`chip ${status.cls}`}>{status.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}