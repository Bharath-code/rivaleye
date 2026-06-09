"use client";

import { useState, type FormEvent } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { analytics } from "@/components/providers/AnalyticsProvider";
import type { Competitor } from "@/hooks/useDashboardData";

/**
 * AddCompetitorDialog
 *
 * Self-contained client component. Owns its own form state, submission,
 * and error display. The parent only needs to:
 *   1. Provide the existing competitor count (for analytics)
 *   2. Receive the new competitor via onAdded()
 *
 * Renders the "Add Competitor" trigger button as well as the dialog
 * (alternative: render only the dialog content and place the trigger
 * externally — current shape keeps it self-contained).
 */

interface Props {
    existingCount: number;
    onAdded: (competitor: Competitor) => void;
}

export function AddCompetitorDialog({ existingCount, onAdded }: Props) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setName("");
        setUrl("");
        setError(null);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/competitors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, url }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to add competitor");
            }

            analytics.competitorAdded(existingCount + 1);
            onAdded(data.competitor);
            setOpen(false);
            reset();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add competitor");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
                <Button variant="glow-emerald" className="gap-2 h-10 px-5">
                    <Plus className="w-4 h-4 stroke-[3px]" />
                    Add Competitor
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">
                        Add a Competitor
                    </DialogTitle>
                    <DialogDescription>
                        Enter their pricing or homepage URL. We&apos;ll take a snapshot immediately.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-name">Competitor Name</Label>
                        <Input
                            id="add-name"
                            placeholder="e.g. Acme Corp"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-url">URL</Label>
                        <Input
                            id="add-url"
                            type="url"
                            placeholder="https://acme.com/pricing"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-400" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Add & Snapshot
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
