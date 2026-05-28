import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Send } from "lucide-react-native";
import { useChat } from "ai/react";
import type { LearningProfile } from "@bitebase/ai";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [finalizedProfile, setFinalizedProfile] = useState<LearningProfile | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: `${API_BASE}/api/onboarding/chat`,
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi! I'm BiteBase. What topic or skill would you like to learn today?",
      },
    ],
    onFinish(message) {
      const toolCall = message.toolInvocations?.find(
        (t) => t.toolName === "finalizeProfile"
      );
      if (toolCall && "result" in toolCall && toolCall.result?.profile) {
        setFinalizedProfile(toolCall.result.profile as LearningProfile);
      }
    },
  });

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    if (finalizedProfile) {
      generateCurriculum(finalizedProfile);
    }
  }, [finalizedProfile]);

  async function generateCurriculum(profile: LearningProfile) {
    setIsGenerating(true);
    setGenerationStatus("Building your curriculum...");

    try {
      const response = await fetch(`${API_BASE}/api/onboarding/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let curriculumId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.event === "status") {
              setGenerationStatus(parsed.data.message ?? "");
            } else if (parsed.event === "curriculum_created") {
              curriculumId = parsed.data.curriculumId;
            } else if (parsed.event === "done") {
              curriculumId = parsed.data.curriculumId ?? curriculumId;
            }
          } catch {
            // ignore
          }
        }
      }

      if (curriculumId) {
        router.push(`/curriculum/${curriculumId}`);
      }
    } catch {
      setGenerationStatus("Something went wrong.");
      setIsGenerating(false);
    }
  }

  const displayMessages = messages.filter((m) => (m.role as string) !== "tool");

  return (
    <SafeAreaView className="flex-1 bg-white">
      {isGenerating ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-violet-100">
            <Text className="text-4xl">✨</Text>
          </View>
          <Text className="mb-2 text-center text-xl font-bold text-gray-900">
            Building your curriculum
          </Text>
          <Text className="mb-6 text-center text-sm text-gray-500">
            This takes a minute while BiteBase creates personalized lessons.
          </Text>
          <View className="w-full rounded-xl bg-violet-50 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <ActivityIndicator color="#7c3aed" size="small" />
              <Text className="ml-2 text-sm text-violet-700">{generationStatus}</Text>
            </View>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="border-b border-gray-100 px-5 py-3">
            <Text className="text-base font-semibold text-gray-900">
              New Course
            </Text>
            <Text className="text-xs text-gray-500">
              Chat with BiteBase to get started
            </Text>
          </View>

          <FlatList
            ref={flatListRef}
            data={displayMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item: m }) => {
              const isAssistant = m.role === "assistant";
              return (
                <View
                  className={`flex-row gap-2 ${isAssistant ? "" : "flex-row-reverse"}`}
                >
                  {isAssistant && (
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-violet-600">
                      <Text className="text-sm">🧠</Text>
                    </View>
                  )}
                  <View
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      isAssistant
                        ? "bg-white border border-gray-100"
                        : "bg-violet-600"
                    }`}
                  >
                    <Text
                      className={`text-sm leading-relaxed ${
                        isAssistant ? "text-gray-700" : "text-white"
                      }`}
                    >
                      {m.content}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          {isLoading && (
            <View className="px-5 py-2">
              <ActivityIndicator color="#7c3aed" size="small" />
            </View>
          )}

          <View className="border-t border-gray-100 px-4 py-3">
            <View className="flex-row items-center gap-3">
              <TextInput
                value={input}
                onChangeText={(text) =>
                  handleInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>)
                }
                placeholder="Type your message..."
                multiline
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900"
                returnKeyType="send"
                onSubmitEditing={() => handleSubmit()}
              />
              <TouchableOpacity
                onPress={() => handleSubmit()}
                disabled={isLoading || !input.trim()}
                className="h-10 w-10 items-center justify-center rounded-xl bg-violet-600 disabled:opacity-60"
              >
                <Send color="white" size={16} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}
