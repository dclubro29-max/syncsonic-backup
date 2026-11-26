// Playlisturi locale: ordinea pieselor și numele rămân pe acest device.
// Piesele sunt referite prin id, deci playlistul nu dublează fișierele.

const KEY = "musicsync.playlists";

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `pl-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function readPlaylists() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((p) => p && p.id) : [];
  } catch (e) {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    /* ignore */
  }
  return list;
}

export function createPlaylist(name = "") {
  const playlist = {
    id: uid(),
    name: name.trim() || "Playlist nou",
    trackIds: [],
    createdAt: Date.now(),
  };
  return write([...readPlaylists(), playlist]);
}

export function renamePlaylist(id, name) {
  return write(
    readPlaylists().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
  );
}

export function deletePlaylist(id) {
  return write(readPlaylists().filter((p) => p.id !== id));
}

export function addTrackToPlaylist(id, trackId) {
  return write(
    readPlaylists().map((p) =>
      p.id === id && !p.trackIds.includes(trackId)
        ? { ...p, trackIds: [...p.trackIds, trackId] }
        : p
    )
  );
}

export function removeTrackFromPlaylist(id, trackId) {
  return write(
    readPlaylists().map((p) =>
      p.id === id ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p
    )
  );
}

export function reorderPlaylist(id, trackIds) {
  return write(readPlaylists().map((p) => (p.id === id ? { ...p, trackIds } : p)));
}