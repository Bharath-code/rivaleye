"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Competitor } from "@/hooks/useDashboardData";

/**
 * EditCompetitorDialog
 *
 * Self-contained. Opens when `competitor` is non-null.
 * Warns the user if the URL is changing (history reset is destructive).
 */

interface Props {
    competitor: Competitor | null;
    onClose: () => void;
    onSaved: (updated: Competitor, historyReset: boolean) => void;
}

export function EditCompetitorDialog({ competitor, onClose, onSaved }: Props) {
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when a new competitor comes in
    useEffect(() => {
        if (competitor) {
            setName(competitor.name);
            setUrl(competitor.url);
            setError(null);
        }
    }, [competitor]);

    if (!competitor) return null;

    const urlIsChanging = url !== competitor.url;

    const handleSave = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const res = await fetch(`/api/competitors/${competitor.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name !== competitor.name ? name : undefined,
                    url: url !== competitor.url ? url : undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to update competitor");
                return;
            }

            onSaved(data.competitor, !!data.historyReset);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update competitor");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={!!competitor} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl">
                        Edit Competitor
                    </DialogTitle>
                    <DialogDescription>
                        Update name or URL. Changing the URL will reset historical data.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Competitor Name</Label>
                        <Input
                            id="edit-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-url">URL</Label>
                        <Input
                            id="edit-url"
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isSubmitting}
                        />
                    </div>
                    {urlIsChanging && (
                        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-medium">URL changed</p>
                                <p className="text-xs mt-1">
                                    Historical snapshots will be cleared because the new URL
                                    represents a different page.
                                </p>
                            </div>
                        </div>
                    )}
                    {error && (
                        <p className="text-sm text-red-400" role="alert">{error}</p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
