"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brain, LayoutDashboard, LogOut, Plus } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface AppNavProps {
  user: { id: string; name: string; email: string; image?: string | null };
}

export default function AppNav({ user }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">BiteBase</span>
          </Link>
          <Link
            href="/dashboard"
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
              pathname === "/dashboard"
                ? "text-violet-600"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
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
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
