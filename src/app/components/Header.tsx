"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, LayoutDashboard } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
);

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border glass-card">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          {/* Logo */}
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg glow-emerald transition-transform group-hover:scale-105">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-background"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </div>
          <span className="font-display text-xl text-foreground tracking-tight">
            RivalEye
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-4" />
          ) : user ? (
            <>
              {pathname !== "/dashboard" && (
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-red-400 gap-2"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/#pricing"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
              >
                Pricing
              </Link>
              <Link href="/login">
                <Button size="sm" className="glow-emerald">
                  Sign In
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
