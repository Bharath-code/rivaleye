import crypto from "crypto";

/**
 * Encryption Utilities
 * 
 * Provides AES-256-GCM encryption for sensitive data like Slack webhook URLs.
 * Uses a secret key from environment variables.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment variable.
 * Key must be 32 bytes (256 bits) for AES-256.
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
        throw new Error("ENCRYPTION_KEY environment variable is not set");
    }

    // If key is a hex string (64 chars = 32 bytes), decode it
    if (key.length === 64) {
        return Buffer.from(key, "hex");
    }

    // Otherwise use SHA-256 to derive a key from the secret
    return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt a string value.
 * Returns a base64-encoded string containing: IV + encrypted data + auth tag
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    // Combine: IV (16 bytes) + auth tag (16 bytes) + encrypted data
    const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, "base64")
    ]);

    return combined.toString("base64");
}

/**
 * Decrypt an encrypted string.
 * Expects a base64-encoded string containing: IV + auth tag + encrypted data
 */
export function decrypt(encryptedData: string): string {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, "base64");

    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
}

/**
 * Check if a string appears to be encrypted (base64 with proper length).
 */
export function isEncrypted(value: string): boolean {
    try {
        const decoded = Buffer.from(value, "base64");
        // Minimum length: IV (16) + auth tag (16) + at least 1 byte of data
        return decoded.length > IV_LENGTH + AUTH_TAG_LENGTH;
    } catch {
        return false;
    }
}

/**
 * Safely encrypt a webhook URL.
 * Returns encrypted value if valid URL, otherwise returns null.
 */
export function encryptWebhookUrl(url: string | null | undefined): string | null {
    if (!url || !url.startsWith("https://")) {
        return null;
    }

    // Don't double-encrypt
    if (isEncrypted(url)) {
        return url;
    }

    return encrypt(url);
}

/**
 * Safely decrypt a webhook URL.
 * Returns decrypted URL or null if decryption fails.
 */
export function decryptWebhookUrl(encryptedUrl: string | null | undefined): string | null {
    if (!encryptedUrl) {
        return null;
    }

    // If it's already a plain URL (not encrypted), return as-is
    if (encryptedUrl.startsWith("https://")) {
        return encryptedUrl;
    }

    try {
        return decrypt(encryptedUrl);
    } catch (error) {
        console.error("[Encryption] Failed to decrypt webhook URL:", error);
        return null;
    }
}
