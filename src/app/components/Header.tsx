"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut, LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // First check session (faster, from localStorage)
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        setIsLoading(false);
        return;
      }

      // Fallback to getUser if no session (validates with server)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser || null);
      setIsLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Handle all relevant auth events
      if (event === "SIGNED_OUT") {
        setUser(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setUser(session?.user || null);
      } else if (session?.user) {
        setUser(session.user);
      }
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
          {/* Logo: Sensor Mark */}
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg glow-emerald transition-all duration-500 group-hover:scale-110 group-hover:rotate-[15deg]">
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 text-background"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Outer Aperture - Asymmetrical */}
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" strokeDasharray="4 2" />
              <path d="M22 12c0-5.52-4.48-10-10-10" />

              {/* Inner Focus */}
              <circle cx="12" cy="12" r="3" fill="currentColor" />

              {/* Tactical Crosshairs - Offset */}
              <line x1="12" y1="7" x2="12" y2="9" />
              <line x1="12" y1="15" x2="12" y2="17" />
              <line x1="7" y1="12" x2="9" y2="12" />
              <line x1="15" y1="12" x2="17" y2="12" />
            </svg>
          </div>
          <span className="font-display text-2xl font-bold text-foreground tracking-tight transition-colors group-hover:text-emerald-400">
            RivalEye
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-4" />
          ) : user ? (
            <div className="flex items-center gap-2">
              {pathname !== "/dashboard" && (
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2 h-9">
                    <LayoutDashboard className="w-4 h-4" />
                    <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>
              )}

              <Link href="/settings">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-9 h-9 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border border-transparent",
                    pathname === "/settings" && "text-emerald-400 bg-white/5 border-white/5"
                  )}
                  title="Settings"
                  aria-label="Open notification settings"
                >
                  <SettingsIcon className="w-4.5 h-4.5" />
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-red-400 gap-2 h-9"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
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
