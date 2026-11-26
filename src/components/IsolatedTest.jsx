import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDj } from "@/lib/djContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Headphones, MonitorSpeaker, Play, Square, Info } from "lucide-react";
import { SYSTEM_DEFAULT_ID, isCommunicationsOutput } from "@/lib/outputs";

/**
 * Test izolat: o singură ieșire activă, aceeași piesă, tempo original, EQ neutru,
 * efecte oprite, delay 0 ms. Comparația comută între ieșirea selectată și ieșirea
 * implicită a sistemului — niciodată simultan.
 */
export default function IsolatedTest() {
  const dj = useDj();
  const deckIndex = dj.decks.findIndex((d) => d.track);
  const track = deckIndex >= 0 ? dj.decks[deckIndex].track : null;

  const outputs = useMemo(() => dj.speakers.filter((s) => !s.systemDefault), [dj.speakers]);
  const preferred = useMemo(
    () => outputs.find((s) => !isCommunicationsOutput(s.label)) || outputs[0],
    [outputs]
  );

  const [targetId, setTargetId] = useState(null);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!targetId && preferred) setTargetId(preferred.deviceId);
  }, [preferred, targetId]);

  const activeRef = useRef(false);
  const stopRef = useRef(dj.stopIsolatedAudition);
  useEffect(() => {
    stopRef.current = dj.stopIsolatedAudition;
  });
  useEffect(
    () => () => {
      if (activeRef.current) stopRef.current();
    },
    []
  );

  const play = async (id) => {
    if (!id) return;
    await dj.startIsolatedAudition(id);
    activeRef.current = true;
    setCurrent(id);
    if (deckIndex >= 0 && !dj.decks[deckIndex].isPlaying) await dj.togglePlay(deckIndex);
  };

  const stop = async () => {
    dj.stopIsolatedAudition();
    activeRef.current = false;
    setCurrent(null);
    if (deckIndex >= 0 && dj.decks[deckIndex].isPlaying) await dj.togglePlay(deckIndex);
  };

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="p-7 pb-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="font-heading text-lg">Test izolat, o singură boxă</CardTitle>
            <CardDescription className="text-xs">
              Aceeași piesă, tempo original, EQ neutru, efecte oprite, delay 0 ms, fără alte ieșiri
              active
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-7 pt-0">
        {!track && (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Încarcă o piesă pe un deck ca să poți compara ieșirile.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ieșire testată
          </Label>
          <Select value={targetId || ""} onValueChange={setTargetId} disabled={!outputs.length}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Alege ieșirea" />
            </SelectTrigger>
            <SelectContent>
              {outputs.map((s) => (
                <SelectItem key={s.deviceId} value={s.deviceId}>
                  {s.label}
                  {isCommunicationsOutput(s.label) ? " — posibil pentru apeluri" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button className="gap-2" onClick={() => play(targetId)} disabled={!track || !targetId}>
            <Play className="h-4 w-4" />
            Ascultă ieșirea selectată
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => play(SYSTEM_DEFAULT_ID)}
            disabled={!track}
          >
            <MonitorSpeaker className="h-4 w-4" />
            Ascultă ieșirea implicită
          </Button>
          <Button variant="ghost" className="gap-2" onClick={stop} disabled={!current}>
            <Square className="h-4 w-4" />
            Oprește testul
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {current === SYSTEM_DEFAULT_ID
            ? "Acum rulează ieșirea implicită a sistemului. Apasă cealaltă ieșire pentru comparație — se comută, nu se suprapun."
            : current
              ? "Acum rulează ieșirea selectată. Apasă „Ascultă ieșirea implicită” pentru comparație — se comută, nu se suprapun."
              : "Niciun test activ. Redarea obișnuită rămâne pe boxele selectate mai sus."}
        </p>
      </CardContent>
    </Card>
  );
}