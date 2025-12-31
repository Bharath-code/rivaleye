import type { DiffResult } from "@/lib/types";

/**
 * Diff Engine Module
 * 
 * Compares old vs new normalized text and extracts changed blocks.
 * Uses hash comparison for early exit.
 */

// Minimum change threshold to be considered a real diff
const MIN_DIFF_LENGTH = 10;

export function computeDiff(
    oldText: string,
    newText: string,
    oldHash?: string,
    newHash?: string
): DiffResult {
    // Early exit if hashes are identical
    if (oldHash && newHash && oldHash === newHash) {
        return {
            hasChanges: false,
            changedBlocks: [],
        };
    }

    // If texts are identical (fallback if hashes weren't provided)
    if (oldText === newText) {
        return {
            hasChanges: false,
            changedBlocks: [],
        };
    }

    // Split into sentences/blocks for granular comparison
    const oldBlocks = splitIntoBlocks(oldText);
    const newBlocks = splitIntoBlocks(newText);

    const oldSet = new Set(oldBlocks);
    const newSet = new Set(newBlocks);

    // Find removed blocks (in old but not in new)
    const removed = oldBlocks.filter(b => !newSet.has(b));

    // Find added blocks (in new but not in old)
    const added = newBlocks.filter(b => !oldSet.has(b));

    // No meaningful changes if additions/removals are too small
    const totalChangeLength = [...removed, ...added].join(" ").length;
    if (totalChangeLength < MIN_DIFF_LENGTH) {
        return {
            hasChanges: false,
            changedBlocks: [],
        };
    }

    // Create paired blocks for comparison
    const changedBlocks = pairChangedBlocks(removed, added);

    return {
        hasChanges: changedBlocks.length > 0,
        changedBlocks,
    };
}

function splitIntoBlocks(text: string): string[] {
    // Split by sentences or significant punctuation
    return text
        .split(/[.!?]\s+/)
        .map(block => block.trim())
        .filter(block => block.length > 5);
}

function pairChangedBlocks(
    removed: string[],
    added: string[]
): { oldText: string; newText: string }[] {
    const blocks: { oldText: string; newText: string }[] = [];

    // Simple pairing: if we have both removed and added, pair them
    // Otherwise, represent as additions or removals
    const maxLen = Math.max(removed.length, added.length);

    for (let i = 0; i < maxLen; i++) {
        blocks.push({
            oldText: removed[i] || "",
            newText: added[i] || "",
        });
    }

    return blocks.filter(b => b.oldText || b.newText);
}

/**
 * Get a summary of changes for display
 */
export function summarizeDiff(diff: DiffResult): string {
    if (!diff.hasChanges) {
        return "No changes detected";
    }

    const lines: string[] = [];

    for (const block of diff.changedBlocks.slice(0, 3)) {
        if (block.oldText && block.newText) {
            lines.push(`Changed: "${truncate(block.oldText, 50)}" → "${truncate(block.newText, 50)}"`);
        } else if (block.newText) {
            lines.push(`Added: "${truncate(block.newText, 80)}"`);
        } else if (block.oldText) {
            lines.push(`Removed: "${truncate(block.oldText, 80)}"`);
        }
    }

    if (diff.changedBlocks.length > 3) {
        lines.push(`...and ${diff.changedBlocks.length - 3} more changes`);
    }

    return lines.join("\n");
}

function truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + "...";
}
