import { describe, it, expect } from 'vitest'
import { normalizeText, hashText, createNormalizedSnapshot } from '../normalize'

describe('normalize', () => {
    describe('normalizeText', () => {
        it('converts text to lowercase', () => {
            const result = normalizeText('HELLO WORLD')
            expect(result).toBe('hello world')
        })

        it('removes copyright notices', () => {
            const result = normalizeText('Content here © 2024 Company Name')
            expect(result).not.toContain('© 2024')
        })

        it('removes "all rights reserved"', () => {
            const result = normalizeText('Some text. All rights reserved.')
            expect(result).not.toContain('all rights reserved')
        })

        it('removes privacy policy mentions', () => {
            const result = normalizeText('Check our Privacy Policy for details')
            expect(result).not.toContain('privacy policy')
        })

        it('removes URLs', () => {
            const result = normalizeText('Visit https://example.com for more')
            expect(result).not.toContain('https://')
        })

        it('removes email addresses', () => {
            const result = normalizeText('Contact us at hello@example.com')
            expect(result).not.toContain('hello@example.com')
        })

        it('normalizes whitespace', () => {
            const result = normalizeText('Multiple    spaces   and\n\nnewlines')
            expect(result).toBe('multiple spaces and newlines')
        })

        it('normalizes em-dashes to regular dashes', () => {
            // The normalize function converts em-dashes (—) and en-dashes (–) to regular dashes
            const result = normalizeText('price—monthly or yearly')
            expect(result).toContain('price-monthly')
        })

        it('removes relative time expressions', () => {
            const result = normalizeText('Updated 5 days ago')
            expect(result).not.toContain('days ago')
        })

        it('truncates very long text', () => {
            const longText = 'A'.repeat(5000)
            const result = normalizeText(longText)
            expect(result.length).toBeLessThanOrEqual(4000)
        })

        it('truncates at sentence boundary for long text', () => {
            // Create text > 4000 chars with a sentence boundary around 3500
            const part1 = 'A'.repeat(3500)
            const sentenceBoundary = '. '
            const part2 = 'B'.repeat(1000)
            const longText = part1 + sentenceBoundary + part2

            const result = normalizeText(longText)

            // Should truncate at the '. ' which is at index approx 3501
            expect(result.length).toBeLessThanOrEqual(3501)
            expect(result.endsWith('.')).toBe(true)
        })


        it('removes testimonial sections', () => {
            const result = normalizeText('Pricing info here. Testimonials: John said it was great. More content.')
            expect(result).not.toContain('john said')
        })

        it('removes FAQ sections', () => {
            const result = normalizeText('Features list. FAQ How do I start? Answer here.')
            expect(result).not.toContain('how do i start')
        })
    })

    describe('hashText', () => {
        it('returns a consistent hash for the same input', () => {
            const hash1 = hashText('hello world')
            const hash2 = hashText('hello world')
            expect(hash1).toBe(hash2)
        })

        it('returns different hashes for different inputs', () => {
            const hash1 = hashText('hello world')
            const hash2 = hashText('hello world!')
            expect(hash1).not.toBe(hash2)
        })

        it('returns a 64-character hex string (SHA-256)', () => {
            const hash = hashText('test')
            expect(hash).toMatch(/^[a-f0-9]{64}$/)
        })
    })

    describe('createNormalizedSnapshot', () => {
        it('returns both normalizedText and hash', () => {
            const snapshot = createNormalizedSnapshot('HELLO WORLD')
            expect(snapshot).toHaveProperty('normalizedText')
            expect(snapshot).toHaveProperty('hash')
        })

        it('normalizes text before hashing', () => {
            const snapshot = createNormalizedSnapshot('HELLO WORLD')
            expect(snapshot.normalizedText).toBe('hello world')
        })

        it('produces consistent snapshots', () => {
            const s1 = createNormalizedSnapshot('Test content')
            const s2 = createNormalizedSnapshot('Test content')
            expect(s1.hash).toBe(s2.hash)
        })
    })
})
