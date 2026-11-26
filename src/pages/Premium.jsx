import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPremiumStatus } from "@/lib/premiumStatus";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";
import { CalendarDays, CheckCircle2, CreditCard, Gift, Sparkles, Ticket } from "lucide-react";

const RULES = [
  {
    icon: Gift,
    title: "Primul cod: 3 luni",
    text: "Primul cod eligibil activat pe un cont oferă trei luni calendaristice Premium.",
  },
  {
    icon: Sparkles,
    title: "Fiecare cod următor: +1 lună",
    text: "Codurile suplimentare din aceeași campanie adaugă câte o lună pe același cont.",
  },
  {
    icon: CreditCard,
    title: "Fără card, fără abonament",
    text: "Activarea unui cod nu cere card și nu pornește o plată recurentă.",
  },
];

export default function Premium() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPremiumStatus()
      .then((status) => {
        if (!cancelled) setData(status);
      })
      .catch(() => {
        if (!cancelled) setError("Starea Premium nu a putut fi citită acum.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const campaign = data?.campaign;
  const entitlement = data?.entitlement;
  const active = !!data?.active;
  const lifetime = !!entitlement?.lifetime;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Premium"
        title="Muzică fără întreruperi"
        icon={Ticket}
        description="Campania demo SyncSonic Box: activezi un cod și vezi exact până când ai acces."
        actions={
          <StatusPill tone={active ? "live" : "neutral"} dot>
            {lifetime ? "Premium pe viață" : active ? `activ până la ${entitlement?.expires_on_display}` : "neactiv"}
          </StatusPill>
        }
      />

      <Surface className="overflow-hidden p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <p className="caps">Campanie demonstrativă</p>
            <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.03em]">
              {campaign?.name || "SyncSonic Box Demo – România"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Variantă de test, fără logo IKEA și fără încasări reale. Structura este pregătită
              pentru un eventual pilot de {campaign?.pilot_quota || 2500} de coduri.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 px-5 py-4">
            <p className="caps">Preț propus</p>
            <p className="mt-1 font-heading text-3xl font-semibold tracking-[-0.04em]">
              29,99 <span className="text-base font-medium text-muted-foreground">lei/lună</span>
            </p>
            <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-muted-foreground">
              Doar pentru viitorul abonament. Activarea codului nu percepe nimic.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild className="h-12 gap-2 px-5">
            <Link to="/activate"><Ticket className="h-4 w-4" /> Activează un cod</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 gap-2 border-border/80">
            <Link to="/account">Vezi contul</Link>
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </Surface>

      <div className="grid gap-3 sm:grid-cols-3">
        {RULES.map(({ icon: Icon, title, text }) => (
          <Surface key={title} tone="quiet" className="p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface-raised text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="mt-3 font-heading text-sm font-semibold">{title}</h3>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{text}</p>
          </Surface>
        ))}
      </div>

      <Surface className="p-6">
        <SurfaceHead
          icon={CalendarDays}
          title="Cum se calculează expirarea"
          hint="Lunile sunt calendaristice, nu blocuri fixe de 30 de zile."
        />
        <div className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Dacă Premium este încă activ, perioada nouă pornește după data expirării. Dacă a expirat,
            pornește de la data activării.
          </p>
          <p>
            Când luna țintă are mai puține zile, folosim ultima zi a lunii: 31 ianuarie + 1 lună devine
            28 februarie într-un an obișnuit și 29 februarie într-un an bisect.
          </p>
          <p className="flex items-start gap-2 text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {lifetime
              ? "Premium este activ pe viață. Un cod temporar ulterior nu îl transformă într-un acces cu termen."
              : active
                ? `Premium este activ până la ${entitlement?.expires_on_display}. Poți activa oricând un cod suplimentar.`
                : "Premium nu este activ. Demo-urile și biblioteca rămân disponibile și fără Premium."}
          </p>
        </div>
      </Surface>
    </div>
  );
}