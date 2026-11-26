import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { useDj } from "@/lib/djContext";
import { MASTER_PRESETS } from "@/lib/masterChain";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/ui-kit/StatusPill";

const CRYSTAL = MASTER_PRESETS.find((preset) => preset.id === "crystal");
const sameValues = (current, values) =>
  Object.keys(values).every((key) => Math.abs((current[key] ?? 0) - values[key]) < 0.005);

/**
 * A/B ghidat între reglajul curent și Crystal Clear, cu nivelul de ieșire
 * păstrat. Textura se compară, volumul nu; confirmarea finală rămâne auditivă.
 */
export default function MasterPresetCompare() {
  const dj = useDj();
  const [saved, setSaved] = useState(null);
  const [comparing, setComparing] = useState(false);

  const matched = MASTER_PRESETS.find((preset) => sameValues(dj.masterEnhance, preset.values));
  const currentLabel = matched?.label || "reglaj actual";
  const alreadyCrystal = matched?.id === "crystal";
  const blocked = dj.neutral || dj.abBypass;

  const compare = () => {
    if (comparing || blocked || alreadyCrystal) return;
    const snapshot = { values: { ...dj.masterEnhance }, limiterOn: dj.limiterOn };
    setSaved(snapshot);
    dj.applyMasterPreset("crystal");
    dj.setMasterEnhance({ outGain: snapshot.values.outGain ?? 1 });
    setComparing(true);
  };

  const restore = () => {
    if (!saved) return;
    dj.setMasterEnhance(saved.values);
    dj.setLimiter(saved.limiterOn);
    setSaved(null);
    setComparing(false);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="caps flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Compară Crystal Clear
        </p>
        <StatusPill tone={comparing ? "ready" : "neutral"} dot>
          {comparing ? "Crystal Clear" : currentLabel}
        </StatusPill>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Comută A/B la același nivel de ieșire. Crystal Clear primește nivelul reglajului actual,
        ca să compari textura, nu volumul.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button
          variant={!comparing ? "default" : "outline"}
          className="h-10 min-w-0"
          onClick={restore}
          disabled={!comparing}
        >
          <span className="truncate">A · {currentLabel}</span>
        </Button>
        <Button
          variant={comparing ? "default" : "outline"}
          className="h-10 min-w-0 gap-1.5"
          onClick={compare}
          disabled={comparing || blocked || alreadyCrystal}
        >
          <span className="truncate">B · Crystal Clear</span>
        </Button>
      </div>

      {alreadyCrystal && !comparing ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Ești deja pe Crystal Clear.</p>
      ) : null}

      {blocked ? (
        <p className="mt-2 text-[11px] leading-relaxed text-warning">
          Oprește „Sunet original” și „B · Fidel” ca lanțul de masterizare să fie activ în timpul comparației.
        </p>
      ) : null}

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        Pentru tranziții: pornește două piese cu nivel ridicat, începe tranziția și comută A/B în timpul ei.
        Confirmarea că se aude mai bine rămâne auditivă.
      </p>
    </div>
  );
}