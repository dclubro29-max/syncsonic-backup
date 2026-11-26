import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import {
  CAMPAIGN_NAME,
  CAMPAIGN_SLUG,
  ensurePremiumLock,
  generateCode,
  getDemoCampaign,
} from "../../shared/premium.ts";

const MAX_BATCH = 2500;
const OWNER_BATCH_NAME = "Lot privat – Premium pe viață";
const OWNER_ACCESS_KEY = "owner_access_code";

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch((error) =>
    error.status === 401 ? null : Promise.reject(error),
  );
  if (!user) return { error: Response.json({ error: "Neautentificat." }, { status: 401 }) };
  if (user.role !== "admin") {
    return { error: Response.json({ error: "Doar administratorul poate gestiona campaniile." }, { status: 403 }) };
  }
  return { user };
}

async function bootstrapCampaign(base44) {
  const existing = await getDemoCampaign(base44);
  if (existing) return existing;
  return base44.asServiceRole.entities.PremiumCampaign.create({
    name: CAMPAIGN_NAME,
    slug: CAMPAIGN_SLUG,
    country: "RO",
    product: "SyncSonic Box",
    store_scope: "Pilot propus – România",
    first_months: 3,
    additional_months: 1,
    pilot_quota: 2500,
    price_lei: 29.99,
    active: true,
    demo: true,
    terms:
      "Campanie demonstrativă, fără încasări reale. Primul cod eligibil oferă 3 luni Premium; fiecare cod suplimentar adaugă 1 lună pe același cont.",
  });
}

async function uniqueCodes(base44, count) {
  const codes = new Set();
  let guard = 0;
  while (codes.size < count && guard < 50) {
    guard += 1;
    const wanted = Math.min(100, count - codes.size);
    const candidates = Array.from({ length: wanted }, () => generateCode());
    const existing = await base44.asServiceRole.entities.PremiumCode.filter({
      code: { $in: candidates },
    });
    const taken = new Set(existing.map((item) => item.code));
    candidates.forEach((candidate) => {
      if (!taken.has(candidate)) codes.add(candidate);
    });
  }
  if (codes.size < count) throw new Error("Nu am putut genera suficiente coduri unice.");
  return Array.from(codes);
}

async function ensureOwnerBatch(base44, campaign) {
  const { items } = await base44.asServiceRole.entities.PremiumBatch.filter(
    { campaign_id: campaign.id, name: OWNER_BATCH_NAME },
    { limit: 1 },
  );
  if (items[0]) return items[0];
  const batch = await base44.asServiceRole.entities.PremiumBatch.create({
    campaign_id: campaign.id,
    name: OWNER_BATCH_NAME,
    country: campaign.country || "RO",
    product: campaign.product || "SyncSonic Box",
    store: "Proprietar",
    quantity: 5,
    notes: "Cinci coduri Premium pe viață. Păstrează-le nefolosite pentru predare; testează cu alte coduri.",
    lifetime: true,
  });
  const codes = await uniqueCodes(base44, 5);
  await base44.asServiceRole.entities.PremiumCode.bulkCreate(
    codes.map((code) => ({
      campaign_id: campaign.id,
      batch_id: batch.id,
      code,
      status: "available",
      lifetime: true,
      country: batch.country,
      product: batch.product,
      store: batch.store,
    })),
  );
  return batch;
}

async function ensureOwnerAccessCode(base44) {
  const { items } = await base44.asServiceRole.entities.PremiumLock.filter(
    { key: OWNER_ACCESS_KEY },
    { limit: 1 },
  );
  if (items[0]?.token) return items[0].token;
  const code = generateCode();
  await base44.asServiceRole.entities.PremiumLock.create({
    key: OWNER_ACCESS_KEY,
    locked: false,
    token: code,
    expires_at: 0,
  });
  return code;
}

async function listBatches(base44, campaign) {
  await ensureOwnerBatch(base44, campaign);
  const { items: batches } = await base44.asServiceRole.entities.PremiumBatch.filter(
    { campaign_id: campaign.id },
    { sort: "-created_date", limit: 100 },
  );
  const enriched = [];
  for (let index = 0; index < batches.length; index += 6) {
    const chunk = batches.slice(index, index + 6);
    const rows = await Promise.all(
      chunk.map(async (batch) => {
        const [generated, claimed, available] = await Promise.all([
          base44.asServiceRole.entities.PremiumCode.count({ batch_id: batch.id }),
          base44.asServiceRole.entities.PremiumCode.count({ batch_id: batch.id, status: "claimed" }),
          base44.asServiceRole.entities.PremiumCode.count({ batch_id: batch.id, status: "available" }),
        ]);
        return { ...batch, generated, claimed, available };
      }),
    );
    enriched.push(...rows);
  }
  const [generated, claimed, available] = await Promise.all([
    base44.asServiceRole.entities.PremiumCode.count({ campaign_id: campaign.id }),
    base44.asServiceRole.entities.PremiumCode.count({ campaign_id: campaign.id, status: "claimed" }),
    base44.asServiceRole.entities.PremiumCode.count({ campaign_id: campaign.id, status: "available" }),
  ]);
  return {
    batches: enriched,
    totals: { generated, claimed, available, pilot_quota: campaign.pilot_quota },
  };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireAdmin(base44);
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";
    const campaign = await bootstrapCampaign(base44);
    await ensurePremiumLock(base44);

    if (action === "list") {
      const data = await listBatches(base44, campaign);
      const accessCode = await ensureOwnerAccessCode(base44);
      return Response.json({
        campaign,
        ownerAccess: { code: accessCode, path: `/admin/campaigns?access=${accessCode}` },
        ...data,
      });
    }

    if (action === "createBatch") {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_BATCH) {
        return Response.json(
          { error: `Numărul de coduri trebuie să fie între 1 și ${MAX_BATCH}.` },
          { status: 400 },
        );
      }
      const name = String(body.name || "").trim();
      if (!name) return Response.json({ error: "Dă un nume lotului." }, { status: 400 });

      const used = await base44.asServiceRole.entities.PremiumCode.count({ campaign_id: campaign.id });
      if (used + quantity > campaign.pilot_quota) {
        return Response.json(
          {
            error: `Cota pilot este de ${campaign.pilot_quota} coduri. Mai ai ${Math.max(0, campaign.pilot_quota - used)} disponibile.`,
          },
          { status: 400 },
        );
      }

      const batch = await base44.asServiceRole.entities.PremiumBatch.create({
        campaign_id: campaign.id,
        name,
        country: String(body.country || campaign.country || "RO").trim(),
        product: String(body.product || campaign.product || "SyncSonic Box").trim(),
        store: String(body.store || "").trim(),
        quantity,
        notes: String(body.notes || "").trim(),
        lifetime: !!body.lifetime,
      });

      const codes = await uniqueCodes(base44, quantity);
      for (let index = 0; index < codes.length; index += 100) {
        const chunk = codes.slice(index, index + 100);
        await base44.asServiceRole.entities.PremiumCode.bulkCreate(
          chunk.map((code) => ({
            campaign_id: campaign.id,
            batch_id: batch.id,
            code,
            status: "available",
            lifetime: !!batch.lifetime,
            country: batch.country,
            product: batch.product,
            store: batch.store,
          })),
        );
      }

      const data = await listBatches(base44, campaign);
      const accessCode = await ensureOwnerAccessCode(base44);
      return Response.json({
        ok: true,
        batch,
        generated: codes.length,
        campaign,
        ownerAccess: { code: accessCode, path: `/admin/campaigns?access=${accessCode}` },
        ...data,
      });
    }

    if (action === "batchCodes") {
      const batchId = String(body.batch_id || "");
      if (!batchId) return Response.json({ error: "Lipsește lotul." }, { status: 400 });
      const batch = await base44.asServiceRole.entities.PremiumBatch.get(batchId).catch((error) =>
        error.status === 404 ? null : Promise.reject(error),
      );
      if (!batch) return Response.json({ error: "Lotul nu există." }, { status: 404 });
      const { items } = await base44.asServiceRole.entities.PremiumCode.filter(
        { batch_id: batchId },
        { sort: "created_date", limit: MAX_BATCH },
      );
      return Response.json({ batch, codes: items, campaign });
    }

    return Response.json({ error: "Acțiune necunoscută." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error.message || "Administrarea campaniei nu a reușit." },
      { status: 500 },
    );
  }
}