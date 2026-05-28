import { z } from "zod";

export const learningProfileSchema = z.object({
  topic: z.string().describe("The main topic or skill the user wants to learn"),
  experienceLevel: z
    .enum(["beginner", "intermediate", "advanced"])
    .describe("User's current experience level with this topic"),
  goals: z
    .string()
    .describe("What the user hopes to achieve by learning this topic"),
  availableMinutesPerDay: z
    .number()
    .min(5)
    .max(240)
    .describe("How many minutes per day the user can dedicate to learning"),
  additionalContext: z
    .string()
    .optional()
    .describe("Any additional context about the user's learning preferences"),
});

export type LearningProfile = z.infer<typeof learningProfileSchema>;

export const subsectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number(),
});

export const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  estimatedMinutes: z.number(),
  order: z.number(),
  subsections: z.array(subsectionSchema),
});

export const curriculumPlanSchema = z.object({
  title: z.string().describe("Engaging title for the curriculum"),
  description: z
    .string()
    .describe("Brief overview of what the user will learn"),
  totalEstimatedMinutes: z
    .number()
    .describe("Total estimated learning time in minutes"),
  sections: z
    .array(sectionSchema)
    .min(3)
    .max(8)
    .describe("Main sections of the curriculum"),
});

export type CurriculumPlan = z.infer<typeof curriculumPlanSchema>;

export const quizQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["multiple_choice", "fill_in_blank"]),
  question: z.string(),
  options: z
    .array(z.string())
    .length(4)
    .optional()
    .describe("4 options for multiple choice questions"),
  correctAnswer: z
    .string()
    .describe("The correct answer (or index 0-3 for multiple choice)"),
  explanation: z
    .string()
    .describe("Why this is the correct answer"),
});

export const lessonContentSchema = z.object({
  content: z
    .string()
    .describe(
      "Rich markdown content for the lesson, including examples, code snippets if relevant, and clear explanations"
    ),
  estimatedMinutes: z.number().describe("Estimated reading time in minutes"),
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      })
    )
    .describe("Sources used to create this lesson"),
  quiz: z.object({
    questions: z.array(quizQuestionSchema).min(3).max(6),
    passingScore: z
      .number()
      .min(50)
      .max(100)
      .default(70)
      .describe("Minimum score (0-100) to pass the quiz"),
  }),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;
