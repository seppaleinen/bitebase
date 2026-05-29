import { z } from "zod";
import { protectedProcedure, router } from "../trpc";
import { scoreQuiz } from "../lib/quiz-scoring";
import {
  db,
  curricula,
  learningProfiles,
  lessons,
  quizzes,
  progress,
} from "@bitebase/db";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";

export const curriculumRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(curricula)
      .where(eq(curricula.userId, ctx.session.user.id));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, input.id),
            eq(curricula.userId, ctx.session.user.id)
          )
        );

      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });
      return curriculum;
    }),

  getLessons: protectedProcedure
    .input(z.object({ curriculumId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, input.curriculumId),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });

      const lessonList = await db
        .select()
        .from(lessons)
        .where(eq(lessons.curriculumId, input.curriculumId));

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

      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, lesson.curriculumId),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });

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
        answers: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, lesson.curriculumId),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });

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

      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, currentLesson.curriculumId),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) return null;

      const allLessons = await db
        .select()
        .from(lessons)
        .where(eq(lessons.curriculumId, currentLesson.curriculumId));

      const next = allLessons.find((l) => l.order === currentLesson.order + 1) ?? null;
      return next
        ? {
            id: next.id,
            title: next.title,
            curriculumId: next.curriculumId,
            order: next.order,
          }
        : null;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, input.id),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });

      // Deleting the curriculum cascades to lessons → quizzes and progress via FK.
      await db.delete(curricula).where(eq(curricula.id, input.id));
    }),

  getProfile: protectedProcedure
    .input(z.object({ curriculumId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, input.curriculumId),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });

      const [profile] = await db
        .select()
        .from(learningProfiles)
        .where(eq(learningProfiles.id, curriculum.profileId));

      return profile ?? null;
    }),

  /** Delete a failed curriculum and return its learning profile so the caller
   *  can immediately re-trigger generation with the same inputs. */
  retryAndGetProfile: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [curriculum] = await db
        .select()
        .from(curricula)
        .where(
          and(
            eq(curricula.id, input.id),
            eq(curricula.userId, ctx.session.user.id)
          )
        );
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND" });

      const [profile] = await db
        .select()
        .from(learningProfiles)
        .where(eq(learningProfiles.id, curriculum.profileId));

      // Deleting the curriculum cascades to lessons → quizzes and progress via FK.
      await db.delete(curricula).where(eq(curricula.id, input.id));

      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Learning profile not found" });

      return {
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
    .where(eq(lessons.curriculumId, completedLesson.curriculumId));

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
