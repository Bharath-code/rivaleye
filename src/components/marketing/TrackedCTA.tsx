'use client';

import { Button } from "@/components/ui/button";
import { analytics } from "@/components/providers/AnalyticsProvider";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ComponentProps } from "react";

type ButtonVariant = 'hero' | 'demo' | 'pricing' | 'footer';

interface TrackedCTAProps {
    variant: ButtonVariant;
    href: string;
    children: React.ReactNode;
    buttonProps?: ComponentProps<typeof Button>;
}

export function TrackedCTA({ variant, href, children, buttonProps }: TrackedCTAProps) {
    const handleClick = () => {
        analytics.ctaClicked(variant);
    };

    return (
        <Link href={href} onClick={handleClick}>
            <Button {...buttonProps}>
                {children}
            </Button>
        </Link>
    );
}

// Pre-configured CTAs for landing page
export function HeroCTA() {
    return (
        <TrackedCTA
            variant="hero"
            href="/login"
            buttonProps={{
                size: "lg",
                className: "glow-emerald text-base px-8 py-6 gap-2"
            }}
        >
            Start Free — No Card Required
            <ArrowRight className="w-4 h-4" />
        </TrackedCTA>
    );
}

export function DemoCTA() {
    return (
        <TrackedCTA
            variant="demo"
            href="#demo"
            buttonProps={{
                variant: "outline",
                size: "lg",
                className: "text-base px-8 py-6"
            }}
        >
            See a Live Alert
        </TrackedCTA>
    );
}

export function PricingFreeCTA() {
    return (
        <TrackedCTA
            variant="pricing"
            href="/login"
            buttonProps={{
                variant: "outline",
                className: "w-full h-12 text-base"
            }}
        >
            Start Monitoring
        </TrackedCTA>
    );
}

export function PricingProCTA() {
    return (
        <TrackedCTA
            variant="pricing"
            href="/login"
            buttonProps={{
                className: "w-full h-12 text-base glow-emerald"
            }}
        >
            Deploy Pro Sensors
        </TrackedCTA>
    );
}

export function FooterCTA() {
    return (
        <TrackedCTA
            variant="footer"
            href="/login"
            buttonProps={{
                size: "lg",
                className: "glow-emerald text-base px-10 py-8 gap-3"
            }}
        >
            Deploy Your First Sensor
            <ArrowRight className="w-5 h-5" />
        </TrackedCTA>
    );
}
