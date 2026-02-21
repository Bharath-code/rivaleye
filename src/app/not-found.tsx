import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Custom 404 — branded not-found page.
 */
export default function NotFound() {
    return (
        <html lang="en" className="dark">
            <body className="bg-background text-foreground antialiased min-h-screen flex flex-col">
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="max-w-md text-center">
                        {/* Glowing 404 */}
                        <div className="relative mb-8">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
                            </div>
                            <h1 className="relative font-display text-[120px] leading-none font-bold text-foreground/10">
                                404
                            </h1>
                        </div>

                        {/* Icon */}
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                            <Eye className="w-7 h-7 text-emerald-400" />
                        </div>

                        <h2 className="font-display text-2xl text-foreground mb-3">
                            Target Not Found
                        </h2>
                        <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto leading-relaxed">
                            The page you&apos;re looking for doesn&apos;t exist or has been moved.
                            Our sensors couldn&apos;t locate this intel.
                        </p>

                        <div className="flex items-center justify-center gap-3">
                            <Link href="/">
                                <Button variant="outline" className="gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to Base
                                </Button>
                            </Link>
                            <Link href="/dashboard">
                                <Button className="glow-emerald gap-2">
                                    Open Dashboard
                                </Button>
                            </Link>
                        </div>

                        {/* Subtle branding */}
                        <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40 font-mono">
                            RivalEye Intelligence Grid
                        </p>
                    </div>
                </div>
            </body>
        </html>
    );
}
