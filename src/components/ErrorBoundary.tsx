"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * React Error Boundary
 *
 * Catches rendering errors in child components and shows a
 * recovery UI instead of crashing the entire page.
 */

interface Props {
    children: ReactNode;
    /** Optional fallback component. Defaults to built-in recovery card. */
    fallback?: ReactNode;
    /** Component name for logging (e.g. "Dashboard", "AlertsPage") */
    context?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(
            `[ErrorBoundary${this.props.context ? `:${this.props.context}` : ""}]`,
            error,
            info.componentStack
        );
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex items-center justify-center min-h-[400px] p-6">
                    <Card className="glass-card max-w-md w-full">
                        <CardContent className="py-10 text-center">
                            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
                                <AlertTriangle className="w-7 h-7 text-red-400" />
                            </div>
                            <h3 className="text-lg font-display text-foreground mb-2">
                                Something went wrong
                            </h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                                {this.state.error?.message || "An unexpected error occurred."}
                            </p>
                            <Button
                                onClick={this.handleRetry}
                                variant="outline"
                                className="gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
