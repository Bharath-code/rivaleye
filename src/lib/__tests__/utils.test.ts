import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('utils', () => {
    describe('cn (classNames merge)', () => {
        it('merges single class', () => {
            expect(cn('foo')).toBe('foo')
        })

        it('merges multiple classes', () => {
            const result = cn('foo', 'bar', 'baz')
            expect(result).toContain('foo')
            expect(result).toContain('bar')
            expect(result).toContain('baz')
        })

        it('handles conditional classes with clsx', () => {
            expect(cn('foo', true && 'bar')).toContain('bar')
            expect(cn('foo', false && 'bar')).not.toContain('bar')
        })

        it('removes undefined and null values', () => {
            const result = cn('foo', undefined, null, 'bar')
            expect(result).toBe('foo bar')
        })

        it('handles object syntax', () => {
            const result = cn({ foo: true, bar: false, baz: true })
            expect(result).toContain('foo')
            expect(result).not.toContain('bar')
            expect(result).toContain('baz')
        })

        it('handles array syntax', () => {
            const result = cn(['foo', 'bar'])
            expect(result).toContain('foo')
            expect(result).toContain('bar')
        })

        it('merges conflicting Tailwind classes correctly', () => {
            // twMerge should resolve conflicts by keeping last
            const result = cn('px-2', 'px-4')
            expect(result).toBe('px-4')
        })

        it('handles complex Tailwind class merging', () => {
            const result = cn('text-red-500', 'text-blue-500')
            expect(result).toBe('text-blue-500')
        })

        it('preserves non-conflicting Tailwind classes', () => {
            const result = cn('text-red-500', 'bg-blue-500', 'p-4')
            expect(result).toContain('text-red-500')
            expect(result).toContain('bg-blue-500')
            expect(result).toContain('p-4')
        })

        it('handles empty input', () => {
            expect(cn()).toBe('')
        })

        it('handles only falsy values', () => {
            expect(cn(false, null, undefined, '')).toBe('')
        })

        it('handles mixed types', () => {
            const result = cn(
                'base',
                { conditional: true },
                ['array-class'],
                true && 'ternary-class'
            )
            expect(result).toContain('base')
            expect(result).toContain('conditional')
            expect(result).toContain('array-class')
            expect(result).toContain('ternary-class')
        })
    })
})
