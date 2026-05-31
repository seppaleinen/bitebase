import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db, curricula, lessons, quizzes } from "@bitebase/db";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const publicRouter = router({
  /** Return the current user session (null if anonymous). */
  getSession: publicProcedure.query(async ({ ctx }) => {
    if (ctx.session?.user) {
      return {
        id: ctx.session.user.id,
        name: ctx.session.user.name,
        email: ctx.session.user.email,
        image: ctx.session.user.image ?? null,
      };
    }
    return null;
  }),

  /** List all published curricula, newest first. */
  listPublished: publicProcedure.query(async () => {
    return db
      .select()
      .from(curricula)
      .where(eq(curricula.isPublished, true))
      .orderBy(desc(curricula.createdAt));
  }),

  /** Get a single published curriculum by ID. */
  getPublishedCurriculum: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(eq(curricula.id, input.id));
      if (!curriculum || !curriculum.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return curriculum;
    }),

  /** Get lessons for a published curriculum (no per-user progress). */
  getPublishedLessons: publicProcedure
    .input(z.object({ curriculumId: z.string() }))
    .query(async ({ input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(eq(curricula.id, input.curriculumId));
      if (!curriculum || !curriculum.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return db
        .select()
        .from(lessons)
        .where(eq(lessons.curriculumId, input.curriculumId));
    }),

  /** Get a single lesson + quiz from a published curriculum (no per-user progress). */
  getPublishedLesson: publicProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ input }) => {
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId));
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(eq(curricula.id, lesson.curriculumId));
      if (!curriculum || !curriculum.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.lessonId, input.lessonId));

      return { lesson, quiz: quiz ?? null };
    }),
});
