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
  id: z.string().catch("sub-0").describe("Short unique slug, e.g. 'sub-1-a', 'sub-2-b'"),
  title: z.string(),
  description: z.string(),
  order: z.coerce.number().int().catch(0).describe("0-based position index"),
});

export const sectionSchema = z.object({
  id: z.string().catch("section-0").describe("Short unique slug, e.g. 'section-1', 'section-2'"),
  title: z.string(),
  description: z.string(),
  estimatedMinutes: z.coerce.number().int().min(1).catch(10),
  order: z.coerce.number().int().catch(0).describe("0-based position index"),
  subsections: z.array(subsectionSchema).min(1).max(6),
});

export const curriculumPlanSchema = z.object({
  title: z.string().describe("Engaging title for the curriculum"),
  description: z
    .string()
    .describe("Brief overview of what the user will learn"),
  totalEstimatedMinutes: z
    .coerce.number()
    .catch(60)
    .describe("Total estimated learning time in minutes"),
  sections: z
    .array(sectionSchema)
    .min(1)
    .max(8)
    .describe("Main sections of the curriculum"),
});

export type CurriculumPlan = z.infer<typeof curriculumPlanSchema>;

// Normalise type strings the model might output (e.g. "multiple choice", "Multiple_Choice")
const quizTypeSchema = z.preprocess(
  (val) =>
    typeof val === "string"
      ? val.toLowerCase().replace(/[\s-]+/g, "_")
      : val,
  z.enum(["multiple_choice", "fill_in_blank"])
);

export const quizQuestionSchema = z.object({
  id: z.string().describe("Short unique ID, e.g. 'q1', 'q2', 'q3'"),
  type: quizTypeSchema.describe("'multiple_choice' or 'fill_in_blank'"),
  question: z.string(),
  // Allow 2-6 options so minor over/under-generation doesn't fail the whole schema
  options: z
    .array(z.string())
    .min(2)
    .max(6)
    .optional()
    .describe("Answer choices for multiple_choice questions — provide exactly 4"),
  correctAnswer: z
    .string()
    .describe("Exact text of the correct answer (must match one of the options for multiple_choice)"),
  explanation: z
    .string()
    .catch("")
    .describe("Brief explanation of why this answer is correct"),
});

export const lessonContentSchema = z.object({
  content: z
    .string()
    .describe(
      "Rich markdown lesson content with clear headings, examples, and code snippets where relevant"
    ),
  estimatedMinutes: z.coerce.number().int().min(1).catch(10).describe("Estimated reading time in minutes"),
  // .catch([]) lets generation succeed even if model omits or mis-formats sources
  sources: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
      })
    )
    .catch([])
    .describe("Reference sources used — can be an empty array if none"),
  quiz: z.object({
    questions: z.array(quizQuestionSchema).min(1).max(6),
    passingScore: z
      .coerce.number()
      .min(50)
      .max(100)
      .default(70)
      .catch(70)
      .describe("Minimum percentage score (50-100) required to pass, default 70"),
  }),
});

export type LessonContent = z.infer<typeof lessonContentSchema>;
