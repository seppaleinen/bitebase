// API entry point – combines all routers (public, curriculum, admin)

import { router } from "./trpc";
import { curriculumRouter } from "./routers/curriculum";
import { publicRouter } from "./routers/public";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  curriculum: curriculumRouter,
  public: publicRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
