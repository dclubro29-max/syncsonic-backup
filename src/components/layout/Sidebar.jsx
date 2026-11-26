import React from "react";
import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "@/lib/nav";
import { useDj } from "@/lib/djContext";
import { Waves, Radio } from "lucide-react";

const GROUPS = [
  { label: "Principal", paths: ["/", "/library", "/mixer"] },
  { label: "Sunet", paths: ["/speakers"] },
  { label: "Cont", paths: ["/account", "/premium"] },
  { label: "Altele", paths: ["/more"] },
];

export default function Sidebar() {
  const dj = useDj();
  const autoOn = !!dj.autoDj?.on;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:flex">
      <div className="flex items-center gap-3 px-5 pb-6 pt-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-deck-b text-primary-foreground shadow-[0_10px_28px_-14px_hsl(var(--primary)/0.9)]">
          <Waves className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-[15px] font-semibold leading-tight tracking-tight">SyncSonic</p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            DJ sincronizat
          </p>
        </div>
      </div>

      <nav aria-label="Navigare principală" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {GROUPS.map((group) => {
          const items = group.paths
            .map((path) => NAV_ITEMS.find((item) => item.to === path))
            .filter(Boolean);
          return (
            <div key={group.label}>
              <p className="px-3 pb-2 font-heading text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 ${
                        isActive
                          ? "bg-primary/12 text-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`absolute left-0 h-5 w-0.5 rounded-full transition-opacity ${
                            isActive ? "bg-primary opacity-100" : "opacity-0"
                          }`}
                          aria-hidden="true"
                        />
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                            isActive
                              ? "border-primary/30 bg-primary/15 text-primary"
                              : "border-transparent bg-surface-raised/60 text-muted-foreground group-hover:text-foreground"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="rounded-xl border border-border/60 bg-surface-raised/50 p-3">
          <p className="flex items-center gap-1.5 font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <Radio className="h-3 w-3 text-primary" aria-hidden="true" />
            {autoOn ? "Auto DJ activ" : "Sunet local"}
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            {dj.outputCount > 0
              ? `${dj.outputCount} ${dj.outputCount === 1 ? "ieșire activă" : "ieșiri active"} · procesare în browser.`
              : "Procesare locală. Alege boxele din pagina Boxe și sunet."}
          </p>
        </div>
      </div>
    </aside>
  );
}