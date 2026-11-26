import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDj } from "@/lib/djContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Upload,
  Trash2,
  Star,
  Music,
  HardDrive,
  FolderUp,
  Library as LibraryIcon,
  Disc3,
  ListPlus,
  MoreVertical,
  Play,
} from "lucide-react";
import { formatSize } from "@/lib/trackStore";
import { DECK_LABELS } from "@/hooks/useDjEngine";
import LibraryTransfer from "@/components/LibraryTransfer";
import PageHeader from "@/components/ui-kit/PageHeader";
import StateBlock from "@/components/ui-kit/StateBlock";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlaylistsView from "@/components/library/PlaylistsView";
import { useRepeatGuard } from "@/components/mixer/RepeatLockProvider";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Library() {
  const dj = useDj();
  const guard = useRepeatGuard();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("added");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [view, setView] = useState("tracks");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = dj.tracks.filter((t) => t.name.toLowerCase().includes(q));
    if (onlyFavorites) list = list.filter((t) => t.favorite);
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ro"));
    else if (sort === "size") sorted.sort((a, b) => b.size - a.size);
    else sorted.sort((a, b) => b.addedAt - a.addedAt);
    return sorted;
  }, [dj.tracks, query, sort, onlyFavorites]);

  const totalSize = dj.tracks.reduce((s, t) => s + (t.size || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Colecția ta"
        title="Bibliotecă"
        icon={LibraryIcon}
        description={`${dj.tracks.length} piese · ${formatSize(totalSize)} · stocate local pe acest device`}
        actions={
          <>
            <Button asChild className="gap-2">
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                Adaugă piese
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    dj.addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
            <Button asChild variant="outline" className="gap-2 border-border/80">
              <label className="cursor-pointer">
                <FolderUp className="h-4 w-4" />
                Adaugă folder
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  webkitdirectory=""
                  className="hidden"
                  onChange={(e) => {
                    dj.addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
            <Button asChild variant="outline" className="gap-2 border-border/80">
              <Link to="/mixes"><Disc3 className="h-4 w-4" /> Mixuri</Link>
            </Button>
          </>
        }
      />

      <LibraryTransfer />

      <Tabs value={view} onValueChange={setView} className="space-y-4">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="tracks">Piese</TabsTrigger>
          <TabsTrigger value="playlists">Playlisturi</TabsTrigger>
        </TabsList>

        <TabsContent value="tracks" className="mt-4 space-y-6">
      <div className="panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Caută după titlu…"
            aria-label="Caută piese"
            className="h-11 border-border/70 bg-surface-inset/60 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-11 w-full border-border/70 bg-surface-inset/60 sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="added">Cele mai recente</SelectItem>
              <SelectItem value="name">Titlu (A–Z)</SelectItem>
              <SelectItem value="size">Dimensiune</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={onlyFavorites ? "default" : "outline"}
            className={`h-11 gap-2 ${onlyFavorites ? "" : "border-border/80"}`}
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-pressed={onlyFavorites}
          >
            <Star className={`h-4 w-4 ${onlyFavorites ? "fill-current" : ""}`} />
            Favorite
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <StateBlock
          icon={Music}
          title={dj.tracks.length === 0 ? "Biblioteca este goală" : "Nicio piesă pentru filtrele alese"}
          description={
            dj.tracks.length === 0
              ? "Trage fișiere audio aici sau folosește butoanele de mai sus (MP3, WAV, FLAC, OGG) — rămân pe acest device."
              : "Schimbă căutarea sau oprește filtrul de favorite."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => (
            <article key={t.id} className="panel group p-4 transition-colors hover:border-border">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface-raised text-primary">
                  <Music className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {formatSize(t.size)}
                  </p>
                </div>
                {t.favorite ? (
                  <Star className="h-4 w-4 shrink-0 fill-current text-warning" aria-label="Favorit" />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="chip border-success/30 text-success">
                  <HardDrive className="h-3 w-3" />
                  local
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 gap-1.5 border-border/70"
                      aria-label={`Acțiuni pentru ${t.name}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                      Acțiuni
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate text-xs">{t.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => guard.guardDeck(0, async () => {
                        await dj.loadToDeck(0, t);
                        await dj.togglePlay(0);
                      })}
                      className="gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Redă
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        dj.enqueueTrack(t);
                        toast({ title: "Adăugat în coadă", description: t.name });
                      }}
                      className="gap-2"
                    >
                      <ListPlus className="h-4 w-4" />
                      Adaugă la coadă
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {(dj.advanced ? [0, 1, 2, 3] : [0, 1]).map((i) => (
                      <DropdownMenuItem
                        key={i}
                        onSelect={() => guard.guardDeck(i, () => dj.loadToDeck(i, t))}
                        className="gap-2"
                      >
                        <Disc3 className="h-4 w-4" />
                        Încarcă în Mixer {DECK_LABELS[i]}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => dj.toggleFavorite(t.id)} className="gap-2">
                      <Star className={`h-4 w-4 ${t.favorite ? "fill-current text-warning" : ""}`} />
                      {t.favorite ? "Scoate din favorite" : "Adaugă la favorite"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        if (window.confirm(`Ștergi „${t.name}" din bibliotecă?`)) {
                          dj.removeTrackById(t.id);
                        }
                      }}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Șterge
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <HardDrive className="h-3 w-3" />
        Fișierele rămân local în browser; se urcă doar când generezi un cod de bibliotecă.
      </p>
        </TabsContent>

        <TabsContent value="playlists" className="mt-4">
          <PlaylistsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}