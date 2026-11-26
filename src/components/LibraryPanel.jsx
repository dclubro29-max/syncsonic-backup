import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music, Trash2, Upload, HardDrive } from "lucide-react";
import { formatSize } from "@/lib/trackStore";

export default function LibraryPanel({ tracks, onAdd, onRemove, onLoadToDeck, hasSpeakers }) {
  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-xl">
      <CardHeader className="p-7 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Music className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-heading text-lg">Bibliotecă</CardTitle>
              <CardDescription className="text-xs">
                {tracks.length} piese salvate local
              </CardDescription>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" disabled={!hasSpeakers}>
            <label className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              Adaugă
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }}
              />
            </label>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-7 pt-0">
        {tracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Adaugă fișiere audio (MP3, FLAC, WAV…). Sunt ținute minte pe acest
            device și pot fi redate oricând, de câte ori vrei.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tracks.map((t) => (
              <div
                key={t.id}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-background/40 p-5 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatSize(t.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-xs font-bold text-primary"
                    onClick={() => onLoadToDeck(0, t)}
                  >
                    Încarcă A
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 flex-1 text-xs font-bold text-chart-4"
                    onClick={() => onLoadToDeck(1, t)}
                  >
                    Încarcă B
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemove(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tracks.length > 0 && (
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            Stocate local în browser · nu părăsesc device-ul
          </div>
        )}
      </CardContent>
    </Card>
  );
}