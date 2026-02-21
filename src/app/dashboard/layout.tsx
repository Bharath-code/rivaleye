import { ErrorBoundary } from "@/components/ErrorBoundary";

/**
 * Dashboard Layout
 *
 * Wraps all dashboard routes with an error boundary so a
 * single component crash doesn't take down the entire page.
 */

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ErrorBoundary context="Dashboard">
            {children}
        </ErrorBoundary>
    );
}
