"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpcReact } from "@/lib/trpc/provider";
import { Badge } from "@bitebase/ui/web";
import QuizSection from "@/components/quiz-section";

export default function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpcReact.useUtils();
  const [showQuiz, setShowQuiz] = useState(false);

  const { data, isLoading } = trpcReact.curriculum.getLesson.useQuery({
    lessonId: id,
  });

  const { data: curriculum } = trpcReact.curriculum.get.useQuery(
    { id: data?.lesson.curriculumId ?? "" },
    { enabled: !!data?.lesson.curriculumId }
  );

  const markStarted = trpcReact.curriculum.markLessonStarted.useMutation();

  useEffect(() => {
    if (data?.lesson && data.progress?.status === "available") {
      markStarted.mutate({ lessonId: id });
    }
  }, [data?.lesson?.id]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!data) return null;

  const { lesson, quiz, progress } = data;
  const isCompleted = progress?.status === "completed";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back nav */}
      <Link
        href={`/curriculum/${lesson.curriculumId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to curriculum
      </Link>

      {/* Lesson header — hidden during quiz to avoid text-matching ambiguity */}
      {!showQuiz && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant={isCompleted ? "success" : "secondary"}>
              {isCompleted ? "Completed" : "Lesson"}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {lesson.estimatedMinutes} min read
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{lesson.title}</p>
        </div>
      )}

      {/* Lesson content — hidden while quiz is active to avoid selector collisions */}
      {!showQuiz && (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="prose-lesson">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {lesson.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Sources */}
      {!showQuiz && lesson.sources && lesson.sources.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Sources & Further Reading
          </h3>
          <ul className="space-y-2">
            {lesson.sources.map((source, i) => (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quiz section */}
      {quiz && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {!showQuiz ? (
            <div className="p-6 text-center">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                Ready to test your knowledge?
              </h3>
              <p className="mb-4 text-sm text-gray-500">
                Answer {quiz.questions.length} questions to complete this lesson.
                You need {quiz.passingScore}% to pass.
              </p>
              {isCompleted ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-emerald-600 font-medium">
                    You passed this quiz with {progress?.quizScore}%!
                  </p>
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Retake quiz
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Take the quiz
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <QuizSection
              lessonId={id}
              quiz={quiz}
              lessonTitle={lesson.title}
              curriculumId={lesson.curriculumId}
              curriculumTitle={curriculum?.title}
              onComplete={() => {
                utils.curriculum.getLesson.invalidate({ lessonId: id });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
