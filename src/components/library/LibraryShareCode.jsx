import React, { useEffect, useRef, useState } from "react";
import { useDj } from "@/lib/djContext";
import { getTracks, formatSize } from "@/lib/trackStore";
import { makePairCode, startSender } from "@/lib/localTransfer";
import { Button } from "@/components/ui/button";
import TransferProgress from '@/components/library/TransferProgress';
import { Wifi, Copy, Check, X } from "lucide-react";

const LABEL = {
  starting: "Pregătesc conexiunea…",
  waiting: "Aștept celălalt dispozitiv. Introdu codul acolo.",
  connecting: "Dispozitiv găsit. Se conectează…",
  sending: "Se trimit piesele direct…",
  saving: "Aștept confirmarea salvării pe celălalt dispozitiv…",
  done: "Gata — toate piesele au fost salvate pe celălalt dispozitiv.",
};

/** Dă biblioteca locală altui dispozitiv din aceeași rețea, printr-un cod. */
export default function LibraryShareCode() {
  const dj = useDj();
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const handleRef = useRef(null);
  const sessionRef = useRef(0);
  const totalSize = dj.tracks.reduce((sum, t) => sum + (t.size || 0), 0);

  useEffect(() => () => { sessionRef.current++; handleRef.current?.cancel(); }, []);

  const begin = async () => {
    const session = ++sessionRef.current;
    handleRef.current?.cancel();
    setError(''); setCopied(false); setProgress(null); setPhase('starting'); setCode('');
    try {
      const stored = await getTracks();
      if (session !== sessionRef.current) return;
      if (!stored.length) { setPhase('idle'); return; }
      const next = makePairCode();
      setCode(next);
      const handle = await startSender({ code: next, tracks: stored, onState: (state) => {
        if (session !== sessionRef.current) return;
        if (state.phase === 'error') setError(state.message || 'Transferul s-a oprit.');
        if (state.progress) setProgress(state.progress);
        setPhase(state.phase);
      } });
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
    setCode("");
    setPhase("idle");
    setProgress(null);
    setError("");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const active = !['idle', 'error', 'done'].includes(phase);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Pornește transferul aici și primești un cod. Introdu codul pe celălalt dispozitiv, ține
        ambele deschise în același Wi-Fi. Piesele merg direct între ele — fără urcare în cloud, deci
        fără credite de integrare. Dacă reiei transferul, piesele deja salvate nu se retrimit.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {!active && (
          <Button className="gap-2" onClick={begin} disabled={!dj.tracks.length}>
            <Wifi className="h-4 w-4" />
            Pornesc transferul
          </Button>
        )}
        {active && (
          <Button variant="ghost" className="gap-2" onClick={stop}>
            <X className="h-4 w-4" />
            Renunță
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {dj.tracks.length} piese · {formatSize(totalSize)}
        </span>
      </div>

      {code && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <span className="font-mono text-lg font-semibold tracking-[0.3em]">{code}</span>
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiat" : "Copiază codul"}
          </Button>
        </div>
      )}

      {active && <p className="text-xs text-muted-foreground">{LABEL[phase]}</p>}

      {phase === 'done' && <p className="text-xs text-primary">{LABEL.done}</p>}
      <TransferProgress progress={progress} />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}