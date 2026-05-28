import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TRPCProvider } from "@/lib/trpc-provider";
import "../global.css";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <TRPCProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </TRPCProvider>
    </SafeAreaProvider>
  );
}
