export const PENDING_CODE_KEY = "syncsonic.pendingCode";
export const CODE_LENGTH = 6;

export function normalizeCode(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidCode(code) {
  return new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(String(code || ""));
}

export function maskCode(code) {
  const clean = normalizeCode(code);
  if (clean.length !== CODE_LENGTH) return "••••••";
  return `${clean.slice(0, 2)}••${clean.slice(-2)}`;
}

export function activationUrl(code, origin = window.location.origin) {
  return new URL(`/activate?code=${encodeURIComponent(normalizeCode(code))}`, origin).href;
}

export function formatDateRo(dateOnly) {
  if (!dateOnly) return "";
  const [year, month, day] = String(dateOnly).split("-").map(Number);
  if (!year || !month || !day) return String(dateOnly);
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function readPendingCode() {
  try {
    return normalizeCode(sessionStorage.getItem(PENDING_CODE_KEY) || "");
  } catch (error) {
    return "";
  }
}

export function storePendingCode(code) {
  try {
    sessionStorage.setItem(PENDING_CODE_KEY, normalizeCode(code));
  } catch (error) {
    /* sessionStorage poate fi blocat */
  }
}

export function clearPendingCode() {
  try {
    sessionStorage.removeItem(PENDING_CODE_KEY);
  } catch (error) {
    /* ignore */
  }
}
