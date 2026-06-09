"use client";

import { useState, type FormEvent } from "react";
import { Search, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

/**
 * SemanticSearchBar
 *
 * Natural-language search across all tracked competitor history.
 * Examples:
 *   "competitors that raised prices"
 *   "who removed their free tier"
 *   "tools that switched to annual billing"
 *
 * Results are retrieved via /api/search (pgvector + OpenAI embeddings).
 *
 * On click of a result, navigates to that competitor's detail page
 * with the analysis hash in the URL so it can be highlighted.
 */

interface SearchResult {
    id: string;
    competitor_id: string;
    competitor_name: string;
    competitor_url: string;
    analysis_id: string;
    content: string;
    similarity: number;
    created_at: string;
}

export function SemanticSearchBar() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;

        setIsSearching(true);
        setError(null);
        setHasSearched(true);

        try {
            const res = await fetch("/api/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Search failed");
                setResults([]);
                return;
            }

            setResults(data.results || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Search failed");
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleResultClick = (result: SearchResult) => {
        router.push(`/dashboard/competitors/${result.competitor_id}`);
    };

    return (
        <div className="space-y-4">
            <form onSubmit={handleSearch} className="relative">
                <div className="relative flex items-center">
                    <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search competitor history in natural language…"
                        className="pl-10 pr-24 h-11"
                        disabled={isSearching}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="glow-emerald"
                        className="absolute right-1 h-9 px-4"
                        disabled={isSearching || !query.trim()}
                    >
                        {isSearching ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                Search
                            </>
                        )}
                    </Button>
                </div>
            </form>

            {error && (
                <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
                    {error}
                </div>
            )}

            {hasSearched && !error && results.length === 0 && !isSearching && (
                <div className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-md">
                    No matches. Try a different query — semantic search works
                    best with descriptive phrases like
                    &quot;raised Pro tier price&quot; or &quot;removed free plan&quot;.
                </div>
            )}

            {results.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {results.length} {results.length === 1 ? "match" : "matches"}
                    </p>
                    {results.map((result) => (
                        <Card
                            key={result.id}
                            className="glass-card cursor-pointer hover:border-emerald-500/40 transition-colors"
                            onClick={() => handleResultClick(result)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleResultClick(result);
                                }
                            }}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <h3 className="font-medium text-foreground truncate">
                                            {result.competitor_name}
                                        </h3>
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] px-1.5 py-0 text-emerald-400 border-emerald-500/30"
                                        >
                                            {Math.round(result.similarity * 100)}% match
                                        </Badge>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-3">
                                    {result.content}
                                </p>
                                <p className="text-[11px] text-muted-foreground/60 mt-2">
                                    {new Date(result.created_at).toLocaleDateString()}
                                </p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
