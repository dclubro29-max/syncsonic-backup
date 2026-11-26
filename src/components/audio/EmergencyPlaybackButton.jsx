import React, { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useDj } from '@/lib/djContext';
import { SYSTEM_DEFAULT_ID, SYSTEM_DEFAULT_OUTPUT } from '@/lib/outputs';
import { Button } from '@/components/ui/button';
import EmergencyPlaybackDialog from '@/components/audio/EmergencyPlaybackDialog';

export default function EmergencyPlaybackButton() {
  const dj = useDj(), emergency = dj.emergency;
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState(SYSTEM_DEFAULT_ID);
  const speakers = dj.speakers.length ? dj.speakers : [SYSTEM_DEFAULT_OUTPUT];
  const activate = async () => { if (await emergency.start(deviceId)) setOpen(false); };
  return (
    <>
      <Button size="sm" variant={emergency.on ? 'default' : 'outline'} className="gap-1.5"
        disabled={emergency.busy || !dj.tracks.length || dj.calibrationBusy}
        title={emergency.on ? `O singură ieșire: ${emergency.speaker}. Ieșirea oprește Auto DJ și restaurează reglajele.` : 'Redare directă pe o singură boxă, fără efecte sau analiză în fundal'}
        onClick={() => emergency.on ? emergency.stop() : setOpen(true)}>
        {emergency.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {emergency.on ? 'Urgență activă · Ieși' : 'Redare de urgență'}
      </Button>
      {!open && emergency.error && <span role="alert" className="text-xs text-destructive">{emergency.error}</span>}
      <EmergencyPlaybackDialog open={open} onOpenChange={setOpen} speakers={speakers} deviceId={deviceId}
        onDeviceChange={setDeviceId} busy={emergency.busy} error={emergency.error} onStart={activate} />
    </>
  );
}