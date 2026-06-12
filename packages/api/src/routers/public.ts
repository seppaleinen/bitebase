import { z } from "zod";
import { publicProcedure, router } from "../trpc";
import { db, courses, learningProfiles, lessons, quizzes } from "@bitebase/db";
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

  /** List all distinct categories that have published courses. */
  listCategories: publicProcedure.query(async () => {
    const rows = await db
      .select({
        category: courses.category,
        subcategory: courses.subcategory,
      })
      .from(courses)
      .where(
        and(
          eq(courses.isPublished, true),
          isNotNull(courses.category),
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

  /** List published courses, optionally filtered by category + search term.
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
      const conditions: SQL[] = [eq(courses.isPublished, true)];

      if (input?.category) {
        conditions.push(eq(courses.category, input.category));
      }

      if (input?.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        const searchClause = or(
          ilike(courses.title, term),
          ilike(courses.description, term),
          ilike(learningProfiles.topic, term),
        );
        if (searchClause) conditions.push(searchClause);

        const rows = await db
          .select()
          .from(courses)
          .leftJoin(
            learningProfiles,
            eq(courses.profileId, learningProfiles.id)
          )
          .where(and(...conditions))
          .orderBy(desc(courses.createdAt));
        return rows.map((r) => r.courses);
      }

      return db
        .select()
        .from(courses)
        .where(and(...conditions))
        .orderBy(desc(courses.createdAt));
    }),

  /** Get a single published course by ID. */
  getPublishedCurriculum: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.id));
      if (!course || !course.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return course;
    }),

  /** Get lessons for a published course (no per-user progress). */
  getPublishedLessons: publicProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.courseId));
      if (!course || !course.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return db
        .select()
        .from(lessons)
        .where(eq(lessons.courseId, input.courseId));
    }),

  /** Get a single lesson + quiz from a published course (no per-user progress). */
  getPublishedLesson: publicProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ input }) => {
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId));
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, lesson.courseId));
      if (!course || !course.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.lessonId, input.lessonId));

      return { lesson, quiz: quiz ?? null };
    }),

  /** Get a single published course by its slug (for pSEO /learn/[topic] routes). */
  getByTopicSlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.slug, input.slug));
      if (!course || !course.isPublished) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return course;
    }),
});
