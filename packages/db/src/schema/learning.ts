import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const experienceLevelEnum = pgEnum("experience_level", [
  "beginner",
  "intermediate",
  "advanced",
]);

export const lessonStatusEnum = pgEnum("lesson_status", [
  "locked",
  "available",
  "in_progress",
  "completed",
]);

export const learningProfiles = pgTable("learning_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  topic: text("topic").notNull(),
  experienceLevel: experienceLevelEnum("experience_level").notNull(),
  goals: text("goals").notNull(),
  additionalContext: text("additional_context"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CurriculumSection = {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  order: number;
  subsections: Array<{
    id: string;
    title: string;
    description: string;
    order: number;
  }>;
};

export const curricula = pgTable("curricula", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  profileId: text("profile_id")
    .notNull()
    .references(() => learningProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  totalEstimatedMinutes: integer("total_estimated_minutes").notNull(),
  sections: jsonb("sections").$type<CurriculumSection[]>().notNull(),
  generationStatus: text("generation_status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type QuizQuestion = {
  id: string;
  type: "multiple_choice" | "fill_in_blank";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

export const lessons = pgTable("lessons", {
  id: text("id").primaryKey(),
  curriculumId: text("curriculum_id")
    .notNull()
    .references(() => curricula.id, { onDelete: "cascade" }),
  sectionId: text("section_id").notNull(),
  subsectionId: text("subsection_id"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sources: jsonb("sources").$type<Array<{ title: string; url: string }>>().notNull().default([]),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const quizzes = pgTable("quizzes", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  questions: jsonb("questions").$type<QuizQuestion[]>().notNull(),
  passingScore: integer("passing_score").notNull().default(70),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const progress = pgTable("progress", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  status: lessonStatusEnum("status").notNull().default("locked"),
  quizScore: integer("quiz_score"),
  quizPassed: boolean("quiz_passed"),
  quizAttempts: integer("quiz_attempts").notNull().default(0),
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at").notNull().defaultNow(),
});

export const streaks = pgTable("streaks", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: text("last_activity_date"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
