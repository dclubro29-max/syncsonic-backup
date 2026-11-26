import { useState } from "react";
import { LogIn } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { workerRequest } from "@/api/workerClient";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function WorkerLogin() {
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
      if (ticket) {
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
          {!ticket && (
            <>
              <Label htmlFor="worker-login-email">Email</Label>
              <Input id="worker-login-email" type="email" autoComplete="email" required
                value={email} onChange={(event) => setEmail(event.target.value)} />
            </>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Se procesează…" : ticket ? "Confirmă conectarea" : "Trimite linkul"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
