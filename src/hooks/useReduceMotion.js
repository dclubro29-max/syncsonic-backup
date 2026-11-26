import { useCallback, useState } from "react";

const KEY = "musicsync.reduceMotion";

/** Citește preferința: alegerea din aplicație sau setarea sistemului. */
export function readReduceMotion() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "1") return true;
    if (saved === "0") return false;
  } catch (e) {
    /* fără localStorage — folosim setarea sistemului */
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

/** Mod cu animații reduse, pentru dispozitive mai slabe sau ecrane obositoare. */
export function useReduceMotion() {
  const [reduced, setReduced] = useState(readReduceMotion);

  const set = useCallback((value) => {
    setReduced(value);
    try {
      localStorage.setItem(KEY, value ? "1" : "0");
    } catch (e) {
      /* ignore */
    }
  }, []);

  return [reduced, set];
}