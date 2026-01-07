import { describe, it, expect } from 'vitest';
import { generateFallbackSummary } from '../performanceRecommendations';

// Test only the synchronous fallback function (no AI mock needed)
describe('performanceRecommendations', () => {
    const mockPsiData: any = {
        categories: { performance: 50, accessibility: 80, seo: 90 },
        coreWebVitals: { lcp: 3000, fid: 200, cls: 0.2, ttfb: 1000 },
        opportunities: [
            { id: '1', title: 'Optimize Images', score: 0.3, displayValue: '2s', description: 'Reduce image size.' },
            { id: '2', title: 'Remove Unused JS', score: 0.5, displayValue: '1s', description: 'Clean up dead code.' },
        ],
    };

    it('generateFallbackSummary returns correct grade for excellent score', () => {
        const data = { ...mockPsiData, categories: { ...mockPsiData.categories, performance: 95 } };
        expect(generateFallbackSummary(data).grade).toBe('Excellent');
    });

    it('generateFallbackSummary returns correct grade for good score', () => {
        const data = { ...mockPsiData, categories: { ...mockPsiData.categories, performance: 80 } };
        expect(generateFallbackSummary(data).grade).toBe('Good');
    });

    it('generateFallbackSummary returns correct grade for needs work score', () => {
        const data = { ...mockPsiData, categories: { ...mockPsiData.categories, performance: 60 } };
        expect(generateFallbackSummary(data).grade).toBe('Needs Work');
    });

    it('generateFallbackSummary returns correct grade for poor score', () => {
        const data = { ...mockPsiData, categories: { ...mockPsiData.categories, performance: 30 } };
        expect(generateFallbackSummary(data).grade).toBe('Poor');
    });

    it('generateFallbackSummary returns correct grade for critical score', () => {
        const data = { ...mockPsiData, categories: { ...mockPsiData.categories, performance: 10 } };
        expect(generateFallbackSummary(data).grade).toBe('Critical');
    });

    it('generateFallbackSummary builds recommendations from opportunities', () => {
        const result = generateFallbackSummary(mockPsiData);
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.recommendations[0].issue).toBe('Optimize Images');
    });
});
