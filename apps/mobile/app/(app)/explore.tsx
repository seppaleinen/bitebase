import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpcReact } from "@/lib/trpc-provider";
import { BookOpen, Clock, Search } from "lucide-react-native";

export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: curricula, isLoading } =
    trpcReact.public.listPublished.useQuery();

  const filtered = curricula
    ? search.trim()
      ? curricula.filter(
          (c) =>
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.description.toLowerCase().includes(search.toLowerCase())
        )
      : curricula
    : [];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="px-5 pb-3 pt-6">
        <Text
          accessibilityRole="header"
          className="text-2xl font-bold text-gray-900"
        >
          Explore
        </Text>
        <Text className="mt-1 text-sm text-gray-500">
          Browse community-generated courses.
        </Text>
      </View>

      {/* Search */}
      <View className="px-5 pb-4">
        <View className="flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search color="#9ca3af" size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search curricula..."
            placeholderTextColor="#9ca3af"
            className="ml-2 flex-1 text-sm text-gray-900"
            accessibilityLabel="Search curricula"
            returnKeyType="search"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c3aed" size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View
          className="flex-1 items-center justify-center px-8"
          accessibilityLabel="No curricula found"
        >
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
            <BookOpen color="#7c3aed" size={32} />
          </View>
          <Text className="mb-2 text-center text-lg font-semibold text-gray-900">
            {search ? "No matching curricula" : "No curricula yet"}
          </Text>
          <Text className="text-center text-sm text-gray-500">
            {search
              ? "Try a different search term."
              : "Be the first to create a curriculum and share it."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/curriculum/${item.id}`)}
              accessibilityLabel={item.title}
              accessibilityHint={`Open ${item.title} curriculum`}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <View className="mb-3 flex-row items-start justify-between">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <BookOpen color="#7c3aed" size={20} />
                </View>
              </View>
              <Text
                className="mb-1 font-semibold text-gray-900"
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <Text className="mb-3 text-xs text-gray-500" numberOfLines={2}>
                {item.description}
              </Text>
              <View className="flex-row items-center gap-1">
                <Clock color="#9ca3af" size={12} />
                <Text className="text-xs text-gray-400">
                  {Math.round(item.totalEstimatedMinutes / 60)}h total
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
