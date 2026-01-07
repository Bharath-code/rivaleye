import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock for S3 send function
const mockSend = vi.hoisted(() => vi.fn())

// Mock the S3Client to avoid AWS SDK initialization
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: class {
        send = mockSend
    },
    PutObjectCommand: class { },
    DeleteObjectsCommand: class { },
    ListObjectsV2Command: class { },
}))

import { getScreenshotUrl, uploadScreenshot, cleanupOldScreenshots } from '../screenshotStorage'

describe('screenshotStorage', () => {
    let originalEnv: Record<string, string | undefined>

    beforeEach(() => {
        originalEnv = {
            NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
        }
        mockSend.mockReset()
        vi.spyOn(console, 'warn').mockImplementation(() => { })
        vi.spyOn(console, 'error').mockImplementation(() => { })
        vi.spyOn(console, 'log').mockImplementation(() => { })
    })

    afterEach(() => {
        process.env.NEXT_PUBLIC_R2_PUBLIC_URL = originalEnv.NEXT_PUBLIC_R2_PUBLIC_URL
        vi.restoreAllMocks()
    })

    describe('getScreenshotUrl', () => {
        it('returns path when no base URL is configured', () => {
            delete process.env.NEXT_PUBLIC_R2_PUBLIC_URL

            const result = getScreenshotUrl('competitor-123/us/1234567890.webp')

            expect(result).toBe('competitor-123/us/1234567890.webp')
        })

        it('returns full URL when base URL is configured', () => {
            process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://cdn.example.com'

            const result = getScreenshotUrl('competitor-123/us/1234567890.webp')

            expect(result).toContain('https://cdn.example.com')
            expect(result).toContain('competitor-123/us/1234567890.webp')
        })

        it('adds format=webp parameter', () => {
            process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://cdn.example.com'

            const result = getScreenshotUrl('path/to/image.webp')

            expect(result).toContain('format=webp')
        })

        it('adds width parameter when provided', () => {
            process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://cdn.example.com'

            const result = getScreenshotUrl('path/to/image.webp', { width: 800 })

            expect(result).toContain('width=800')
        })

        it('adds quality parameter when provided', () => {
            process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://cdn.example.com'

            const result = getScreenshotUrl('path/to/image.webp', { quality: 85 })

            expect(result).toContain('quality=85')
        })

        it('adds both width and quality when provided', () => {
            process.env.NEXT_PUBLIC_R2_PUBLIC_URL = 'https://cdn.example.com'

            const result = getScreenshotUrl('path/to/image.webp', { width: 1200, quality: 90 })

            expect(result).toContain('width=1200')
            expect(result).toContain('quality=90')
        })
    })

    describe('uploadScreenshot', () => {
        it('returns success with path on successful upload', async () => {
            mockSend.mockResolvedValue({})

            const result = await uploadScreenshot('comp-123', 'us', Buffer.from('image-data'))

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.path).toContain('comp-123/us/')
                expect(result.path).toContain('.webp')
            }
        })

        it('returns error when S3 upload fails', async () => {
            mockSend.mockRejectedValue(new Error('S3 upload failed'))

            const result = await uploadScreenshot('comp-123', 'us', Buffer.from('image-data'))

            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error).toBe('S3 upload failed')
            }
        })

        it('generates path with timestamp', async () => {
            mockSend.mockResolvedValue({})

            const result = await uploadScreenshot('comp-123', 'eu', Buffer.from('image-data'))

            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.path).toMatch(/comp-123\/eu\/\d+\.webp/)
            }
        })
    })

    describe('cleanupOldScreenshots', () => {
        it('does nothing when fewer than keepLast screenshots exist', async () => {
            mockSend.mockResolvedValueOnce({
                Contents: [
                    { Key: 'comp-123/us/1.webp', LastModified: new Date() },
                    { Key: 'comp-123/us/2.webp', LastModified: new Date() },
                ],
            })

            await cleanupOldScreenshots('comp-123', 'us', 5)

            // Only List command should be called, not Delete
            expect(mockSend).toHaveBeenCalledTimes(1)
        })

        it('deletes old screenshots beyond keepLast limit', async () => {
            const now = Date.now()
            mockSend.mockResolvedValueOnce({
                Contents: [
                    { Key: 'comp-123/us/6.webp', LastModified: new Date(now) },
                    { Key: 'comp-123/us/5.webp', LastModified: new Date(now - 1000) },
                    { Key: 'comp-123/us/4.webp', LastModified: new Date(now - 2000) },
                    { Key: 'comp-123/us/3.webp', LastModified: new Date(now - 3000) },
                    { Key: 'comp-123/us/2.webp', LastModified: new Date(now - 4000) },
                    { Key: 'comp-123/us/1.webp', LastModified: new Date(now - 5000) },
                ],
            }).mockResolvedValueOnce({}) // Delete command

            await cleanupOldScreenshots('comp-123', 'us', 5)

            // List + Delete
            expect(mockSend).toHaveBeenCalledTimes(2)
        })

        it('handles empty Contents gracefully', async () => {
            mockSend.mockResolvedValueOnce({
                Contents: undefined,
            })

            await cleanupOldScreenshots('comp-123', 'us', 5)

            // Should not throw
            expect(mockSend).toHaveBeenCalledTimes(1)
        })

        it('handles S3 errors gracefully', async () => {
            mockSend.mockRejectedValue(new Error('S3 error'))

            // Should not throw
            await cleanupOldScreenshots('comp-123', 'us', 5)
        })
    })
})
