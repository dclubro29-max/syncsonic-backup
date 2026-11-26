import { SYSTEM_DEFAULT_ID } from '@/lib/outputs';
import { prepareMixerHardwareReference, forgetMixerHardwareReference } from '@/components/audio/mixerHardwareReference';

/** Normal playback keeps a fixed internal reference; only stopped emergency playback pins a box. */
export async function routeSpeakerDestination(context, speakers, _outputs, { emergency = false } = {}) {
  if (speakers.length && !emergency) {
    const reference = await prepareMixerHardwareReference(context);
    return { deviceId: reference.pinned
      ? speakers.find((speaker) => speaker.deviceId === reference.deviceId)?.deviceId ?? null
      : speakers.find((speaker) => speaker.deviceId === SYSTEM_DEFAULT_ID)?.deviceId ?? null };
  }
  const primary = emergency ? speakers[0] : null;
  const sinkId = primary && primary.deviceId !== SYSTEM_DEFAULT_ID ? primary.deviceId : '';
  try {
    if (typeof context.setSinkId === 'function' && context.sinkId !== sinkId) await context.setSinkId(sinkId);
    forgetMixerHardwareReference(context);
    return { deviceId: primary?.deviceId ?? null };
  } catch (error) {
    return { deviceId: null, error };
  }
}