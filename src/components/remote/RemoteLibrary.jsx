import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseTrackName } from "@/lib/trackName";
import { ChevronDown, Clock, Mic, Music, Plus, Search, Zap } from "lucide-react";

const STYLES = [
  { id: "dj", label: "DJ", hint: "beatmatch când se poate" },
  { id: "smooth", label: "Lină", hint: "fade mai lung" },
  { id: "quick", label: "Rapidă", hint: "intrare scurtă" },
];

const searchText = (value) => value.normalize("NFD").replace(/\p{M}/gu, "")
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Biblioteca gazdei: caută, mixează imediat sau adaugă la coadă. */
export default function RemoteLibrary({ device, large, onMixNow, onQueue, onPick }) {
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("dj");
  const [listening, setListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const recognition = useRef(null);
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  useEffect(() => {
    setListening(false);
    setVoiceMessage("");
    return () => {
      const active = recognition.current;
      recognition.current = null;
      active?.abort();
    };
  }, [device?.device_id]);

  const listen = () => {
    if (!Recognition || !device?.tracks?.length || recognition.current) return;
    const active = new Recognition();
    recognition.current = active;
    active.lang = "ro-RO";
    active.onresult = (event) => {
      if (recognition.current !== active) return;
      const transcript = event.results[0]?.[0]?.transcript || "";
      const titleText = searchText(transcript).replace(/^(pune|reda|play)\s+/, "").replace(/^piesa\s+/, "");
      if (!titleText) return;
      setQuery(titleText);
      const exact = device.tracks.filter((track) => {
        const { artist, title } = parseTrackName(track.name || "");
        return [title, `${title} ${artist}`, `${artist} ${title}`].some((name) => searchText(name) === titleText);
      });
      if (exact.length === 1) {
        setVoiceMessage("Trimit piesa la gazdă.");
        onMixNow(exact[0], style);
      } else {
        setVoiceMessage("Alege piesa din rezultate.");
      }
    };
    active.onerror = () => {
      if (recognition.current === active) setVoiceMessage("Nu am putut folosi microfonul. Poți căuta după titlu.");
    };
    active.onend = () => {
      if (recognition.current !== active) return;
      recognition.current = null;
      setListening(false);
    };
    try {
      active.start();
      setListening(true);
      setVoiceMessage("Spune «Pune» și titlul piesei.");
    } catch {
      recognition.current = null;
      setVoiceMessage("Microfonul nu este disponibil.");
    }
  };
  const currentId = device?.now_playing?.track_id || null;
  const nextId = device?.queue?.[0]?.id || null;
  const styleLabel = STYLES.find((item) => item.id === style)?.label || "DJ";

  const tracks = useMemo(() => {
    const list = device?.tracks || [];
    const q = searchText(query);
    if (!q) return list;
    return list.filter((track) => {
      const { artist, title } = parseTrackName(track.name || "");
      return searchText(`${title} ${artist} ${track.name || ""}`).includes(q);
    });
  }, [device, query]);

  return (
    <section className={`panel flex min-h-0 flex-col ${large ? "p-5" : "p-4 sm:p-5"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="caps">Bibliotecă</p>
          <p className={`mt-1 text-muted-foreground ${large ? "text-sm" : "text-[12px]"}`}>
            {device?.label ? `Piesele de pe ${device.label}` : "Alege întâi un dispozitiv."}
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-72">
          <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută titlu sau artist…"
            className={`pl-9 ${large ? "h-12 text-base" : "h-10 text-sm"}`}
            aria-label="Caută în biblioteca gazdei"
          />
          </div>
          {Recognition && (
            <Button type="button" size="icon" variant="outline" onClick={listen}
              className={large ? "h-12 w-12 shrink-0" : "shrink-0"}
              disabled={listening || !device?.tracks?.length} aria-label="Alege o piesă folosind microfonul"
              title="Recunoaștere vocală prin browser">
              <Mic className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {voiceMessage && <p role="status" className="mt-2 text-xs text-muted-foreground">{voiceMessage}</p>}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Stil „Mixează acum”</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 border-border/80">
              <Zap className="h-3.5 w-3.5" />
              {styleLabel}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Cum intră piesa nouă
            </DropdownMenuLabel>
            {STYLES.map((item) => (
              <DropdownMenuItem key={item.id} onSelect={() => setStyle(item.id)} className="gap-2">
                <Zap className={`h-3.5 w-3.5 ${item.id === style ? "text-primary" : "text-muted-foreground"}`} />
                <span className="flex-1">
                  <span className="block text-sm">{item.label}</span>
                  <span className="block text-[10px] text-muted-foreground">{item.hint}</span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={`mt-3 space-y-1.5 overflow-y-auto pr-1 ${large ? "max-h-[52vh]" : "max-h-[46vh]"}`}>
        {tracks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12px] text-muted-foreground">
            {device ? "Biblioteca dispozitivului este goală sau căutarea nu găsește nimic." : "Alege întâi un dispozitiv."}
          </p>
        ) : (
          tracks.map((track) => {
            const { artist, title } = parseTrackName(track.name || "");
            const current = track.id === currentId;
            const next = track.id === nextId;
            return (
              <div
                key={track.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  current
                    ? "border-primary/45 bg-primary/[0.07]"
                    : next
                      ? "border-warning/35 bg-warning/[0.05]"
                      : "border-border/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Music className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${large ? "text-base" : "text-sm"}`}>{title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {current ? "Se aude acum" : next ? "Urmează" : artist || "Pe acest dispozitiv"}
                    </p>
                  </div>
                </div>
                <div className={`mt-2 flex flex-wrap gap-1.5 ${large ? "" : "sm:flex-nowrap"}`}>
                  <Button
                    size="sm"
                    className={`gap-1.5 ${large ? "h-12 flex-1 text-base" : "h-9 flex-1"}`}
                    onClick={() => onMixNow(track, style)}
                    disabled={current}
                  >
                    <Zap className="h-4 w-4" />
                    Mixează acum
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-1.5 border-border/80 ${large ? "h-12 flex-1 text-base" : "h-9 flex-1"}`}
                    onClick={() => onQueue(track)}
                    disabled={next}
                  >
                    <Plus className="h-4 w-4" />
                    Adaugă la coadă
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`shrink-0 ${large ? "h-12 w-12" : "h-9 w-9"}`}
                    onClick={() => onPick(track)}
                    aria-label={`Programează ${title}`}
                    title="Programează"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
