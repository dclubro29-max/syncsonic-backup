import { base44 } from "@/api/base44Client";

/**
 * Starea Premium este aceeași pe Cont și pe pagina Premium. O cerere comună,
 * reținută 30 de secunde, evită apelurile duplicate la navigarea între ele.
 */
const TTL_MS = 30000;
let cache = null;
let cachedAt = 0;
let inflight = null;

export function getPremiumStatus({ force = false } = {}) {
  if (!force && cache && Date.now() - cachedAt < TTL_MS) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = base44.functions
    .invoke("premiumAccount", {})
    .then((response) => {
      cache = response.data;
      cachedAt = Date.now();
      return cache;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidatePremiumStatus() {
  cache = null;
  cachedAt = 0;
}