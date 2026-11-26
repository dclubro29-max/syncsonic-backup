import React, { useRef, useState } from "react";
import { Film, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const VIDEO_NAME = /\.(mp4|m4v|webm|mov|mkv|ogv)$/i;

/** Alege filmul din dispozitiv: buton sau tragere. Fișierul nu părăsește telefonul. */
export default function MovieSource({ onPick }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const accept = (file) => {
    if (!file) return;
    if (!file.type.startsWith("video/") && !VIDEO_NAME.test(file.name)) {
      setError("Alege un fișier video (MP4, WebM, MOV).");
      return;
    }
    setError(null);
    onPick({ url: URL.createObjectURL(file), name: file.name, size: file.size });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-primary/70 bg-primary/5" : "border-border"
        }`}
      >
        <Film className="h-8 w-8 text-primary" />
        <div>
          <p className="font-heading text-sm font-semibold">Trage filmul aici</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, WebM, MOV — filmul rămâne pe dispozitiv, nu se urcă nicăieri.
          </p>
        </div>
        <Button type="button" onClick={() => inputRef.current?.click()} className="mt-1">
          <Upload className="h-4 w-4" /> Alege filmul
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}