/** Întârzierea de siguranță a ieșirii implicite, când nu e selectată nicio boxă. */
export const SPEAKER_RESERVE_SECONDS = 0.32;
const PACKET_FRAMES = 1024;

export function speakerReserveFrames(context) {
  return Math.ceil(context.sampleRate * SPEAKER_RESERVE_SECONDS / PACKET_FRAMES) * PACKET_FRAMES;
}

export function createSpeakerSafetyDelay(context) {
  const node = context.createDelay(1);
  node.delayTime.value = speakerReserveFrames(context) / context.sampleRate;
  return node;
}