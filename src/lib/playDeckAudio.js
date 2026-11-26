/** Bound play() itself: readyState alone does not settle a blocked media promise. */
export function playDeckAudio(audio, signal) {
  return new Promise((resolve, reject) => {
    const source = audio.getAttribute('src');
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      if (error) {
        if (audio.getAttribute('src') === source) audio.pause();
        reject(error);
      } else resolve();
    };
    const cancel = () => finish(new DOMException('Redarea a fost anulată.', 'AbortError'));
    const timer = setTimeout(() => finish(Object.assign(
      new Error('Pornirea fișierului a expirat după 12 secunde.'), { name: 'TrackPlaybackError' })), 12000);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) { cancel(); return; }
    Promise.resolve().then(() => {
      if (!settled) return audio.play();
    }).then(() => {
      if (signal?.aborted || audio.getAttribute('src') !== source) cancel();
      else finish();
    }, finish);
  });
}