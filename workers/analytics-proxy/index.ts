export default {
    async fetch(request: any, env: any) {
        const url = new URL(request.url);
        const hostname = url.hostname;

        // Handle incoming telemetry from the frontend
        // We assume the frontend hits https://rivaleye.com/ingress/*
        if (url.pathname.startsWith('/ingress')) {
            const posthogHost = 'https://app.posthog.com'; // Adjust if using EU region
            const targetUrl = new URL(posthogHost + url.pathname.replace('/ingress', ''));

            // Clone request to keep body and method
            const newRequest = new Request(targetUrl, request);

            // DE-IDENTIFY: Essential for privacy and solo-founder safety
            // We strip IP-related headers so the data is anonymized at the edge
            newRequest.headers.delete('cf-connecting-ip');
            newRequest.headers.delete('true-client-ip');
            newRequest.headers.delete('x-real-ip');
            newRequest.headers.delete('x-forwarded-for');

            // Set the proper Host header for PostHog
            newRequest.headers.set('Host', 'app.posthog.com');

            return fetch(newRequest);
        }

        // Default: Forward to the main site (if this worker is used as a full proxy)
        // or return a 404 if it's only for the /ingress route.
        return new Response('Not Found', { status: 404 });
    }
}
