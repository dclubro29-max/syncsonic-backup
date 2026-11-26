import { useEffect } from 'react';
import { pushAudioEvent } from '@/lib/audioDiagnostics';

const LABELS = ['A', 'B', 'C', 'D'];

/** Jurnal de schimbări: motor, filă, transport. Fără eșantionare periodică. */
export default function useAudioDiagnostics({ engineContext, decksRef }) {
  useEffect(() => {
    if (!engineContext) return;
    const onState = () => pushAudioEvent('context', `Motor audio: ${engineContext.state}`);
    engineContext.addEventListener('statechange', onState);
    return () => engineContext.removeEventListener('statechange', onState);
  }, [engineContext]);

  useEffect(() => {
    const onVisibility = () => pushAudioEvent('visibility', document.hidden
      ? 'Pagina a trecut în fundal' : 'Pagina a revenit în prim-plan');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!engineContext) return;
    const types = ['waiting', 'stalled', 'error', 'ended'];
    const last = new Map();
    const unbind = decksRef.current.map((node, index) => {
      const onEvent = (event) => {
        const key = `${index}:${event.type}`;
        const now = Date.now();
        if (now - (last.get(key) || 0) < 2000) return;
        last.set(key, now);
        const label = LABELS[index] || String(index + 1);
        if (event.type === 'waiting') pushAudioEvent('waiting', `Deck ${label}: așteaptă date`);
        else if (event.type === 'stalled') pushAudioEvent('stalled', `Deck ${label}: flux blocat`);
        else if (event.type === 'error') pushAudioEvent('error', `Deck ${label}: fișierul nu poate fi redat`);
        else pushAudioEvent('context', `Deck ${label}: piesa s-a încheiat`);
      };
      types.forEach((type) => node.audio.addEventListener(type, onEvent));
      return () => types.forEach((type) => node.audio.removeEventListener(type, onEvent));
    });
    return () => unbind.forEach((release) => release());
  }, [engineContext, decksRef]);
}