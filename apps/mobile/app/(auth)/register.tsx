import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError("");
    setLoading(true);
    const { error: authError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    if (authError) {
      setError(authError.message ?? "Registration failed");
      setLoading(false);
      return;
    }
    router.replace("/(app)/onboarding");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-violet-50"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        className="px-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center py-12">
          <View className="mb-8 items-center">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl bg-violet-600">
              <Text className="text-3xl">🧠</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">BiteBase</Text>
            <Text className="mt-1 text-gray-500">Start learning today</Text>
          </View>

          <View className="rounded-2xl bg-white p-6 shadow-sm">
            {error ? (
              <View className="mb-4 rounded-xl bg-red-50 p-3">
                <Text className="text-sm text-red-600">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Alex Johnson"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900"
              />
            </View>

            <View className="mb-4">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900"
              />
            </View>

            <View className="mb-6">
              <Text className="mb-1.5 text-sm font-medium text-gray-700">Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                secureTextEntry
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900"
              />
            </View>

            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              className="items-center justify-center rounded-xl bg-violet-600 py-3 disabled:opacity-60"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="font-semibold text-white">Create account</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/login")}
            className="mt-4 items-center"
          >
            <Text className="text-sm text-gray-500">
              Have an account?{" "}
              <Text className="font-medium text-violet-600">Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
