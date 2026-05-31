"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brain, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface LandingNavProps {
  isLoggedIn: boolean;
  onLogout?: () => void;
}

export default function LandingNav({ isLoggedIn, onLogout }: LandingNavProps) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-white/50 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">BiteBase</span>
        </div>

        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                View dashboard
              </Link>
              <button
                onClick={onLogout || handleSignOut}
                aria-label="Sign out"
                className="rounded-lg p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
