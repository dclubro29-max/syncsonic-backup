import React from "react";
import { useDj } from "@/lib/djContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Headphones } from "lucide-react";

const NONE = "__none__";

/**
 * Ieșirea de preascultare: aici alegi căștile. Semnalul de preascultare nu trece
 * prin master, deci nu se aude în boxe — doar în ieșirea aleasă aici.
 */
export default function CueOutput() {
  const dj = useDj();
  const outputs = dj.speakers.filter((s) => !s.systemDefault);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="p-5 pb-4">
        <CardTitle className="flex items-center gap-2 font-heading text-sm">
          <Headphones className="h-4 w-4 text-primary" />
          Preascultare în căști
        </CardTitle>
        <CardDescription className="mt-1 text-[11px] leading-relaxed">
          Alege ieșirea căștilor, apoi apasă CĂȘTI pe un deck ca să-l auzi doar acolo,
          indiferent de fader sau crossfader. Nu se aude în boxe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-5 pt-0">
        <div>
          <Label className="mb-1.5 block text-xs font-medium">Ieșirea căștilor</Label>
          {outputs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              Nu văd încă nicio ieșire. Conectează căștile, apoi apasă „Reîmprospătează"
              în lista de mai sus.
            </p>
          ) : (
            <Select
              value={dj.cueDevice || NONE}
              onValueChange={(v) => dj.setCueDevice(v === NONE ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Fără preascultare</SelectItem>
                {outputs.map((s) => (
                  <SelectItem key={s.deviceId} value={s.deviceId}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className={dj.cueDevice ? "" : "opacity-60"}>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Volum căști</Label>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.round(dj.cueVolume * 100)}%
            </span>
          </div>
          <Slider
            value={[Math.round(dj.cueVolume * 100)]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => dj.setCueVolume(v / 100)}
          />
        </div>
      </CardContent>
    </Card>
  );
}