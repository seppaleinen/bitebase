import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle,
  Lock,
  Circle,
  ChevronLeft,
  ChevronRight,
  Tag,
} from "lucide-react-native";
import { trpcReact } from "@/lib/trpc-provider";
import type { CurriculumSection } from "@bitebase/db";

export default function CurriculumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: curriculum, isLoading: loadingCurriculum } =
    trpcReact.curriculum.get.useQuery({ id });
  const { data: lessonsData, isLoading: loadingLessons } =
    trpcReact.curriculum.getLessons.useQuery({ curriculumId: id });

  if (loadingCurriculum || loadingLessons) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator color="#7c3aed" size="large" />
      </View>
    );
  }

  if (!curriculum || !lessonsData) return null;

  const sections = curriculum.sections as CurriculumSection[];
  const lessonMap = new Map(
    lessonsData.map((l) => [`${l.sectionId}:${l.subsectionId ?? ""}`, l])
  );

  const items = sections.flatMap((section) => [
    { type: "section" as const, section },
    ...section.subsections.map((sub) => ({
      type: "lesson" as const,
      sub,
      section,
      lesson: lessonMap.get(`${section.id}:${sub.id}`),
    })),
  ]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row items-center gap-3 border-b border-gray-100 bg-white px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Go back">
          <ChevronLeft color="#6b7280" size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-semibold text-gray-900" numberOfLines={1}>
            {curriculum.title}
          </Text>
          {curriculum.category && (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Tag color="#9ca3af" size={11} />
              <Text className="text-xs text-gray-400" numberOfLines={1}>
                {curriculum.category}
                {curriculum.subcategory ? ` · ${curriculum.subcategory}` : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, i) =>
          item.type === "section" ? item.section.id : `${item.sub.id}-${i}`
        }
        contentContainerStyle={{ padding: 16, gap: 4 }}
        renderItem={({ item }) => {
          if (item.type === "section") {
            return (
              <View className="mb-1 mt-4 px-1">
                <Text accessibilityRole="header" className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                  {item.section.title}
                </Text>
              </View>
            );
          }

          const { lesson, sub } = item;
          const status = lesson?.progress?.status ?? "locked";
          const isLocked = !lesson || status === "locked";
          const isCompleted = status === "completed";

          return (
            <TouchableOpacity
              onPress={() => {
                if (lesson && !isLocked) {
                  router.push(`/lesson/${lesson.id}`);
                }
              }}
              disabled={isLocked}
              accessibilityLabel={sub.title}
              accessibilityHint={isLocked ? "Lesson locked, complete previous lesson first" : `Open ${sub.title} lesson`}
              accessibilityState={{ disabled: isLocked }}
              className={`flex-row items-center gap-3 rounded-xl border p-4 ${
                isLocked
                  ? "border-gray-100 bg-gray-50 opacity-60"
                  : "border-gray-100 bg-white"
              }`}
            >
              {isCompleted ? (
                <CheckCircle color="#10b981" size={20} accessibilityLabel="Completed" />
              ) : isLocked ? (
                <Lock color="#d1d5db" size={20} accessibilityLabel="Locked" />
              ) : (
                <Circle color="#7c3aed" size={20} accessibilityLabel="Available" />
              )}
              <View className="flex-1">
                <Text
                  className={`text-sm font-medium ${
                    isLocked ? "text-gray-400" : "text-gray-900"
                  }`}
                >
                  {sub.title}
                </Text>
                {lesson && (
                  <Text className="text-xs text-gray-400">
                    {lesson.estimatedMinutes} min
                  </Text>
                )}
              </View>
              {!isLocked && <ChevronRight color="#9ca3af" size={16} />}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}
