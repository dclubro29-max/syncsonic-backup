import { createTransferProgress } from '@/lib/transferFlow';
import { getTransferredTrackKeys } from '@/lib/trackStore';

export const cloudCodePattern = /^[A-Za-z0-9_-]{43}$/;

function background(run, onState) {
  const controller = new AbortController();
  const signal = controller.signal;
  const report = state => { if (!signal.aborted) onState(state); };
  const request = async (path, options) => {
    const result = await fetch('/api/v1/transfer/' + path, { ...options, signal });
    if (!result.ok) {
      const data = await result.json().catch(() => null);
      throw new Error(data?.error || 'Transferul prin internet a fost întrerupt.');
    }
    return result;
  };
  void run(request, report, signal).catch(error => report({ phase: 'error', message: error.message }));
  return { cancel: () => controller.abort() };
}

export function startCloudSender({ tracks, onState }) {
  return background(async (request, report) => {
    const files = tracks.map(({ blob, name, file_name }) => ({
      name: blob.name || file_name || `${name}.mp3`, size: blob.size,
      type: blob.type.startsWith('audio/') ? blob.type : 'application/octet-stream',
    }));
    const bytes = files.reduce((total, file) => total + file.size, 0);
    const progress = createTransferProgress(report, 'sending', files.length, bytes);
    const { id, code } = await (await request('create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }),
    })).json();
    for (const [index, track] of tracks.entries()) {
      await request(`upload/${id}?index=${index}`, { method: 'PUT', body: track.blob });
      progress(track.blob.size, true, true, files[index].name);
    }
    await request(`finish/${id}`, { method: 'POST' });
    report({ phase: 'done', code });
  }, onState);
}

export function startCloudReceiver({ code, onState, onFiles }) {
  return background(async (request, report, signal) => {
    const headers = { Authorization: 'Bearer ' + code };
    const { id, files } = await (await request('manifest', { headers })).json();
    const bytes = files.reduce((total, file) => total + file.size, 0);
    const progress = createTransferProgress(report, 'receiving', files.length, bytes);
    const saved = await getTransferredTrackKeys();
    for (const [index, file] of files.entries()) {
      signal.throwIfAborted();
      const transferKey = `cloud:${id}:${index}`;
      if (!saved.has(transferKey)) {
        const contents = await (await request(`file/${index}`, { headers })).blob();
        if (contents.size !== file.size) throw new Error('Piesa a ajuns incomplet. Reintrodu codul pentru a continua.');
        await onFiles([new File([contents], file.name, { type: file.type })], { transferKey });
      }
      progress(file.size, true, true, file.name);
    }
    report({ phase: 'done', progress: { total: files.length, done: files.length, bytes, totalBytes: bytes } });
  }, onState);
}
