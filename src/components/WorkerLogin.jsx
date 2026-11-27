import { useState } from "react";
import { useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workerRequest } from "@/api/workerClient";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function WorkerLogin() {
  const { pathname } = useLocation();
  const admin = pathname === "/admin-sign-in";
  const [ticket, setTicket] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("ticket"));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (admin) {
        await workerRequest("admin/sign-in", {});
        window.location.replace(safeReturnTo());
      } else if (ticket) {
        await workerRequest("account/login-confirm", { ticket });
        window.location.replace(safeReturnTo());
      } else {
        await workerRequest("account/login-request", { email, returnTo: safeReturnTo() });
        setSent(true);
      }
    } catch (failure) {
      if (ticket && failure.status === 401) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        setTicket(null);
        setError("Linkul a expirat sau a fost folosit. Cere un link nou.");
      } else {
        setError("Conectarea nu este disponibilă momentan. Încearcă din nou.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout icon={LogIn} title="Conectare la SyncSonic" subtitle="Folosește adresa asociată contului tău">
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {sent ? (
        <p role="status">Dacă adresa este asociată unui cont, vei primi un link de conectare.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {!ticket && !admin && (
            <>
              <Label htmlFor="worker-login-email">Email</Label>
              <Input id="worker-login-email" type="email" autoComplete="email" required
                value={email} onChange={(event) => setEmail(event.target.value)} />
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Se procesează…" : ticket || admin ? "Confirmă conectarea" : "Trimite linkul"}
          </Button>
          {!ticket && !admin && (
            <a className="block text-center text-sm text-primary hover:underline"
              href={"/admin-sign-in?returnTo=" + encodeURIComponent(safeReturnTo())}>
              Acces administrator
            </a>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
