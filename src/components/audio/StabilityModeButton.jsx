import React from 'react';
import { Shield } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { Button } from '@/components/ui/button';

export default function StabilityModeButton() {
  const dj = useDj();
  return <Button size="sm" variant="outline" disabled={dj.calibrationBusy || dj.emergencyPlayback}
    title="Suspendă efectele, analiza, înregistrarea și toate vizualizările; păstrează boxele selectate."
    onClick={() => {
      if (dj.isRecording) dj.stop();
      dj.stopPads();
      dj.setStabilityMode(true);
    }}>
    <Shield className="h-4 w-4" /> Mod stabilitate
  </Button>;
}