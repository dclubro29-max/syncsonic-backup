import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSkin } from "@/lib/SkinContext";
import { Cast, Check, Clapperboard, Disc3, LayoutGrid, MoreHorizontal, Palette, PartyPopper, Smartphone, Tv } from "lucide-react";

/** Funcțiile care nu au nevoie de un tab propriu, lângă player. */
export default function PlayerOptionsMenu() {
  const { skins, skin, setSkin } = useSkin();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-12 w-full gap-2 border-border/80"
          aria-label="Opțiuni player"
          title="Opțiuni player"
        >
          <MoreHorizontal className="h-4 w-4" />
          Opțiuni
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Cu muzica pornită
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/remote" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Telecomandă
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/party" className="gap-2">
            <Tv className="h-4 w-4" />
            Party TV
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/mixes" className="gap-2">
            <Disc3 className="h-4 w-4" />
            Mixurile mele
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          Schimbă aspectul
        </DropdownMenuLabel>
        {skins.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => setSkin(item.id)} className="gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${item.id === skin ? "bg-primary" : "bg-muted-foreground/35"}`} />
            <span className="flex-1">{item.name}</span>
            {item.id === skin ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/start" className="gap-2">
            <PartyPopper className="h-4 w-4" />
            Pregătește petrecerea
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/movie" className="gap-2">
            <Clapperboard className="h-4 w-4" />
            Mod film
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/tv" className="gap-2">
            <Cast className="h-4 w-4" />
            Televizor (HDMI)
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/more" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Mai multe unelte
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}