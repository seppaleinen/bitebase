import type { Metadata } from "next";
import { LoginForm } from "./login-client";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your BiteBase account to continue learning.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
