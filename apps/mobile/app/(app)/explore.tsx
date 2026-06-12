import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { trpcReact } from "@/lib/trpc-provider";
import {
  BookOpen,
  Clock,
  Search,
  ChevronDown,
  X,
  Tag,
} from "lucide-react-native";

export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const { data: categories } = trpcReact.public.listCategories.useQuery();
  const { data: courses, isLoading } =
    trpcReact.public.listPublished.useQuery({
      category: selectedCategory ?? undefined,
      search: search.trim() || undefined,
    });

  const activeCategory =
    selectedCategory && categories
      ? categories.find((c) => c.category === selectedCategory)
      : null;

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
      <View className="px-5 pb-3">
        <View className="flex-row items-center rounded-xl border border-gray-200 bg-white px-3 py-2">
          <Search color="#9ca3af" size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search courses..."
            placeholderTextColor="#9ca3af"
            className="ml-2 flex-1 text-sm text-gray-900"
            accessibilityLabel="Search courses"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              accessibilityLabel="Clear search"
            >
              <X color="#9ca3af" size={16} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category picker */}
      {categories && categories.length > 0 && (
        <View className="px-5 pb-3">
          <TouchableOpacity
            onPress={() => setShowCategoryPicker(true)}
            className="flex-row items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5"
            accessibilityLabel="Select category"
            accessibilityHint={
              activeCategory
                ? `Current category: ${activeCategory.category}`
                : "All categories"
            }
          >
            <Tag color="#9ca3af" size={16} />
            <Text className="flex-1 text-sm text-gray-700">
              {activeCategory ? activeCategory.category : "All categories"}
            </Text>
            <ChevronDown color="#9ca3af" size={16} />
          </TouchableOpacity>

          <Modal
            visible={showCategoryPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCategoryPicker(false)}
          >
            <TouchableOpacity
              className="flex-1 bg-black/40 justify-center px-6"
              activeOpacity={1}
              onPress={() => setShowCategoryPicker(false)}
            >
              <View className="rounded-2xl bg-white py-2 shadow-xl">
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategory(null);
                    setShowCategoryPicker(false);
                  }}
                  className={`px-5 py-3 ${!selectedCategory ? "bg-violet-50" : ""}`}
                >
                  <Text
                    className={`text-sm ${!selectedCategory ? "font-semibold text-violet-700" : "text-gray-700"}`}
                  >
                    All categories
                  </Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.category}
                    onPress={() => {
                      setSelectedCategory(
                        cat.category === selectedCategory
                          ? null
                          : cat.category
                      );
                      setShowCategoryPicker(false);
                    }}
                    className={`px-5 py-3 ${selectedCategory === cat.category ? "bg-violet-50" : ""}`}
                  >
                    <Text
                      className={`text-sm ${selectedCategory === cat.category ? "font-semibold text-violet-700" : "text-gray-700"}`}
                    >
                      {cat.category}
                      {cat.subcategories.length > 0 && (
                        <Text className="text-xs text-gray-400">
                          {" "}
                          ({cat.subcategories.length})
                        </Text>
                      )}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      )}

      {/* Active filter indicator */}
      {(selectedCategory || search.trim()) && (
        <View className="flex-row flex-wrap items-center gap-2 px-5 pb-3">
          {selectedCategory && (
            <View className="flex-row items-center gap-1 rounded-full bg-violet-100 px-3 py-1">
              <Text className="text-xs font-medium text-violet-700">
                {selectedCategory}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedCategory(null)}
                accessibilityLabel={`Remove ${selectedCategory} filter`}
              >
                <X color="#7c3aed" size={14} />
              </TouchableOpacity>
            </View>
          )}
          {search.trim() && (
            <View className="flex-row items-center gap-1 rounded-full bg-violet-100 px-3 py-1">
              <Text className="text-xs font-medium text-violet-700">
                &ldquo;{search.trim()}&rdquo;
              </Text>
              <TouchableOpacity
                onPress={() => setSearch("")}
                accessibilityLabel="Clear search"
              >
                <X color="#7c3aed" size={14} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#7c3aed" size="large" />
        </View>
      ) : !courses || courses.length === 0 ? (
        <View
          className="flex-1 items-center justify-center px-8"
          accessibilityLabel="No courses found"
        >
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
            <BookOpen color="#7c3aed" size={32} />
          </View>
          <Text className="mb-2 text-center text-lg font-semibold text-gray-900">
            {search || selectedCategory
              ? "No matching courses"
              : "No courses yet"}
          </Text>
          <Text className="text-center text-sm text-gray-500">
            {search || selectedCategory
              ? "Try different filters or search terms."
              : "Be the first to create a course and share it."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/course/${item.id}`)}
              accessibilityLabel={item.title}
              accessibilityHint={`Open ${item.title} course`}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <View className="mb-3 flex-row items-start justify-between">
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
                  <BookOpen color="#7c3aed" size={20} />
                </View>
                {item.category && (
                  <View className="rounded-full bg-gray-100 px-2.5 py-0.5">
                    <Text className="text-xs font-medium text-gray-600">
                      {item.category}
                      {item.subcategory ? ` · ${item.subcategory}` : ""}
                    </Text>
                  </View>
                )}
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
