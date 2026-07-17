import { describe, it, expect } from "vitest";
import { computeOwnShare } from "../ownShare";

describe("computeOwnShare", () => {
    it("returns null when there are no rows", () => {
        expect(computeOwnShare([])).toBeNull();
    });

    it("returns null when no row has own-brand data (pre-PAR-1 history)", () => {
        expect(
            computeOwnShare([{ own_mentioned: null }, { own_mentioned: null }])
        ).toBeNull();
    });

    it("computes share over rows that have own-brand data only", () => {
        const rows = [
            { own_mentioned: true },
            { own_mentioned: false },
            { own_mentioned: true },
            { own_mentioned: null }, // scanned before brand was set — excluded
        ];
        expect(computeOwnShare(rows)).toEqual({
            total: 3,
            mentions: 2,
            visibility_pct: 66.7,
        });
    });

    it("rounds to one decimal", () => {
        const rows = [
            { own_mentioned: true },
            { own_mentioned: false },
            { own_mentioned: false },
        ];
        expect(computeOwnShare(rows)!.visibility_pct).toBe(33.3);
    });
});
