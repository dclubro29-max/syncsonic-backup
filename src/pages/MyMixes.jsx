import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRecordings, renameRecording, removeRecording } from "@/lib/recordingStore";
import { formatSize } from "@/lib/trackStore";
import { Play, Pause, Download, Trash2, Pencil, Check, Disc3 } from "lucide-react";
import RecorderBar from "@/components/RecorderBar";
import PageHeader from "@/components/ui-kit/PageHeader";
import StateBlock from "@/components/ui-kit/StateBlock";

function fmtDur(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MyMixes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const audioRef = useRef(null);
  const urlRef = useRef(null);

  const load = useCallback(async () => {
    setItems(await getRecordings());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (audioRef.current) audioRef.current.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [load]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPlayingId(null);
  };

  const togglePlay = (item) => {
    if (playingId === item.id) {
      stopAudio();
      return;
    }
    stopAudio();
    const url = URL.createObjectURL(item.blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audio.onended = stopAudio;
    audio.play().catch(() => stopAudio());
    audioRef.current = audio;
    setPlayingId(item.id);
  };

  const download = (item) => {
    const ext = item.mimeType?.includes("webm") ? "webm" : item.mimeType?.includes("ogg") ? "ogg" : "m4a";
    const url = URL.createObjectURL(item.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.name}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveName = async (id) => {
    await renameRecording(id, editName.trim() || "Mix");
    setEditingId(null);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Arhiva"
        title="Mixurile mele"
        icon={Disc3}
        description="Înregistrările mixajului, salvate local pe acest device."
      />

      <RecorderBar />

      {loading ? (
        <StateBlock variant="loading" title="Se încarcă înregistrările…" />
      ) : items.length === 0 ? (
        <StateBlock
          icon={Disc3}
          title="Nicio înregistrare încă"
          description="Pornește „Înregistrează mixul”, mixează, apoi oprește — înregistrarea apare aici."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <article key={item.id} className="panel flex flex-wrap items-center gap-3 p-4">
              <Button
                size="icon"
                variant={playingId === item.id ? "default" : "outline"}
                className="h-11 w-11 shrink-0 rounded-full border-border/70"
                onClick={() => togglePlay(item)}
                aria-label={playingId === item.id ? `Pauză ${item.name}` : `Redă ${item.name}`}
              >
                {playingId === item.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <div className="min-w-[180px] flex-1">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-9 border-border/70 bg-surface-inset/60"
                      autoFocus
                    />
                    <Button size="icon" className="h-9 w-9" onClick={() => saveName(item.id)} aria-label="Salvează numele">
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="truncate text-sm font-medium">
                    <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.name}
                  </p>
                )}
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {fmtDur(item.duration)} · {formatSize(item.size)} · {item.mimeType}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground"
                  title="Redenumește"
                  aria-label="Redenumește"
                  onClick={() => {
                    setEditingId(item.id);
                    setEditName(item.name);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground"
                  title="Descarcă"
                  aria-label="Descarcă"
                  onClick={() => download(item)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Șterge"
                  aria-label="Șterge"
                  onClick={async () => {
                    if (window.confirm(`Ștergi „${item.name}"?`)) {
                      if (playingId === item.id) stopAudio();
                      await removeRecording(item.id);
                      load();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <Disc3 className="h-3 w-3" />
        Formatul este cel oferit de browser (de obicei WebM/Opus). Salvarea în cont necesită
        configurare de stocare cloud.
      </p>
    </div>
  );
}