export const dynamic = "force-dynamic";

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@bitebase/api";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
