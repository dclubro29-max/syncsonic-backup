import { useState, useCallback, useRef, useEffect } from "react";
import { getPads, savePad, clearPad } from "@/lib/padStore";
import { decodeAudioFromUrl } from "@/lib/audioAnalysis";

export const PAD_COUNT = 8;

/**
 * Sampler cu 8 paduri. Fiecare pad are un fișier audio propriu, redat prin
 * magistrala master (deci trece prin limiter și ajunge pe toate boxele selectate).
 * Padurile sunt salvate local, pe acest device.
 */
export function useSampler(dj) {
  const [pads, setPads] = useState(() => Array.from({ length: PAD_COUNT }, () => null));
  const [samplerError, setSamplerError] = useState(null);
  const [activePad, setActivePad] = useState(null);
  const buffersRef = useRef(new Array(PAD_COUNT).fill(null));
  const sourcesRef = useRef(new Set());
  const djRef = useRef(dj);
  djRef.current = dj;

  useEffect(() => {
    let cancelled = false;
    getPads()
      .then((stored) => {
        if (cancelled) return;
        setPads((prev) => {
          const next = [...prev];
          stored.forEach((r) => {
            if (r.index >= 0 && r.index < PAD_COUNT) {
              next[r.index] = { name: r.name, size: r.size, blob: r.blob };
            }
          });
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const sources = sourcesRef.current;
    return () => {
      sources.forEach((s) => {
        try {
          s.stop();
        } catch (e) {
          /* ignore */
        }
      });
      sources.clear();
    };
  }, []);

  const triggerPad = useCallback(async (index) => {
    if (djRef.current.isStabilityMode?.()) return;
    const pad = pads[index];
    if (!pad) return;
    try {
      const ctx = await djRef.current.ensureAudio();
      if (djRef.current.isStabilityMode?.()) return;
      const masterIn = djRef.current.getMasterInput();
      if (!ctx || !masterIn) return;

      let buf = buffersRef.current[index];
      if (!buf) {
        const url = URL.createObjectURL(pad.blob);
        try {
          buf = await decodeAudioFromUrl(url, ctx);
        } finally {
          URL.revokeObjectURL(url);
        }
        buffersRef.current[index] = buf;
      }

      if (djRef.current.isStabilityMode?.()) return;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(g);
      g.connect(masterIn);
      src.onended = () => {
        sourcesRef.current.delete(src);
        try {
          g.disconnect();
        } catch (e) {
          /* ignore */
        }
      };
      sourcesRef.current.add(src);
      src.start();
      setActivePad(index);
      setTimeout(() => setActivePad((p) => (p === index ? null : p)), 160);
      setSamplerError(null);
    } catch (e) {
      setSamplerError("Pad-ul nu a putut fi redat. Formatul poate să nu fie suportat.");
    }
  }, [pads]);

  const assignPad = useCallback(async (index, file) => {
    try {
      const rec = await savePad(index, file);
      buffersRef.current[index] = null;
      setPads((prev) => {
        const next = [...prev];
        next[index] = { name: rec.name, size: rec.size, blob: rec.blob };
        return next;
      });
      setSamplerError(null);
    } catch (e) {
      setSamplerError("Pad-ul nu a putut fi salvat. Poate lipsi spațiul de stocare.");
    }
  }, []);

  const removePad = useCallback(async (index) => {
    buffersRef.current[index] = null;
    setPads((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    await clearPad(index);
  }, []);

  const stopPads = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch (e) {
        /* ignore */
      }
    });
    sourcesRef.current.clear();
  }, []);

  return { pads, activePad, samplerError, triggerPad, assignPad, removePad, stopPads };
}