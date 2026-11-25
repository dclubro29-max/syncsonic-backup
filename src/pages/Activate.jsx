import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearPendingCode,
  isValidCode,
  normalizeCode,
  readPendingCode,
  storePendingCode,
} from "@/lib/premium";
import { invalidatePremiumStatus } from "@/lib/premiumStatus";
import { ArrowLeft, CheckCircle2, Loader2, Ticket, TriangleAlert } from "lucide-react";

function initialCode() {
  const fromStorage = readPendingCode();
  if (fromStorage) return fromStorage;
  return normalizeCode(new URLSearchParams(window.location.search).get("code") || "");
}

export default function Activate() {
  const { user, isLoadingAuth, isLoadingPublicSettings } = useAuth();
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const checking = isLoadingAuth || isLoadingPublicSettings;
  const complete = isValidCode(code);

  const updateCode = (value) => {
    const next = normalizeCode(value).slice(0, 6);
    setCode(next);
    storePendingCode(next);
    if (error) setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!complete) {
      setError("Codul are exact șase caractere: litere A–Z și cifre 0–9.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await base44.functions.invoke("redeemPremiumCode", { code });
      const data = response.data;
      if (!data?.ok) {
        setError(data?.error || "Codul nu a putut fi activat.");
        return;
      }
      setResult(data);
      clearPendingCode();
      invalidatePremiumStatus();
    } catch (failure) {
      const message =
        failure?.response?.data?.error ||
        failure?.data?.error ||
        failure?.message ||
        "Conexiunea a fost întreruptă. Codul a rămas în câmp; reîncearcă.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError("");
    setCode("");
    clearPendingCode();
  };

  if (checking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[100dvh] items-start justify-center bg-background px-5 py-8 sm:items-center sm:py-10">
        <div className="panel w-full max-w-md p-6 text-center">
          <Ticket className="mx-auto h-9 w-9 text-primary" />
          <h1 className="mt-4 font-heading text-2xl font-semibold">Activează un cod</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Codul rămâne salvat pe acest dispozitiv. Conectează-te sau creează un cont, apoi revii direct aici.
          </p>
          <div className="mt-5 grid gap-2">
            <Button asChild className="h-12">
              <Link to={`/login?returnTo=${encodeURIComponent("/activate")}`}>Conectează-te</Link>
            </Button>
            <Button asChild variant="outline" className="h-12 border-border/80">
              <Link to={`/register?returnTo=${encodeURIComponent("/activate")}`}>Creează cont</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="flex min-h-[100dvh] items-start justify-center bg-background px-5 py-8 sm:items-center sm:py-10">
        <div className="panel w-full max-w-md p-6 text-center sm:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-heading text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            {result.lifetime
              ? result.already_lifetime
                ? "Premium pe viață este deja activ"
                : "Ai activat Premium pe viață"
              : result.first_in_campaign
                ? `Ai activat ${result.months_label} Premium`
                : `Ai adăugat ${result.months_label}`}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {result.lifetime
              ? "Accesul rămâne activ fără expirare. Un cod temporar ulterior nu îl retrage."
              : <>Valabil până la <strong className="font-medium text-foreground">{result.expires_on_display}</strong>.</>}
          </p>
          {result.already_lifetime ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Codul nu a modificat accesul permanent deja acordat.
            </p>
          ) : null}
          {result.previous_expires_on_display ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Perioada s-a adăugat după {result.previous_expires_on_display}.
            </p>
          ) : null}
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Cod {result.code_masked}
          </p>
          <div className="mt-6 grid gap-2">
            <Button asChild className="h-12">
              <Link to="/">Înapoi la muzică</Link>
            </Button>
            <Button variant="ghost" className="h-11" onClick={reset}>
              Activează alt cod
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-start justify-center bg-background px-5 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:items-center sm:py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Înapoi la muzică
        </Link>

        <div className="panel mt-4 p-6 sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Ticket className="h-6 w-6" />
          </span>
          <h1 className="mt-5 font-heading text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
            Activează un cod
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Primul cod eligibil oferă <strong className="font-medium text-foreground">3 luni Premium</strong>.
            Fiecare cod suplimentar adaugă <strong className="font-medium text-foreground">1 lună</strong> pe același cont.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="premium-code">Codul de pe card</Label>
              <Input
                id="premium-code"
                value={code}
                onChange={(event) => updateCode(event.target.value)}
                maxLength={6}
                autoFocus={!code}
                autoCapitalize="characters"
                autoComplete="one-time-code"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
                aria-invalid={!!error}
                aria-describedby="premium-code-help"
                placeholder="ABC123"
                className="h-14 text-center font-mono text-2xl uppercase tracking-[0.35em]"
              />
              <p id="premium-code-help" className="min-h-4 text-[11px] text-muted-foreground" aria-live="polite">
                {complete
                  ? "Cod complet. Apasă Activează."
                  : code.length
                    ? `Mai lipsesc ${6 - code.length} caractere.`
                    : "Șase caractere: litere A–Z și cifre 0–9."}
              </p>
            </div>

            {error ? (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.07] px-4 py-3 text-xs leading-relaxed text-destructive">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button type="submit" className="h-14 w-full text-[15px]" disabled={busy || !complete}>
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {busy ? "Se verifică…" : error ? "Reîncearcă" : "Activează"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Nu se cere card și nu pornește un abonament. Codul se consumă doar când apeși Activează.
          </p>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            <Link to="/premium" className="text-primary hover:underline">Cum funcționează Premium</Link>
          </p>
        </div>
      </div>
    </div>
  );
}