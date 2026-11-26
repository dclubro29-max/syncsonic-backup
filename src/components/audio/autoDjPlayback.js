/** A bounded, cancellable wait; old sessions must not restart a deck later. */
export function waitForPlaybackReady(audio, playing = false, signal) {
  return new Promise((resolve, reject) => {
    const events = ['canplay', 'seeked', 'playing', 'timeupdate', 'loadeddata', 'error', 'emptied', 'abort'];
    const source = audio.getAttribute('src');
    let timer, poll, settled = false, position = audio.currentTime;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(poll);
      events.forEach((event) => audio.removeEventListener(event, check));
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error); else resolve();
    };
    const cancel = () => {
      if (playing && audio.getAttribute('src') === source) audio.pause();
      finish(new DOMException('Redarea a fost anulată.', 'AbortError'));
    };
    const unavailable = (message) => Object.assign(new Error(message), { name: 'TrackPlaybackError' });
    const check = () => {
      if (signal?.aborted) return cancel();
      if (audio.getAttribute('src') !== source) {
        finish(new DOMException('Piesa încărcată s-a schimbat.', 'AbortError'));
      } else if (audio.error) finish(unavailable('Fișierul nu poate fi redat.'));
      else if (audio.seeking) position = audio.currentTime;
      else if (audio.readyState >= 3 && (!playing || (!audio.paused && !audio.ended && audio.currentTime > position + 0.02))) finish();
    };
    events.forEach((event) => audio.addEventListener(event, check));
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => finish(unavailable('Fișierul nu a devenit redabil în 12 secunde.')), 12000);
    // A resolved play() promise alone does not prove the decoder is producing audio.
    poll = setInterval(check, 50);
    check();
  });
}