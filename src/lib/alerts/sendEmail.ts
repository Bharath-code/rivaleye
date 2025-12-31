import { Resend } from "resend";
import type { AIInsight } from "@/lib/types";

/**
 * Email Alert Sender
 * 
 * Sends professional, calm competitor alerts via Resend.
 * No hype, no urgency, no emojis. Just facts and insights.
 */

function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error("Missing RESEND_API_KEY environment variable");
    }
    return new Resend(apiKey);
}

interface AlertEmailParams {
    to: string;
    competitorName: string;
    pageUrl: string;
    insight: AIInsight;
}

export async function sendAlertEmail(params: AlertEmailParams): Promise<boolean> {
    const { to, competitorName, pageUrl, insight } = params;

    try {
        const client = getResendClient();

        const subject = `${competitorName} made a change — here's what it may mean`;

        const htmlContent = buildEmailHtml(competitorName, pageUrl, insight);
        const textContent = buildEmailText(competitorName, pageUrl, insight);

        const result = await client.emails.send({
            from: process.env.RESEND_FROM_EMAIL || "RivalEye <alerts@rivaleye.io>",
            to,
            subject,
            html: htmlContent,
            text: textContent,
        });

        if (result.error) {
            console.error("Error sending email:", result.error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error sending alert email:", error);
        return false;
    }
}

function buildEmailHtml(
    competitorName: string,
    pageUrl: string,
    insight: AIInsight
): string {
    const confidenceLabel = {
        high: "High confidence signal",
        medium: "Notable signal",
        low: "Possible signal",
    }[insight.confidence];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Competitor Alert: ${competitorName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0E1A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Header -->
    <div style="margin-bottom: 32px;">
      <div style="display: inline-block; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 4px 12px; font-size: 12px; color: #10B981; margin-bottom: 16px;">
        ${confidenceLabel}
      </div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #F0F4F8; line-height: 1.3;">
        ${competitorName} changed their page
      </h1>
      <p style="margin: 8px 0 0; font-size: 14px; color: #94A3B8;">
        Monitored page: ${pageUrl}
      </p>
    </div>
    
    <!-- What Changed -->
    <div style="background: #111827; border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px;">
        What Changed
      </h2>
      <p style="margin: 0; font-size: 16px; color: #F0F4F8; line-height: 1.6;">
        ${insight.whatChanged}
      </p>
    </div>
    
    <!-- Why It Matters -->
    <div style="background: #111827; border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px;">
        Why This May Matter
      </h2>
      <p style="margin: 0; font-size: 16px; color: #F0F4F8; line-height: 1.6;">
        ${insight.whyItMatters}
      </p>
    </div>
    
    <!-- What To Do -->
    <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 24px; margin-bottom: 32px;">
      <h2 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #10B981; text-transform: uppercase; letter-spacing: 0.5px;">
        What To Consider
      </h2>
      <p style="margin: 0; font-size: 16px; color: #F0F4F8; line-height: 1.6;">
        ${insight.whatToDo}
      </p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding-top: 24px; border-top: 1px solid rgba(148, 163, 184, 0.1);">
      <p style="margin: 0; font-size: 13px; color: #64748B;">
        This alert was sent by <span style="color: #10B981;">RivalEye</span>
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #475569;">
        Competitive intelligence that thinks.
      </p>
    </div>
    
  </div>
</body>
</html>
`;
}

function buildEmailText(
    competitorName: string,
    pageUrl: string,
    insight: AIInsight
): string {
    return `
${competitorName} made a change
Monitored page: ${pageUrl}

━━━━━━━━━━━━━━━━━━━━━━

WHAT CHANGED
${insight.whatChanged}

WHY THIS MAY MATTER
${insight.whyItMatters}

WHAT TO CONSIDER
${insight.whatToDo}

━━━━━━━━━━━━━━━━━━━━━━

Sent by RivalEye — Competitive intelligence that thinks.
`.trim();
}
