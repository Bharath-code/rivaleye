import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { encrypt, decrypt, isEncrypted, encryptWebhookUrl, decryptWebhookUrl } from '../encryption'

// Test encryption key (64 hex chars = 32 bytes for AES-256)
const TEST_ENCRYPTION_KEY = 'a'.repeat(64)

describe('encryption', () => {
    let originalEnv: string | undefined

    beforeAll(() => {
        originalEnv = process.env.ENCRYPTION_KEY
        process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    })

    afterAll(() => {
        if (originalEnv !== undefined) {
            process.env.ENCRYPTION_KEY = originalEnv
        } else {
            delete process.env.ENCRYPTION_KEY
        }
    })

    describe('encrypt', () => {
        it('returns a valid base64 string', () => {
            const result = encrypt('hello world')
            expect(result).toMatch(/^[A-Za-z0-9+/]+=*$/)
        })

        it('produces different ciphertext for same plaintext (random IV)', () => {
            const text = 'hello world'
            const encrypted1 = encrypt(text)
            const encrypted2 = encrypt(text)
            expect(encrypted1).not.toBe(encrypted2)
        })

        it('handles empty string', () => {
            const result = encrypt('')
            expect(result).toBeTruthy()
            expect(typeof result).toBe('string')
        })

        it('handles unicode characters', () => {
            const text = '日本語 🎉 émojis'
            const encrypted = encrypt(text)
            expect(encrypted).toBeTruthy()
        })

        it('handles long text', () => {
            const longText = 'a'.repeat(10000)
            const encrypted = encrypt(longText)
            expect(encrypted).toBeTruthy()
        })
    })

    describe('decrypt', () => {
        it('decrypts an encrypted string correctly', () => {
            const original = 'hello world'
            const encrypted = encrypt(original)
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe(original)
        })

        it('decrypts unicode characters correctly', () => {
            const original = '日本語 🎉 émojis'
            const encrypted = encrypt(original)
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe(original)
        })

        it('decrypts empty string correctly', () => {
            const encrypted = encrypt('')
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe('')
        })

        it('decrypts long text correctly', () => {
            const original = 'a'.repeat(10000)
            const encrypted = encrypt(original)
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe(original)
        })

        it('throws on invalid base64', () => {
            expect(() => decrypt('not-valid-base64!!!')).toThrow()
        })

        it('throws on tampered ciphertext', () => {
            const encrypted = encrypt('hello')
            // Tamper with the ciphertext
            const tampered = encrypted.slice(0, -2) + 'XX'
            expect(() => decrypt(tampered)).toThrow()
        })
    })

    describe('isEncrypted', () => {
        it('returns true for encrypted data', () => {
            const encrypted = encrypt('test')
            expect(isEncrypted(encrypted)).toBe(true)
        })

        it('returns false for plain text', () => {
            expect(isEncrypted('hello world')).toBe(false)
        })

        it('returns false for short base64', () => {
            // Base64 that decodes to less than IV + auth tag (32 bytes)
            expect(isEncrypted(btoa('short'))).toBe(false)
        })

        it('returns false for empty string', () => {
            expect(isEncrypted('')).toBe(false)
        })

        it('returns false for invalid base64', () => {
            expect(isEncrypted('not-base64!!!')).toBe(false)
        })

        it('returns true for base64 with sufficient length', () => {
            // Create a base64 string that represents > 32 bytes
            const longEnough = Buffer.alloc(64).toString('base64')
            expect(isEncrypted(longEnough)).toBe(true)
        })
    })

    describe('encryptWebhookUrl', () => {
        it('encrypts a valid https URL', () => {
            const url = 'https://hooks.slack.com/services/xxx/yyy'
            const encrypted = encryptWebhookUrl(url)
            expect(encrypted).toBeTruthy()
            expect(encrypted).not.toBe(url)
        })

        it('returns null for null input', () => {
            expect(encryptWebhookUrl(null)).toBeNull()
        })

        it('returns null for undefined input', () => {
            expect(encryptWebhookUrl(undefined)).toBeNull()
        })

        it('returns null for non-https URL', () => {
            expect(encryptWebhookUrl('http://example.com')).toBeNull()
        })

        it('returns null for empty string', () => {
            expect(encryptWebhookUrl('')).toBeNull()
        })

        it('returns null for invalid URL', () => {
            expect(encryptWebhookUrl('not-a-url')).toBeNull()
        })

        it('returns null for already encrypted data (not https://)', () => {
            const url = 'https://hooks.slack.com/services/xxx'
            const encrypted = encryptWebhookUrl(url)
            // Encrypted data doesn't start with https://, so it returns null
            // This is expected behavior - you can't re-encrypt encrypted data
            const result = encryptWebhookUrl(encrypted!)
            expect(result).toBeNull()
        })
    })

    describe('decryptWebhookUrl', () => {
        it('decrypts an encrypted webhook URL', () => {
            const url = 'https://hooks.slack.com/services/xxx'
            const encrypted = encryptWebhookUrl(url)
            const decrypted = decryptWebhookUrl(encrypted)
            expect(decrypted).toBe(url)
        })

        it('returns null for null input', () => {
            expect(decryptWebhookUrl(null)).toBeNull()
        })

        it('returns null for undefined input', () => {
            expect(decryptWebhookUrl(undefined)).toBeNull()
        })

        it('returns the URL as-is if already in plain https format', () => {
            const url = 'https://example.com'
            expect(decryptWebhookUrl(url)).toBe(url)
        })

        it('returns null for invalid encrypted data', () => {
            // Use console.error mock to verify error is logged
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })
            const result = decryptWebhookUrl('invalid-encrypted-data')
            expect(result).toBeNull()
            expect(consoleSpy).toHaveBeenCalled()
            consoleSpy.mockRestore()
        })
    })

    describe('missing encryption key', () => {
        it('throws error when ENCRYPTION_KEY is not set', () => {
            const originalKey = process.env.ENCRYPTION_KEY
            delete process.env.ENCRYPTION_KEY

            expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set')

            process.env.ENCRYPTION_KEY = originalKey
        })
    })

    describe('key derivation', () => {
        it('works with non-hex key (SHA-256 derivation)', () => {
            const originalKey = process.env.ENCRYPTION_KEY
            process.env.ENCRYPTION_KEY = 'my-secret-password' // Not 64 chars

            const encrypted = encrypt('test')
            const decrypted = decrypt(encrypted)
            expect(decrypted).toBe('test')

            process.env.ENCRYPTION_KEY = originalKey
        })
    })
})
