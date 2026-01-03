'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { ReactNode, useEffect } from 'react';

/**
 * Analytics Event Helpers
 * 
 * Use these to track North Star and acquisition metrics.
 */
export const analytics = {
    // Acquisition
    ctaClicked: (button: 'hero' | 'pricing' | 'demo' | 'footer') =>
        posthog.capture('cta_clicked', { button }),
    signupStarted: () =>
        posthog.capture('signup_started'),
    signupCompleted: (method: 'email' | 'google' | 'github') =>
        posthog.capture('signup_completed', { method }),

    // Activation
    onboardingCompetitorAdded: () =>
        posthog.capture('onboarding_competitor_added'),
    onboardingCompleted: () =>
        posthog.capture('onboarding_completed'),
    firstScanCompleted: () =>
        posthog.capture('first_scan_completed'),
    firstAlertReceived: () =>
        posthog.capture('first_alert_received'),

    // Engagement
    alertViewed: (alertId: string, severity: string) =>
        posthog.capture('alert_viewed', { alert_id: alertId, severity }),
    screenshotViewed: () =>
        posthog.capture('screenshot_viewed'),
    dashboardVisit: (daysSinceSignup: number) =>
        posthog.capture('dashboard_visit', { days_since_signup: daysSinceSignup }),
    competitorAdded: (totalCount: number) =>
        posthog.capture('competitor_added', { total_count: totalCount }),
    manualScanTriggered: () =>
        posthog.capture('manual_scan_triggered'),

    // Revenue
    upgradeModalViewed: () =>
        posthog.capture('upgrade_modal_viewed'),
    checkoutStarted: (plan: string) =>
        posthog.capture('checkout_started', { plan }),
    paymentCompleted: (plan: string, mrr: number) =>
        posthog.capture('payment_completed', { plan, mrr }),
    churnInitiated: () =>
        posthog.capture('churn_initiated'),
};

export function AnalyticsProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://rivaleye.com/ingress';

        if (key && typeof window !== 'undefined') {
            posthog.init(key, {
                api_host: host,
                ui_host: 'https://app.posthog.com',
                person_profiles: 'always',
                capture_pageview: true,
                ip: false,
            });
        }
    }, []);

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
