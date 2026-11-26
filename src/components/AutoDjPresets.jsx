import React from "react";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Crown, Feather, Flame, MinusCircle, Zap } from "lucide-react";
import { DJ_MAX_CONFIG, DJ_ULTRA_CONFIG, PARTY_MAX_CONFIG, PARTY_MAX_ULTRA_CONFIG } from '@/lib/djMaxConfig';

/**
 * Preseturi de mixare: schimbă stilul tranziției și durata ei. Sunt combinații
 * de reglaje; ULTRA pornește și procesarea audio dedicată.
 */
export const PRESETS = {
  party: {
    label: 'PARTY MAX',
    icon: Flame,
    hint: 'Efecte de la pornire: filtru pronunțat, ecou, reverb și revenire de bass. Un build → drop la fiecare 8 măsuri, cu pauză între accente; fără BPM detectat, efectele folosesc un ritm de 120 BPM. Auto DJ și efectele au un singur control; volumul master rămâne neschimbat.',
    config: PARTY_MAX_CONFIG,
  },
  partyUltra: {
    label: 'PARTY MAX ULTRA',
    icon: Crown,
    hint: 'Același mod pornit din Redare: efecte Party MAX, tranziție de 20s și protecția refrenului. „Mix din mijlocul piesei” este oprit implicit; îl poți activa din Mixer, iar zonele importante rămân protejate.',
    config: PARTY_MAX_ULTRA_CONFIG,
  },
  ultra: {
    label: "DJ MAX ULTRA",
    icon: Crown,
    hint: "Precizia MAX plus coregrafie: build → drop pe structura reală a piesei (filtru, reverb, impact de bass) o singură dată, cu revenire curată. Faza bătăilor e ținută pe tot blendul, EQ de crossover și selecție după tempo, nivel, timbru și energia setului. Masterul rămâne la volumul ales.",
    config: DJ_ULTRA_CONFIG,
  },
  max: {
    label: "DJ MAX",
    icon: Zap,
    hint: "Mix invizibil de precis: ieșire pe frază, tempo pregătit pe deckul mut, fază corectată pe tot crossfade-ul, EQ de crossover și selecție după tempo, nivel și energia setului. Fără efecte peste piese; volumul master rămâne neschimbat.",
    config: DJ_MAX_CONFIG,
  },
  lin: {
    label: "Lin",
    icon: Feather,
    hint: "Tranziții lungi și line, fără efecte live. Potrivit pentru muzică liniștită sau oaspeți.",
    config: {
      performanceMode: 'balanced', partyMax: false, performance: false, transitionFx: false, mixBars: 0,
      transition: "smooth",
      crossfade: 16,
      bassSwap: true,
      beatmatch: true,
    },
  },
  energic: {
    label: "Energic",
    icon: Flame,
    hint: "Tranziții scurte, pe beat, fără efecte live. Potrivit pentru un set de petrecere.",
    config: {
      performanceMode: 'balanced', partyMax: false, performance: false, transitionFx: false, mixBars: 0,
      transition: "cut",
      crossfade: 8,
      bassSwap: true,
      beatmatch: true,
    },
  },
  fara: {
    label: "Fără schimb de bass",
    icon: MinusCircle,
    hint: "Doar crossfade curat: fără schimb de bass și fără efecte, piesele rămân neatinse.",
    config: {
      performanceMode: 'balanced', partyMax: false, performance: false, transitionFx: false, mixBars: 0,
      transition: "smooth",
      crossfade: 12,
      bassSwap: false,
      beatmatch: true,
    },
  },
};

// „performance" era singurul reglaj care putea rămâne aprins după DJ MAX:
// fără el în comparație, un preset line apărea activ cu efectele pornite.
const KEYS = ["transition", "crossfade", "bassSwap", "beatmatch", "performanceMode", "performance", "transitionFx", "mixBars", "partyMax"];

/** Care preset corespunde exact reglajelor actuale (altfel: reglaje proprii). */
export function matchPreset(config) {
  const found = Object.entries(PRESETS).find(([, preset]) =>
    KEYS.every((key) => preset.config[key] === config[key])
  );
  return found ? found[0] : null;
}

export default function AutoDjPresets() {
  const { autoDj, emergencyPlayback } = useDj();
  const active = matchPreset(autoDj.config);

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Preset de mixare</Label>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(PRESETS).map(([id, preset]) => {
          const Icon = preset.icon;
          return (
            <Button
              key={id}
              size="sm"
              disabled={emergencyPlayback}
              variant={active === id ? "default" : "outline"}
              className={`h-auto flex-col gap-1 py-2 text-[11px] ${id === "ultra" || id === "party" || id === "partyUltra" ? "col-span-2" : ""}`}
              onClick={() =>
                preset.config.performanceMode === "max"
                  ? autoDj.startMax(preset.config)
                  : autoDj.setConfig(preset.config)
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {preset.label}
              {preset.config.crossfade ? (
                <span className="text-[10px] font-normal opacity-70">{preset.config.crossfade}s</span>
              ) : null}
            </Button>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {active
          ? PRESETS[active].hint
          : "Reglaje proprii: modificările din panou se aplică imediat."}
      </p>
    </div>
  );
}