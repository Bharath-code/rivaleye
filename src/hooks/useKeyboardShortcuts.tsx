"use client";

import { useEffect, useCallback } from "react";

/**
 * useKeyboardShortcuts
 *
 * Global keyboard shortcut handler for the dashboard.
 * Ignores shortcuts when the user is typing in an input/textarea.
 */

interface ShortcutMap {
    [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // Skip when typing in inputs
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if ((e.target as HTMLElement)?.isContentEditable) return;

            // Skip when modifier keys are pressed (except for shortcuts that need them)
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const handler = shortcuts[e.key.toLowerCase()];
            if (handler) {
                e.preventDefault();
                handler();
            }
        },
        [shortcuts]
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);
}

/**
 * Keyboard Shortcut Hint
 *
 * Small inline badge showing a keyboard shortcut key.
 */
export function KbdHint({ shortcut }: { shortcut: string }) {
    return (
        <kbd className= "hidden sm:inline-flex items-center justify-center h-5 w-5 rounded bg-muted/50 border border-border/50 text-[10px] font-mono text-muted-foreground ml-2" >
        { shortcut }
        </kbd>
    );
}
