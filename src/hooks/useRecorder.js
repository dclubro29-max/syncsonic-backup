import { useCallback, useEffect, useRef, useState } from "react";
import { saveRecording } from "@/lib/recordingStore";

const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return PREFERRED.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

export function isRecordingSupported() {
  return typeof MediaRecorder !== "undefined" && !!pickMime();
}

export function useRecorder(dj) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);

  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const timerRef = useRef(null);

  const start = useCallback(async () => {
    if (dj.isStabilityMode?.()) return;
    setError(null);
    if (!isRecordingSupported()) {
      setError("Browserul tău nu permite înregistrarea audio. Folosește Chrome sau Edge.");
      return;
    }
    try {
      const stream = await dj.getRecordStream();
      if (dj.isStabilityMode?.()) return;
      if (!stream) {
        setError("Motorul audio nu este pornit. Încarcă o piesă mai întâi.");
        return;
      }
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const duration = (Date.now() - startedRef.current) / 1000;
        try {
          const saved = await saveRecording({
            name: `Mix ${new Date().toLocaleString("ro-RO")}`,
            blob,
            mimeType: type,
            duration,
          });
          setLastSaved(saved);
        } catch (e) {
          setError("Înregistrarea nu a putut fi salvată local.");
        }
      };
      rec.start(1000);
      recRef.current = rec;
      startedRef.current = Date.now();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((Date.now() - startedRef.current) / 1000), 500);
    } catch (e) {
      setError("Browserul nu a permis pornirea înregistrării.");
    }
  }, [dj]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch (e) {
        /* ignore */
      }
    }
    recRef.current = null;
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    []
  );

  return { isRecording, elapsed, error, lastSaved, start, stop };
}