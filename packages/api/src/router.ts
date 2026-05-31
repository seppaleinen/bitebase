import { router } from "./trpc";
import { curriculumRouter } from "./routers/curriculum";
import { publicRouter } from "./routers/public";

export const appRouter = router({
  curriculum: curriculumRouter,
  public: publicRouter,
});

export type AppRouter = typeof appRouter;
