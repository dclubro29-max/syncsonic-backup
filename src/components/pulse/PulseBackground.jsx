import React, { useEffect, useRef } from "react";
import { useDj } from "@/lib/djContext";
import { useSkin } from "@/lib/SkinContext";
import { useReduceMotion } from "@/hooks/useReduceMotion";

/**
 * Pulse citește doar nivelul mixului master. Nu creează noduri audio și nu
 * modifică sunetul; fără semnal sau cu mișcare redusă rămâne un fundal calm.
 */
export default function PulseBackground() {
  const { skin, pulseMode } = useSkin();
  const dj = useDj();
  const [reduced] = useReduceMotion();
  const djRef = useRef(dj);
  djRef.current = dj;
  const rootRef = useRef(null);

  useEffect(() => {
    if (skin !== "pulse") return undefined;
    const root = rootRef.current;
    if (!root) return undefined;
    root.dataset.motion = pulseMode;
    root.dataset.reduced = reduced ? "true" : "false";
    if (pulseMode === "off") {
      root.style.setProperty("--pulse-level", "0");
      root.style.setProperty("--pulse-wave", "0");
      return undefined;
    }

    let raf = 0;
    let last = 0;
    let smooth = 0;
    let wave = 0;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < 80) return;
      last = now;
      const engine = djRef.current;
      if (engine.stabilityMode) {
        root.style.setProperty("--pulse-level", "0");
        root.dataset.stability = "true";
        return;
      }
      root.dataset.stability = "false";
      const meter = engine.getMasterMeter?.();
      const raw = Math.max(0, Math.min(1, meter?.level ?? 0));
      const next = smooth * 0.72 + raw * 0.28;
      const jump = next - smooth;
      smooth = next;
      wave = Math.max(0, wave - 0.07);
      if (pulseMode === "normal" && !reduced && jump > 0.1) wave = 1;
      const level = reduced || pulseMode === "reduced" ? smooth * 0.38 : smooth;
      root.style.setProperty("--pulse-level", level.toFixed(3));
      root.style.setProperty("--pulse-wave", wave.toFixed(3));
      const a = engine.decks[0]?.isPlaying ? 1 - engine.crossfade : 0;
      const b = engine.decks[1]?.isPlaying ? engine.crossfade : 0;
      root.style.setProperty("--pulse-a", a.toFixed(2));
      root.style.setProperty("--pulse-b", b.toFixed(2));
      root.dataset.paused = engine.decks.some((deck) => deck.isPlaying) || engine.autoDj?.on ? "false" : "true";
    };

    raf = requestAnimationFrame(tick);
    const onVisibility = () => {
      root.dataset.hidden = document.hidden ? "true" : "false";
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [skin, pulseMode, reduced]);

  if (skin !== "pulse") return null;

  return (
    <div ref={rootRef} className="pulse-background" aria-hidden="true">
      <div className="pulse-layer pulse-layer-a" />
      <div className="pulse-layer pulse-layer-b" />
      <div className="pulse-ring" />
      <div className="pulse-grain" />
    </div>
  );
}