import React, { useEffect, useState } from "react";
import { useDj } from "@/lib/djContext";
import { Upload } from "lucide-react";

/**
 * Zonă de adăugare prin tragere: poți arunca fișiere audio oriunde în aplicație,
 * din explorer sau din telefon, fără să cauți un buton. Rămân local.
 */
export default function GlobalDropZone() {
  const { addFiles } = useDj();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

    const onEnter = (e) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setActive(true);
    };
    const onOver = (e) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onDrop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      addFiles(e.dataTransfer.files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [addFiles]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-6 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 px-10 py-8 text-center">
        <Upload className="h-8 w-8 text-primary" />
        <p className="font-heading text-sm font-semibold">Dă drumul la fișiere</p>
        <p className="text-xs text-muted-foreground">
          MP3, WAV, FLAC, OGG — intră direct în biblioteca locală.
        </p>
      </div>
    </div>
  );
}