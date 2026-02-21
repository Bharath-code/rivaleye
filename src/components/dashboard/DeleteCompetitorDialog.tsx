"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Confirmation dialog for deleting a competitor.
 * Warns that all snapshots, alerts, and history will be permanently removed.
 */

interface Competitor {
    id: string;
    name: string;
    url: string;
}

interface DeleteCompetitorDialogProps {
    competitor: Competitor | null;
    onClose: () => void;
    onDeleted: (id: string) => void;
}

export function DeleteCompetitorDialog({
    competitor,
    onClose,
    onDeleted,
}: DeleteCompetitorDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!competitor) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/competitors?id=${competitor.id}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Failed to delete competitor");
                return;
            }

            toast.success(`${competitor.name} removed from monitoring.`);
            onDeleted(competitor.id);
            onClose();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to delete competitor");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={!!competitor} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md glass-card">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <Trash2 className="w-5 h-5 text-red-400" />
                        Delete Competitor
                    </DialogTitle>
                    <DialogDescription>
                        This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-400">
                                Permanently delete {competitor?.name}?
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                All snapshots, alerts, pricing history, and analysis data for this competitor
                                will be permanently removed. This frees up a competitor slot on your plan.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="flex-1"
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="flex-1"
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                "Delete Permanently"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
