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
        // Initialize Lenis
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
        });

        // Sync ScrollTrigger with Lenis
        lenis.on("scroll", ScrollTrigger.update);

        // GSAP ticker for Lenis
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });

        // Disable GSAP ticker's lag smoothing for sync
        gsap.ticker.lagSmoothing(0);

        // Scroll to top on refresh
        window.scrollTo(0, 0);

        return () => {
            lenis.destroy();
            gsap.ticker.remove((time) => {
                lenis.raf(time * 1000);
            });
        };
    }, []);

    return <>{children}</>;
};
