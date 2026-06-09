"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brain, LayoutDashboard, LogOut, Plus, Compass, Shield, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface AppNavProps {
  user: { id: string; name: string; email: string; image?: string | null } | null;
}

export default function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "";

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  const linkClass = (target: string) =>
    `flex items-center gap-1.5 text-sm font-medium transition-colors ${
      pathname === target
        ? "text-violet-600"
        : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BiteBase</span>
          </Link>
          <Link href="/explore" className={linkClass("/explore")}>
            <Compass className="h-4 w-4" />
            Explore
          </Link>
          {user && (
            <Link href="/dashboard" className={linkClass("/dashboard")}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          )}
          {user?.email === "davidbaeriksson@gmail.com" && (
            <>
              <Link href="/admin/lessons" className={linkClass("/admin/lessons")}>
                <Shield className="h-4 w-4" />
                Admin
              </Link>
              <Link href="/admin/settings" className={linkClass("/admin/settings")}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/onboarding"
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                <Plus className="h-3.5 w-3.5" />
                New course
              </Link>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                  {initials}
                </div>
                <button
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="rounded-lg p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-xl border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Sign up free
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
