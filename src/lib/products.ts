import { PLAN_PRICING } from "@/lib/billing/featureFlags";

export type Product = {
  product_id: string;
  name: string;
  description: string;
  price: number; // in cents
  features: string[];
};

/**
 * RivalEye plans. Prices are derived from PLAN_PRICING (single source of
 * truth) — do NOT hardcode dollar amounts here.
 *
 * `product_id` is the Dodo product that charges the card; it comes from env
 * so test/live modes use the right product. Previously this file shipped a
 * Dodo template placeholder (Basic $9.99 / Premium $199.99) — that was dead
 * code and a mispricing landmine if ever wired into checkout (BIZ-1).
 */
export const products: Product[] = [
  {
    product_id: process.env.DODO_PRO_PRODUCT_ID ?? "",
    name: "Pro",
    description: "Full competitive intelligence: 5 competitors, 4 regions, AI tactical briefs, AEO visibility, Slack alerts.",
    price: PLAN_PRICING.pro.monthly * 100,
    features: [
      "5 competitors",
      "4 regions (US, EU, IN, Global)",
      "AI tactical briefs",
      "Tech stack + branding alerts",
      "AEO / AI-visibility scorecard",
      "Slack integration",
      "Unlimited alert history",
    ],
  },
];
