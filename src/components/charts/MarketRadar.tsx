"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface RadarEntity {
    id: string;
    name: string;
    featureDensity: number;
    startingPrice: number;
    hasFreeTier: boolean;
}

interface MarketRadarProps {
    entities: RadarEntity[];
    className?: string;
}

/**
 * Market Radar
 * 
 * Maps competitors on a 2-dimensional quadrant (Price vs. Feature Density).
 * This allows founders to spot market "White Space" and identify 
 * disruptive or overpriced competitors.
 */
export function MarketRadar({ entities, className }: MarketRadarProps) {
    const size = 500;
    const padding = 60;

    // Normalize scale
    const processedEntities = useMemo(() => {
        if (!entities || entities.length === 0) return [];

        const prices = entities.map(e => e.startingPrice);
        const densities = entities.map(e => e.featureDensity);

        const maxPrice = Math.max(...prices, 100);
        const maxDensity = Math.max(...densities, 5);

        return entities.map(e => {
            // Logarithmic scale for price to handle outliers
            const priceNorm = Math.log10(e.startingPrice + 1) / Math.log10(maxPrice + 1);
            const densityNorm = e.featureDensity / maxDensity;

            return {
                ...e,
                x: padding + priceNorm * (size - 2 * padding),
                y: size - padding - densityNorm * (size - 2 * padding)
            };
        });
    }, [entities, size, padding]);

    return (
        <div className={cn("relative bg-slate-950/50 rounded-2xl border border-slate-800 overflow-hidden", className)}>
            {/* Architectural Noise */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.04] noise-overlay mix-blend-overlay" />

            <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto">
                <defs>
                    <pattern id="dotGridRadar" width="25" height="25" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill="#1e293b" fillOpacity="0.5" />
                    </pattern>
                </defs>

                <rect width={size} height={size} fill="url(#dotGridRadar)" />

                {/* Quadrant Lines */}
                <line x1={size / 2} y1={padding} x2={size / 2} y2={size - padding} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={size / 2} x2={size - padding} y2={size / 2} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />

                {/* Axis Labels */}
                <text x={size / 2} y={size - 10} textAnchor="middle" className="text-[10px] font-mono fill-slate-500 uppercase tracking-[0.2em]">Price (Low → High)</text>
                <text x={10} y={size / 2} textAnchor="middle" transform={`rotate(-90, 10, ${size / 2})`} className="text-[10px] font-mono fill-slate-500 uppercase tracking-[0.2em]">Feature Density</text>

                {/* Quadrant Labels */}
                <text x={size - padding - 10} y={padding + 20} textAnchor="end" className="text-[9px] font-bold fill-emerald-500/50 uppercase">Enterprise</text>
                <text x={padding + 10} y={padding + 20} textAnchor="start" className="text-[9px] font-bold fill-blue-500/50 uppercase">Disruptors</text>
                <text x={padding + 10} y={size - padding - 10} textAnchor="start" className="text-[9px] font-bold fill-slate-500/50 uppercase">Entry-Level</text>
                <text x={size - padding - 10} y={size - padding - 10} textAnchor="end" className="text-[9px] font-bold fill-red-500/50 uppercase">Overpriced</text>

                {/* Radar Entities */}
                {processedEntities.map((entity, i) => (
                    <g key={entity.id} className="cursor-pointer group transition-all duration-300">
                        {/* Glow Trace */}
                        <circle cx={entity.x} cy={entity.y} r="8" className="fill-emerald-500/20 group-hover:fill-emerald-500/40 animate-pulse" />
                        <circle cx={entity.x} cy={entity.y} r="3" className="fill-emerald-400" />

                        {/* Label */}
                        <text
                            x={entity.x + 8}
                            y={entity.y + 4}
                            className="text-[10px] font-medium fill-slate-300 pointer-events-none group-hover:fill-white transition-colors"
                        >
                            {entity.name}
                        </text>

                        <title>{`${entity.name}\nStarting at $${entity.startingPrice}\nFeatures: ${entity.featureDensity.toFixed(1)} avg`}</title>
                    </g>
                ))}
            </svg>

            {/* Empty State Help */}
            {entities.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-slate-950/80 backdrop-blur-sm">
                    <p className="text-sm text-slate-400 max-w-xs">
                        Add more competitors to see how they map against each other in the market quadrant.
                    </p>
                </div>
            )}
        </div>
    );
}
