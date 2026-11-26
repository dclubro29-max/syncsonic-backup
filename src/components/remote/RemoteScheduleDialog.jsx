import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, Play } from "lucide-react";
import { clockText, nextOccurrence } from "@/lib/remoteControl";

/** Alege momentul: imediat sau la o oră anume. */
export default function RemoteScheduleDialog({ track, device, open, onOpenChange, onSend }) {
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (playAt) => {
    if (!playAt || busy) return;
    setBusy(true);
    try {
      await onSend(track, playAt);
    } finally {
      setBusy(false);
    }
  };

  const scheduled = nextOccurrence(time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Pornește piesa</DialogTitle>
          <DialogDescription className="truncate">
            {track?.name} · pe {device?.label}
          </DialogDescription>
        </DialogHeader>

        <Button className="w-full gap-2" disabled={busy} onClick={() => send(Date.now())}>
          <Play className="h-4 w-4" />
          Redă acum
        </Button>

        <div className="space-y-2 rounded-xl border border-border/70 p-3.5">
          <p className="caps flex items-center gap-1.5">
            <Clock className="h-3 w-3" aria-hidden="true" />
            La o anumită oră
          </p>
          <div className="flex gap-2">
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-10 flex-1"
              aria-label="Ora pornirii"
            />
            <Button variant="secondary" disabled={!scheduled || busy} onClick={() => send(scheduled)}>
              Programează
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {scheduled
              ? `Pornește la ${clockText(scheduled)}${new Date(scheduled).getDate() !== new Date().getDate() ? " (mâine)" : ""}.`
              : "Ora aleasă: dacă a trecut deja, pornirea se face mâine."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}