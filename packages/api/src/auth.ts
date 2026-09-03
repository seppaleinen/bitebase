import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, users, sessions, accounts, verifications } from "@bitebase/db";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      // Session expires after 30 days of inactivity
      expiresIn: 60 * 60 * 24 * 30,
      // Update session activity every 5 minutes
      updateAge: 60 * 5,
      // Session is considered fresh for 10 minutes
      freshAge: 60 * 10,
      // Regenerate session ID on login to prevent session fixation
      regenerateIdOnLogin: true,
    },
    trustedOrigins: (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",").filter(Boolean),
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

declare global {
  // eslint-disable-next-line no-var
  var __bitebase_auth: Auth | undefined;
}

function getAuth(): Auth {
  if (globalThis.__bitebase_auth) return globalThis.__bitebase_auth;
  globalThis.__bitebase_auth = createAuth();
  return globalThis.__bitebase_auth;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return (getAuth() as unknown as Record<string | symbol, unknown>)[prop];
  },
  has(_target, prop) {
    return prop in getAuth();
  },
});
