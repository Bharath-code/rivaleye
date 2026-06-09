import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Tunnel Route
 *
 * Browser events are POSTed here, then forwarded to Sentry's ingest URL.
 * This bypasses ad-blockers that target sentry.io.
 *
 * See: https://docs.sentry.io/platforms/javascript/tracing/#using-tunneling
 */

const SENTRY_HOST = "o450000000000000.ingest.sentry.io"; // placeholder, replaced at build
const SENTRY_PROJECT_IDS = ["0000000"]; // replaced at build via withSentryConfig

export async function POST(request: NextRequest) {
    try {
        const envelope = await request.text();
        const piece = envelope.split("\n")[0];
        const header = JSON.parse(piece);
        const dsn = new URL(header.dsn);
        const project_id = dsn.pathname.replace("/", "");

        if (!SENTRY_PROJECT_IDS.includes(project_id)) {
            return NextResponse.json({ error: "Invalid project" }, { status: 400 });
        }

        const upstreamUrl = `https://${SENTRY_HOST}/api/${project_id}/envelope/`;
        const upstream = await fetch(upstreamUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-sentry-envelope" },
            body: envelope,
        });

        return new NextResponse(null, { status: upstream.status });
    } catch (err) {
        Sentry.captureException(err);
        return NextResponse.json({ error: "Tunnel failed" }, { status: 500 });
    }
}
