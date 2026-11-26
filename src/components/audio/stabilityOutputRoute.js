import routeSpeakerOutput from '@/components/audio/routeSpeakerOutput';

/** Keep calibrated delay and speaker volume, but physically retire band filters. */
export default function setStabilityOutputRoute(post, output, enabled) {
  routeSpeakerOutput(post, output, {
    emergency: !!output.emergencyBypass,
    stability: enabled,
  });
}