import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  PULSE_MODES,
  SKINS,
  hasStoredSkin,
  readPulseMode,
  readSkin,
  storePulseMode,
  storeSkin,
} from "@/lib/appearance";

const SkinContext = createContext(null);

/** O singură structură de interfață, patru skinuri și preferința Pulse. */
export function SkinProvider({ children }) {
  const [skin, setSkinState] = useState(readSkin);
  const [pulseMode, setPulseModeState] = useState(readPulseMode);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.skin = skin;
    root.classList.toggle("dark", skin !== "daylight");
  }, [skin]);

  // Skinul ales pe alt dispozitiv se aplică doar dacă acest device nu are deja o alegere.
  useEffect(() => {
    if (hasStoredSkin()) return;
    let cancelled = false;
    base44.auth
      .me()
      .then((user) => {
        if (cancelled || !SKINS.some((item) => item.id === user?.skin)) return;
        setSkinState(user.skin);
        storeSkin(user.skin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setSkin = useCallback((id) => {
    if (!SKINS.some((item) => item.id === id)) return;
    setSkinState(id);
    storeSkin(id);
    base44.auth.updateMe({ skin: id }).catch(() => {});
  }, []);

  const setPulseMode = useCallback((id) => {
    if (!PULSE_MODES.some((item) => item.id === id)) return;
    setPulseModeState(id);
    storePulseMode(id);
  }, []);

  return (
    <SkinContext.Provider value={{ skins: SKINS, skin, setSkin, pulseMode, setPulseMode }}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin trebuie folosit în interiorul SkinProvider");
  return ctx;
}