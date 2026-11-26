import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/ui-kit/PageHeader";
import ThisDeviceCard from "@/components/remote/ThisDeviceCard";
import RemoteTargets from "@/components/remote/RemoteTargets";
import RemoteNowPlaying from "@/components/remote/RemoteNowPlaying";
import RemoteLibrary from "@/components/remote/RemoteLibrary";
import RemoteQueue from "@/components/remote/RemoteQueue";
import RemoteScheduleDialog from "@/components/remote/RemoteScheduleDialog";
import RecentCommands from "@/components/remote/RecentCommands";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { clockText, getDeviceId, getDeviceLabel, sendRemoteCommand } from "@/lib/remoteControl";
import { Smartphone, Type } from "lucide-react";

const LARGE_KEY = "musicsync.remoteLarge";

/** Telecomanda de pe telefon: alege gazda, caută și mixează imediat. */
export default function Remote() {
  const { toast } = useToast();
  const myId = getDeviceId();
  const [devices, setDevices] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [commands, setCommands] = useState([]);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("library");
  const [large, setLarge] = useState(() => {
    try {
      return localStorage.getItem(LARGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  });

  const loadDevices = useCallback(() => {
    base44.entities.RemoteDevice.list()
      .then(setDevices)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadDevices();
    return base44.entities.RemoteDevice.subscribe(loadDevices);
  }, [loadDevices]);

  const mine = devices.find((device) => device.device_id === myId) || null;
  const others = devices.filter((device) => device.device_id !== myId);
  const target = others.find((device) => device.device_id === targetId) || null;
  const targetDeviceId = target?.device_id || null;
  const activeCommand = commands.find((command) =>
    command.action === "mix_now" || command.action === "play" || command.action === "next") || null;

  useEffect(() => {
    if (!targetId && others.length) setTargetId(others[0].device_id);
  }, [others, targetId]);

  useEffect(() => {
    if (!targetDeviceId) {
      setCommands([]);
      return undefined;
    }
    const load = () => {
      base44.entities.RemoteCommand.filter(
        { device_id: targetDeviceId },
        { sort: "-created_date", limit: 8 }
      )
        .then((page) => setCommands(page.items))
        .catch(() => {});
    };
    load();
    return base44.entities.RemoteCommand.subscribe(load);
  }, [targetDeviceId]);

  const sendCommand = async (action, payload = {}, success) => {
    if (!targetDeviceId || busy) return;
    setBusy(true);
    try {
      await sendRemoteCommand({
        targetId: targetDeviceId,
        action,
        playAt: Date.now(),
        ...payload,
      });
      if (success) toast({ title: success, description: target?.label });
    } catch (error) {
      toast({
        title: "Comanda nu a putut fi trimisă",
        description: target?.label || error.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const sendScheduled = async (track, playAt) => {
    try {
      await sendRemoteCommand({
        targetId: targetDeviceId,
        action: "play",
        trackId: track.id,
        trackName: track.name,
        playAt,
      });
      setPicked(null);
      toast({
        title: playAt > Date.now() + 1500 ? `Programat la ${clockText(playAt)}` : "Pornire trimisă acum",
        description: `${track.name} · ${target?.label || "dispozitiv"}`,
      });
    } catch (error) {
      toast({
        title: "Comanda nu a putut fi trimisă",
        description: target?.label || error.message,
        variant: "destructive",
      });
    }
  };

  const toggleLarge = () => {
    const next = !large;
    setLarge(next);
    try {
      localStorage.setItem(LARGE_KEY, next ? "1" : "0");
    } catch (error) {
      /* local preference only */
    }
  };

  return (
    <div className={`space-y-4 ${large ? "mx-auto max-w-2xl" : ""}`}>
      <PageHeader
        eyebrow="Telecomandă"
        title="Petrecerea, de pe telefon"
        icon={Smartphone}
        description="Gazda redă și confirmă. Telefonul cere, fără să oprească muzica atunci când îl închizi."
        actions={(
          <Button variant="outline" className="gap-2 border-border/80" onClick={toggleLarge} aria-pressed={large}>
            <Type className="h-4 w-4" />
            {large ? "Comenzi normale" : "Comenzi mari"}
          </Button>
        )}
      />

      <div className={large ? "space-y-4" : "grid gap-4 lg:grid-cols-[1.05fr_1fr]"}>
        <div className="space-y-4">
          <RemoteNowPlaying
            device={target}
            command={activeCommand}
            large={large}
            busy={busy}
            onToggle={() => sendCommand("toggle")}
            onNext={() => sendCommand("next")}
            onVolume={(volume) => sendCommand("volume", { volume })}
          />
          <RemoteTargets
            devices={devices}
            myId={myId}
            selectedId={targetId}
            onSelect={setTargetId}
            large={large}
          />
          <details className="panel px-4 py-3">
            <summary className="cursor-pointer list-none text-[11px] font-medium text-muted-foreground">
              Acest dispozitiv și istoricul comenzilor
            </summary>
            <div className="mt-3 space-y-3">
              <ThisDeviceCard device={mine} label={getDeviceLabel()} />
              <RecentCommands commands={commands} />
            </div>
          </details>
        </div>

        <div className="space-y-3">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library">Bibliotecă</TabsTrigger>
              <TabsTrigger value="queue">Coadă</TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="mt-3">
              <RemoteLibrary
                device={target}
                large={large}
                onMixNow={(track, style = "dj") => sendCommand(
                  "mix_now",
                  { trackId: track.id, trackName: track.name, style },
                  "Comandă trimisă · aștept confirmarea gazdei"
                )}
                onQueue={(track) => sendCommand(
                  "queue",
                  { trackId: track.id, trackName: track.name },
                  "Adăugată la coadă"
                )}
                onPick={setPicked}
              />
            </TabsContent>
            <TabsContent value="queue" className="mt-3">
              <RemoteQueue
                device={target}
                large={large}
                onMixNow={(track) => sendCommand(
                  "mix_now",
                  { trackId: track.id, trackName: track.name, style: "dj" },
                  "Comandă trimisă · aștept confirmarea gazdei"
                )}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <RemoteScheduleDialog
        track={picked}
        device={target}
        open={!!picked}
        onOpenChange={(open) => !open && setPicked(null)}
        onSend={sendScheduled}
      />
    </div>
  );
}