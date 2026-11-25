import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import {
  LIFETIME_EXPIRES,
  LIFETIME_LABEL,
  addDays,
  addMonthsClamped,
  checkRateLimit,
  formatDateRo,
  getDemoCampaign,
  isEntitlementActive,
  isValidCode,
  maskCode,
  monthsLabel,
  normalizeCode,
  todayInBucharest,
  withPremiumLock,
} from "../../shared/premium.ts";

function activationResult(activation, extra = {}) {
  return {
    ok: true,
    months: activation.months,
    months_label: activation.lifetime ? LIFETIME_LABEL : monthsLabel(activation.months),
    lifetime: !!activation.lifetime,
    first_in_campaign: activation.first_in_campaign,
    expires_on: activation.expires_on,
    expires_on_display: activation.lifetime ? LIFETIME_LABEL : formatDateRo(activation.expires_on),
    previous_expires_on: activation.previous_expires_on || null,
    code_masked: activation.code_masked,
    activation_id: activation.id,
    ...extra,
  };
}

async function syncEntitlement(base44, userId, campaign, activation) {
  const rows = await base44.asServiceRole.entities.PremiumEntitlement.filter({
    user_id: userId,
    campaign_id: campaign.id,
  });
  const current = rows[0] || null;
  const count = await base44.asServiceRole.entities.PremiumActivation.count({
    user_id: userId,
    campaign_id: campaign.id,
  });
  const lifetime = !!activation.lifetime || !!current?.lifetime;
  const expiresOn = lifetime
    ? LIFETIME_EXPIRES
    : current && current.expires_on && current.expires_on > activation.expires_on
      ? current.expires_on
      : activation.expires_on;
  if (current) {
    if (
      current.last_activation_id !== activation.id ||
      current.expires_on !== expiresOn ||
      !!current.lifetime !== lifetime
    ) {
      await base44.asServiceRole.entities.PremiumEntitlement.update(current.id, {
        expires_on: expiresOn,
        lifetime,
        activation_count: count,
        last_activation_id: activation.id,
        last_code_masked: activation.code_masked,
      });
    }
    return current.id;
  }
  const created = await base44.asServiceRole.entities.PremiumEntitlement.create({
    user_id: userId,
    campaign_id: campaign.id,
    expires_on: expiresOn,
    lifetime,
    activation_count: count,
    last_activation_id: activation.id,
    last_code_masked: activation.code_masked,
  });
  return created.id;
}

export default async function (req) {
  let claimedCodeId = null;
  let activationCreated = false;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) =>
      error.status === 401 ? null : Promise.reject(error),
    );
    if (!user) return Response.json({ error: "Conectează-te pentru a activa codul." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const codeValue = normalizeCode(body.code);
    if (!isValidCode(codeValue)) {
      return Response.json(
        { error: "Codul are exact șase caractere: litere A–Z și cifre 0–9.", code: "invalid_format" },
        { status: 400 },
      );
    }

    const limit = await checkRateLimit(base44, user.id);
    if (!limit.allowed) {
      return Response.json(
        { error: "Prea multe încercări. Așteaptă câteva minute și reîncearcă.", code: "rate_limited" },
        { status: 429 },
      );
    }

    const campaign = await getDemoCampaign(base44);
    if (!campaign) {
      return Response.json(
        { error: "Campania demo nu este configurată. Activează mai întâi campania din administrare.", code: "no_campaign" },
        { status: 404 },
      );
    }

    const codeRows = await base44.asServiceRole.entities.PremiumCode.filter({ code: codeValue });
    const code = codeRows[0];
    if (!code) {
      return Response.json(
        { error: "Codul nu a fost găsit. Verifică literele și cifrele.", code: "not_found" },
        { status: 404 },
      );
    }

    const savedPage = await base44.asServiceRole.entities.PremiumActivation.filter(
      { user_id: user.id, code_id: code.id },
      { sort: "-created_date", limit: 1 },
    );
    const saved = savedPage.items || [];
    if (saved[0]) {
      await syncEntitlement(base44, user.id, campaign, saved[0]);
      return Response.json(activationResult(saved[0], { idempotent: true }));
    }

    // Un cod temporar nu are voie să retragă un acces pe viață deja acordat.
    const earlyEntitlementRows = await base44.asServiceRole.entities.PremiumEntitlement.filter({
      user_id: user.id,
      campaign_id: campaign.id,
    });
    if (earlyEntitlementRows[0]?.lifetime && !code.lifetime) {
      return Response.json({
        ok: true,
        lifetime: true,
        already_lifetime: true,
        months: 0,
        months_label: LIFETIME_LABEL,
        expires_on: LIFETIME_EXPIRES,
        expires_on_display: LIFETIME_LABEL,
        code_masked: maskCode(code.code),
      });
    }

    if (code.status === "disabled") {
      return Response.json(
        { error: "Codul nu mai este disponibil în această campanie.", code: "disabled" },
        { status: 410 },
      );
    }
    if (code.status === "claimed" && code.claimed_by_id && code.claimed_by_id !== user.id) {
      return Response.json(
        { error: "Codul a fost deja activat pe alt cont.", code: "already_used" },
        { status: 409 },
      );
    }

    return await withPremiumLock(base44, async () => {
      const freshRows = await base44.asServiceRole.entities.PremiumCode.filter({ id: code.id });
      const fresh = freshRows[0];
      if (!fresh) {
        return Response.json({ error: "Codul nu mai există.", code: "not_found" }, { status: 404 });
      }

      const againPage = await base44.asServiceRole.entities.PremiumActivation.filter(
        { user_id: user.id, code_id: fresh.id },
        { sort: "-created_date", limit: 1 },
      );
      const again = againPage.items || [];
      if (again[0]) {
        await syncEntitlement(base44, user.id, campaign, again[0]);
        return Response.json(activationResult(again[0], { idempotent: true }));
      }

      if (fresh.status === "claimed" && fresh.claimed_by_id && fresh.claimed_by_id !== user.id) {
        return Response.json(
          { error: "Codul a fost deja activat pe alt cont.", code: "already_used" },
          { status: 409 },
        );
      }
      if (fresh.status === "disabled") {
        return Response.json(
          { error: "Codul nu mai este disponibil în această campanie.", code: "disabled" },
          { status: 410 },
        );
      }

      if (fresh.status === "available") {
        await base44.asServiceRole.entities.PremiumCode.updateMany(
          { id: fresh.id, status: "available" },
          {
            $set: {
              status: "claimed",
              claimed_by_id: user.id,
              claimed_at: Date.now(),
              claim_token: crypto.randomUUID(),
            },
          },
        );
        const claimedRows = await base44.asServiceRole.entities.PremiumCode.filter({ id: fresh.id });
        if (!claimedRows[0] || claimedRows[0].claimed_by_id !== user.id) {
          return Response.json(
            { error: "Codul a fost activat chiar acum pe alt cont.", code: "already_used" },
            { status: 409 },
          );
        }
        claimedCodeId = fresh.id;
      }

      const priorCount = await base44.asServiceRole.entities.PremiumActivation.count({
        user_id: user.id,
        campaign_id: campaign.id,
      });
      const entitlementRows = await base44.asServiceRole.entities.PremiumEntitlement.filter({
        user_id: user.id,
        campaign_id: campaign.id,
      });
      const entitlement = entitlementRows[0] || null;
      if (entitlement?.lifetime && !fresh.lifetime) {
        return Response.json({
          ok: true,
          lifetime: true,
          already_lifetime: true,
          months: 0,
          months_label: LIFETIME_LABEL,
          expires_on: LIFETIME_EXPIRES,
          expires_on_display: LIFETIME_LABEL,
          code_masked: maskCode(fresh.code),
        });
      }
      const today = todayInBucharest();
      const first = priorCount === 0;
      const lifetime = !!fresh.lifetime;
      const months = lifetime ? 0 : first ? campaign.first_months : campaign.additional_months;
      const stillActive = entitlement ? isEntitlementActive(entitlement, today) : false;
      const baseDate = lifetime ? today : stillActive ? addDays(entitlement.expires_on, 1) : today;
      const expiresOn = lifetime ? LIFETIME_EXPIRES : addMonthsClamped(baseDate, months);

      const activation = await base44.asServiceRole.entities.PremiumActivation.create({
        user_id: user.id,
        campaign_id: campaign.id,
        batch_id: fresh.batch_id,
        code_id: fresh.id,
        code_masked: maskCode(fresh.code),
        months,
        lifetime,
        first_in_campaign: first,
        granted_from: baseDate,
        expires_on: expiresOn,
        previous_expires_on: entitlement?.expires_on || null,
        entitlement_id: entitlement?.id || null,
        idempotency_key: `${user.id}:${fresh.id}`,
      });
      activationCreated = true;

      const entitlementId = await syncEntitlement(base44, user.id, campaign, activation);
      await base44.asServiceRole.entities.PremiumActivation.update(activation.id, {
        entitlement_id: entitlementId,
      });
      await base44.asServiceRole.entities.PremiumCode.update(fresh.id, {
        activation_id: activation.id,
      });

      return Response.json(
        activationResult(activation, {
          entitlement_id: entitlementId,
          previous_expires_on_display: entitlement?.expires_on
            ? formatDateRo(entitlement.expires_on)
            : null,
        }),
      );
    });
  } catch (error) {
    if (claimedCodeId && !activationCreated) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.PremiumCode.updateMany(
          { id: claimedCodeId, activation_id: null },
          {
            $set: {
              status: "available",
              claimed_by_id: null,
              claimed_at: null,
              claim_token: null,
            },
          },
        );
      } catch {
        /* codul rămâne marcat; administrarea îl poate debloca */
      }
    }
    return Response.json(
      { error: error.message || "Activarea nu a reușit. Codul a fost păstrat; reîncearcă." },
      { status: 500 },
    );
  }
}