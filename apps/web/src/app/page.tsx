import Link from "next/link";
import { Brain, BookOpen, Zap, Trophy, ArrowRight, Sparkles } from "lucide-react";
import { auth } from "@bitebase/api";
import { headers, cookies } from "next/headers";
import LandingNav from "@/components/landing-nav";

export const dynamic = "force-dynamic";

async function getSession() {
  if (process.env.NODE_ENV !== "production") {
    const cookieStore = await cookies();
    if (cookieStore.get("__playwright_test__")?.value === "1") {
      return true;
    }
  }
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return !!session;
  } catch {
    return false;
  }
}

export default async function LandingPage() {
  const isLoggedIn = await getSession();
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      <LandingNav isLoggedIn={isLoggedIn} />

      <main>
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Powered by local AI — your data stays on your device
          </div>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Learn anything.{" "}
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              Bit by bit.
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-gray-500">
            Tell BiteBase what you want to learn. Answer a few questions. Get a
            personalized curriculum with lessons, real-world examples, and
            quizzes — all generated just for you.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-md hover:bg-violet-700"
            >
              {isLoggedIn ? "Go to dashboard" : "Start learning for free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {!isLoggedIn && (
              <Link
                href="/login"
                className="rounded-xl border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50"
              >
                Sign in
              </Link>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Brain,
                title: "Tell us what to learn",
                desc: "Chat with BiteBase. It asks smart questions to understand your goals and level.",
                color: "bg-violet-100 text-violet-600",
              },
              {
                icon: BookOpen,
                title: "Get your curriculum",
                desc: "BiteBase builds a structured, step-by-step learning plan tailored to you.",
                color: "bg-blue-100 text-blue-600",
              },
              {
                icon: Zap,
                title: "Learn in bite-sizes",
                desc: "Short, focused lessons with real examples. No overwhelm — just progress.",
                color: "bg-amber-100 text-amber-600",
              },
              {
                icon: Trophy,
                title: "Prove your knowledge",
                desc: "Quizzes after each lesson make sure the knowledge sticks.",
                color: "bg-emerald-100 text-emerald-600",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
                  aria-hidden
                >
                  <feature.icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mb-2 font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
