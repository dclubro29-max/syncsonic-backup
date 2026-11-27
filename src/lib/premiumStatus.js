import { base44 } from "@/api/base44Client";
import { workerPreview, workerRequest } from "@/api/workerClient";

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
  const request = workerPreview
    ? workerRequest("premium/account")
    : base44.functions.invoke("premiumAccount", {}).then((response) => response.data);
  inflight = request.then((data) => {
      cache = data;
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
