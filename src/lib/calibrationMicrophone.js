import { isCommunicationsOutput } from '@/lib/outputs';

export const isWirelessMicrophone = (label) =>
  isCommunicationsOutput(label) || /bluetooth|airpods|buds|wireless/i.test(label || '');

/** Opening a Bluetooth microphone can switch its speaker into telephone audio. */
export async function openCalibrationMicrophone(deviceId) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microfonul nu este disponibil. Deschide aplicația în Chrome sau Edge și permite accesul.');
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === 'audioinput');
  const preferred = deviceId ? inputs.find((device) => device.deviceId === deviceId)
    : inputs.find((device) => /built.?in|internal|integrat|microphone array|macbook/i.test(device.label))
      || inputs.find((device) => device.deviceId !== 'default' && device.label && !isWirelessMicrophone(device.label));
  if (preferred && isWirelessMicrophone(preferred.label)) {
    throw new Error('Alege microfonul integrat sau USB, nu microfonul Bluetooth: acesta poate reduce calitatea boxelor.');
  }
  const selected = preferred?.deviceId || deviceId;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: {
    ...(selected ? { deviceId: { exact: selected } } : {}), channelCount: 1,
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
  } });
  if (stream.getAudioTracks().some((track) => isWirelessMicrophone(track.label))) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('Microfonul implicit este wireless. Selectează microfonul integrat/USB și repetă calibrarea.');
  }
  return stream;
}