import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpcReact } from "@/lib/trpc-provider";
import { BookOpen, Clock, ChevronRight } from "lucide-react-native";

export default function DashboardScreen() {
  const router = useRouter();
  const { data: curricula, isLoading } = trpcReact.curriculum.list.useQuery();

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-5 pb-4 pt-6">
        <Text className="text-2xl font-bold text-gray-900">Your Learning</Text>
        <Text className="mt-1 text-sm text-gray-500">
          {curricula?.length
            ? `${curricula.length} active ${curricula.length === 1 ? "curriculum" : "curricula"}`
            : "No courses yet"}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c3aed" size="large" />
        </View>
      ) : !curricula?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
            <BookOpen color="#7c3aed" size={32} />
          </View>
          <Text className="mb-2 text-center text-lg font-semibold text-gray-900">
            No courses yet
          </Text>
          <Text className="mb-6 text-center text-sm text-gray-500">
            Tap &quot;New Course&quot; to create your first personalized curriculum.
          </Text>
        </View>
      ) : (
        <FlatList
          data={curricula}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/curriculum/${item.id}`)}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <View className="mb-3 flex-row items-start justify-between">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <BookOpen color="#7c3aed" size={20} />
                </View>
                {item.generationStatus !== "complete" && (
                  <View className="rounded-full bg-amber-100 px-2 py-0.5">
                    <Text className="text-xs font-medium text-amber-700">
                      Generating...
                    </Text>
                  </View>
                )}
              </View>
              <Text className="mb-1 font-semibold text-gray-900" numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="mb-3 text-xs text-gray-500" numberOfLines={2}>
                {item.description}
              </Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-1">
                  <Clock color="#9ca3af" size={12} />
                  <Text className="ml-1 text-xs text-gray-400">
                    {Math.round(item.totalEstimatedMinutes / 60)}h total
                  </Text>
                </View>
                <ChevronRight color="#9ca3af" size={16} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
