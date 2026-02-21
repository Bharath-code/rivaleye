"use client";

import { usePathname } from "next/navigation";
import { useRef, useEffect, type ReactNode } from "react";

/**
 * PageTransition — CSS-only fade transition on route change.
 *
 * Wraps children and fades in on each pathname change.
 * No JS animation library needed — pure CSS transition.
 */

export function PageTransition({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Reset opacity and trigger fade-in
        el.style.opacity = "0";
        el.style.transform = "translateY(4px)";

        // Force reflow before adding transition
        void el.offsetHeight;

        el.style.transition = "opacity 300ms ease, transform 300ms ease";
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
    }, [pathname]);

    return (
        <div ref={ref} style={{ opacity: 1 }}>
            {children}
        </div>
    );
}
