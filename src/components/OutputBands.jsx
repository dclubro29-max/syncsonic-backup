import React from "react";
import { useDj } from "@/lib/djContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, Info } from "lucide-react";
import { BANDS, getBand } from "@/lib/bands";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import StateBlock from "@/components/ui-kit/StateBlock";

export default function OutputBands() {
  const dj = useDj();
  const outputs = dj.outputs;

  const labelFor = (id) => {
    const sp = dj.speakers.find((s) => s.deviceId === id);
    return sp?.label || "Ieșire audio";
  };

  return (
    <Surface className="p-5 sm:p-6">
      <SurfaceHead
        icon={SlidersHorizontal}
        title="Împărțirea sunetului pe boxe"
        hint="Alegi ce bandă redă fiecare boxă selectată: bass pe una, vocale pe cealaltă."
      />
      <div className="mt-4 space-y-3">
        {outputs.length === 0 ? (
          <StateBlock
            icon={SlidersHorizontal}
            title="Nicio boxă activă"
            description="Selectează cel puțin o boxă mai sus, apoi împarte sunetul aici."
            className="py-6"
          />
        ) : (
          outputs.map((o) => (
            <div key={o.deviceId} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label className="break-words text-sm font-medium">{labelFor(o.deviceId)}</Label>
                <Select
                  value={o.band || "full"}
                  onValueChange={(v) => dj.setOutputBand(o.deviceId, v)}
                >
                  <SelectTrigger className="h-10 w-full border-border/70 bg-surface-inset/60 sm:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANDS.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{getBand(o.band).hint}</p>
            </div>
          ))
        )}

        <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            „Vocale” nu extrage vocea din piesă — scoate în față zona în care stă de obicei vocea
            (aproximativ 900 Hz – 4,5 kHz). Pentru bass separat, pune o boxă pe „Bass” și pe
            cealaltă alege „Vocale” sau „Medii”. Fiecare bandă are un plus de nivel, ca boxele să
            rămână puternice după filtrare.
          </span>
        </div>
      </div>
    </Surface>
  );
}