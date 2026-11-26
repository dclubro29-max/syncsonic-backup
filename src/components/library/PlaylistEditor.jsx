import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useDj } from "@/lib/djContext";
import { useRepeatGuard } from "@/components/mixer/RepeatLockProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatSize } from "@/lib/trackStore";
import {
  addTrackToPlaylist,
  deletePlaylist,
  removeTrackFromPlaylist,
  renamePlaylist,
  reorderPlaylist,
} from "@/lib/playlistStore";
import { GripVertical, Music, Plus, Trash2, X } from "lucide-react";

/** Un playlist: redenumire, adăugare de piese, reordonare prin tragere, încărcare pe deck. */
export default function PlaylistEditor({ playlist, onChanged }) {
  const dj = useDj();
  const guard = useRepeatGuard();
  const [name, setName] = useState(playlist.name);
  const [picking, setPicking] = useState(false);

  const tracks = playlist.trackIds
    .map((id) => dj.tracks.find((t) => t.id === id))
    .filter(Boolean);
  const missing = dj.tracks.filter((t) => !playlist.trackIds.includes(t.id));

  const commitName = () => {
    if (name.trim() && name.trim() !== playlist.name) {
      onChanged(renamePlaylist(playlist.id, name));
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const ids = tracks.map((t) => t.id);
    const [moved] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, moved);
    onChanged(reorderPlaylist(playlist.id, ids));
  };

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          aria-label="Numele playlistului"
          className="h-10 min-w-[160px] flex-1 border-border/70 bg-surface-inset/60 font-medium"
        />
        <span className="chip">
          {tracks.length} {tracks.length === 1 ? "piesă" : "piese"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Șterge playlistul"
          aria-label="Șterge playlistul"
          onClick={() => {
            if (window.confirm(`Ștergi playlistul „${playlist.name}"?`)) {
              onChanged(deletePlaylist(playlist.id));
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {tracks.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
          Playlistul este gol. Adaugă piese din lista de mai jos.
        </p>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId={`playlist-${playlist.id}`}>
            {(drop) => (
              <div ref={drop.innerRef} {...drop.droppableProps} className="mt-3 space-y-1.5">
                {tracks.map((track, index) => (
                  <Draggable key={track.id} draggableId={track.id} index={index}>
                    {(item) => (
                      <div
                        ref={item.innerRef}
                        {...item.draggableProps}
                        className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/40 p-2"
                      >
                        <span
                          {...item.dragHandleProps}
                          className="cursor-grab px-1 text-muted-foreground"
                          aria-label="Reordonează"
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <span className="w-5 shrink-0 font-mono text-[10px] text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <Music className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-sm">{track.name}</span>
                        <span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
                          {formatSize(track.size)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-border/70 px-2 text-[10px] font-bold text-deck-a"
                          onClick={() => guard.guardDeck(0, () => dj.loadToDeck(0, track))}
                        >
                          A
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-border/70 px-2 text-[10px] font-bold text-deck-b"
                          onClick={() => guard.guardDeck(1, () => dj.loadToDeck(1, track))}
                        >
                          B
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Scoate ${track.name}`}
                          onClick={() => onChanged(removeTrackFromPlaylist(playlist.id, track.id))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {drop.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-border/80"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
        >
          <Plus className="h-3.5 w-3.5" />
          {picking ? "Închide lista" : "Adaugă piese"}
        </Button>

        {picking && (
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-1.5">
            {missing.length === 0 ? (
              <p className="p-2 text-xs text-muted-foreground">
                Toate piesele din bibliotecă sunt deja în playlist.
              </p>
            ) : (
              missing.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onChanged(addTrackToPlaylist(playlist.id, track.id))}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{track.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {formatSize(track.size)}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}