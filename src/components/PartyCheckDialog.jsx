import React from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Play, Volume2 } from "lucide-react";

/** Rezultatul testului care rulează înainte de orice petrecere. */
export default function PartyCheckDialog({ open, checks, onConfirm, onCancel, onTestSound }) {
  const allOk = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Test înainte de petrecere</DialogTitle>
          <DialogDescription>
            Verific sunetul, piesele și ieșirile înainte să pornim.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {checks.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-border px-4 py-3"
            >
              {c.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{c.label}</p>
                {!c.ok && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {c.hint}
                    {c.to && (
                      <Link
                        to={c.to}
                        onClick={onCancel}
                        className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Deschide
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <Button variant="outline" className="gap-2" onClick={onTestSound}>
          <Volume2 className="h-4 w-4" />
          Testează sunetul
        </Button>

        {allOk && (
          <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Totul e ok — poți porni petrecerea.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Renunță
          </Button>
          <Button className="gap-2" onClick={onConfirm}>
            <Play className="h-4 w-4" />
            {allOk ? "Pornește petrecerea" : "Pornește oricum"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}