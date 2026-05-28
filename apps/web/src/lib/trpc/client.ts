import { createTRPCClient, httpBatchStreamLink } from "@trpc/client";
import type { AppRouter } from "@bitebase/api";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchStreamLink({
      url: "/api/trpc",
    }),
  ],
});
