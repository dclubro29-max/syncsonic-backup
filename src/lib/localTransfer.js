import { base44 } from "@/api/base44Client";
import { workerPreview, workerRequest } from "@/api/workerClient";
import { sendLibraryTracks, attachLibraryReceiver } from '@/lib/libraryTransferData';
import { keepTransferAwake as keepAwake, watchTransferConnection } from '@/lib/transferSession';

/**
 * Transfer direct între două dispozitive, în aceeași rețea Wi-Fi.
 * Piesele nu trec prin niciun spațiu de stocare: browserul cel care dă le
 * trimite browserului care primește. Serverul intermediază doar conectarea.
 *
 * Ordinea contează: dispozitivul care dă scrie mai întâi codul, apoi oferta.
 * Cel care primește așteaptă până când oferta chiar există, în loc să renunțe
 * la prima citire.
 */

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];
const POLL_MS = 900;
const WAIT_MS = 150 * 1000;
const OPEN_MS = 25 * 1000;
const GATHER_MS = 3000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const NETWORK_ERROR =
  "Conexiunea directă nu s-a putut face. Ambele dispozitive trebuie să fie în același Wi-Fi " +
  "(nu într-o rețea de oaspeți) și să aibă transferul pornit.";

export function makePairCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes)
    .map((n) => ALPHABET[n % ALPHABET.length])
    .join("");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pairs = workerPreview ? {
  filter: ({ code, role }) => workerRequest("library/pairs?" + new URLSearchParams({ code, role })),
  create: (data) => workerRequest("library/pairs", data),
  update: (id, data) => workerRequest("library/pairs/" + encodeURIComponent(id), data, "PATCH"),
  delete: (id) => workerRequest("library/pairs/" + encodeURIComponent(id), undefined, "DELETE"),
} : base44.entities.LibraryPair;

/** Așteaptă descrierea completă a conexiunii, cu tot cu adrese. */
function gather(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    }, GATHER_MS);
  });
}

/** Așteaptă canalul deschis, cu limită de timp. */
function waitForOpen(getChannel, isCancelled, timeout = OPEN_MS) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const tick = setInterval(() => {
      const channel = getChannel();
      if (channel && channel.readyState === "open") {
        clearInterval(tick);
        resolve();
      } else if (isCancelled() || channel?.readyState === 'closed' || Date.now() > deadline) {
        clearInterval(tick);
        reject(new Error("timeout"));
      }
    }, 200);
  });
}

/**
 * Caută înregistrarea celuilalt dispozitiv până când are câmpul de care avem
 * nevoie (`offer` sau `answer`). O citire ratată nu oprește transferul.
 */
async function findPeer(code, role, isCancelled, needed, waitMs = WAIT_MS) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && !isCancelled()) {
    try {
      const { items } = await pairs.filter(
        { code, role },
        { sort: "-created_date", limit: 1 }
      );
      const record = items[0];
      if (record && record[needed]) return record;
    } catch (e) {
      /* rețea aglomerată — reîncercăm */
    }
    await sleep(POLL_MS);
  }
  return null;
}

async function forget(id) {
  if (!id) return;
  try {
    await pairs.delete(id);
  } catch (e) {
    /* rămâne în urmă o înregistrare de împerechere, fără efect */
  }
}

/** Dispozitivul care dă piesele. Întoarce un obiect cu `cancel()`. */
export async function startSender({ code, tracks, onState }) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const channel = pc.createDataChannel("library", { ordered: true });
  channel.binaryType = "arraybuffer";
  const awake = keepAwake();
  let cancelled = false;
  const isCancelled = () => cancelled;

  let record;
  try {
    record = await pairs.create({
      code, role: 'sender', status: 'waiting', track_count: tracks.length,
      total_size: tracks.reduce((sum, t) => sum + t.blob.size, 0),
    });
  } catch (error) {
    pc.close();
    awake.release();
    throw error;
  }

  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    stopWatching();
    awake.release();
    try {
      channel.close();
    } catch (e) {
      /* deja închis */
    }
    try {
      pc.close();
    } catch (e) {
      /* deja închis */
    }
    void forget(record.id);
  };

  const stopWatching = watchTransferConnection(pc, () => {
    if (!cancelled) {
      onState({ phase: 'error', message: NETWORK_ERROR });
      void cancel();
    }
  });

  channel.addEventListener("error", () => {
    if (!cancelled) {
      onState({ phase: "error", message: "Canalul de transfer a întâmpinat o eroare de rețea." });
      cancel();
    }
  });

  const run = async () => {
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await gather(pc);
      if (cancelled) return;
      await pairs.update(record.id, {
        offer: JSON.stringify(pc.localDescription),
        status: "connecting",
      });
      onState({ phase: "waiting" });

      const peer = await findPeer(code, "receiver", isCancelled, "answer");
      if (cancelled) return;
      if (!peer) {
        onState({
          phase: "error",
          message: "Celălalt dispozitiv nu a răspuns. Verifică dacă a introdus codul și e în același Wi-Fi.",
        });
        await cancel();
        return;
      }

      await pc.setRemoteDescription(JSON.parse(peer.answer));
      onState({ phase: "connecting" });
      await waitForOpen(() => channel, isCancelled);

      await sendLibraryTracks(channel, pc, tracks, onState, isCancelled);
      if (cancelled) return;
      cancelled = true;
      stopWatching();
      awake.release();
      channel.close();
      pc.close();
      void forget(record.id);
    } catch (e) {
      if (!cancelled) onState({ phase: "error", message: e.message === 'timeout' ? NETWORK_ERROR : e.message || NETWORK_ERROR });
      await cancel();
    }
  };

  run();

  return { cancel };
}

/** Dispozitivul care primește piesele. Întoarce un obiect cu `cancel()`. */
export async function startReceiver({ code, onState, onFiles }) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const awake = keepAwake();
  let cancelled = false;
  const isCancelled = () => cancelled;
  let channel = null;
  let total = 0;
  let totalBytes = 0;
  let complete = false;
  let myId = null;
  let detachReceiver = () => {};

  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    stopWatching();
    detachReceiver();
    awake.release();
    try {
      if (channel) channel.close();
    } catch (e) {
      /* deja închis */
    }
    try {
      pc.close();
    } catch (e) {
      /* deja închis */
    }
    void forget(myId);
  };

  const stopWatching = watchTransferConnection(pc, () => {
    if (!cancelled && !complete) {
      onState({ phase: 'error', message: NETWORK_ERROR });
      void cancel();
    }
  });

  pc.ondatachannel = (event) => {
    channel = event.channel;
    channel.binaryType = "arraybuffer";
    onState({ phase: "receiving", progress: { done: 0, total, bytes: 0, totalBytes } });
    detachReceiver = attachLibraryReceiver(channel, {
      total, totalBytes, onState, onFiles, isCancelled,
      onComplete: () => { complete = true; stopWatching(); awake.release(); void forget(myId); },
      onError: (error) => {
        if (!cancelled && !complete) onState({ phase: 'error', message: error.message });
        cancel();
      },
    });
    channel.onclose = () => {
      if (!complete && !cancelled) onState({ phase: 'error', message: 'Conexiunea s-a închis înainte de salvarea tuturor pieselor.' });
      cancel();
    };
  };

  const run = async () => {
    try {
      onState({ phase: "finding" });
      const sender = await findPeer(code, "sender", isCancelled, "offer", 20000);
      if (cancelled) return;
      if (!sender) {
        onState({
          phase: "error",
          message: "Nu am găsit niciun transfer pornit cu acest cod. Verifică literele și încearcă din nou.",
        });
        await cancel();
        return;
      }

      const safeCount = (value) => (Number.isSafeInteger(value) && value > 0 ? value : 0);
      total = safeCount(sender.track_count);
      totalBytes = safeCount(sender.total_size);
      await pc.setRemoteDescription(JSON.parse(sender.offer));
      await pc.setLocalDescription(await pc.createAnswer());
      await gather(pc);
      if (cancelled) return;
      const record = await pairs.create({
        code,
        role: "receiver",
        answer: JSON.stringify(pc.localDescription),
        status: "connecting",
      });
      myId = record.id;
      if (cancelled || complete) { void forget(myId); return; }
      if (channel?.readyState !== 'open') onState({ phase: 'connecting', progress: { done: 0, total, bytes: 0, totalBytes } });
      await waitForOpen(() => channel, isCancelled);
    } catch (e) {
      if (!cancelled && !complete) onState({ phase: "error", message: e.message === 'timeout' ? NETWORK_ERROR : e.message || NETWORK_ERROR });
      await cancel();
    }
  };

  run();

  return { cancel };
}
