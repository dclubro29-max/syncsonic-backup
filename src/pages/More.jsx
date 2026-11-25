import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface } from "@/components/ui-kit/Surface";
import {
  Cast,
  Clapperboard,
  Compass,
  Disc3,
  GraduationCap,
  LayoutGrid,
  Palette,
  PartyPopper,
  ShieldCheck,
  Smartphone,
  Ticket,
  Tv,
  User,
} from "lucide-react";

const ITEMS = [
  { to: "/premium", label: "Premium", icon: Ticket, hint: "Activează un cod și vezi până când ai acces." },
  { to: "/remote", label: "Telecomandă", icon: Smartphone, hint: "Telefonul controlează laptopul, acum sau programat." },
  { to: "/party", label: "Party TV", icon: Tv, hint: "Ecran mare pentru petrecere, fără oprirea mixului." },
  { to: "/appearance", label: "Aspect", icon: Palette, hint: "Studio, Daylight, Club sau Pulse." },
  { to: "/mixes", label: "Mixurile mele", icon: Disc3, hint: "Înregistrările salvate pe acest dispozitiv." },
  { to: "/account", label: "Cont", icon: User, hint: "Profil, spațiu folosit și preferințe." },
  { to: "/start", label: "Pregătește petrecerea", icon: PartyPopper, hint: "Playlist, boxe și mod de mixare, în pași scurți." },
  { to: "/discover", label: "Descoperă", icon: Compass, hint: "Idei, demo-uri și piese pentru început." },
  { to: "/learn", label: "Învață", icon: GraduationCap, hint: "Ghidul pas cu pas pentru primul mix." },
  { to: "/movie", label: "Mod film", icon: Clapperboard, hint: "Redare pentru film, prin același motor audio." },
  { to: "/tv", label: "Televizor (HDMI)", icon: Cast, hint: "Ieșire pe televizor prin HDMI." },
];

export default function More() {
  const { user } = useAuth();
  const items = user?.role === "admin"
    ? [
        ...ITEMS,
        { to: "/admin/campaigns", label: "Campanii și coduri", icon: ShieldCheck, hint: "Loturi de test, cote și carduri pentru pilot." },
      ]
    : ITEMS;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Navigare"
        title="Mai multe"
        icon={LayoutGrid}
        description="Restul uneltelor, într-un singur loc. Redarea continuă când intri și ieși."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ to, label, icon: Icon, hint }) => (
          <Link
            key={to}
            to={to}
            className="panel group flex items-start gap-3 p-4 transition-colors hover:border-foreground/20"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-raised text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-sm font-semibold">{label}</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
      <Surface tone="quiet" className="p-5 text-[11px] leading-relaxed text-muted-foreground">
        Pe telefon, bara de jos are doar Redare, Bibliotecă și Mixer. Avatarul din dreapta sus deschide Cont, Activează un cod și Aspect; restul uneltelor rămân aici.
      </Surface>
    </div>
  );
}