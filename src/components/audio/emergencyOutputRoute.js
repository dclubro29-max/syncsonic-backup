import routeSpeakerOutput from '@/components/audio/routeSpeakerOutput';

/** Dry single-speaker output skips stored frequency splits and calibration delays. */
export default function setEmergencyOutputRoute(post, output, enabled) {
  routeSpeakerOutput(post, output, {
    emergency: enabled,
    stability: !!output.stabilityBypass,
  });
}