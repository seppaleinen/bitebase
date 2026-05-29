import type { QuizQuestion } from "@bitebase/db";

export type QuizFeedbackItem = {
  questionId: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
};

export type QuizScoreResult = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  feedback: QuizFeedbackItem[];
};

/**
 * Pure function — no DB or side effects.
 * Grades a quiz submission and returns score + per-question feedback.
 */
export function scoreQuiz(
  questions: QuizQuestion[],
  answers: Record<string, string>,
  passingScore: number
): QuizScoreResult {
  const total = questions.length;

  const feedback: QuizFeedbackItem[] = questions.map((q) => ({
    questionId: q.id,
    correct: (answers[q.id] ?? "").trim().toLowerCase() === q.correctAnswer.trim().toLowerCase(),
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));

  const correct = feedback.filter((f) => f.correct).length;
  // No questions → trivially 100% (nothing to get wrong)
  const score = total === 0 ? 100 : Math.round((correct / total) * 100);
  const passed = total === 0 ? true : score >= passingScore;

  return { score, passed, correct, total, feedback };
}
