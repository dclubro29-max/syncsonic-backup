import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Timer, PlayCircle, RotateCcw, Info } from "lucide-react";

export default function OutputCalibration({ outputs, speakers, onDelayChange, onTest, onTestAll, supported }) {
  const labelFor = (deviceId) => {
    const sp = speakers.find((s) => s.deviceId === deviceId);
    if (!sp) return "Boxă";
    return sp.label || "Boxă";
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="p-7 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Timer className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-heading text-lg">Calibrare boxe (ecou)</CardTitle>
            <CardDescription className="text-xs">
              Dacă auzi ecou, întârzie puțin boxa care cântă prima
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-7 pt-0">
        {!supported && (
          <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Browserul tău nu expune ieșiri separate, deci nu putem întârzia boxele individual.
            </span>
          </div>
        )}

        {supported && outputs.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Selectează cel puțin o boxă mai sus. Dacă sistemul arată boxele ca o singură
            ieșire, reglajele individuale nu au efect — aplicația poate controla doar
            ieșirile pe care browserul le separă.
          </div>
        )}

        {outputs.length > 0 && (
          <>
            <div className="space-y-4">
              {outputs.map((o) => (
                <div key={o.deviceId} className="rounded-2xl border border-border px-5 py-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium">{labelFor(o.deviceId)}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => onTest(o.deviceId)}
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Test
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Resetează la 0 ms"
                        onClick={() => onDelayChange(o.deviceId, 0)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[o.delay]}
                      min={0}
                      max={500}
                      step={1}
                      onValueChange={(v) => onDelayChange(o.deviceId, v[0])}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={500}
                        step={1}
                        value={o.delay}
                        onChange={(e) => onDelayChange(o.deviceId, Number(e.target.value) || 0)}
                        className="h-8 w-20 text-right text-xs tabular-nums"
                      />
                      <span className="text-xs text-muted-foreground">ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button variant="secondary" className="gap-2" onClick={onTestAll}>
                <PlayCircle className="h-4 w-4" />
                Testează toate împreună
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Reglajele se salvează local, per dispozitiv.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}