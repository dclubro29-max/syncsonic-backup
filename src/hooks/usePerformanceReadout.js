import { useEffect, useState } from 'react';

/** Read actual audio parameters, not preset targets or a decorative beat animation. */
export function usePerformanceReadout({ on, activeDeck, mixing, getDeckPerformance, getDeckAudio }) {
  const [values, setValues] = useState([]);
  useEffect(() => {
    if (!on) { setValues([]); return; }
    const read = () => {
      const indices = mixing ? [activeDeck, 1 - activeDeck] : [activeDeck];
      setValues(indices.map((index) => {
        const audio = getDeckAudio(index);
        return { index, ...getDeckPerformance(index), playing: !!audio && !audio.paused && !audio.ended };
      }));
    };
    read();
    const timer = setInterval(read, 250);
    return () => clearInterval(timer);
  }, [on, activeDeck, mixing, getDeckPerformance, getDeckAudio]);
  return values;
}