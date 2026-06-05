import type { Metadata } from "next";
import { RegisterForm } from "./register-client";

export const metadata: Metadata = {
  title: "Create an Account",
  description: "Create your free BiteBase account and start learning with personalized AI-generated curricula.",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/register",
  },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
