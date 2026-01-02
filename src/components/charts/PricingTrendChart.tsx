"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DataPoint {
    date: string;
    price: number;
}

interface PricingTrendChartProps {
    data: DataPoint[];
    className?: string;
    lineColor?: string;
    currency?: string;
}

/**
 * Pricing Trend Chart
 * 
 * A bespoke SVG visualization that adheres to the VisuaLab design system.
 * Features architectural dot-grid backgrounds, noise textures, and 
 * glow-trace line animations.
 */
export function PricingTrendChart({
    data,
    className,
    lineColor = "#10b981", // Emerald-500
    currency = "$"
}: PricingTrendChartProps) {
    // Chart Dimensions
    const width = 600;
    const height = 300;
    const padding = 40;

    // Process Data
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const prices = data.map(d => d.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const range = maxPrice - minPrice || 1;

        // Add 10% padding to range
        const chartMin = Math.max(0, minPrice - range * 0.1);
        const chartMax = maxPrice + range * 0.1;

        return data.map((d, i) => {
            const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
            const y = height - padding - ((d.price - chartMin) / (chartMax - chartMin)) * (height - 2 * padding);
            return { x, y, price: d.price, date: d.date };
        });
    }, [data, width, height, padding]);

    // SVG Path String
    const pathData = useMemo(() => {
        if (processedData.length < 2) return "";
        return processedData.reduce((acc, point, i) => {
            return i === 0 ? `M ${point.x} ${point.y}` : `${acc} L ${point.x} ${point.y}`;
        }, "");
    }, [processedData]);

    const areaPathData = useMemo(() => {
        if (processedData.length < 2) return "";
        const first = processedData[0];
        const last = processedData[processedData.length - 1];
        return `${pathData} L ${last.x} ${height - padding} L ${first.x} ${height - padding} Z`;
    }, [pathData, processedData, height, padding]);

    if (data.length === 0) {
        return (
            <div className={cn("flex items-center justify-center bg-muted/10 rounded-lg border border-dashed", className)}>
                <span className="text-sm text-muted-foreground">Insufficient data points for trend analysis.</span>
            </div>
        );
    }

    return (
        <div className={cn("relative group select-none", className)}>
            {/* Noise Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] noise-overlay mix-blend-overlay rounded-xl overflow-hidden" />

            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto drop-shadow-2xl"
                style={{ filter: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.1))" }}
            >
                {/* Architectural Grid */}
                <defs>
                    <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill="currentColor" fillOpacity="0.1" />
                    </pattern>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                    </linearGradient>
                </defs>

                <rect width={width} height={height} fill="url(#dotGrid)" className="text-slate-500" />

                {/* Axes */}
                <line
                    x1={padding} y1={height - padding}
                    x2={width - padding} y2={height - padding}
                    stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"
                />

                {/* Area under curve */}
                <path d={areaPathData} fill="url(#areaGradient)" />

                {/* The Path Tracing */}
                <path
                    d={pathData}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="1000"
                    strokeDashoffset="1000"
                    className="animate-reveal-chart"
                />

                {/* Data Points */}
                {processedData.map((point, i) => (
                    <g key={i} className="cursor-help transition-all duration-300 hover:scale-125">
                        <circle
                            cx={point.x}
                            cy={point.y}
                            r="4"
                            fill="#0f172a" // Space navy
                            stroke={lineColor}
                            strokeWidth="2"
                        />
                        <title>{`${new Date(point.date).toLocaleDateString()}: ${currency}${point.price}`}</title>
                    </g>
                ))}
            </svg>

            {/* Custom Legend/Tooltips */}
            <div className="absolute top-4 left-4 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Pricing Context History</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-display text-foreground">{currency}{data[data.length - 1].price}</span>
                    <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        data.length > 1 && data[data.length - 1].price > data[0].price
                            ? "bg-red-500/10 text-red-500"
                            : "bg-emerald-500/10 text-emerald-500"
                    )}>
                        {data.length > 1 && (
                            <>
                                {data[data.length - 1].price > data[0].price ? "↑" : "↓"}
                                {Math.abs(((data[data.length - 1].price - data[0].price) / data[0].price) * 100).toFixed(1)}%
                            </>
                        )}
                    </span>
                </div>
            </div>

            <style jsx>{`
                @keyframes revealChart {
                    to { stroke-dashoffset: 0; }
                }
                .animate-reveal-chart {
                    animation: revealChart 1.5s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }
            `}</style>
        </div>
    );
}
