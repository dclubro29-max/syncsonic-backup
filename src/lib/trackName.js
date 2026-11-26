/** Numele pieselor vine din fișier; „Artist - Titlu" e desprins pentru afișare. */
const SEPARATOR = /\s+[-–—]\s+/;

export function parseTrackName(name) {
  const raw = String(name || "").trim();
  if (!raw) return { artist: "", title: "" };
  const parts = raw.split(SEPARATOR);
  if (parts.length >= 2) {
    const artist = parts[0].trim();
    const title = parts.slice(1).join(" - ").trim();
    if (artist && title) return { artist, title };
  }
  return { artist: "", title: raw };
}