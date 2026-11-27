import { useCallback, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { workerPreview, workerRequest } from "@/api/workerClient";
import { useAuth } from "@/lib/AuthContext";
import { useDj } from "@/lib/djContext";
import { getDeviceId, pollRemote, publishDevice } from "@/lib/remoteControl";

/**
 * Puntea de telecomandă: publică biblioteca și starea redării acestui dispozitiv
 * și execută comenzile primite de la telefon. Gazda rămâne sursa oficială a
 * stării; telefonul doar cere, iar confirmarea vine prin entitatea comenzii.
 */

const MIX_SECONDS = { dj: 4, smooth: 8, quick: 1.5 };

function playingIndexes(engine) {
  return engine.decks
    .slice(0, engine.deckCount || 2)
    .map((deck, index) => (deck.isPlaying && deck.track ? index : -1))
    .filter((index) => index >= 0);
}

function audibleIndex(engine) {
  const playing = playingIndexes(engine);
  if (playing.includes(0) && playing.includes(1)) return engine.crossfade >= 0.5 ? 1 : 0;
  if (playing.length) return playing[0];
  return engine.decks.findIndex((deck) => deck.track);
}

export default function RemoteBridge() {
  const dj = useDj();
  const { user } = useAuth();
  const djRef = useRef(dj);
  djRef.current = dj;
  const deviceId = useRef(getDeviceId()).current;
  const queue = useRef(new Map());
  const running = useRef(false);

  const setStatus = useCallback((id, status, error_message = "") => {
    const patch = {
      status,
      done_at: Date.now(),
      error_message,
    };
    return (workerPreview ? workerRequest("remote/commands/" + encodeURIComponent(id), patch, "PATCH")
      : base44.entities.RemoteCommand.update(id, patch)).catch(() => {});
  }, []);

  const execute = useCallback(async (command) => {
    const engine = djRef.current;
    const action = command.action || "play";
    try {
      if (action === "volume") {
        const value = Number(command.volume);
        if (!Number.isFinite(value)) throw new Error("Volumul cerut nu este valid.");
        engine.setMasterVolume(Math.max(0, Math.min(1, value)));
        await setStatus(command.id, "done");
        return;
      }

      if (action === "toggle") {
        const index = audibleIndex(engine);
        if (index < 0) throw new Error("Nicio piesă încărcată pe laptop.");
        if (engine.autoDj?.on) engine.autoDj.setOn(false);
        await engine.togglePlay(index);
        await setStatus(command.id, "done");
        return;
      }

      if (action === "next") {
        if (engine.autoDj?.on) engine.autoDj.setOn(false);
        const index = audibleIndex(engine);
        const current = index >= 0 ? engine.decks[index]?.track : null;
        const queued = engine.playQueue?.[0] || null;
        const library = engine.tracks || [];
        const libraryIndex = current ? library.findIndex((track) => track.id === current.id) : -1;
        const next = queued || (library.length
          ? library[libraryIndex >= 0 ? (libraryIndex + 1) % library.length : 0]
          : null);
        if (!next || next.id === current?.id) throw new Error("Nu există o piesă următoare.");
        const target = index === 0 ? 1 : 0;
        await setStatus(command.id, "preparing");
        await engine.loadToDeck(target, next);
        await setStatus(command.id, "mixing");
        await engine.togglePlay(target);
        engine.crossfadeOver(target === 0 ? 0 : 1, 4);
        if (queued) engine.removeQueuedTrack(queued.id);
        if (index >= 0) {
          const old = engine.getDeckAudio(index);
          window.setTimeout(() => {
            if (old && !old.paused) old.pause();
          }, 4400);
        }
        await setStatus(command.id, "done");
        return;
      }

      if (action === "queue") {
        const track = (engine.tracks || []).find((item) => item.id === command.track_id);
        if (!track) throw new Error("Piesa lipsește din biblioteca laptopului.");
        engine.enqueueTrack(track);
        await setStatus(command.id, "done");
        return;
      }

      const track = (engine.tracks || []).find((item) => item.id === command.track_id);
      if (!track) {
        await setStatus(command.id, "skipped", "Piesa lipsește din biblioteca laptopului.");
        return;
      }

      if (action === "play") {
        const decks = engine.decks.slice(0, engine.deckCount || 2);
        const free = decks.findIndex((deck) => !deck.isPlaying);
        const index = free < 0 ? 0 : free;
        await engine.loadToDeck(index, track);
        await engine.togglePlay(index);
        await setStatus(command.id, "done");
        return;
      }

      if (action !== "mix_now") throw new Error("Comandă necunoscută.");

      // „Mixează acum": nu așteaptă finalul piesei A.
      const newerChoice = [...queue.current.values()].some((item) =>
        item.action === "mix_now" && item.id !== command.id &&
        String(item.created_date || "") > String(command.created_date || ""));
      if (newerChoice) {
        await setStatus(command.id, "skipped", "Înlocuită de o alegere mai nouă.");
        return;
      }
      await setStatus(command.id, "preparing");
      if (engine.autoDj?.on) engine.autoDj.setOn(false);

      // Dacă ambele deckuri sunt deja audibile, închidem întâi trecerea în curs.
      const playing = playingIndexes(engine);
      let active = audibleIndex(engine);
      if (playing.includes(0) && playing.includes(1)) {
        const dominant = engine.crossfade >= 0.5 ? 1 : 0;
        engine.crossfadeOver(dominant, 0.25);
        await new Promise((resolve) => window.setTimeout(resolve, 300));
        const other = engine.getDeckAudio(1 - dominant);
        if (other && !other.paused) other.pause();
        active = dominant;
      }

      const target = active === 0 ? 1 : 0;
      const targetAudio = engine.getDeckAudio(target);
      if (targetAudio && !targetAudio.paused) targetAudio.pause();
      await engine.loadToDeck(target, track);
      await setStatus(command.id, "mixing");
      await engine.togglePlay(target);

      if ((command.style || "dj") === "dj" && active >= 0) {
        try {
          engine.beatAlign(target, active);
        } catch (error) {
          /* Beatmatch is optional; a clean fade still follows. */
        }
      }

      const seconds = MIX_SECONDS[command.style] || MIX_SECONDS.dj;
      engine.crossfadeOver(target === 0 ? 0 : 1, seconds);
      if (active >= 0) {
        const old = engine.getDeckAudio(active);
        window.setTimeout(() => {
          if (old && !old.paused) old.pause();
        }, (seconds + 0.2) * 1000);
      }
      engine.removeQueuedTrack(track.id);
      await setStatus(command.id, "done");
    } catch (error) {
      await setStatus(
        command.id,
        "failed",
        error.message || "Activează sunetul pe laptop înainte de telecomandă."
      );
    }
  }, [setStatus]);

  const drain = useCallback(async () => {
    if (running.current) return;
    const now = Date.now();
    const ready = [...queue.current.values()]
      .filter((command) => command.play_at <= now)
      .sort((a, b) => a.play_at - b.play_at);
    if (!ready.length) return;

    const latestMix = ready
      .filter((command) => command.action === "mix_now")
      .sort((a, b) => String(a.created_date || "").localeCompare(String(b.created_date || "")))
      .pop();

    running.current = true;
    try {
      for (const command of ready) {
        queue.current.delete(command.id);
        if (command.action === "mix_now" && latestMix && command.id !== latestMix.id) {
          await setStatus(command.id, "skipped", "Înlocuită de o alegere mai nouă.");
          continue;
        }
        if (command.play_at < now - 120000) {
          await setStatus(command.id, "skipped", "Comanda a expirat.");
          continue;
        }
        if (workerPreview) {
          try {
            await workerRequest("remote/commands/" + encodeURIComponent(command.id), {
              claim_device: deviceId,
            }, "PATCH");
          } catch {
            continue;
          }
        }
        await execute(command);
      }
    } finally {
      running.current = false;
    }
  }, [deviceId, execute, setStatus]);

  const publish = useCallback((includeTracks = false) => {
    if (workerPreview && !user?.id) return;
    const engine = djRef.current;
    const index = audibleIndex(engine);
    const deck = index >= 0 ? engine.decks[index] : null;
    const nowPlaying = deck?.track ? {
      track_id: deck.track.id,
      track_name: deck.track.name,
      cover: deck.track.cover || deck.track.art || "",
      progress: deck.progress || 0,
      duration: deck.duration || 0,
      is_playing: !!deck.isPlaying,
      master_volume: engine.masterVolume,
      auto_dj: !!engine.autoDj?.on,
      party_max: !!engine.autoDj?.on && !!engine.autoDj?.config?.partyMax,
      updated_at: Date.now(),
    } : null;

    return publishDevice(engine.tracks, {
      audioReady: engine.audioContext?.state === "running",
      nowPlaying,
      queue: engine.playQueue || [],
    }, { includeTracks }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    const debounce = setTimeout(() => publish(true), 300);
    return () => clearTimeout(debounce);
  }, [dj.tracks, publish]);

  useEffect(() => {
    // Starea redării pleacă la evenimente; pulsul rar doar corectează ceasul telefonului.
    const heartbeat = setInterval(() => publish(false), 20000);
    return () => clearInterval(heartbeat);
  }, [publish]);

  const stateSignature = [
    dj.decks[0]?.track?.id,
    dj.decks[0]?.isPlaying,
    dj.decks[1]?.track?.id,
    dj.decks[1]?.isPlaying,
    dj.autoDj?.on,
    dj.autoDj?.config?.partyMax,
    (dj.playQueue || []).map((track) => track.id).join(","),
  ].join("|");

  useEffect(() => {
    const debounce = setTimeout(() => publish(false), 250);
    return () => clearTimeout(debounce);
  }, [stateSignature, publish]);

  // Comenzile acestui dispozitiv.
  useEffect(() => {
    const accept = (command) =>
      command && command.device_id === deviceId &&
      (command.status === "scheduled" || command.status === "pending");

    if (workerPreview) {
      if (!user?.id) return undefined;
      const stop = pollRemote(
        () => workerRequest("remote/commands/" + encodeURIComponent(deviceId) + "?pending=1"),
        ({ items }) => {
          queue.current.clear();
          items.filter(accept).forEach((command) => queue.current.set(command.id, command));
          void drain();
        }, 1500);
      return () => {
        stop();
        queue.current.clear();
      };
    }

    let cancelled = false;
    const loadPending = async () => {
      let cursor;
      do {
        const page = await base44.entities.RemoteCommand.filter(
          { device_id: deviceId, status: { $in: ["scheduled", "pending"] } },
          { sort: "play_at", limit: 50, ...(cursor ? { cursor } : {}) }
        );
        if (cancelled) return;
        page.items.filter(accept).forEach((command) => queue.current.set(command.id, command));
        cursor = page.has_more ? page.next_cursor : null;
      } while (cursor);
      drain();
    };
    loadPending().catch(() => {});

    const unsubscribe = base44.entities.RemoteCommand.subscribe((event) => {
      const command = event.data;
      if (event.type === "create" && accept(command)) {
        queue.current.set(command.id, command);
        drain();
      }
      if (event.type === "update" && command && ["done", "skipped", "failed"].includes(command.status)) {
        queue.current.delete(command.id);
      }
      if (event.type === "delete") queue.current.delete(event.id);
    });
    const timer = setInterval(drain, 1000);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
  }, [deviceId, drain, user?.id]);

  return null;
}
