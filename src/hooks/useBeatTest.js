import { useCallback, useEffect, useRef, useState } from 'react';
import { startBeat } from '@/lib/beatTest';
import { pushAudioEvent } from '@/lib/audioDiagnostics';
import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';

/** Beat de test generat local, rutat prin lanțul real al fiecărei ieșiri. */
export default function useBeatTest({ resume, isCalibrating, postRef, defaultGainRef, outputsRef }) {
  const activeRef = useRef(null);
  const [beatTest, setBeatTest] = useState({ active: false, target: null });

  const stopTestBeat = useCallback(() => {
    activeRef.current?.stop?.();
    activeRef.current = null;
    setBeatTest({ active: false, target: null });
  }, []);

  const testBeat = useCallback(async (target = 'all') => {
    if (isCalibrating()) throw new Error('Oprește alinierea înainte de testul cu beat.');
    const ctx = await resume();
    if (isCalibrating()) return;
    stopTestBeat();
    let destination = null, level = 0.22, label = 'ieșirea aleasă';
    if (target === 'all') {
      destination = postRef.current;
      level = 0.16;
      label = 'toate boxele';
    } else if (target === SYSTEM_DEFAULT_ID) {
      const systemOutput = outputsRef.current.get(SYSTEM_DEFAULT_ID);
      // With separate outputs active the default path is muted, so test the
      // mixer's own hardware sink instead of a silent gain node.
      destination = systemOutput
        ? systemOutput.bandGain
        : (outputsRef.current.size ? ctx.destination : defaultGainRef.current);
      level = systemOutput || !outputsRef.current.size ? 0.24 : 0.18;
      label = 'ieșirea sistemului';
    } else {
      const output = outputsRef.current.get(target);
      if (!output) throw new Error('Ieșirea nu mai este disponibilă. Reîmprospătează lista de boxe.');
      // Intră în aceeași ramură ca muzica: filtru de bandă, întârziere și volum.
      destination = output.bandGain;
      level = 0.24;
      label = 'o ieșire selectată';
    }
    if (!destination) throw new Error('Nicio ieșire audio activă pentru test.');
    const handle = await startBeat(ctx, destination, { level });
    if (ctx.state !== 'running') {
      handle.stop();
      throw new Error('Sunetul nu a pornit. Apasă din nou, într-o filă activă.');
    }
    activeRef.current = handle;
    setBeatTest({ active: true, target });
    pushAudioEvent('beat', `Beat de test trimis către ${label}`);
  }, [resume, isCalibrating, stopTestBeat, postRef, defaultGainRef, outputsRef]);

  useEffect(() => () => {
    activeRef.current?.stop?.();
    activeRef.current = null;
  }, []);

  return { beatTest, testBeat, stopTestBeat };
}