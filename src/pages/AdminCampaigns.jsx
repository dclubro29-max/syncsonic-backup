import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StatusPill from "@/components/ui-kit/StatusPill";
import { useToast } from "@/components/ui/use-toast";
import { Check, Copy, CreditCard, KeyRound, Loader2, Plus, ShieldAlert, Ticket } from "lucide-react";

const initialForm = {
  name: "Lot demo 10 – test",
  quantity: 10,
  country: "RO",
  product: "SyncSonic Box",
  store: "Pilot propus",
  notes: "Primul lot de test.",
};

export default function AdminCampaigns() {
  const { user, isLoadingAuth } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState(initialForm);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("premiumAdmin", { action: "list" });
      setData(response.data);
    } catch (failure) {
      setError(failure?.response?.data?.error || failure?.message || "Campania nu a putut fi încărcată.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingAuth && user?.role === "admin") load();
    if (!isLoadingAuth && user?.role !== "admin") setLoading(false);
  }, [isLoadingAuth, user?.role]);

  const createBatch = async (event) => {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const response = await base44.functions.invoke("premiumAdmin", {
        action: "createBatch",
        ...form,
        quantity: Number(form.quantity),
      });
      setData(response.data);
      toast({
        title: "Lot creat",
        description: `${response.data.generated} coduri generate. Aceleași coduri rămân la retipărire.`,
      });
    } catch (failure) {
      setError(failure?.response?.data?.error || failure?.message || "Lotul nu a putut fi creat.");
    } finally {
      setCreating(false);
    }
  };

  if (isLoadingAuth || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-lg">
        <Surface className="p-8 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-warning" />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Acces restricționat</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Campaniile și codurile sunt disponibile doar administratorului aplicației.
          </p>
          <Button asChild className="mt-5"><Link to="/">Înapoi la muzică</Link></Button>
        </Surface>
      </div>
    );
  }

  const campaign = data?.campaign;
  const totals = data?.totals || { generated: 0, claimed: 0, available: 0, pilot_quota: 2500 };
  const batches = data?.batches || [];
  const ownerBatch = batches.find((batch) => batch.lifetime || batch.name?.includes("pe viață"));
  const ownerAccess = data?.ownerAccess;
  const accessFromUrl = new URLSearchParams(window.location.search).get("access") || "";
  const accessConfirmed = !!ownerAccess?.code && accessFromUrl === ownerAccess.code;

  const copyAccessCode = async () => {
    if (!ownerAccess?.code) return;
    try {
      await navigator.clipboard.writeText(ownerAccess.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Cod copiat", description: "Lipește-l în adresă după /admin/campaigns?access=" });
    } catch {
      toast({ title: "Copierea nu a reușit", description: "Selectează codul și copiază-l manual.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administrare"
        title="Campanii și coduri"
        icon={Ticket}
        description="Loturi de test, cota pilot și cardurile care se retipăresc cu aceleași coduri. Accesul este verificat pe server după rolul de administrator."
        actions={<StatusPill tone="neutral" dot>{campaign?.name || "campanie demo"}</StatusPill>}
      />

      <Surface tone="quiet" className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="caps text-primary">Acces rapid proprietar</p>
                {accessConfirmed ? <StatusPill tone="ready">confirmat</StatusPill> : null}
              </div>
              <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                Codul deschide pagina doar din contul proprietarului. Serverul verifică rolul de administrator înainte de orice citire; un cont obișnuit primește refuz și cu cod, și prin URL direct.
              </p>
            </div>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <code className="min-w-0 flex-1 rounded-xl border border-border/70 bg-background/60 px-3 py-2 font-mono text-sm tracking-[0.22em] text-foreground sm:flex-none">
              {ownerAccess?.code || "—"}
            </code>
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0 gap-1.5 border-primary/40" onClick={copyAccessCode} disabled={!ownerAccess?.code}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiat" : "Copiază"}
            </Button>
          </div>
        </div>
      </Surface>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Generate", value: totals.generated },
          { label: "Revendicate", value: totals.claimed },
          { label: "Disponibile", value: totals.available },
          { label: "Cota pilot", value: totals.pilot_quota },
        ].map((item) => (
          <Surface key={item.label} tone="quiet" className="p-4">
            <p className="caps">{item.label}</p>
            <p className="mt-1 font-heading text-3xl font-semibold tabular-nums">{item.value}</p>
          </Surface>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <Surface className="p-5 sm:p-6">
          <SurfaceHead icon={CreditCard} title="Loturi" hint="Retipărirea unui lot folosește exact codurile existente." />
          {ownerBatch ? (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="caps text-primary">Lot privat proprietar</p>
                  <p className="mt-1 text-sm font-medium">{ownerBatch.name}</p>
                </div>
                <StatusPill tone="ready">acces real</StatusPill>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {ownerBatch.generated || 5} coduri Premium pe viață. Păstrează-le nefolosite la predare; testele se fac cu alte coduri.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 gap-2 border-primary/40">
                <Link to={`/admin/cards/${ownerBatch.id}`}><CreditCard className="h-3.5 w-3.5" /> Vezi cardurile</Link>
              </Button>
            </div>
          ) : null}
          <div className="mt-4 space-y-2">
            {batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun lot încă. Creează primul lot de test în dreapta.</p>
            ) : (
              batches.map((batch) => (
                <div key={batch.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{batch.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {batch.country} · {batch.product} · {batch.store || "fără magazin"} · {batch.generated} generate
                    </p>
                  </div>
                  {batch.lifetime ? <StatusPill tone="ready">pe viață</StatusPill> : null}
                  <StatusPill tone={batch.available > 0 ? "ready" : "neutral"}>
                    {batch.claimed} revendicate
                  </StatusPill>
                  <StatusPill tone="neutral">{batch.available} disponibile</StatusPill>
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link to={`/admin/cards/${batch.id}`}><CreditCard className="h-3.5 w-3.5" /> Carduri</Link>
                  </Button>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            {campaign?.terms}
          </p>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SurfaceHead icon={Plus} title="Creează un lot" hint="Codurile sunt generate pe server și verificate ca unice." />
          <form onSubmit={createBatch} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="batch-name">Nume lot</Label>
              <Input id="batch-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={80} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="batch-quantity">Număr coduri</Label>
                <Input
                  id="batch-quantity"
                  type="number"
                  min={1}
                  max={2500}
                  value={form.quantity}
                  onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="batch-country">Țară</Label>
                <Input id="batch-country" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} maxLength={2} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-product">Produs</Label>
              <Input id="batch-product" value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-store">Magazin / rețea</Label>
              <Input id="batch-store" value={form.store} onChange={(event) => setForm({ ...form, store: event.target.value })} maxLength={60} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-notes">Notă internă</Label>
              <Input id="batch-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={120} />
            </div>
            <Button type="submit" className="h-11 w-full gap-2" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? "Se generează…" : "Generează lotul"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Pentru prima probă folosește 10 coduri. Cota totală a pilotului este configurabilă la {totals.pilot_quota}.
            </p>
          </form>
        </Surface>
      </div>
    </div>
  );
}