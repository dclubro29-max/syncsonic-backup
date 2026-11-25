// Regulile campaniei demo și ale calendarului Premium, într-un singur loc.
// Sunt folosite de funcțiile de activare și de administrare, ca să nu divergă.

export const CAMPAIGN_SLUG = "syncsonic-box-demo-ro";
export const CAMPAIGN_NAME = "SyncSonic Box Demo – România";
export const LOCK_KEY = "premium_redeem";
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const LIFETIME_EXPIRES = "9999-12-31";
export const LIFETIME_LABEL = "pe viață";

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

export function generateCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export function todayInBucharest() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseDateOnly(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function addDays(dateOnly, days) {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return dateOnly;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Adună luni calendaristice. Când luna țintă nu are ziua de plecare
 * (31 ianuarie + 1 lună), folosim ultima zi a lunii țintă: 28 februarie
 * într-un an obișnuit, 29 februarie într-un an bisect.
 */
export function addMonthsClamped(dateOnly, months) {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return dateOnly;
  const targetIndex = parsed.month - 1 + months;
  const targetYear = parsed.year + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(parsed.day, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isActiveOn(expiresOn, today = todayInBucharest()) {
  if (!expiresOn) return false;
  return String(expiresOn) >= String(today);
}

/** Accesul pe viață rămâne activ indiferent de data de azi. */
export function isEntitlementActive(entitlement, today = todayInBucharest()) {
  if (!entitlement) return false;
  if (entitlement.lifetime) return true;
  return isActiveOn(entitlement.expires_on, today);
}

export function formatDateRo(dateOnly) {
  const parsed = parseDateOnly(dateOnly);
  if (!parsed) return "";
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12));
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function monthsLabel(months) {
  return months === 1 ? "1 lună" : `${months} luni`;
}

export async function getDemoCampaign(base44) {
  const rows = await base44.asServiceRole.entities.PremiumCampaign.filter({ slug: CAMPAIGN_SLUG });
  return rows[0] || null;
}

export async function ensurePremiumLock(base44) {
  const rows = await base44.asServiceRole.entities.PremiumLock.filter({ key: LOCK_KEY });
  if (!rows.length) {
    await base44.asServiceRole.entities.PremiumLock.create({
      key: LOCK_KEY,
      locked: false,
      expires_at: 0,
    });
  }
}

/**
 * Serializează activările. Operația de revendicare a codului și actualizarea
 * dreptului Premium rulează una după alta, ca două coduri diferite să nu
 * pornească amândouă de la aceeași expirare. Lock-ul are expirare, ca o
 * funcție întreruptă să nu blocheze campania.
 */
export async function withPremiumLock(base44, work) {
  await ensurePremiumLock(base44);
  const token = crypto.randomUUID();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const now = Date.now();
    const [lock] = await base44.asServiceRole.entities.PremiumLock.filter({ key: LOCK_KEY });
    if (lock && (!lock.locked || lock.expires_at < now)) {
      await base44.asServiceRole.entities.PremiumLock.updateMany(
        { key: LOCK_KEY, $or: [{ locked: false }, { expires_at: { $lt: now } }] },
        { $set: { locked: true, token, expires_at: now + 30000 } },
      );
      const [confirmed] = await base44.asServiceRole.entities.PremiumLock.filter({ key: LOCK_KEY });
      if (confirmed?.token === token) {
        try {
          return await work();
        } finally {
          await base44.asServiceRole.entities.PremiumLock.updateMany(
            { key: LOCK_KEY, token },
            { $set: { locked: false, token: null, expires_at: 0 } },
          );
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Sistemul de activare este ocupat. Încearcă din nou în câteva secunde.");
}

export async function checkRateLimit(base44, userId, limit = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  // Cererile simultane pot crea mai multe rânduri pentru același cont.
  // Numărăm toate ferestrele active, nu doar primul rând găsit.
  const rows = await base44.asServiceRole.entities.PremiumRateLimit.filter({ user_id: userId });
  if (!rows.length) {
    await base44.asServiceRole.entities.PremiumRateLimit.create({
      user_id: userId,
      window_start: now,
      count: 1,
    });
    return { allowed: true, remaining: limit - 1 };
  }
  const active = rows.filter((row) => now - (row.window_start || 0) <= windowMs);
  if (!active.length) {
    await base44.asServiceRole.entities.PremiumRateLimit.update(rows[0].id, {
      window_start: now,
      count: 1,
    });
    return { allowed: true, remaining: limit - 1 };
  }
  const used = active.reduce((sum, row) => sum + (row.count || 0), 0);
  if (used >= limit) {
    const oldest = active.reduce((min, row) => Math.min(min, row.window_start || now), now);
    return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - oldest)) };
  }
  await base44.asServiceRole.entities.PremiumRateLimit.update(active[0].id, {
    count: (active[0].count || 0) + 1,
  });
  return { allowed: true, remaining: Math.max(0, limit - used - 1) };
}