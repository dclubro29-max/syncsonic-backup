import { createTransferProgress, waitForTransferBuffer, sendAndConfirm } from '@/lib/transferFlow';
import transferFileStream from '@/lib/transferFileStream';
export { default as attachLibraryReceiver } from '@/lib/libraryTransferReceiver';

/** Two-file pipeline: sending does not wait for every individual disk commit. */
export async function sendLibraryTracks(channel, pc, tracks, onState, isCancelled) {
  const totalBytes = tracks.reduce((sum, track) => sum + track.blob.size, 0);
  const progress = createTransferProgress(onState, 'sending', tracks.length, totalBytes);
  const pending = [];
  let fault = null, confirmedBytes = 0;
  const stopped = () => isCancelled() || Boolean(fault);
  const receive = (event) => {
    if (typeof event.data !== 'string') return;
    try {
      const msg = JSON.parse(event.data);
      if (msg.t === 'error') fault = new Error(msg.message || 'Salvarea piesei a eșuat.');
      if (msg.t === 'progress' && Number.isSafeInteger(msg.bytes) && msg.bytes >= confirmedBytes && msg.bytes <= totalBytes) {
        const delta = msg.bytes - confirmedBytes;
        confirmedBytes = msg.bytes;
        progress(delta, false, false, msg.name);
      }
    } catch { fault = new Error('Răspuns de transfer invalid.'); }
  };
  const waitForSaved = async () => {
    const error = await pending.shift().result;
    if (error) throw error;
  };
  channel.addEventListener('message', receive);
  try {
    const ready = await sendAndConfirm(channel, { t: 'hello', version: 2, total: tracks.length, totalBytes }, 'ready', null, stopped, 10000);
    if (ready.version !== 2) throw new Error('Actualizează aplicația pe ambele dispozitive și pornește un cod nou.');
    for (let index = 0; index < tracks.length; index++) {
      if (fault) throw fault;
      if (isCancelled()) return;
      // Bound both queued files and the receiver's pending disk-write memory.
      while (pending.length >= 2 || pending.reduce((sum, item) => sum + item.size, 0) > 16 * 1024 * 1024) await waitForSaved();
      const track = tracks[index];
      const name = track.blob.name || track.file_name || `${track.name}.mp3`;
      const accepted = await sendAndConfirm(channel, {
        t: 'file', index, name, key: `${track.id}:${track.blob.size}`,
        type: track.type || track.blob.type || 'audio/mpeg', size: track.blob.size,
      }, 'accept', index, stopped);
      if (accepted.skip) { progress(0, true, true, name); continue; }
      await transferFileStream(channel, pc, track.blob, stopped, waitForTransferBuffer);
      await waitForTransferBuffer(channel, stopped);
      // Register before sending the end marker so fast storage cannot race the listener.
      const result = sendAndConfirm(channel, { t: 'end', index }, 'saved', index, stopped, 60000)
        .then(() => { progress(0, true, true, name); return null; }, (error) => { fault = error; return error; });
      pending.push({ size: track.blob.size, result });
    }
    onState({ phase: 'saving' });
    while (pending.length) await waitForSaved();
    if (fault) throw fault;
    await sendAndConfirm(channel, { t: 'all' }, 'done', null, stopped);
    onState({ phase: 'done', progress: { done: tracks.length, total: tracks.length, bytes: totalBytes, totalBytes } });
  } catch (error) { throw fault || error; }
  finally { channel.removeEventListener('message', receive); }
}