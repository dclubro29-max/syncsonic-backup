import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import {
  LIFETIME_LABEL,
  formatDateRo,
  getDemoCampaign,
  isEntitlementActive,
  monthsLabel,
  todayInBucharest,
} from "../../shared/premium.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((error) =>
      error.status === 401 ? null : Promise.reject(error),
    );
    if (!user) return Response.json({ error: "Neautentificat." }, { status: 401 });

    const campaign = await getDemoCampaign(base44);
    if (!campaign) {
      return Response.json({
        campaign: null,
        entitlement: null,
        history: [],
        active: false,
        today: todayInBucharest(),
      });
    }

    const [entitlementRows, activationPage] = await Promise.all([
      base44.asServiceRole.entities.PremiumEntitlement.filter({
        user_id: user.id,
        campaign_id: campaign.id,
      }),
      base44.asServiceRole.entities.PremiumActivation.filter(
        { user_id: user.id, campaign_id: campaign.id },
        { sort: "-created_date", limit: 20 },
      ),
    ]);

    const activations = activationPage.items || [];
    const entitlement = entitlementRows[0] || null;
    const today = todayInBucharest();
    const active = isEntitlementActive(entitlement, today);
    const lifetime = !!entitlement?.lifetime;

    return Response.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        country: campaign.country,
        product: campaign.product,
        first_months: campaign.first_months,
        additional_months: campaign.additional_months,
        pilot_quota: campaign.pilot_quota,
        price_lei: campaign.price_lei,
        demo: campaign.demo,
        terms: campaign.terms,
      },
      entitlement: entitlement
        ? {
            expires_on: entitlement.expires_on,
            expires_on_display: lifetime ? LIFETIME_LABEL : formatDateRo(entitlement.expires_on),
            lifetime,
            activation_count: entitlement.activation_count || 0,
            last_code_masked: entitlement.last_code_masked || null,
            active,
          }
        : null,
      active,
      lifetime,
      today,
      history: activations.map((item) => ({
        id: item.id,
        code_masked: item.code_masked,
        months: item.months,
        months_label: item.lifetime ? LIFETIME_LABEL : monthsLabel(item.months),
        lifetime: !!item.lifetime,
        first_in_campaign: item.first_in_campaign,
        granted_from: item.granted_from,
        expires_on: item.expires_on,
        expires_on_display: item.lifetime ? LIFETIME_LABEL : formatDateRo(item.expires_on),
        created_date: item.created_date,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Starea Premium nu a putut fi citită." },
      { status: 500 },
    );
  }
}