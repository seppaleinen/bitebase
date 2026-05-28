import { router } from "./trpc";
import { curriculumRouter } from "./routers/curriculum";

export const appRouter = router({
  curriculum: curriculumRouter,
});

export type AppRouter = typeof appRouter;
