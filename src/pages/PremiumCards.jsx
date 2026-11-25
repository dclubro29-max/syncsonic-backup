import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import QrImage from "@/components/premium/QrImage";
import { ArrowLeft, Loader2, Printer, ShieldAlert } from "lucide-react";

export default function PremiumCards() {
  const { batchId } = useParams();
  const { user, isLoadingAuth } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoadingAuth) return;
    if (user?.role !== "admin") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    base44.functions
      .invoke("premiumAdmin", { action: "batchCodes", batch_id: batchId })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch((failure) => {
        if (!cancelled) setError(failure?.response?.data?.error || "Lotul nu a putut fi încărcat.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, isLoadingAuth, user?.role]);

  if (isLoadingAuth || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="panel max-w-md p-8 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-warning" />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Acces restricționat</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cardurile sunt disponibile doar administratorului.</p>
          <Button asChild className="mt-5"><Link to="/">Înapoi la muzică</Link></Button>
        </div>
      </div>
    );
  }

  const batch = data?.batch;
  const codes = data?.codes || [];
  const lifetime = !!batch?.lifetime;

  return (
    <div className="min-h-screen bg-background px-4 py-6 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/admin/campaigns"><ArrowLeft className="h-4 w-4" /> Campanii și coduri</Link>
        </Button>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {batch?.name} · {codes.length} carduri
          </p>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Tipărește / salvează PDF
          </Button>
        </div>
      </div>

      {error ? <p className="no-print mx-auto max-w-5xl text-sm text-destructive">{error}</p> : null}

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
        {codes.map((item) => (
          <article key={item.id} className="premium-card p-4 print:p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#7c6a9a]">
                  SyncSonic Box Demo – România
                </p>
                <h2 className="mt-1 text-[15px] font-semibold leading-tight text-[#171320]">
                  Activează SyncSonic Premium
                </h2>
              </div>
              <span className="rounded-full bg-[#f1eafe] px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.14em] text-[#5b21b6]">
                {lifetime ? "pe viață" : item.status === "available" ? "cod demo" : item.status}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <QrImage code={item.code} size={240} className="h-20 w-20 shrink-0 rounded-lg bg-white" />
              <div className="min-w-0">
                <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-[#7c6a9a]">Codul tău</p>
                <p className="premium-card-code mt-1 text-[26px] font-semibold leading-none">{item.code}</p>
                <p className="mt-2 text-[9px] leading-snug text-[#5d556d]">
                  {lifetime
                    ? "Acces Premium pe viață, fără expirare. Un cod temporar ulterior nu îl retrage."
                    : "3 luni la primul cod. Încă o lună la fiecare cod suplimentar activat pe același cont."}
                </p>
              </div>
            </div>

            <p className="mt-3 border-t border-[#e8e1f2] pt-2 text-[9px] leading-snug text-[#4d465c]">
              Scanează QR-ul sau introdu codul în Cont.
            </p>
            <p className="mt-1 text-[8px] text-[#8a8198]">
              {item.country} · {item.product} · {item.store || "pilot propus"}
            </p>
          </article>
        ))}
      </div>

      {codes.length === 0 && !error ? (
        <p className="mx-auto max-w-5xl text-sm text-muted-foreground">Lotul nu are coduri.</p>
      ) : null}
    </div>
  );
}