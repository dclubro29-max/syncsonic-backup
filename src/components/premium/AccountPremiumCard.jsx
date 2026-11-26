import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPremiumStatus } from "@/lib/premiumStatus";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";
import { CalendarCheck, Loader2, Ticket } from "lucide-react";

export default function AccountPremiumCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPremiumStatus()
      .then((status) => {
        if (!cancelled) setData(status);
      })
      .catch(() => {
        if (!cancelled) setError("Starea Premium nu a putut fi citită.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entitlement = data?.entitlement;
  const active = !!data?.active;
  const lifetime = !!entitlement?.lifetime;
  const history = data?.history || [];

  return (
    <Surface className="p-6">
      <SurfaceHead
        icon={CalendarCheck}
        title="Premium"
        hint="Accesul promoțional este separat de viitoarea integrare de plăți."
        action={
          loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <StatusPill tone={active ? "live" : "neutral"} dot>
              {active ? "activ" : "neactiv"}
            </StatusPill>
          )
        }
      />

      <div className="mt-4 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Se verifică Premium…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-3">
              <p className="caps">{lifetime ? "Premium pe viață" : active ? "Premium activ până la" : "Premium"}</p>
              <p className="mt-1 font-heading text-xl font-semibold tracking-[-0.02em]">
                {lifetime ? "Fără expirare" : active ? entitlement?.expires_on_display : "Nu este activ"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {lifetime
                  ? "Acces permanent. Un cod temporar ulterior nu îl transformă într-un acces cu termen."
                  : active
                    ? `${entitlement?.activation_count || 0} ${entitlement?.activation_count === 1 ? "activare" : "activări"} în campanie. Poți adăuga încă o lună cu un cod nou.`
                    : "Demo-urile și biblioteca rămân disponibile. Activează un cod pentru a începe perioada Premium."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="gap-2">
                <Link to="/activate"><Ticket className="h-4 w-4" /> Activează un cod</Link>
              </Button>
              <Button asChild variant="outline" className="border-border/80">
                <Link to="/premium">Detalii Premium</Link>
              </Button>
            </div>

            <div>
              <p className="caps">Istoric beneficii</p>
              {history.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Nicio activare încă.</p>
              ) : (
                <div className="mt-2 divide-y divide-border/50">
                  {history.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {item.first_in_campaign ? "Primul cod" : "Cod suplimentar"} · {item.months_label}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {item.code_masked} · {new Date(item.created_date).toLocaleDateString("ro-RO")}
                        </p>
                      </div>
                      <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                        până la<br />
                        <span className="font-medium text-foreground">{item.expires_on_display}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Surface>
  );
}