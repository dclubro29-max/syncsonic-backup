import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function EmergencyPlaybackDialog({ open, onOpenChange, speakers, deviceId, onDeviceChange, busy, error, onStart }) {
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redare de urgență</DialogTitle>
          <DialogDescription>
            O singură boxă, fără efecte, masterizare, modificări de tempo sau analiză în fundal.
            Auto DJ continuă cu treceri simple de 5 secunde. Activarea oprește scurt redarea curentă.
          </DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm">
          <span>Ieșirea folosită</span>
          <Select value={deviceId} onValueChange={onDeviceChange} disabled={busy}>
            <SelectTrigger aria-label="Ieșirea pentru redare de urgență"><SelectValue placeholder="Alege o ieșire" /></SelectTrigger>
            <SelectContent>{speakers.map((speaker) => (
              <SelectItem key={speaker.deviceId} value={speaker.deviceId}>{speaker.label}</SelectItem>
            ))}</SelectContent>
          </Select>
        </label>
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-muted-foreground">
          Pentru petrecere, preferă o boxă prin cablu sau USB. Celelalte boxe sunt oprite în acest mod;
          volumul poate fi mai mic pentru a evita distorsiunea. Problemele conexiunii Bluetooth nu pot fi eliminate garantat din browser.
        </p>
        <p className="text-xs text-muted-foreground">La ieșire, Auto DJ se oprește, iar selecția boxelor și reglajele anterioare se restaurează.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Anulează</Button>
          <Button disabled={busy || !deviceId} onClick={onStart} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}Pornește pe o singură boxă
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}