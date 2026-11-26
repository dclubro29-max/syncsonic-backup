import { isCommunicationsOutput } from '@/lib/outputs';

const references = new WeakMap();
const INTERNAL_OUTPUT = /realtek|built[\s-]?in|internal speakers|macbook|încorporat|incorporat|integrat/i;
const WIRELESS_OUTPUT = /bluetooth|wireless|hands[\s-]?free|\bsco\b/i;
const NOTICE = 'Ceasul mixerului nu este izolat pe o ieșire internă identificată. Pentru mai multe boxe Bluetooth, setează difuzoarele laptopului ca ieșire implicită în sistem înainte de redare.';

export function getMixerHardwareReference(context) {
  return references.get(context) || { pinned: false, deviceId: null, notice: NOTICE };
}

export function forgetMixerHardwareReference(context) {
  references.delete(context);
}

/** Pin once per playback setup, never follow Bluetooth/default-device changes. No microphone access. */
export function prepareMixerHardwareReference(context) {
  const saved = references.get(context);
  if (saved) return saved.pending || Promise.resolve(saved);
  const state = { pinned: false, deviceId: null, notice: NOTICE, pending: null };
  references.set(context, state);
  state.pending = (async () => {
    if (typeof context.setSinkId !== 'function' || !navigator.mediaDevices?.enumerateDevices) return state;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const reference = devices.find((device) => device.kind === 'audiooutput' &&
      !['default', 'communications', ''].includes(device.deviceId) &&
      INTERNAL_OUTPUT.test(device.label) && !WIRELESS_OUTPUT.test(device.label) &&
      !isCommunicationsOutput(device.label));
    if (!reference || context.state === 'closed') return state;
    if (context.sinkId !== reference.deviceId) await context.setSinkId(reference.deviceId);
    state.pinned = true;
    state.deviceId = reference.deviceId;
    state.notice = null;
    return state;
  })().catch(() => state).finally(() => { state.pending = null; });
  return state.pending;
}