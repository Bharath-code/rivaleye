import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageTransition } from "@/components/providers/PageTransition";

/**
 * Dashboard Layout
 *
 * Wraps all dashboard routes with an error boundary so a
 * single component crash doesn't take down the entire page.
 * PageTransition adds a subtle fade on route changes.
 */

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ErrorBoundary context="Dashboard">
            <PageTransition>
                {children}
            </PageTransition>
        </ErrorBoundary>
    );
}
