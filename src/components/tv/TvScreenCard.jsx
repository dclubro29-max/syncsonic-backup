import React from "react";
import { Cast, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";

const openOnTv = () => {
  // Vizualul de party stă pe o pagină fără meniu: se trage pe televizor și se pune pe tot ecranul.
  window.open("/party", "musicsync-tv", "popup=yes,width=1280,height=760");
};

/** Imaginea pe televizor: fereastra de vizual se deschide separat de mixer. */
export default function TvScreenCard() {
  return (
    <Surface className="p-5">
      <SurfaceHead
        icon={Cast}
        title="Imaginea pe televizor"
        hint="Vizualul se deschide într-o fereastră separată, pe care o muți pe televizor."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={openOnTv}>
          <Cast className="mr-1.5 h-4 w-4" />
          Deschide vizualul
        </Button>
      </div>

      <ol className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <li>
          <span className="num mr-1.5 text-foreground">1.</span>
          Conectează cablul HDMI și, în sistem, alege „Extinde ecranul” (Windows: Win+P, macOS:
          Setări → Monitoare → Oglindă/Extinde).
        </li>
        <li>
          <span className="num mr-1.5 text-foreground">2.</span>
          Apasă „Deschide vizualul” și trage fereastra apărută pe ecranul televizorului.
        </li>
        <li>
          <span className="num mr-1.5 text-foreground">3.</span>
          Pune-o pe tot ecranul:{" "}
          <span className="inline-flex items-center gap-1 text-foreground">
            <Maximize2 className="h-3.5 w-3.5" />
            F11
          </span>{" "}
          pe Windows, Ctrl+Cmd+F pe macOS.
        </li>
        <li>
          <span className="num mr-1.5 text-foreground">4.</span>
          Pornește pe televizor modul „Joc” / „Low latency”, apoi reglează întârzierea din panoul
          de sunet până dispare ecoul.
        </li>
      </ol>
    </Surface>
  );
}