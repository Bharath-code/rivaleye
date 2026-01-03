import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border py-12 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <svg
              viewBox="0 0 24 24"
              className="w-4.5 h-4.5 text-emerald-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" strokeDasharray="4 2" />
              <path d="M22 12c0-5.52-4.48-10-10-10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <span className="text-sm text-muted-foreground">
            RivalEye — Competitive intelligence that thinks.
          </span>
        </div>

        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <a
            href="mailto:hello@rivaleye.io"
            className="hover:text-foreground transition-colors"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
