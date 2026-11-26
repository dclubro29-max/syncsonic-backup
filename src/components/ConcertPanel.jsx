import React from "react";
import { useDj } from "@/lib/djContext";
import { useConcertSync } from "@/hooks/useConcertSync";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, RefreshCw, Mic, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { PILOT_FREQUENCIES } from "@/lib/pilotSync";

/** Cât de bine se aud boxele una față de alta, după ultima verificare. */
function quality(spread) {
  if (spread == null) return null;
  if (spread <= 3) return { text: "Aliniat perfect", tone: "text-primary" };
  if (spread <= 10) return { text: "Aproape aliniat", tone: "text-amber-500" };
  return { text: "Se corectează", tone: "text-amber-500" };
}

/**
 * Sincronizare de concert: microfonul verifică din zece în zece secunde când
 * ajunge sunetul la fiecare boxă, iar întârzierile se corectează singure.
 */
export default function ConcertPanel() {
  const dj = useDj();
  const sync = useConcertSync();
  const q = quality(sync.status.spread);

  const labelFor = (deviceId) =>
    dj.speakers.find((s) => s.deviceId === deviceId)?.label || "Boxă";

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Radio className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="font-heading text-sm">Concert Sync</CardTitle>
              <CardDescription className="text-[11px]">
                Verificare numai cu muzica oprită
              </CardDescription>
            </div>
          </div>
          <Switch checked={sync.on} onCheckedChange={sync.setEnabled} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Verifică alinierea înainte de set. În timpul redării, verificările sunt suspendate:
          nu se redeschide microfonul și nu se schimbă întârzierile peste muzică.
        </p>

        {sync.on && (
          <>
            <div className="flex items-center gap-2 text-xs">
              {sync.status.phase === "measuring" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                  <span className="text-muted-foreground">Ascult boxele…</span>
                </>
              )}
              {sync.status.phase === 'paused' && <span className="text-muted-foreground">{sync.status.message}</span>}
              {sync.status.phase === 'done' && !q && <span className="text-primary">{sync.status.message}</span>}
              {sync.status.phase === "done" && q && (
                <>
                  <CheckCircle2 className={`h-3.5 w-3.5 shrink-0 ${q.tone}`} />
                  <span className={q.tone}>{q.text}</span>
                  <span className="text-muted-foreground">
                    · {sync.status.spread} ms diferență
                    {sync.status.corrected > 0 ? ` · ${sync.status.corrected} corecții` : ""}
                  </span>
                </>
              )}
              {sync.status.phase === "error" && (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span className="text-amber-500">{sync.status.message}</span>
                </>
              )}
            </div>

            {sync.status.results.length > 0 && (
              <div className="space-y-1.5">
                {sync.status.results.map((r) => {
                  const applied = dj.outputs.find((o) => o.deviceId === r.deviceId);
                  return (
                    <div
                      key={r.deviceId}
                      className="rounded-xl border border-border px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate">{labelFor(r.deviceId)}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {r.latency != null ? `${Math.round(r.latency)} ms` : "nedeectat"}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        întârziere aplicată: {applied?.delay ?? 0} ms
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={sync.checkNow}
                disabled={sync.status.phase === "measuring"}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Verifică acum
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {sync.secondsToNext != null
                  ? `Următoarea verificare în ${sync.secondsToNext} s`
                  : "Verificarea pornește imediat."}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground">Semnalul de verificare</span>
              <Select
                value={String(sync.frequency)}
                onValueChange={(v) => sync.setFrequency(Number(v))}
              >
                <SelectTrigger className="h-8 w-[190px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PILOT_FREQUENCIES.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
              <Mic className="mt-0.5 h-3 w-3 shrink-0" />
              Se folosește un microfon integrat/USB, nu cel Bluetooth. Trei măsurători per boxă; rezultatele instabile sunt respinse.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}