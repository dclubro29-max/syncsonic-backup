export const TRANSFER_BUFFER_LIMIT = 1024 * 1024;
const READ_SIZE = 2 * 1024 * 1024;

/** Read ahead one bounded disk window; send views, not a copy for every packet. */
export default async function transferFileStream(channel, pc, blob, isCancelled, waitForBuffer) {
  const maximum = pc.sctp?.maxMessageSize;
  const chunkSize = Math.min(64 * 1024, maximum > 0 ? maximum : 64 * 1024);
  const read = (offset) => blob.slice(offset, offset + READ_SIZE).arrayBuffer()
    .then((buffer) => ({ buffer }), (error) => ({ error }));
  let reading = read(0);
  for (let offset = 0; offset < blob.size; offset += READ_SIZE) {
    const result = await reading;
    if (result.error) throw result.error;
    const bytes = new Uint8Array(result.buffer);
    const next = offset + READ_SIZE;
    if (next < blob.size) reading = read(next);
    for (let start = 0; start < bytes.byteLength; start += chunkSize) {
      if (isCancelled() || channel.readyState !== 'open') throw new Error('Transfer întrerupt.');
      // No Promise/event-listener overhead per packet while there is room to send.
      if (channel.bufferedAmount >= TRANSFER_BUFFER_LIMIT) await waitForBuffer(channel, isCancelled);
      channel.send(bytes.subarray(start, Math.min(start + chunkSize, bytes.byteLength)));
    }
  }
}