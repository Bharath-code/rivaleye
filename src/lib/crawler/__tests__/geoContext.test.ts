import { describe, it, expect } from 'vitest'
import {
    getExpectedCurrency,
    getCurrencySymbols,
} from '../geoContext'

describe('geoContext', () => {
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
