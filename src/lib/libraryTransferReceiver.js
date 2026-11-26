import { createTransferProgress } from '@/lib/transferFlow';
import { getTransferredTrackKeys } from '@/lib/trackStore';

/** Receive the next track while the preceding track commits to local storage. */
export default function attachLibraryReceiver(channel, { total, totalBytes, onState, onFiles, isCancelled, onComplete, onError }) {
  let current = null, chunks = [], received = 0, saved = 0, expected = 0, failed = false, complete = false;
  let writes = Promise.resolve(), knownKeys = null;
  const send = (value) => { if (channel.readyState === 'open') channel.send(JSON.stringify(value)); };
  const progress = createTransferProgress((state) => {
    send({ t: 'progress', bytes: state.progress.bytes, name: state.progress.name });
    onState(state);
  }, 'receiving', total, totalBytes);
  const dispose = () => {
    channel.removeEventListener('message', receive);
    channel.removeEventListener('error', channelError);
    current = null; chunks = [];
  };
  const fail = (error) => {
    if (failed || complete || isCancelled()) return;
    failed = true;
    try { send({ t: 'error', message: error.message }); } catch { /* Connection is already gone. */ }
    dispose();
    onError(error);
  };
  const channelError = () => fail(new Error('Canalul de transfer s-a întrerupt. Reia transferul; piesele salvate vor fi omise.'));
  const receive = (message) => {
    if (failed || complete || isCancelled()) return;
    try {
      if (typeof message.data !== 'string') {
        if (!current?.accepted) throw new Error('Date primite înainte de confirmarea piesei.');
        received += message.data.byteLength;
        if (received > current.size) throw new Error('Dimensiunea piesei primite nu corespunde.');
        chunks.push(message.data);
        progress(message.data.byteLength, false, false, current.name);
        return;
      }
      const msg = JSON.parse(message.data);
      if (msg.t === 'hello') {
        if (msg.version !== 2 || msg.total !== total || msg.totalBytes !== totalBytes) throw new Error('Actualizează aplicația pe ambele dispozitive și pornește un cod nou.');
        getTransferredTrackKeys().then((keys) => {
          if (failed || isCancelled()) return;
          knownKeys = keys;
          send({ t: 'ready', version: 2 });
        }).catch(fail);
      } else if (msg.t === 'file') {
        if (!knownKeys || current || msg.index !== expected || expected >= total || !Number.isSafeInteger(msg.size) || msg.size < 0 || typeof msg.name !== 'string' || typeof msg.key !== 'string') throw new Error('Informațiile piesei sunt invalide. Pornește un cod nou.');
        const fileInfo = { ...msg, accepted: false };
        current = fileInfo; chunks = []; received = 0; expected++;
        const skip = knownKeys.has(msg.key);
        if (skip) { current = null; saved++; progress(msg.size, true, true, msg.name); }
        else { fileInfo.accepted = true; progress(0, false, true, msg.name); }
        send({ t: 'accept', index: msg.index, skip });
      } else if (msg.t === 'end') {
        if (!current?.accepted || msg.index !== current.index || received !== current.size) throw new Error('Piesa a ajuns incomplet. Reia transferul; piesele salvate vor fi omise.');
        const info = current;
        const file = new File(chunks, info.name, { type: info.type });
        current = null; chunks = [];
        progress(0, false, true, file.name);
        onState({ phase: 'saving' });
        writes = writes.then(async () => {
          if (failed || isCancelled()) return;
          await onFiles([file], { transferKey: info.key });
          if (failed || isCancelled()) return;
          saved++;
          knownKeys.add(info.key);
          progress(0, true, true, current?.name || file.name);
          send({ t: 'saved', index: info.index });
        }).catch(fail);
      } else if (msg.t === 'all') {
        if (current || expected !== total) throw new Error('Nu au ajuns toate piesele.');
        onState({ phase: 'saving' });
        writes.then(() => {
          if (failed || isCancelled()) return;
          if (saved !== total) throw new Error('Nu au fost salvate toate piesele.');
          send({ t: 'done' });
          complete = true;
          dispose();
          onComplete();
          onState({ phase: 'done', progress: { done: saved, total, bytes: totalBytes, totalBytes } });
        }).catch(fail);
      }
    } catch (error) { fail(error); }
  };
  channel.addEventListener('message', receive);
  channel.addEventListener('error', channelError);
  return dispose;
}