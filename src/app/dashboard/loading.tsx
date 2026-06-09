import { DashboardSkeleton } from "@/components/dashboard";

/**
 * Dashboard loading state (Next.js Suspense boundary)
 *
 * Renders a skeleton immediately on navigation, so mobile users
 * (who see the network waterfall) get a visual cue within the
 * first 100ms instead of staring at a blank page.
 */
export default function DashboardLoading() {
    return <DashboardSkeleton />;
}
