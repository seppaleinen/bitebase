import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import Markdown from "react-native-markdown-display";
import { trpcReact } from "@/lib/trpc-provider";
import { Image } from "expo-image";
import { VocabularySection } from "@/components/audio-player";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<null | {
    score: number;
    passed: boolean;
  }>(null);

  const utils = trpcReact.useUtils();
  const { data, isLoading } = trpcReact.curriculum.getLesson.useQuery({
    lessonId: id,
  });
  const markStarted = trpcReact.curriculum.markLessonStarted.useMutation();
  const submitQuiz = trpcReact.curriculum.submitQuiz.useMutation({
    onSuccess: (result) => {
      setQuizResult({ score: result.score, passed: result.passed });
      utils.curriculum.getLesson.invalidate({ lessonId: id });
    },
  });

  useEffect(() => {
    if (data?.lesson && data.progress?.status === "available") {
      markStarted.mutate({ lessonId: id });
    }
  }, [data?.lesson?.id]);

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-[#faf7f4]">
        <ActivityIndicator color="#c75146" size="large" />
      </View>
    );
  }

  const { lesson, quiz } = data;

  return (
    <SafeAreaView className="flex-1 bg-[#faf7f4]">
      <View className="flex-row items-center gap-3 border-b border-[#efe9e2] px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <ChevronLeft color="#8a7f73" size={20} />
        </TouchableOpacity>
        <Text className="flex-1 font-[family-name:var(--font-fraunces)] font-semibold text-[#2d2419]" numberOfLines={1}>
          {lesson.title}
        </Text>
      </View>

      <ScrollView className="flex-1 px-5 py-4">
        {!showQuiz ? (
          <>
            <Markdown
              rules={{
                image: (node) => {
                  const { src, alt } = node.attributes;
                  return (
                    <View key={src} className="my-4 overflow-hidden rounded-2xl border border-[#efe9e2] bg-[#fcfaf8]">
                      <Image
                        source={{ uri: src }}
                        style={{ width: "100%", aspectRatio: 16 / 9 }}
                        contentFit="cover"
                        transition={300}
                        alt={alt}
                        accessibilityLabel={alt || "Lesson image"}
                      />
                      {alt ? (
                        <View className="border-t border-[#efe9e2] px-3 py-2">
                          <Text className="text-[11px] italic text-[#8a7f73]">{alt}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                },
              }}
              style={{
                body: { color: "#4a3f35", lineHeight: 24, fontSize: 15, fontFamily: "var(--font-literata), Georgia, serif" },
                heading1: { color: "#2d2419", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: "700", marginBottom: 12, fontSize: 22 },
                heading2: { color: "#2d2419", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: "600", marginBottom: 8, fontSize: 18 },
                heading3: { color: "#2d2419", fontFamily: "var(--font-fraunces), Georgia, serif", fontWeight: "600", marginBottom: 6 },
                code_inline: {
                  backgroundColor: "#e3ede8",
                  color: "#3d6b5a",
                  borderRadius: 4,
                  paddingHorizontal: 4,
                  fontFamily: "monospace",
                },
                fence: {
                  backgroundColor: "#2a2520",
                  borderRadius: 12,
                  padding: 12,
                },
                strong: { fontWeight: "600", color: "#2d2419" },
                link: { color: "#c75146" },
                blockquote: {
                  backgroundColor: "#f8f6f4",
                  borderLeftWidth: 4,
                  borderLeftColor: "#cbd5e0",
                  borderRadius: 12,
                  padding: 12,
                  marginVertical: 8,
                },
                table: {
                  borderWidth: 1,
                  borderColor: "#efe9e2",
                  borderRadius: 8,
                  marginVertical: 8,
                },
                th: {
                  borderWidth: 1,
                  borderColor: "#efe9e2",
                  backgroundColor: "#f2ede8",
                  padding: 8,
                  fontWeight: "600",
                  fontSize: 13,
                  color: "#2d2419",
                  fontFamily: "var(--font-fraunces), Georgia, serif",
                },
                td: {
                  borderWidth: 1,
                  borderColor: "#efe9e2",
                  padding: 8,
                  fontSize: 14,
                },
              }}
            >
              {lesson.content}
            </Markdown>

            {/* Vocabulary & Pronunciation — audio clips from language courses */}
            {lesson.audioClips && lesson.audioClips.length > 0 && (
              <View className="mt-6">
                <VocabularySection clips={lesson.audioClips as Array<{word: string; language: string; pronunciation: string; definition: string; audioDataUrl: string; durationMs: number}>} />
              </View>
            )}

            {/* Visual References */}
            {lesson.sources && lesson.sources.some(s => s.imageUrls && s.imageUrls.length > 0) && (
              <View className="mt-6">
                <Text accessibilityRole="header" className="mb-3 font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[#2d2419]">
                  Visual References
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {lesson.sources.flatMap((s, si) => (s.imageUrls || []).map((url, ii) => (
                    <TouchableOpacity
                      key={`${si}-${ii}`}
                      className="mr-3 w-48 overflow-hidden rounded-xl border border-[#efe9e2] bg-white"
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: url }}
                        style={{ width: "100%", height: 100 }}
                        contentFit="cover"
                        transition={300}
                      />
                      <View className="p-2">
                        <Text className="text-[10px] font-medium text-[#4a3f35]" numberOfLines={1}>
                          {s.title}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )))}
                </ScrollView>
              </View>
            )}

            {quiz && (
              <TouchableOpacity
                onPress={() => setShowQuiz(true)}
                accessibilityLabel="Take the quiz"
                className="mb-8 mt-10 flex-row items-center justify-center gap-2 rounded-xl bg-[#c75146] py-3"
              >
                <Text className="font-semibold text-white">Take the quiz</Text>
                <ChevronRight color="white" size={16} />
              </TouchableOpacity>
            )}
          </>
        ) : quizResult ? (
          <View className="items-center py-8">
            <Text className="mb-2 text-5xl" accessibilityLabel={quizResult.passed ? "Lesson complete" : "Keep studying"}>
              {quizResult.passed ? "🏆" : "📚"}
            </Text>
            <Text className="mb-1 text-xl font-[family-name:var(--font-fraunces)] font-bold text-[#2d2419]">
              {quizResult.passed ? "Lesson complete!" : "Keep at it!"}
            </Text>
            <Text className="mb-6 font-[family-name:var(--font-literata)] text-[#8a7f73]">
              You scored {quizResult.score}%
              {!quizResult.passed ? ". Review and try again!" : "!"}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowQuiz(false);
                setQuizAnswers({});
                setQuizResult(null);
              }}
              className="rounded-xl border border-[#d4c9bd] px-6 py-2.5"
            >
              <Text className="text-sm font-medium text-[#8a7f73]">
                {quizResult.passed ? "Back to lesson" : "Review lesson"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          quiz && (
            <View className="py-4">
              {quiz.questions.map((q, i) => (
                <View key={q.id} className="mb-6">
                  <Text className="mb-3 font-[family-name:var(--font-fraunces)] font-semibold text-[#2d2419]">
                    {i + 1}. {q.question}
                  </Text>
                  {q.type === "multiple_choice" && q.options ? (
                    q.options.map((opt, oi) => {
                      const label = String.fromCharCode(65 + oi);
                      const selected = quizAnswers[q.id] === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() =>
                            setQuizAnswers((a) => ({ ...a, [q.id]: opt }))
                          }
                          accessibilityLabel={`Option ${label}: ${opt}`}
                          accessibilityState={{ selected }}
                          className={`mb-2 rounded-xl border px-4 py-3 ${
                            selected
                              ? "border-[#c75146] bg-[#f0d9d6]"
                              : "border-[#efe9e2] bg-[#fcfaf8]"
                          }`}
                        >
                          <Text
                            className={`text-sm font-[family-name:var(--font-literata)] ${selected ? "text-[#c75146] font-medium" : "text-[#4a3f35]"}`}
                          >
                            <Text className="font-semibold">{label}. </Text>
                            {opt}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View className="rounded-xl border border-[#efe9e2] px-4 py-3">
                      <Text className="font-[family-name:var(--font-literata)] text-sm text-[#8a7f73]">
                        {quizAnswers[q.id] || "Tap to answer..."}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity
                onPress={() =>
                  submitQuiz.mutate({ lessonId: id, answers: quizAnswers })
                }
                accessibilityLabel="Submit quiz"
                disabled={
                  submitQuiz.isPending ||
                  quiz.questions.some((q) => !quizAnswers[q.id])
                }
                className="mb-8 rounded-xl bg-[#c75146] py-3 items-center disabled:opacity-60"
              >
                {submitQuiz.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="font-semibold text-white">Submit quiz</Text>
                )}
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
