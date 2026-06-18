"use client";

import { useEffect, ReactNode } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollProps {
    children: ReactNode;
}

export const SmoothScroll = ({ children }: SmoothScrollProps) => {
    useEffect(() => {
        // PERF-2 / a11y: respect prefers-reduced-motion. Smooth-scroll hijacking
        // is jarring and can trigger motion sickness; users who ask for reduced
        // motion get native scrolling.
        const prefersReduced = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
        if (prefersReduced) return;

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
        });

        lenis.on("scroll", ScrollTrigger.update);

        // Single ticker reference so cleanup actually removes it (the previous
        // code passed a fresh arrow fn to remove(), leaking the callback).
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);

        window.scrollTo(0, 0);

        return () => {
            lenis.destroy();
            gsap.ticker.remove(tick);
        };
    }, []);

    return <>{children}</>;
};
