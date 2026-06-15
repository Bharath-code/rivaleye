import { describe, it, expect } from 'vitest';
import { products } from '../products';
import { PLAN_PRICING } from '../billing/featureFlags';

describe('products', () => {
    it('should have a list of products', () => {
        expect(Array.isArray(products)).toBe(true);
        expect(products.length).toBeGreaterThan(0);
    });

    it('should have the correct structure for each product', () => {
        products.forEach(product => {
            expect(product).toHaveProperty('product_id');
            expect(product).toHaveProperty('name');
            expect(product).toHaveProperty('description');
            expect(product).toHaveProperty('price');
            expect(product).toHaveProperty('features');
            expect(Array.isArray(product.features)).toBe(true);
        });
    });

    it('should include the Pro plan', () => {
        const productNames = products.map(p => p.name);
        expect(productNames).toContain('Pro');
    });

    it('should derive price from PLAN_PRICING (single source of truth)', () => {
        const pro = products.find(p => p.name === 'Pro');
        expect(pro).toBeDefined();
        expect(pro!.price).toBe(PLAN_PRICING.pro.monthly * 100);
    });
});
