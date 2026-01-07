import { describe, it, expect } from 'vitest'
import {
    getGeoContextConfig,
    getExpectedCurrency,
    getCurrencySymbols,
} from '../geoContext'
import type { PricingContext } from '@/lib/types'

// ──────────────────────────────────────────────────────────────────────────────
// MOCK DATA FACTORIES
// ──────────────────────────────────────────────────────────────────────────────

function createMockContext(overrides: Partial<PricingContext> = {}): PricingContext {
    return {
        key: 'us',
        label: 'United States',
        locale: 'en-US',
        currency: 'USD',
        timezone: 'America/New_York',
        ...overrides,
    }
}

describe('geoContext', () => {
    describe('getGeoContextConfig', () => {
        it('returns correct config for US context', () => {
            const context = createMockContext({ key: 'us', locale: 'en-US', timezone: 'America/New_York' })
            const config = getGeoContextConfig(context)

            expect(config.locale).toBe('en-US')
            expect(config.timezoneId).toBe('America/New_York')
            expect(config.geolocation).toEqual({ latitude: 40.7128, longitude: -74.006 })
            expect(config.permissions).toContain('geolocation')
        })

        it('returns correct config for India context', () => {
            const context = createMockContext({ key: 'in', locale: 'en-IN', timezone: 'Asia/Kolkata' })
            const config = getGeoContextConfig(context)

            expect(config.locale).toBe('en-IN')
            expect(config.geolocation).toEqual({ latitude: 19.076, longitude: 72.8777 })
        })

        it('returns correct config for EU context', () => {
            const context = createMockContext({ key: 'eu', locale: 'de-DE', timezone: 'Europe/Berlin' })
            const config = getGeoContextConfig(context)

            expect(config.geolocation).toEqual({ latitude: 52.52, longitude: 13.405 })
        })

        it('falls back to global coordinates for unknown key', () => {
            const context = createMockContext({ key: 'unknown', locale: 'en', timezone: 'UTC' })
            const config = getGeoContextConfig(context)

            expect(config.geolocation).toEqual({ latitude: 0, longitude: 0 })
        })

        it('sets viewport to 1440x900', () => {
            const context = createMockContext()
            const config = getGeoContextConfig(context)

            expect(config.viewport).toEqual({ width: 1440, height: 900 })
        })

        it('sets device scale factor to 2', () => {
            const context = createMockContext()
            const config = getGeoContextConfig(context)

            expect(config.deviceScaleFactor).toBe(2)
        })

        it('includes Accept-Language header', () => {
            const context = createMockContext({ key: 'us' })
            const config = getGeoContextConfig(context)

            expect(config.extraHTTPHeaders).toBeDefined()
            expect(config.extraHTTPHeaders?.['Accept-Language']).toContain('en-US')
        })
    })

    describe('getExpectedCurrency', () => {
        it('returns USD for US region', () => {
            expect(getExpectedCurrency('us')).toBe('USD')
        })

        it('returns INR for India region', () => {
            expect(getExpectedCurrency('in')).toBe('INR')
        })

        it('returns EUR for EU region', () => {
            expect(getExpectedCurrency('eu')).toBe('EUR')
        })

        it('returns USD for global region', () => {
            expect(getExpectedCurrency('global')).toBe('USD')
        })

        it('falls back to USD for unknown region', () => {
            expect(getExpectedCurrency('unknown')).toBe('USD')
        })
    })

    describe('getCurrencySymbols', () => {
        it('returns dollar symbols for US region', () => {
            const symbols = getCurrencySymbols('us')
            expect(symbols).toContain('$')
            expect(symbols).toContain('USD')
        })

        it('returns rupee symbols for India region', () => {
            const symbols = getCurrencySymbols('in')
            expect(symbols).toContain('₹')
            expect(symbols).toContain('INR')
            expect(symbols).toContain('Rs')
        })

        it('returns euro symbols for EU region', () => {
            const symbols = getCurrencySymbols('eu')
            expect(symbols).toContain('€')
            expect(symbols).toContain('EUR')
        })

        it('returns all common symbols for global region', () => {
            const symbols = getCurrencySymbols('global')
            expect(symbols).toContain('$')
            expect(symbols).toContain('€')
            expect(symbols).toContain('₹')
            expect(symbols).toContain('£')
        })

        it('falls back to global symbols for unknown region', () => {
            const symbols = getCurrencySymbols('unknown')
            expect(symbols.length).toBeGreaterThan(0)
        })
    })
})

