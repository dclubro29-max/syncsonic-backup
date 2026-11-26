/**
 * Convoluția este cel mai scump nod din Web Audio: un buffer de 2,8 s stereo
 * înseamnă peste 130 000 de coeficienți calculați neîncetat, pentru fiecare
 * instanță. Cât timp reverbul nu se aude, Chromium continuă totuși să-l ruleze
 * — iar cu două convoluții pe fiecare din cele patru deck-uri, firul audio
 * rămâne fără timp și apar goluri identice pe toate ieșirile.
 *
 * Un convolver fără buffer nu procesează nimic. Deci, la fel ca exciterul de pe
 * master, reverbul iese complet din calcul când nu e folosit și revine doar
 * când cineva îl cere.
 */
export function attachConvolver(send, convolver, impulse) {
  if (!send || !convolver) return;
  send.convolver = convolver;
  send.impulse = impulse;
  convolver.buffer = null;
}

export function wakeConvolver(send) {
  const convolver = send?.convolver;
  if (!convolver || convolver.buffer || !send.impulse) return;
  clearTimeout(send.idleTimer);
  convolver.buffer = send.impulse;
}

export function idleConvolver(send) {
  const convolver = send?.convolver;
  if (!convolver || !convolver.buffer) return;
  convolver.buffer = null;
}