// API entry point – combines all routers (public, course, admin)

import { router } from "./trpc";
import { courseRouter } from "./routers/course";
import { publicRouter } from "./routers/public";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  course: courseRouter,
  public: publicRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
