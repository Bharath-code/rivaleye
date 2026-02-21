"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * BillingToggle — Monthly/Annual switch for pricing section.
 *
 * Annual pricing shows a 20% discount badge.
 * Uses controlled state so the parent can react to billing period changes.
 */

interface BillingToggleProps {
    onToggle: (period: "monthly" | "annual") => void;
    defaultPeriod?: "monthly" | "annual";
}

export function BillingToggle({ onToggle, defaultPeriod = "monthly" }: BillingToggleProps) {
    const [period, setPeriod] = useState<"monthly" | "annual">(defaultPeriod);

    const handleToggle = (newPeriod: "monthly" | "annual") => {
        setPeriod(newPeriod);
        onToggle(newPeriod);
    };

    return (
        <div className="inline-flex items-center gap-1 bg-muted/30 border border-border rounded-full p-1">
            <button
                onClick={() => handleToggle("monthly")}
                className={cn(
                    "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300",
                    period === "monthly"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                Monthly
            </button>
            <button
                onClick={() => handleToggle("annual")}
                className={cn(
                    "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
                    period === "annual"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                Annual
                <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors",
                    period === "annual"
                        ? "bg-emerald-500 text-black"
                        : "bg-emerald-500/20 text-emerald-400"
                )}>
                    –20%
                </span>
            </button>
        </div>
    );
}
