'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { ReactNode, useEffect } from 'react';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://rivaleye.com/ingress';

        if (key && typeof window !== 'undefined') {
            posthog.init(key, {
                api_host: host,
                ui_host: 'https://app.posthog.com',
                person_profiles: 'always', // or 'identified_only'
                capture_pageview: true,
                // Disable IP capture on the client side just in case (the worker does it too)
                ip: false,
            });
        }
    }, []);

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
