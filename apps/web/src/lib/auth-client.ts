import { createAuthClient } from "better-auth/react";

// baseURL defaults to window.location.origin when unset — no need for a
// build-time fallback. Set NEXT_PUBLIC_APP_URL during Docker build only if
// the API is served from a different origin than the frontend.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
});

export type Session = typeof authClient.$Infer.Session;
