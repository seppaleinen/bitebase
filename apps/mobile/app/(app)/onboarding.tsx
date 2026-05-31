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
import { extractProfileValues } from "@bitebase/ai";
import { getSuggestions } from "@/lib/onboarding-suggestions";
import { keyboardHandler } from "@/lib/keyboard-handler";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [finalizedProfile, setFinalizedProfile] = useState<LearningProfile | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: `${API_BASE}/api/onboarding/chat`,
    fetch: (url, options) =>
      fetch(url, { ...options, credentials: "include" }),
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

  // Layered profile detection: tool call → PROFILE:text marker → heuristic
  useEffect(() => {
    if (finalizedProfile || isLoading) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    let detected: LearningProfile | null = null;

    // Secondary: PROFILE:{...} text marker
    const match = lastAssistant.content.match(/PROFILE:\s*(\{[^]*?\})/);
    if (match) {
      try {
        const p = JSON.parse(match[1]) as LearningProfile;
        if (p.topic && p.experienceLevel && p.goals) detected = p;
      } catch { /* fall through to heuristic */ }
    }

    // Heuristic: scan conversation for all 3 fields
    if (!detected) {
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
      const extracted = extractProfileValues(chatMessages);
      if (extracted) detected = extracted;
    }

    if (detected) setFinalizedProfile(detected);
  }, [messages, isLoading, finalizedProfile]);

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

  const suggestions = getSuggestions(messages, isLoading, finalizedProfile);

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
            <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
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
                  accessibilityLabel={isAssistant ? `BiteBase: ${m.content}` : `You: ${m.content}`}
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
                      testID={`msg-${m.id}`}
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
            <View className="px-5 py-2" accessibilityRole="alert" accessibilityLabel="BiteBase is typing">
              <ActivityIndicator color="#7c3aed" size="small" />
            </View>
          )}

          {finalizedProfile && !isGenerating && (
            <View testID="profile-card" accessibilityLabel="Profile review card" className="mx-4 mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <Text className="mb-3 text-sm font-semibold text-emerald-800">
                Ready to generate your curriculum
              </Text>
              <View className="mb-4 gap-1">
                <View className="flex-row">
                  <Text className="w-20 text-xs font-medium text-emerald-700">Topic</Text>
                  <Text testID="profile-topic" accessibilityLabel={`Topic: ${finalizedProfile.topic}`} className="flex-1 text-xs capitalize text-emerald-700">
                    {finalizedProfile.topic}
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="w-20 text-xs font-medium text-emerald-700">Level</Text>
                  <Text testID="profile-level" accessibilityLabel={`Level: ${finalizedProfile.experienceLevel}`} className="flex-1 text-xs capitalize text-emerald-700">
                    {finalizedProfile.experienceLevel}
                  </Text>
                </View>
                <View className="flex-row">
                  <Text className="w-20 text-xs font-medium text-emerald-700">Goal</Text>
                  <Text testID="profile-goals" accessibilityLabel={`Goal: ${finalizedProfile.goals}`} className="flex-1 text-xs text-emerald-700">
                    {finalizedProfile.goals}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setFinalizedProfile(null)}
                  className="flex-1 rounded-xl border border-emerald-300 py-2.5"
                  testID="edit-answers"
                  accessibilityLabel="Edit answers"
                  {...keyboardHandler(() => setFinalizedProfile(null))}
                >
                  <Text className="text-center text-xs font-medium text-emerald-700">
                    Edit answers
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void generateCurriculum(finalizedProfile)}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5"
                  testID="build-curriculum"
                  accessibilityLabel="Build my curriculum"
                  {...keyboardHandler(() => void generateCurriculum(finalizedProfile))}
                >
                  <Text className="text-center text-xs font-medium text-white">
                    Build my curriculum
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View className="border-t border-gray-100 px-4 py-3">
            {suggestions.length > 0 && (
              <View className="mb-3 flex-row flex-wrap gap-2">
                {suggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => void append({ role: "user", content: s })}
                    accessibilityLabel={s}
                    className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5"
                    {...keyboardHandler(() => void append({ role: "user", content: s }))}
                  >
                    <Text className="text-xs font-medium text-violet-700">{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View className="flex-row items-center gap-3">
              <TextInput
                value={input}
                onChangeText={(text) =>
                  handleInputChange({ target: { value: text } } as React.ChangeEvent<HTMLInputElement>)
                }
                placeholder="Type your message..."
                accessibilityLabel="Type your message"
                multiline
                className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900"
                returnKeyType="send"
                onSubmitEditing={() => handleSubmit()}
                {...{
                  onKeyDown: (e: { key: string; preventDefault: () => void; shiftKey: boolean }) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  },
                } as any}
              />
              <TouchableOpacity
                onPress={() => handleSubmit()}
                disabled={isLoading || !input.trim()}
                className="h-10 w-10 items-center justify-center rounded-xl bg-violet-600 disabled:opacity-60"
                testID="send-btn"
                accessibilityLabel="Send message"
                {...keyboardHandler(() => handleSubmit())}
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
