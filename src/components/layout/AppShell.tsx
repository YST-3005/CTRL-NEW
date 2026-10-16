"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NAV } from "@/components/layout/nav";
import { useGuardianStore } from "@/stores/useGuardianStore";
import { Button } from "@/components/ui/Hud";
import { cn } from "@/lib/utils";

const MotionNav = motion.nav as any;

const PUBLIC = new Set(["/", "/login", "/register", "/reset-password", "/store"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const user = useGuardianStore((s) => s.user);
  const hydrated = useGuardianStore((s) => s.hydrated);
  const hydrate = useGuardianStore((s) => s.hydrate);
  const logout = useGuardianStore((s) => s.logout);
  const prefs = useGuardianStore((s) => s.prefs);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.dataset.motion = prefs.motion;
  }, [prefs.motion]);

  const needsAuth = useMemo(() => {
    if (PUBLIC.has(path) || path.startsWith("/store/")) return false;
    return true;
  }, [path]);

  useEffect(() => {
    if (!hydrated) return;
    if (needsAuth && !user) router.replace("/login");
  }, [hydrated, needsAuth, user, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-cyan-200">
        Restoring chamber session…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="scanlines pointer-events-none fixed inset-0 z-10 mix-blend-overlay" aria-hidden />
      <header className="sticky top-0 z-40 border-b border-cyan-400/10 bg-[#050814]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="display text-sm tracking-[0.28em] text-cyan-200">
            LABELLENS // GUARDIAN
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs tracking-wide text-slate-300 hover:text-cyan-100",
                  path === item.href && "bg-cyan-400/10 text-cyan-100",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-amber-300 sm:inline">
              {user ? `${user.authMode} session` : "sealed"}
            </span>
            {user ? (
              <Button variant="ghost" onClick={() => logout().then(() => router.push("/login"))}>
                Logout
              </Button>
            ) : (
              <Link href="/login">
                <Button>Enter lab</Button>
              </Link>
            )}
            <button
              className="rounded-full border border-cyan-400/30 px-3 py-2 text-xs lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              Menu
            </button>
          </div>
        </div>
        <AnimatePresence>
          {open && (
            <MotionNav
              id="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-cyan-400/10 lg:hidden"
            >
              <div className="grid gap-1 p-3">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-cyan-400/10"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </MotionNav>
          )}
        </AnimatePresence>
      </header>
      <main className={cn("relative z-20", path !== "/" && "mx-auto max-w-7xl px-4 py-8")}>
        {children}
      </main>
    </div>
  );
}
