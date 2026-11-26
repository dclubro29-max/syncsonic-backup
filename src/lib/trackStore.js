// Persistență locală a bibliotecii de piese, folosind IndexedDB.
// Fișierele rămân pe device (nu sunt urcate pe niciun server).

const DB_NAME = "multiboxa-dj";
const STORE = "tracks";
// Profilul muzical (BPM, nivel) stă separat de fișier, ca să nu rescriem blob-ul.
const PROFILE_STORE = "profiles";
const VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.objectStoreNames.contains(STORE)
        ? req.transaction.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: "id" });
      if (!store.indexNames.contains('transferKey')) store.createIndex('transferKey', 'transferKey');
      if (!db.objectStoreNames.contains(PROFILE_STORE)) db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export async function saveTrack(file, { transferKey, bpmHint } = {}) {
  const db = await openDB();
  const record = {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.[^.]+$/, ""),
    size: file.size,
    type: file.type,
    blob: file,
    addedAt: Date.now(),
    favorite: false,
    ...(transferKey ? { transferKey } : {}),
    ...(bpmHint ? { bpmHint } : {}),
  };
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Salvarea locală a fost întreruptă. Verifică spațiul liber.'));
    });
  } finally { db.close(); }
  return record;
}

export async function getTransferredTrackKeys() {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const keys = new Set();
      const tx = db.transaction(STORE, 'readonly');
      // Only the small index keys cross into memory, never the audio blobs.
      const req = tx.objectStore(STORE).index('transferKey').openKeyCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) { keys.add(cursor.key); cursor.continue(); }
      };
      tx.oncomplete = () => resolve(keys);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Biblioteca locală nu poate fi citită.'));
    });
  } finally { db.close(); }
}

export async function getTracks() {
  const db = await openDB();
  const list = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return list.sort((a, b) => b.addedAt - a.addedAt);
}

export async function removeTrack(id) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, PROFILE_STORE], "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.objectStore(PROFILE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getTrackProfiles() {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readonly");
      const req = tx.objectStore(PROFILE_STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveTrackProfile(id, profile) {
  const db = await openDB();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PROFILE_STORE, "readwrite");
      tx.objectStore(PROFILE_STORE).put({ id, ...profile });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function updateTrack(id, patch) {
  const db = await openDB();
  const current = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!current) {
    db.close();
    return null;
  }
  const next = { ...current, ...patch };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(next);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return next;
}

export async function getStorageUsage() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch (e) {
    return null;
  }
}