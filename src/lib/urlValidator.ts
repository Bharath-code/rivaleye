/**
 * URL Validation & SSRF Protection
 *
 * Prevents users from submitting internal/private network URLs
 * as competitor pages, which could cause SSRF attacks.
 */

// Private/reserved IP ranges (RFC 1918, RFC 6598, etc.)
const PRIVATE_IP_PATTERNS = [
    /^127\./,                    // Loopback
    /^10\./,                     // Class A private
    /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
    /^192\.168\./,               // Class C private
    /^169\.254\./,               // Link-local
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGN (RFC 6598)
    /^0\./,                      // "This" network
    /^fc/i,                      // IPv6 unique local
    /^fe80/i,                    // IPv6 link-local
    /^::1$/,                     // IPv6 loopback
];

const BLOCKED_HOSTNAMES = new Set([
    "localhost",
    "0.0.0.0",
    "[::]",
    "[::1]",
    "metadata.google.internal",      // GCP metadata
    "169.254.169.254",               // AWS/GCP/Azure metadata endpoint
    "metadata.google.internal.",
]);

const BLOCKED_PROTOCOLS = new Set([
    "file:",
    "ftp:",
    "data:",
    "javascript:",
    "vbscript:",
]);

export interface UrlValidationResult {
    valid: boolean;
    error?: string;
    sanitizedUrl?: string;
}

/**
 * Validate and sanitize a competitor URL.
 * Blocks SSRF vectors: private IPs, metadata endpoints, non-HTTP protocols.
 */
export function validateCompetitorUrl(url: string): UrlValidationResult {
    // Trim whitespace
    const trimmed = url.trim();

    if (!trimmed) {
        return { valid: false, error: "URL is required" };
    }

    // Parse URL
    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        return { valid: false, error: "Invalid URL format" };
    }

    // Block non-HTTP protocols
    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
        return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { valid: false, error: "Only HTTP and HTTPS URLs are allowed" };
    }

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
        return { valid: false, error: "Only HTTPS URLs are allowed" };
    }

    // Block known dangerous hostnames
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(hostname)) {
        return { valid: false, error: "This URL cannot be monitored" };
    }

    // Block private/reserved IP addresses
    for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(hostname)) {
            return { valid: false, error: "Private network URLs cannot be monitored" };
        }
    }

    // Block URLs with credentials
    if (parsed.username || parsed.password) {
        return { valid: false, error: "URLs with credentials are not allowed" };
    }

    // Block non-standard ports (common SSRF vector)
    const port = parsed.port ? parseInt(parsed.port, 10) : null;
    if (port && port !== 80 && port !== 443) {
        return { valid: false, error: "Only standard HTTP/HTTPS ports are allowed" };
    }

    // Reconstruct clean URL (strips fragments, normalizes)
    const sanitizedUrl = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${parsed.search}`;

    return { valid: true, sanitizedUrl };
}
