import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { formatSize, getStorageUsage } from "@/lib/trackStore";
import { User, LogOut, HardDrive, Cloud, Info, Settings2 } from "lucide-react";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";
import AccountPremiumCard from "@/components/premium/AccountPremiumCard";

export default function Account() {
  const dj = useDj();
  // Sesiunea vine din AuthProvider; pagina nu mai repetă cererea /auth/me.
  const { user, isLoadingAuth, logout } = useAuth();
  const checking = isLoadingAuth;
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    getStorageUsage().then(setUsage);
  }, []);

  const localSize = dj.tracks.reduce((s, t) => s + (t.size || 0), 0);
  const usedRatio = usage?.quota ? Math.min(100, (usage.usage / usage.quota) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Profil"
        title="Cont"
        icon={User}
        description="Profil, spațiu folosit și preferințe. Poți folosi aplicația și fără cont."
        actions={
          <StatusPill tone={user ? "live" : "neutral"} dot>
            {checking ? "se verifică…" : user ? "conectat" : "mod local"}
          </StatusPill>
        }
      />

      <Surface className="p-6">
        <SurfaceHead icon={User} title="Profil" />
        <div className="mt-4">
          {checking ? (
            <p className="text-sm text-muted-foreground">Se verifică sesiunea…</p>
          ) : user ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-heading text-sm font-semibold text-primary">
                  {(user.full_name || user.email || "?").slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium">{user.full_name || user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <Button variant="outline" className="gap-2 border-border/80" onClick={() => void logout("/")}>
                <LogOut className="h-4 w-4" />
                Deconectare
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nu ești conectat. Bibliotecă și mixurile funcționează local, pe acest device.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/login">Conectare</Link>
                </Button>
                <Button asChild variant="outline" className="border-border/80">
                  <Link to="/register">Creează cont</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/forgot-password">Am uitat parola</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Surface>

      <AccountPremiumCard />

      <Surface className="p-6">
        <SurfaceHead icon={HardDrive} title="Spațiu folosit" />
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Piese în bibliotecă</span>
            <span className="num font-medium">{formatSize(localSize)}</span>
          </div>
          {usage && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stocare browser folosită</span>
                <span className="num font-medium">
                  {formatSize(usage.usage)} / {formatSize(usage.quota)}
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Spațiu de stocare folosit"
                aria-valuenow={Math.round(usedRatio)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full ${usedRatio > 85 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${usedRatio}%` }}
                />
              </div>
            </>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Limita este cea impusă de browser pentru acest site. Când spațiul se apropie de maxim,
            șterge piesele sau înregistrările pe care nu le mai folosești.
          </p>
        </div>
      </Surface>

      <Surface className="p-6">
        <SurfaceHead icon={Cloud} title="Stocare în cont" />
        <div className="mt-4 flex items-start gap-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="space-y-2">
            <p>
              Momentan fișierele rămân <strong className="font-medium text-foreground">doar local</strong>.
              Nu afișăm „salvat în cont" pentru ceva ce există doar pe acest device.
            </p>
            <p>
              Pentru bibliotecă și mixuri disponibile pe orice dispozitiv, e nevoie de configurarea
              unei soluții de stocare cloud (serviciu extern, cu costuri proprii). Spune-mi dacă
              vrei să o pregătim.
            </p>
          </div>
        </div>
      </Surface>

      <Surface className="p-6">
        <SurfaceHead icon={Settings2} title="Preferințe active" />
        <dl className="mt-4 divide-y divide-border/50 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted-foreground">Limiter de protecție</dt>
            <dd>
              <StatusPill tone={dj.limiterOn ? "live" : "neutral"}>
                {dj.limiterOn ? "Pornit" : "Oprit"}
              </StatusPill>
            </dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted-foreground">Ieșiri selectate</dt>
            <dd className="num font-medium">{dj.outputCount}</dd>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <dt className="text-muted-foreground">Sunet original (bypass)</dt>
            <dd>
              <StatusPill tone={dj.neutral ? "ready" : "neutral"}>
                {dj.neutral ? "Activ" : "Inactiv"}
              </StatusPill>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">Le poți schimba oricând din pagina Mixer.</p>
      </Surface>
    </div>
  );
}
