import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getExchangeRates, convertToUsd, getRateToUsd, clearRatesCache } from '../exchangeRates'

describe('exchangeRates', () => {
    beforeEach(() => {
        clearRatesCache()
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('getExchangeRates', () => {
        it('returns fallback rates when API fails', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const rates = await getExchangeRates()

            expect(rates).toHaveProperty('USD', 1)
            expect(rates).toHaveProperty('EUR')
            expect(rates).toHaveProperty('INR')
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })

        it('returns fallback rates when API response is not ok', async () => {
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: false,
                status: 500,
            } as Response)
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const rates = await getExchangeRates()

            expect(rates).toHaveProperty('USD', 1)
            expect(consoleSpy).toHaveBeenCalledWith(
                'Exchange rate API error, using fallback rates'
            )

            consoleSpy.mockRestore()
        })

        it('returns API rates when successful', async () => {
            const mockRates = {
                base: 'USD',
                date: '2024-01-01',
                rates: { USD: 1, EUR: 0.85, INR: 82 },
            }
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => mockRates,
            } as Response)

            const rates = await getExchangeRates()

            expect(rates).toEqual(mockRates.rates)
        })

        it('caches rates and returns cached value on subsequent calls', async () => {
            const mockRates = {
                base: 'USD',
                date: '2024-01-01',
                rates: { USD: 1, EUR: 0.85 },
            }
            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => mockRates,
            } as Response)

            // First call
            await getExchangeRates()
            // Second call should use cache
            await getExchangeRates()

            expect(fetchSpy).toHaveBeenCalledTimes(1)
        })
    })

    describe('convertToUsd', () => {
        beforeEach(() => {
            const mockRates = {
                base: 'USD',
                date: '2024-01-01',
                rates: { USD: 1, EUR: 0.92, INR: 83.5, GBP: 0.79 },
            }
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => mockRates,
            } as Response)
        })

        it('returns same amount for USD', async () => {
            const result = await convertToUsd(100, 'USD')
            expect(result).toBe(100)
        })

        it('converts EUR to USD correctly', async () => {
            const result = await convertToUsd(92, 'EUR')
            // 92 / 0.92 = 100
            expect(result).toBe(100)
        })

        it('converts INR to USD correctly', async () => {
            const result = await convertToUsd(83.5, 'INR')
            // 83.5 / 83.5 = 1
            expect(result).toBeCloseTo(1, 5)
        })

        it('returns same amount for unknown currency', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const result = await convertToUsd(100, 'XYZ')

            expect(result).toBe(100)
            expect(consoleSpy).toHaveBeenCalledWith(
                'Unknown currency: XYZ, assuming USD'
            )

            consoleSpy.mockRestore()
        })

        it('handles zero amount', async () => {
            const result = await convertToUsd(0, 'EUR')
            expect(result).toBe(0)
        })

        it('handles negative amount', async () => {
            const result = await convertToUsd(-92, 'EUR')
            expect(result).toBe(-100)
        })
    })

    describe('getRateToUsd', () => {
        beforeEach(() => {
            const mockRates = {
                base: 'USD',
                date: '2024-01-01',
                rates: { USD: 1, EUR: 0.92, INR: 83.5 },
            }
            vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => mockRates,
            } as Response)
        })

        it('returns 1 for USD', async () => {
            const rate = await getRateToUsd('USD')
            expect(rate).toBe(1)
        })

        it('returns inverse rate for EUR', async () => {
            const rate = await getRateToUsd('EUR')
            // 1 / 0.92 ≈ 1.087
            expect(rate).toBeCloseTo(1 / 0.92, 5)
        })

        it('returns 1 for unknown currency', async () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

            const rate = await getRateToUsd('XYZ')

            expect(rate).toBe(1)
            expect(consoleSpy).toHaveBeenCalled()

            consoleSpy.mockRestore()
        })
    })

    describe('clearRatesCache', () => {
        it('clears the cache so next call fetches fresh data', async () => {
            const mockRates = {
                base: 'USD',
                date: '2024-01-01',
                rates: { USD: 1 },
            }
            const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
                ok: true,
                json: async () => mockRates,
            } as Response)

            await getExchangeRates()
            expect(fetchSpy).toHaveBeenCalledTimes(1)

            clearRatesCache()

            await getExchangeRates()
            expect(fetchSpy).toHaveBeenCalledTimes(2)
        })
    })
})
