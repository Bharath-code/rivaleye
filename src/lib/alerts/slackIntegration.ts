/**
 * Slack Integration Helper
 * 
 * Simple utility to push formatted alerts to Slack.
 */

import { decryptWebhookUrl } from "@/lib/encryption";

export async function pushToSlack(payload: {
    title: string;
    description: string;
    competitorName: string;
    link?: string;
    playbook?: {
        salesDraft?: string;
    };
    webhookUrl?: string; // Custom webhook URL (per-user, may be encrypted)
}) {
    // Decrypt webhook URL if it's encrypted
    let webhookUrl = payload.webhookUrl
        ? decryptWebhookUrl(payload.webhookUrl)
        : process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
        console.warn("[Slack] No webhook URL configured.");
        return { success: false, error: "No Slack webhook URL configured" };
    }

    const slackPayload = {
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `🚨 RIVAL SIGNAL: ${payload.competitorName}`,
                    emoji: true,
                },
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${payload.title}*\n${payload.description}`,
                },
            },
            ...(payload.playbook?.salesDraft ? [
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Tactical Sales Draft:*\n\`\`\`${payload.playbook.salesDraft}\`\`\``,
                    },
                }
            ] : []),
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "View Alert in RivalEye",
                            emoji: true,
                        },
                        url: payload.link || "https://rivaleye.com/dashboard",
                        style: "primary",
                    },
                ],
            },
        ],
    };

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload),
        });

        if (!response.ok) {
            throw new Error(`Slack API error: ${response.statusText}`);
        }

        return { success: true };
    } catch (error) {
        console.error("[Slack] Push failed:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}
