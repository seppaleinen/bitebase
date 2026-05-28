"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Trophy, RotateCcw, ChevronRight, Loader2 } from "lucide-react";
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

export default function QuizSection({ lessonId, quiz, onComplete }: QuizSectionProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  const submitQuiz = trpcReact.curriculum.submitQuiz.useMutation({
    onSuccess: (data) => {
      setResult(data);
      onComplete?.();
    },
  });

  const currentQuestion = quiz.questions[currentQ];
  const isLastQuestion = currentQ === quiz.questions.length - 1;
  const currentAnswer = answers[currentQuestion?.id ?? ""];
  const allAnswered = quiz.questions.every((q) => answers[q.id]);

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
    setShowReview(false);
  }

  // Results view
  if (result) {
    const feedbackMap = new Map(result.feedback.map((f) => [f.questionId, f]));

    return (
      <div className="p-6">
        <div className="mb-6 text-center">
          <div
            className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${
              result.passed ? "bg-emerald-100" : "bg-red-100"
            }`}
          >
            {result.passed ? (
              <Trophy className="h-10 w-10 text-emerald-500" />
            ) : (
              <XCircle className="h-10 w-10 text-red-400" />
            )}
          </div>
          <h3 className="mb-1 text-xl font-bold text-gray-900">
            {result.passed ? "Lesson complete!" : "Not quite there yet"}
          </h3>
          <p className="text-sm text-gray-500">
            You got {result.correct} out of {result.total} correct —{" "}
            <span
              className={`font-semibold ${result.passed ? "text-emerald-600" : "text-red-500"}`}
            >
              {result.score}%
            </span>
          </p>
          {!result.passed && (
            <p className="mt-1 text-xs text-gray-400">
              You need {quiz.passingScore}% to pass. Review the lesson and try again.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => setShowReview(!showReview)}
            className="text-sm text-violet-600 hover:text-violet-700"
          >
            {showReview ? "Hide" : "Review"} answers
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <RotateCcw className="h-4 w-4" />
            Retake quiz
          </button>
        </div>

        {showReview && (
          <div className="mt-6 space-y-4">
            {quiz.questions.map((q, i) => {
              const fb = feedbackMap.get(q.id);
              const userAnswer = answers[q.id];
              const isCorrect = fb?.correct ?? false;

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-4 ${
                    isCorrect
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="mb-2 flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <p className="text-sm font-medium text-gray-900">
                      {i + 1}. {q.question}
                    </p>
                  </div>
                  {!isCorrect && (
                    <div className="ml-6 space-y-1 text-xs">
                      <p className="text-red-600">
                        Your answer: {userAnswer}
                      </p>
                      <p className="text-emerald-600">
                        Correct: {fb?.correctAnswer}
                      </p>
                    </div>
                  )}
                  {fb?.explanation && (
                    <p className="ml-6 mt-2 text-xs text-gray-500">
                      {fb.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Quiz taking view
  return (
    <div className="p-6">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Question {currentQ + 1} of {quiz.questions.length}
          </span>
          <span className="text-gray-400">
            {Object.keys(answers).length} answered
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-100">
          <div
            className="h-1.5 rounded-full bg-violet-600 transition-all"
            style={{
              width: `${((currentQ + 1) / quiz.questions.length) * 100}%`,
            }}
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
              const optionLabel = String.fromCharCode(65 + i); // A, B, C, D
              const isSelected = currentAnswer === option;

              return (
                <button
                  key={option}
                  onClick={() => handleAnswer(currentQuestion.id, option)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    isSelected
                      ? "border-violet-400 bg-violet-50 text-violet-700 ring-2 ring-violet-200"
                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-200 hover:bg-violet-50"
                  }`}
                >
                  <span className="mr-3 font-semibold">{optionLabel}.</span>
                  {option}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            value={currentAnswer ?? ""}
            onChange={(e) =>
              handleAnswer(currentQuestion.id, e.target.value)
            }
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
