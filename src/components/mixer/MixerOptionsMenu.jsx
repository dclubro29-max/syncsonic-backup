import React from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lock, Smartphone, Sun, SlidersHorizontal, Tv, Unlock } from "lucide-react";

/** Acțiunile mai rare ale mixerului, strânse într-un singur meniu. */
export default function MixerOptionsMenu() {
  const dj = useDj();
  const locked = dj.volumeLock !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5" title="Mai multe opțiuni">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Opțiuni
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem asChild>
          <Link to="/party" className="gap-2">
            <Tv className="h-4 w-4" />
            Mod Party (TV)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => dj.toggleVolumeLock()} className="gap-2">
          {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          {locked
            ? `Deblochează volumul (${Math.round(dj.volumeLock * 100)}%)`
            : "Blochează volumul master"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => dj.setKeepAwake(!dj.keepAwake)} className="gap-2">
          <Sun className="h-4 w-4" />
          {dj.keepAwake ? "Ecranul rămâne aprins · pornit" : "Ecranul rămâne aprins · oprit"}
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-2 text-[11px] leading-relaxed opacity-100">
          <Smartphone className="h-4 w-4 shrink-0" />
          <span className="text-muted-foreground">
            Pe telefon, redarea continuă cu ecranul stins. Controalele apar pe ecranul blocat.
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Modul mixerului
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={dj.advanced ? "avansat" : "simplu"}
          onValueChange={(value) => dj.setAdvanced(value === "avansat")}
        >
          <DropdownMenuRadioItem value="simplu">Simplu · 2 deckuri</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="avansat">Avansat · 4 deckuri</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}