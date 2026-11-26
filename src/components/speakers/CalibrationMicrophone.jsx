import React, { useEffect, useState } from 'react';
import { isWirelessMicrophone } from '@/lib/calibrationMicrophone';

export default function CalibrationMicrophone({ value, onChange, disabled }) {
  const [inputs, setInputs] = useState([]);
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let mounted = true;
    const refresh = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (mounted) setInputs(devices.filter((device) => device.kind === 'audioinput' && device.deviceId !== 'default'));
    };
    refresh();
    navigator.mediaDevices.addEventListener?.('devicechange', refresh);
    return () => { mounted = false; navigator.mediaDevices.removeEventListener?.('devicechange', refresh); };
  }, []);
  return (
    <label className="block space-y-2 text-xs text-muted-foreground">
      <span>Microfon pentru aliniere</span>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-foreground"
        value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        <option value="">Automat — preferă microfonul integrat / USB</option>
        {inputs.map((input, index) => <option key={input.deviceId} value={input.deviceId}
          disabled={isWirelessMicrophone(input.label)}>
          {input.label || `Microfon ${index + 1}`}{isWirelessMicrophone(input.label) ? ' — nepotrivit pentru calibrare' : ''}
        </option>)}
      </select>
      <span className="block">Nu folosi microfonul boxei Bluetooth: poate activa sunetul de apel.</span>
    </label>
  );
}