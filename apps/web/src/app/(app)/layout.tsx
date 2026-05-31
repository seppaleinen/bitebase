import { headers, cookies } from "next/headers";
import { auth } from "@bitebase/api";
import AppNav from "@/components/app-nav";

export const dynamic = "force-dynamic";

// Playwright E2E bypass: if the test cookie is present, use a mock session so
// tests never require a real database. Only active when NODE_ENV !== "production".
const TEST_USER = {
  id: "playwright-test-user",
  name: "Test User",
  email: "test@playwright.dev",
  emailVerified: true as const,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function getSession() {
  if (process.env.NODE_ENV !== "production") {
    const cookieStore = await cookies();
    if (cookieStore.get("__playwright_test__")?.value === "1") {
      return { user: TEST_USER };
    }
  }
  return auth.api.getSession({ headers: await headers() });
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session: Awaited<ReturnType<typeof getSession>> | null = null;
  try {
    session = await getSession();
  } catch (err) {
    console.error("[layout] session check failed:", err instanceof Error ? err.message : err);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav user={session?.user ?? null} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
