import { Webhooks } from "@dodopayments/nextjs";
import { createServerClient } from "@/lib/supabase";

/**
 * Dodo Payments Webhook Handler
 *
 * Handles subscription lifecycle events and updates user records.
 */

export const POST = Webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,

  onSubscriptionActive: async (payload) => {
    console.log("Received onSubscriptionActive webhook:", payload);

    try {
      const supabase = createServerClient();

      // Extract customer info from payload
      const customerId = payload.data?.customer?.customer_id;
      const subscriptionId = payload.data?.subscription_id;
      const customerEmail = payload.data?.customer?.email;

      if (!customerEmail) {
        console.error("No customer email in payload");
        return;
      }

      // Update user record
      const { error } = await supabase
        .from("users")
        .update({
          plan: "pro",
          dodo_customer_id: customerId,
          dodo_subscription_id: subscriptionId,
          subscription_status: "active",
        })
        .eq("email", customerEmail);

      if (error) {
        console.error("Error updating user subscription:", error);
      } else {
        console.log(`User ${customerEmail} upgraded to Pro`);
      }
    } catch (error) {
      console.error("Webhook processing error:", error);
    }
  },

  onSubscriptionCancelled: async (payload) => {
    console.log("Received onSubscriptionCancelled webhook:", payload);

    try {
      const supabase = createServerClient();
      const customerEmail = payload.data?.customer?.email;

      if (!customerEmail) {
        console.error("No customer email in payload");
        return;
      }

      // Downgrade user
      const { error } = await supabase
        .from("users")
        .update({
          plan: "free",
          subscription_status: "cancelled",
        })
        .eq("email", customerEmail);

      if (error) {
        console.error("Error updating user subscription:", error);
      } else {
        console.log(`User ${customerEmail} downgraded to Free`);
      }
    } catch (error) {
      console.error("Webhook processing error:", error);
    }
  },

  onPaymentSucceeded: async (payload) => {
    console.log("Received onPaymentSucceeded webhook:", payload);
    // Payment logging for auditing — subscription is handled separately
  },
});
