import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StateBlock from "@/components/ui-kit/StateBlock";
import PlaylistEditor from "@/components/library/PlaylistEditor";
import { createPlaylist, readPlaylists } from "@/lib/playlistStore";
import { ListMusic, Plus } from "lucide-react";

/** Lista de playlisturi locale + editorul celui selectat. */
export default function PlaylistsView() {
  const [playlists, setPlaylists] = useState(readPlaylists);
  const [activeId, setActiveId] = useState(() => readPlaylists()[0]?.id ?? null);
  const [name, setName] = useState("");

  const active = playlists.find((p) => p.id === activeId) || null;

  const apply = (list, selectId) => {
    setPlaylists(list);
    if (selectId) setActiveId(selectId);
    else if (!list.some((p) => p.id === activeId)) setActiveId(list[0]?.id ?? null);
  };

  const create = () => {
    const list = createPlaylist(name);
    setName("");
    apply(list, list[list.length - 1]?.id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="panel h-fit space-y-3 p-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Playlist nou"
            aria-label="Nume playlist nou"
            className="h-10 border-border/70 bg-surface-inset/60"
          />
          <Button size="icon" className="h-10 w-10 shrink-0" onClick={create} aria-label="Creează playlist">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {playlists.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                p.id === activeId
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <ListMusic className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{p.trackIds.length}</span>
            </button>
          ))}
        </div>
      </aside>

      <div>
        {active ? (
          <PlaylistEditor
            key={active.id}
            playlist={active}
            onChanged={(list) => apply(list)}
          />
        ) : (
          <StateBlock
            icon={ListMusic}
            title="Niciun playlist încă"
            description="Creează un playlist, apoi adaugă piese din bibliotecă. Ordinea se schimbă prin tragere."
          />
        )}
      </div>
    </div>
  );
}