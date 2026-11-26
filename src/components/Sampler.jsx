import React, { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDj } from "@/lib/djContext";
import { formatSize } from "@/lib/trackStore";
import { Grid3x3, Plus, Square, X } from "lucide-react";

/** Sampler cu 8 paduri. Padurile se salvează local, pe acest device. */
export default function Sampler() {
  const dj = useDj();
  const [target, setTarget] = useState(null);
  const inputRef = useRef(null);

  const pick = (index) => {
    setTarget(index);
    inputRef.current?.click();
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 font-heading text-xs font-semibold tracking-widest text-muted-foreground">
            <Grid3x3 className="h-3.5 w-3.5" />
            SAMPLER · 8 PADURI
          </span>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-[11px]" onClick={dj.stopPads}>
            <Square className="h-3 w-3" />
            Oprește
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {dj.pads.map((pad, i) => (
            <button
              key={i}
              type="button"
              onClick={() => (pad ? dj.triggerPad(i) : pick(i))}
              title={pad ? `Redă ${pad.name}` : "Încarcă un sunet pe acest pad"}
              className={`group relative flex h-20 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 text-center transition-all ${
                dj.activePad === i
                  ? "border-primary bg-primary/20 scale-[0.97]"
                  : pad
                  ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                  : "border-dashed border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              {pad ? (
                <>
                  <span className="w-full truncate text-[10px] font-medium leading-tight">{pad.name}</span>
                  <span className="text-[9px] text-muted-foreground">{formatSize(pad.size)}</span>
                </>
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {pad && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    dj.removePad(i);
                  }}
                  className="absolute right-1 top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground group-hover:flex"
                >
                  <X className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          ))}
        </div>

        {dj.samplerError && <p className="mt-3 text-[11px] text-destructive">{dj.samplerError}</p>}

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Padurile intră direct în master, deci trec prin limiter și ajung pe toate boxele
          selectate. Sunt salvate local, pe acest device.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && target !== null) dj.assignPad(target, f);
            e.target.value = "";
            setTarget(null);
          }}
        />
      </CardContent>
    </Card>
  );
}