"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  ChevronRight,
  Loader2,
  Sparkles,
  BookOpen,
  ArrowRight,
  Plus,
} from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";
import type { QuizQuestion } from "@bitebase/db";

interface Quiz {
  id: string;
  questions: QuizQuestion[];
  passingScore: number;
}

interface QuizSectionProps {
  lessonId: string;
  quiz: Quiz;
  lessonTitle: string;
  curriculumId: string;
  curriculumTitle?: string;
  onComplete?: () => void;
}

type QuizResult = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  feedback: Array<{
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
  }>;
};

// ── What's next screen (shown after passing) ──────────────────────────────────

function WhatsNextScreen({
  result,
  lessonId,
  lessonTitle,
  curriculumTitle,
  questions,
  onRetake,
}: {
  result: QuizResult;
  lessonId: string;
  lessonTitle: string;
  curriculumTitle?: string;
  questions: QuizQuestion[];
  onRetake: () => void;
}) {
  const [showReview, setShowReview] = useState(false);

  const { data: nextLesson } = trpcReact.curriculum.getNextLesson.useQuery({
    lessonId,
  });

  // Encode a focused onboarding prompt so the chat opens with context
  const deeperTopicParam = encodeURIComponent(
    `I want to explore a deeper aspect of what I just learned: "${lessonTitle}". Can you help me go further?`
  );
  const relatedTopicParam = encodeURIComponent(
    `I just finished learning about "${lessonTitle}"${curriculumTitle ? ` as part of "${curriculumTitle}"` : ""}. What related topic should I explore next to complement this?`
  );

  return (
    <div className="p-6">
      {/* Pass banner */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <Trophy className="h-10 w-10 text-emerald-500" />
        </div>
        <h3 className="mb-1 text-xl font-bold text-gray-900">Lesson complete!</h3>
        <p className="text-sm text-gray-500">
          You scored{" "}
          <span className="font-semibold text-emerald-600">{result.score}%</span>
          {" "}— {result.correct} out of {result.total} correct.
        </p>
      </div>

      {/* What's next */}
      <div className="space-y-3">
        <p className="text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
          What would you like to do next?
        </p>

        {/* Next lesson in curriculum */}
        {nextLesson ? (
          <Link
            href={`/lesson/${nextLesson.id}`}
            className="flex items-center gap-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 transition-all hover:border-violet-400 hover:bg-violet-100"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600">
              <ArrowRight className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-violet-500">Continue with</p>
              <p className="font-semibold text-violet-900">{nextLesson.title}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-violet-400" />
          </Link>
        ) : (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-emerald-600">All done!</p>
              <p className="font-semibold text-emerald-900">
                You&apos;ve completed {curriculumTitle ?? "this curriculum"}
              </p>
            </div>
          </div>
        )}

        {/* Go deeper on the same topic */}
        <Link
          href={`/onboarding?prompt=${deeperTopicParam}`}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-violet-200 hover:bg-violet-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs font-medium text-gray-400">Go deeper</p>
            <p className="font-medium text-gray-800">
              Explore a deeper aspect of &ldquo;{lessonTitle}&rdquo;
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
        </Link>

        {/* Related topic suggestion */}
        <Link
          href={`/onboarding?prompt=${relatedTopicParam}`}
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-violet-200 hover:bg-violet-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
            <BookOpen className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs font-medium text-gray-400">Related topic</p>
            <p className="font-medium text-gray-800">
              What should I learn next to complement this?
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
        </Link>

        {/* Start something completely new */}
        <Link
          href="/onboarding"
          className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:border-violet-200 hover:bg-violet-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
            <Plus className="h-5 w-5 text-gray-600" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs font-medium text-gray-400">Fresh start</p>
            <p className="font-medium text-gray-800">Learn something completely new</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
        </Link>
      </div>

      {/* Retake / review */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          onClick={() => setShowReview(!showReview)}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          {showReview ? "Hide" : "Review"} answers
        </button>
        <span className="text-gray-200">·</span>
        <button
          onClick={onRetake}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retake quiz
        </button>
      </div>

      {/* Answer review */}
      {showReview && (
        <ReviewSection result={result} questions={questions} />
      )}
    </div>
  );
}

// ── Fail screen ───────────────────────────────────────────────────────────────

function FailScreen({
  result,
  questions,
  answers,
  passingScore,
  onRetake,
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  answers: Record<string, string>;
  passingScore: number;
  onRetake: () => void;
}) {
  const [showReview, setShowReview] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <XCircle className="h-10 w-10 text-red-400" />
        </div>
        <h3 className="mb-1 text-xl font-bold text-gray-900">Not quite there yet</h3>
        <p className="text-sm text-gray-500">
          You got{" "}
          <span className="font-semibold text-red-500">{result.score}%</span>
          {" "}— {result.correct} out of {result.total} correct.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          You need {passingScore}% to pass. Review the lesson and give it another go.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={onRetake}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
        <button
          onClick={() => setShowReview(!showReview)}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          {showReview ? "Hide" : "Review"} answers
        </button>
      </div>

      {showReview && <ReviewSection result={result} questions={questions} answers={answers} />}
    </div>
  );
}

// ── Shared review section ─────────────────────────────────────────────────────

function ReviewSection({
  result,
  questions,
  answers = {},
}: {
  result: QuizResult;
  questions: QuizQuestion[];
  answers?: Record<string, string>;
}) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return (
    <div className="mt-6 space-y-3">
      {result.feedback.map((fb, i) => {
        const question = questionMap.get(fb.questionId);
        const userAnswer = answers[fb.questionId];
        return (
          <div
            key={fb.questionId}
            className={`rounded-xl border p-4 ${
              fb.correct
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            }`}
          >
            <div className="mb-2 flex items-start gap-2">
              {fb.correct ? (
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              )}
              <p className="text-sm font-medium text-gray-900">
                {i + 1}. {question?.question ?? `Question ${i + 1}`}
              </p>
            </div>
            {!fb.correct && (
              <div className="ml-6 space-y-1 text-xs font-bold">
                {userAnswer && (
                  <p className="text-red-600">Your answer: {userAnswer}</p>
                )}
                <p className="text-emerald-600">Correct: {fb.correctAnswer}</p>
              </div>
            )}
            {fb.explanation && (
              <p className="ml-6 mt-2 text-xs text-gray-500">{fb.explanation}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main quiz-taking component ────────────────────────────────────────────────

export default function QuizSection({
  lessonId,
  quiz,
  lessonTitle,
  curriculumTitle,
  onComplete,
}: QuizSectionProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);

  const submitQuiz = trpcReact.curriculum.submitQuiz.useMutation({
    onSuccess: (data) => {
      setResult(data);
      if (data.passed) onComplete?.();
    },
  });

  if (!quiz.questions.length) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        No quiz questions available for this lesson.
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQ];
  const isLastQuestion = currentQ === quiz.questions.length - 1;
  const currentAnswer = answers[currentQuestion?.id ?? ""];

  function handleAnswer(questionId: string, answer: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  function handleNext() {
    if (isLastQuestion) {
      submitQuiz.mutate({ lessonId, answers });
    } else {
      setCurrentQ((q) => q + 1);
    }
  }

  function handleReset() {
    setAnswers({});
    setCurrentQ(0);
    setResult(null);
  }

  // ── Result screens ──────────────────────────────────────────────────────────
  if (result?.passed) {
    return (
      <WhatsNextScreen
        result={result}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        curriculumTitle={curriculumTitle}
        questions={quiz.questions}
        onRetake={handleReset}
      />
    );
  }

  if (result && !result.passed) {
    return (
      <FailScreen
        result={result}
        questions={quiz.questions}
        answers={answers}
        passingScore={quiz.passingScore}
        onRetake={handleReset}
      />
    );
  }

  // ── Quiz-taking UI ──────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <div aria-live="polite" className="text-gray-500">
            Question {currentQ + 1} of {quiz.questions.length}
          </div>
          <span className="text-gray-500">
            {Object.keys(answers).length} answered
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(((currentQ + 1) / quiz.questions.length) * 100)}
          aria-valuemax={100}
          aria-label={`Question ${currentQ + 1} of ${quiz.questions.length}`}
          className="h-1.5 w-full rounded-full bg-gray-100"
        >
          <div
            className="h-1.5 rounded-full bg-violet-600 transition-all"
            style={{ width: `${((currentQ + 1) / quiz.questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mb-6">
        <h3 className="mb-4 text-base font-semibold text-gray-900">
          {currentQuestion.question}
        </h3>

        {currentQuestion.type === "multiple_choice" && currentQuestion.options ? (
          <div className="space-y-2">
            {currentQuestion.options.map((option, i) => {
              const label = String.fromCharCode(65 + i);
              const isSelected = currentAnswer === option;

              return (
                <button
                  key={option}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  aria-pressed={isSelected}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    isSelected
                      ? "border-violet-400 bg-violet-50 text-violet-700 ring-2 ring-violet-200"
                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-200 hover:bg-violet-50"
                  }`}
                >
                  <span className="mr-3 font-semibold">{label}.</span>
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            value={currentAnswer ?? ""}
            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
            aria-label={`Answer for: ${currentQuestion.question}`}
            placeholder="Type your answer..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQ((q) => Math.max(0, q - 1))}
          disabled={currentQ === 0}
          className="text-sm text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          Previous
        </button>

        <button
          onClick={handleNext}
          disabled={!currentAnswer || submitQuiz.isPending}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {submitQuiz.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isLastQuestion ? (
            "Submit quiz"
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
