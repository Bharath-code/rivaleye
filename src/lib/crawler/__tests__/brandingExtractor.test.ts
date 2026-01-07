import { describe, it, expect, vi } from 'vitest'

// Mock Firecrawl to avoid API calls
vi.mock('@mendable/firecrawl-js', () => ({
    default: class {
        scrape = vi.fn()
    },
}))

import {
    compareBranding,
    type ExtractedBranding,
    type BrandingColors,
} from '../brandingExtractor'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockBranding(overrides: Partial<ExtractedBranding> = {}): ExtractedBranding {
    return {
        colorScheme: 'light',
        colors: {
            primary: '#007bff',
            secondary: '#6c757d',
            accent: '#28a745',
            background: '#ffffff',
            textPrimary: '#212529',
            textSecondary: '#6c757d',
        },
        fonts: ['Inter', 'Roboto'],
        typography: {
            fontFamilies: { primary: 'Inter', heading: 'Inter', code: 'Fira Code' },
            fontSizes: { h1: '3rem', h2: '2.5rem', h3: '2rem', body: '1rem' },
            fontWeights: { regular: 400, medium: 500, bold: 700 },
        },
        spacing: { baseUnit: 4, borderRadius: '8px' },
        components: { buttonPrimary: null, input: null },
        assets: { logo: 'https://example.com/logo.png', favicon: null, ogImage: null },
        extractedAt: new Date().toISOString(),
        ...overrides,
    }
}

describe('brandingExtractor', () => {
    describe('compareBranding', () => {
        it('returns no changes when branding is identical', () => {
            const branding = createMockBranding()
            const diff = compareBranding(branding, branding)

            expect(diff.hasChanges).toBe(false)
            expect(diff.changes).toHaveLength(0)
            expect(diff.summary).toBe('No branding changes detected')
        })

        it('detects color scheme change', () => {
            const oldBranding = createMockBranding({ colorScheme: 'light' })
            const newBranding = createMockBranding({ colorScheme: 'dark' })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.hasChanges).toBe(true)
            expect(diff.changes.some(c => c.type === 'theme')).toBe(true)
            expect(diff.summary).toContain('rebrand')
        })

        it('detects primary color change', () => {
            const oldBranding = createMockBranding({
                colors: { primary: '#007bff', secondary: null, accent: null, background: null, textPrimary: null, textSecondary: null },
            })
            const newBranding = createMockBranding({
                colors: { primary: '#ff5722', secondary: null, accent: null, background: null, textPrimary: null, textSecondary: null },
            })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.hasChanges).toBe(true)
            const colorChange = diff.changes.find(c => c.field === 'primary')
            expect(colorChange).toBeDefined()
            expect(colorChange?.type).toBe('color')
            expect(colorChange?.oldValue).toBe('#007bff')
            expect(colorChange?.newValue).toBe('#ff5722')
        })

        it('detects multiple color changes', () => {
            const oldColors: BrandingColors = {
                primary: '#007bff',
                secondary: '#6c757d',
                accent: '#28a745',
                background: '#ffffff',
                textPrimary: '#212529',
                textSecondary: '#6c757d',
            }
            const newColors: BrandingColors = {
                primary: '#ff5722',
                secondary: '#9c27b0',
                accent: '#4caf50',
                background: '#121212',
                textPrimary: '#212529',
                textSecondary: '#6c757d',
            }

            const oldBranding = createMockBranding({ colors: oldColors })
            const newBranding = createMockBranding({ colors: newColors })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.hasChanges).toBe(true)
            expect(diff.changes.filter(c => c.type === 'color').length).toBeGreaterThanOrEqual(3)
            expect(diff.summary).toContain('Color palette')
        })

        it('detects font changes', () => {
            const oldBranding = createMockBranding({ fonts: ['Inter', 'Roboto'] })
            const newBranding = createMockBranding({ fonts: ['Outfit', 'Poppins'] })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.hasChanges).toBe(true)
            const typographyChange = diff.changes.find(c => c.type === 'typography')
            expect(typographyChange).toBeDefined()
        })

        it('detects logo change', () => {
            const oldBranding = createMockBranding({
                assets: { logo: 'https://example.com/old.png', favicon: null, ogImage: null },
            })
            const newBranding = createMockBranding({
                assets: { logo: 'https://example.com/new.png', favicon: null, ogImage: null },
            })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.hasChanges).toBe(true)
            const assetChange = diff.changes.find(c => c.type === 'asset')
            expect(assetChange).toBeDefined()
            expect(diff.summary).toContain('asset')
        })

        it('summarizes color and typography changes together', () => {
            const oldBranding = createMockBranding({
                colors: { primary: '#007bff', secondary: null, accent: null, background: null, textPrimary: null, textSecondary: null },
                fonts: ['Inter'],
            })
            const newBranding = createMockBranding({
                colors: { primary: '#ff5722', secondary: null, accent: null, background: null, textPrimary: null, textSecondary: null },
                fonts: ['Outfit'],
            })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.summary).toContain('Design system refresh')
        })

        it('handles empty/null values gracefully', () => {
            const oldBranding = createMockBranding({
                assets: { logo: null, favicon: null, ogImage: null },
            })
            const newBranding = createMockBranding({
                assets: { logo: 'https://example.com/new.png', favicon: null, ogImage: null },
            })

            const diff = compareBranding(oldBranding, newBranding)

            expect(diff.hasChanges).toBe(true)
        })
    })
})
