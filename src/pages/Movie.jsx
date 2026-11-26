import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MovieSource from "@/components/movie/MovieSource";
import MovieStage from "@/components/movie/MovieStage";
import { useDj } from "@/lib/djContext";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Clapperboard, Info } from "lucide-react";

export default function Movie() {
  const dj = useDj();
  const [source, setSource] = useState(null);

  // Fișierul rămâne în memorie cât timp e deschis; la schimbare eliberăm adresa.
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cinema"
        title="Mod film"
        icon={Clapperboard}
        description="Alege un film din telefon sau laptop, iar sunetul trece prin boxele conectate — cu întârzierea reglată pe fiecare, ca să fie sincron cu imaginea."
      />

      {source ? (
        <MovieStage source={source} onReplace={() => setSource(null)} />
      ) : (
        <MovieSource onPick={setSource} />
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Filmul rămâne local, în browser. Pentru sunet „de cinema”, dă fiecărei boxe o bandă de
          frecvențe diferită în{" "}
          <Link to="/speakers" className="font-medium text-primary hover:underline">
            Boxe și sunet
          </Link>
          {dj.outputCount > 0 ? ` — acum cântă ${dj.outputCount}.` : "."}
        </p>
      </div>
    </div>
  );
}