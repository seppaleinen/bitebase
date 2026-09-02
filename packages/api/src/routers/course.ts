import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { scoreQuiz } from "../lib/quiz-scoring";
import {
  db,
  courses,
  learningProfiles,
  lessons,
  quizzes,
  progress,
} from "@bitebase/db";
import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

const categorySchema = z.object({
  courseId: z.string(),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional(),
});

export const courseRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(courses)
      .where(eq(courses.userId, ctx.session.user.id));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if course exists first (for existence verification)
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.id));

      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Verify ownership - throw FORBIDDEN to avoid leaking resource existence
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return course;
    }),

  getLessons: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if course exists first
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.courseId));

      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Verify ownership - throw FORBIDDEN to avoid leaking resource existence
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const lessonList = await db
        .select()
        .from(lessons)
        .where(eq(lessons.courseId, input.courseId));

      const progressList = await db
        .select()
        .from(progress)
        .where(eq(progress.userId, ctx.session.user.id));

      const progressMap = new Map(progressList.map((p) => [p.lessonId, p]));

      return lessonList.map((lesson) => ({
        ...lesson,
        progress: progressMap.get(lesson.id) ?? null,
      }));
    }),

  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId));
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, lesson.courseId));
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      // Verify ownership - throw FORBIDDEN to avoid leaking resource existence
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.lessonId, input.lessonId));

      const [userProgress] = await db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.lessonId, input.lessonId),
            eq(progress.userId, ctx.session.user.id)
          )
        );

      return { lesson, quiz: quiz ?? null, progress: userProgress ?? null };
    }),

  submitQuiz: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        answers: z.record(z.string(), z.string().max(500, "Answer too long (max 500 chars)")),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify lesson exists and belongs to a course owned by the user
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId));
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, lesson.courseId));
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.lessonId, input.lessonId));
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      const { score, passed, correct, total, feedback } = scoreQuiz(
        quiz.questions,
        input.answers,
        quiz.passingScore
      );

      const [existing] = await db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.lessonId, input.lessonId),
            eq(progress.userId, ctx.session.user.id)
          )
        );

      if (existing) {
        await db
          .update(progress)
          .set({
            quizScore: score,
            quizPassed: passed,
            quizAttempts: existing.quizAttempts + 1,
            status: passed ? "completed" : existing.status,
            completedAt: passed ? new Date() : existing.completedAt,
            lastAccessedAt: new Date(),
          })
          .where(eq(progress.id, existing.id));
      } else {
        await db.insert(progress).values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          lessonId: input.lessonId,
          status: passed ? "completed" : "in_progress",
          quizScore: score,
          quizPassed: passed,
          quizAttempts: 1,
          completedAt: passed ? new Date() : null,
          lastAccessedAt: new Date(),
        });
      }

      if (passed) {
        await unlockNextLesson(ctx.session.user.id, input.lessonId);
      }

      return { score, passed, correct, total, feedback };
    }),

  markLessonCompleted: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [lesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId));
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const [course] = await db
        .select()
        .from(courses)
        .where(
          and(
            eq(courses.id, lesson.courseId),
            eq(courses.userId, ctx.session.user.id)
          )
        );
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });

      const [existing] = await db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.lessonId, input.lessonId),
            eq(progress.userId, ctx.session.user.id)
          )
        );

      if (!existing) {
        await db.insert(progress).values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          lessonId: input.lessonId,
          status: "completed",
          quizScore: 100,
          quizPassed: true,
          quizAttempts: 0,
          completedAt: new Date(),
          lastAccessedAt: new Date(),
        });
      } else {
        await db
          .update(progress)
          .set({
            status: "completed",
            quizScore: 100,
            quizPassed: true,
            completedAt: new Date(),
            lastAccessedAt: new Date(),
          })
          .where(eq(progress.id, existing.id));
      }

      await unlockNextLesson(ctx.session.user.id, input.lessonId);
    }),

  markLessonStarted: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.lessonId, input.lessonId),
            eq(progress.userId, ctx.session.user.id)
          )
        );

      if (!existing) {
        await db.insert(progress).values({
          id: randomUUID(),
          userId: ctx.session.user.id,
          lessonId: input.lessonId,
          status: "in_progress",
          quizAttempts: 0,
          lastAccessedAt: new Date(),
        });
      } else {
        await db
          .update(progress)
          .set({ lastAccessedAt: new Date() })
          .where(eq(progress.id, existing.id));
      }
    }),

  getNextLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [currentLesson] = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, input.lessonId));
      if (!currentLesson) return null;

      const [course] = await db
        .select()
        .from(courses)
        .where(
          and(
            eq(courses.id, currentLesson.courseId),
            eq(courses.userId, ctx.session.user.id)
          )
        );
      if (!course) return null;

      const allLessons = await db
        .select()
        .from(lessons)
        .where(eq(lessons.courseId, currentLesson.courseId));

      const next = allLessons.find((l) => l.order === currentLesson.order + 1) ?? null;
      return next
        ? {
            id: next.id,
            title: next.title,
            courseId: next.courseId,
            order: next.order,
          }
        : null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.id));
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Deleting the course cascades to lessons → quizzes and progress via FK.
      await db.delete(courses).where(eq(courses.id, input.id));
    }),

  /** Get the current user's progress across all lessons in a course. */
  getProgressForCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const courseLessons = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.courseId, input.courseId));
      const lessonIds = courseLessons.map((l) => l.id);
      if (lessonIds.length === 0) return [];
  
      return db
        .select()
        .from(progress)
        .where(
          and(
            inArray(progress.lessonId, lessonIds),
            eq(progress.userId, ctx.session.user.id)
          )
        );
    }),

  /** Get the current user's progress for a single lesson. */
  getLessonProgress: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [userProgress] = await db
        .select()
        .from(progress)
        .where(
          and(
            eq(progress.lessonId, input.lessonId),
            eq(progress.userId, ctx.session.user.id)
          )
        );
      return userProgress ?? null;
    }),

  getProfile: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.courseId));
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [profile] = await db
        .select()
        .from(learningProfiles)
        .where(eq(learningProfiles.id, course.profileId));

      return profile ?? null;
    }),

  /** Update the category/subcategory for a course (owner only). */
  updateCategory: protectedProcedure
    .input(categorySchema)
    .mutation(async ({ ctx, input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.courseId));
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(courses)
        .set({
          category: input.category,
          subcategory: input.subcategory || null,
        })
        .where(eq(courses.id, input.courseId));
    }),

  /** Fetch a learning profile so the caller can re-trigger generation with the
   *  same inputs. Does NOT delete the course — deletion is deferred until
   *  the new course has been successfully generated. */
  retryAndGetProfile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [course] = await db
        .select()
        .from(courses)
        .where(eq(courses.id, input.id));
      if (!course) throw new TRPCError({ code: "NOT_FOUND" });
      if (course.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [profile] = await db
        .select()
        .from(learningProfiles)
        .where(eq(learningProfiles.id, course.profileId));

      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Learning profile not found" });

      return {
        courseId: input.id,
        topic: profile.topic,
        experienceLevel: profile.experienceLevel,
        goals: profile.goals,
        additionalContext: profile.additionalContext ?? "",
      };
    }),
});

async function unlockNextLesson(userId: string, completedLessonId: string) {
  const [completedLesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.id, completedLessonId));
  if (!completedLesson) return;

  const allLessons = await db
    .select()
    .from(lessons)
    .where(eq(lessons.courseId, completedLesson.courseId));

  const nextLesson = allLessons
    .filter((l) => l.order === completedLesson.order + 1)
    .at(0);

  if (!nextLesson) return;

  const [nextProgress] = await db
    .select()
    .from(progress)
    .where(
      and(
        eq(progress.lessonId, nextLesson.id),
        eq(progress.userId, userId)
      )
    );

  if (!nextProgress) {
    await db.insert(progress).values({
      id: randomUUID(),
      userId,
      lessonId: nextLesson.id,
      status: "available",
      quizAttempts: 0,
      lastAccessedAt: new Date(),
    });
  } else if (nextProgress.status === "locked") {
    await db
      .update(progress)
      .set({ status: "available" })
      .where(eq(progress.id, nextProgress.id));
  }
}
