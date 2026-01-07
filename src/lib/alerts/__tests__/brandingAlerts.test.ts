import { describe, it, expect, vi } from 'vitest'

// Mock supabase to avoid env var requirements
vi.mock('@/lib/supabase', () => ({
    createServerClient: vi.fn(() => ({
        from: vi.fn(() => ({
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
    })),
}))

import {
    analyzeBrandingChanges,
    formatBrandingAlertsForNotification,
} from '../brandingAlerts'
import type { ExtractedBranding, BrandingColors } from '@/lib/crawler/brandingExtractor'

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

describe('brandingAlerts', () => {
    describe('analyzeBrandingChanges', () => {
        it('returns empty array when no changes detected', () => {
            const branding = createMockBranding()
            const alerts = analyzeBrandingChanges(branding, branding)
            expect(alerts).toEqual([])
        })

        it('detects theme change from light to dark', () => {
            const oldBranding = createMockBranding({ colorScheme: 'light' })
            const newBranding = createMockBranding({ colorScheme: 'dark' })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].type).toBe('theme_change')
            expect(alerts[0].severity).toBe('high')
            expect(alerts[0].details.oldValue).toBe('light')
            expect(alerts[0].details.newValue).toBe('dark')
        })

        it('detects theme change from dark to light', () => {
            const oldBranding = createMockBranding({ colorScheme: 'dark' })
            const newBranding = createMockBranding({ colorScheme: 'light' })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            expect(alerts).toHaveLength(1)
            expect(alerts[0].type).toBe('theme_change')
            expect(alerts[0].strategicImplication).toContain('lighter')
        })

        it('detects primary color change with high severity', () => {
            const oldBranding = createMockBranding({
                colors: { primary: '#007bff', secondary: null, accent: null, background: null, textPrimary: null, textSecondary: null },
            })
            const newBranding = createMockBranding({
                colors: { primary: '#ff5722', secondary: null, accent: null, background: null, textPrimary: null, textSecondary: null },
            })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            const colorChangeAlert = alerts.find(a => a.type === 'color_change')
            expect(colorChangeAlert).toBeDefined()
            expect(colorChangeAlert?.severity).toBe('high')
            expect(colorChangeAlert?.details.field).toBe('primary_color')
        })

        it('detects multiple color changes as brand refresh', () => {
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

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            const refreshAlert = alerts.find(a => a.type === 'refresh')
            expect(refreshAlert).toBeDefined()
            expect(refreshAlert?.severity).toBe('high')
        })

        it('detects font changes', () => {
            const oldBranding = createMockBranding({ fonts: ['Inter', 'Roboto'] })
            const newBranding = createMockBranding({ fonts: ['Outfit', 'Poppins'] })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            const fontAlert = alerts.find(a => a.type === 'font_change')
            expect(fontAlert).toBeDefined()
            expect(fontAlert?.severity).toBe('medium')
            expect(fontAlert?.changeDescription).toContain('added')
            expect(fontAlert?.changeDescription).toContain('removed')
        })

        it('detects added fonts', () => {
            const oldBranding = createMockBranding({ fonts: ['Inter'] })
            const newBranding = createMockBranding({ fonts: ['Inter', 'Outfit'] })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            const fontAlert = alerts.find(a => a.type === 'font_change')
            expect(fontAlert).toBeDefined()
            expect(fontAlert?.changeDescription).toContain('added')
        })

        it('detects logo change with high severity', () => {
            const oldBranding = createMockBranding({
                assets: { logo: 'https://example.com/old-logo.png', favicon: null, ogImage: null },
            })
            const newBranding = createMockBranding({
                assets: { logo: 'https://example.com/new-logo.png', favicon: null, ogImage: null },
            })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            const logoAlert = alerts.find(a => a.type === 'logo_change')
            expect(logoAlert).toBeDefined()
            expect(logoAlert?.severity).toBe('high')
        })

        it('detects new logo when none existed before', () => {
            const oldBranding = createMockBranding({
                assets: { logo: null, favicon: null, ogImage: null },
            })
            const newBranding = createMockBranding({
                assets: { logo: 'https://example.com/new-logo.png', favicon: null, ogImage: null },
            })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            const logoAlert = alerts.find(a => a.type === 'logo_change')
            expect(logoAlert).toBeDefined()
        })

        it('handles multiple simultaneous changes', () => {
            const oldBranding = createMockBranding({
                colorScheme: 'light',
                fonts: ['Inter'],
                assets: { logo: 'https://example.com/old.png', favicon: null, ogImage: null },
            })
            const newBranding = createMockBranding({
                colorScheme: 'dark',
                fonts: ['Outfit'],
                assets: { logo: 'https://example.com/new.png', favicon: null, ogImage: null },
            })

            const alerts = analyzeBrandingChanges(oldBranding, newBranding)

            expect(alerts.length).toBeGreaterThanOrEqual(3) // theme + font + logo
            expect(alerts.some(a => a.type === 'theme_change')).toBe(true)
            expect(alerts.some(a => a.type === 'font_change')).toBe(true)
            expect(alerts.some(a => a.type === 'logo_change')).toBe(true)
        })
    })

    describe('formatBrandingAlertsForNotification', () => {
        it('returns empty string when no alerts', () => {
            const result = formatBrandingAlertsForNotification('Acme Corp', [])
            expect(result).toBe('')
        })

        it('formats single alert correctly', () => {
            const alerts = [{
                type: 'color_change' as const,
                changeDescription: 'Primary color changed from #007bff to #ff5722',
                strategicImplication: 'Signals potential rebrand',
                severity: 'high' as const,
                details: { field: 'primary', oldValue: '#007bff', newValue: '#ff5722' },
            }]

            const result = formatBrandingAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('Acme Corp')
            expect(result).toContain('🎨') // color icon
            expect(result).toContain('#007bff')
            expect(result).toContain('rebrand')
        })

        it('includes major changes warning for high severity alerts', () => {
            const alerts = [{
                type: 'logo_change' as const,
                changeDescription: 'Logo updated',
                strategicImplication: 'Major brand overhaul likely',
                severity: 'high' as const,
                details: { field: 'logo', oldValue: 'old.png', newValue: 'new.png' },
            }]

            const result = formatBrandingAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('⚠️')
            expect(result).toContain('rebrand')
        })

        it('formats multiple alerts with correct icons', () => {
            const alerts = [
                {
                    type: 'theme_change' as const,
                    changeDescription: 'Theme changed to dark',
                    strategicImplication: 'Premium positioning',
                    severity: 'high' as const,
                    details: { field: 'colorScheme', oldValue: 'light', newValue: 'dark' },
                },
                {
                    type: 'font_change' as const,
                    changeDescription: 'Fonts updated',
                    strategicImplication: 'Design refresh',
                    severity: 'medium' as const,
                    details: { field: 'fonts', oldValue: 'Inter', newValue: 'Outfit' },
                },
            ]

            const result = formatBrandingAlertsForNotification('Acme Corp', alerts)

            expect(result).toContain('🌓') // theme icon
            expect(result).toContain('✏️') // font icon
        })
    })
})
