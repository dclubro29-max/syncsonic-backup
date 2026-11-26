import React from "react";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { RotateCcw, BookOpen, Lightbulb, GraduationCap } from "lucide-react";
import PageHeader from "@/components/ui-kit/PageHeader";
import { Surface, SurfaceHead } from "@/components/ui-kit/Surface";
import TutorialChecklist from "@/components/learn/TutorialChecklist";

const GLOSSARY = [
  { term: "BPM", text: "Viteza ritmului — câte bătăi pe minut. 120 BPM înseamnă 2 bătăi pe secundă." },
  { term: "CUE", text: "Punctul din piesă de unde pregătești pornirea, ca să intri exact pe ritm." },
  { term: "Loop", text: "Repetarea unei bucăți scurte din piesă, cât timp ții loop-ul activ." },
  { term: "Crossfader", text: "Cursorul care trece sunetul de la o piesă la alta. Stânga = A, dreapta = B." },
  { term: "EQ", text: "Reglarea sunetelor joase (bass), medii (mid) și înalte (high)." },
  { term: "Trim", text: "Volumul de intrare al piesei, înainte de fader. Ține-l aproape de 100%." },
  { term: "Tempo", text: "Viteza de redare. 100% = viteza originală, +4% = cu 4% mai rapid." },
  { term: "Limiter", text: "Protecție care oprește distorsiunea când mai multe piese cântă împreună." },
];

export default function Learn() {
  const dj = useDj();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ghid"
        title="Învață"
        icon={GraduationCap}
        description="Primul tău mix, pas cu pas — tutorialul se bifează singur pe măsură ce mixezi."
        actions={
          <Button variant="outline" className="gap-2 border-border/80" onClick={dj.resetMix}>
            <RotateCcw className="h-4 w-4" />
            Resetează mixajul
          </Button>
        }
      />

      <TutorialChecklist />

      <p className="flex items-start gap-2 rounded-2xl border border-warning/25 bg-warning/[0.06] p-4 text-xs leading-relaxed text-muted-foreground">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        „Resetează mixajul” readuce EQ, tempo, volumele și crossfaderul la valorile inițiale, dar
        nu șterge piesele din bibliotecă.
      </p>

      <Surface className="p-6">
        <SurfaceHead icon={BookOpen} title="Termeni DJ, pe scurt" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {GLOSSARY.map((g) => (
            <div key={g.term} className="rounded-xl border border-border/50 bg-background/30 p-3">
              <p className="font-heading text-xs font-semibold text-primary">{g.term}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{g.text}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  );
}