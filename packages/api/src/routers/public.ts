import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db, curricula, learningProfiles, lessons, quizzes } from "@bitebase/db";
import { eq, desc, and, or, ilike, isNotNull, type SQL } from "drizzle-orm";
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

  /** List all distinct categories that have published curricula. */
  listCategories: publicProcedure.query(async () => {
    const rows = await db
      .select({
        category: curricula.category,
        subcategory: curricula.subcategory,
      })
      .from(curricula)
      .where(
        and(
          eq(curricula.isPublished, true),
          isNotNull(curricula.category),
        )
      );

    // Group subcategories under categories
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      if (row.category) {
        if (!map.has(row.category)) map.set(row.category, new Set());
        if (row.subcategory) map.get(row.category)!.add(row.subcategory);
      }
    }
    return Array.from(map.entries()).map(([category, subs]) => ({
      category,
      subcategories: Array.from(subs).sort(),
    }));
  }),

  /** List published curricula, optionally filtered by category + search term.
   *  Search covers title, description, and learning profile topic. */
  listPublished: publicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          search: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const conditions: SQL[] = [eq(curricula.isPublished, true)];

      if (input?.category) {
        conditions.push(eq(curricula.category, input.category));
      }

      if (input?.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        const searchClause = or(
          ilike(curricula.title, term),
          ilike(curricula.description, term),
          ilike(learningProfiles.topic, term),
        );
        if (searchClause) conditions.push(searchClause);

        const rows = await db
          .select()
          .from(curricula)
          .leftJoin(
            learningProfiles,
            eq(curricula.profileId, learningProfiles.id)
          )
          .where(and(...conditions))
          .orderBy(desc(curricula.createdAt));
        return rows.map((r) => r.curricula);
      }

      return db
        .select()
        .from(curricula)
        .where(and(...conditions))
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
