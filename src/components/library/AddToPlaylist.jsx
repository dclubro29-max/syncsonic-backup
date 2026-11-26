import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ListPlus, Plus } from "lucide-react";
import { addTrackToPlaylist, createPlaylist, readPlaylists } from "@/lib/playlistStore";

/** Buton pe fiecare piesă: o adaugă într-un playlist existent sau într-unul nou. */
export default function AddToPlaylist({ trackId, trackName }) {
  const [playlists, setPlaylists] = useState([]);

  const createNew = () => {
    const name = window.prompt(`Numele playlistului pentru „${trackName}":`, "Playlist nou");
    if (!name) return;
    const list = createPlaylist(name);
    const created = list[list.length - 1];
    if (created) addTrackToPlaylist(created.id, trackId);
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && setPlaylists(readPlaylists())}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={`Adaugă ${trackName} în playlist`}
          title="Adaugă în playlist"
        >
          <ListPlus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {playlists.length === 0 ? (
          <DropdownMenuItem disabled>Niciun playlist încă</DropdownMenuItem>
        ) : (
          playlists.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => addTrackToPlaylist(p.id, trackId)}>
              <span className="truncate">{p.name}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                {p.trackIds.length}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={createNew}>
          <Plus className="mr-2 h-3.5 w-3.5" />
          Playlist nou…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}