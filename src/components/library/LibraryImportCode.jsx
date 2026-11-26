import React, { useEffect, useRef, useState } from "react";
import { useDj } from "@/lib/djContext";
import { startReceiver } from "@/lib/localTransfer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TransferProgress from '@/components/library/TransferProgress';
import { Wifi } from "lucide-react";

const LABEL = {
  finding: "Caut codul…",
  connecting: "M-am conectat. Se pregătește trimiterea…",
  receiving: "Se primesc piesele direct…",
  saving: "Salvez piesa primită în biblioteca locală…",
  done: "Gata — piesele sunt în bibliotecă.",
};

/** Aduce pe acest dispozitiv piesele trimise sub un cod. */
export default function LibraryImportCode() {
  const dj = useDj();
  const [entry, setEntry] = useState("");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const handleRef = useRef(null);
  const sessionRef = useRef(0);

  useEffect(() => () => { sessionRef.current++; handleRef.current?.cancel(); }, []);

  const bring = async (raw) => {
    const value = (raw ?? entry).trim().toUpperCase();
    if (!value) return;
    const session = ++sessionRef.current;
    handleRef.current?.cancel();
    setError(''); setMessage(''); setProgress(null); setPhase('finding');
    try {
      const handle = await startReceiver({ code: value,
        onState: (state) => {
          if (session !== sessionRef.current) return;
          if (state.phase === 'error') setError(state.message || 'Transferul nu a reușit.');
          if (state.progress) setProgress(state.progress);
          if (state.phase === 'done') { setEntry(''); setMessage(`${state.progress.total} piese salvate în bibliotecă.`); }
          setPhase(state.phase);
        },
        onFiles: async (files, options) => {
          if (session !== sessionRef.current) throw new Error('Transfer anulat.');
          const added = await dj.addFiles(files, options);
          if (added.length !== files.length) throw new Error('Format audio neacceptat; piesa nu a fost salvată.');
        },
      });
      if (session !== sessionRef.current) handle.cancel();
      else handleRef.current = handle;
    } catch (error) {
      if (session === sessionRef.current) { setError(error.message || 'Transferul nu poate porni.'); setPhase('error'); }
    }
  };

  const stop = async () => {
    sessionRef.current++;
    await handleRef.current?.cancel();
    handleRef.current = null;
    setPhase("idle");
    setProgress(null);
  };

  const active = !['idle', 'error', 'done'].includes(phase);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ai un cod de la celălalt dispozitiv? Introdu-l aici, cu transferul pornit pe celălalt
        dispozitiv și ambele în același Wi-Fi. Piesele vin direct, fără descărcare din cloud.
      </p>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          bring();
        }}
      >
        <Input
          value={entry}
          onChange={(event) => setEntry(event.target.value.toUpperCase())}
          placeholder="COD"
          maxLength={8}
          className="w-[160px] font-mono tracking-[0.25em]"
          disabled={active}
        />
        {active ? (
          <Button type="button" variant="ghost" className="gap-2" onClick={stop}>
            Renunță
          </Button>
        ) : (
          <Button type="submit" variant="outline" className="gap-2" disabled={!entry.trim()}>
            <Wifi className="h-4 w-4" />
            Adu piesele
          </Button>
        )}
      </form>

      {active && <p className="text-xs text-muted-foreground">{LABEL[phase]}</p>}

      <TransferProgress progress={progress} />

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}