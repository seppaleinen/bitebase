import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Mic, MicOff, CheckCircle2, AlertCircle } from "lucide-react-native";

type AudioClip = {
  word: string;
  language: string;
  pronunciation: string;
  definition: string;
  audioDataUrl: string;
  durationMs: number;
};

type EvaluationResult = {
  score: number;
  feedback: string;
  userTranscription: string;
};

/**
 * Returns the API URL for pronunciation evaluation.
 * On mobile (native), the API base URL must be the server's address.
 * In Expo Go, `window.location.origin` is not the server address,
 * so we use `EXPO_PUBLIC_API_URL` which should point to the web server.
 */
function getApiBaseUrl(): string {
  if (Platform.OS === "web") {
    return window.location.origin;
  }
  // On native, use the configured API URL
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;
  // Fallback for development
  return "http://localhost:3000";
}

export function PracticeButton({ clip }: { clip: AudioClip }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading" | "done" | "error">("idle");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setState("error");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setState("recording");

      // Auto-stop after 5 seconds
      setTimeout(async () => {
        if (recordingRef.current) {
          const status = await recordingRef.current.getStatusAsync();
          if (status.canRecord) {
            await recordingRef.current.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
            });
            await uploadRecording(recordingRef.current);
          }
        }
      }, 5000);
    } catch {
      setState("error");
    }
  }, [clip.word, clip.language]);

  const stopRecording = useCallback(async () => {
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.canRecord) {
          await recordingRef.current.stopAndUnloadAsync();
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
          });
          await uploadRecording(recordingRef.current);
        }
      } catch {
        setState("error");
      }
    }
  }, [clip.word, clip.language]);

  const uploadRecording = useCallback(async (recording: Audio.Recording) => {
    setState("uploading");
    try {
      const uri = recording.getURI();
      if (!uri) throw new Error("No recording URI");

      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Determine MIME type from URI extension
      const ext = uri.split(".").pop()?.toLowerCase() || "m4a";
      const mimeType = ext === "webm" ? "audio/webm" :
                       ext === "mp3" ? "audio/mpeg" : "audio/m4a";

      // Build multipart form data manually since React Native doesn't have FormData
      const boundary = "boundary-bitebase-" + Date.now();
      const body = `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="recording.${ext}"\r\nContent-Type: ${mimeType}\r\n\r\n${base64}\r\n--${boundary}\r\nContent-Disposition: form-data; name="expectedWord"\r\n\r\n${clip.word}\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${clip.language}\r\n--${boundary}--\r\n`;

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/pronunciation/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data: EvaluationResult = await res.json();
      setResult(data);
      setState("done");

      // Clean up recording file
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    } catch {
      setState("error");
    }
  }, [clip.word, clip.language]);

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
    recordingRef.current = null;
  }, []);

  // Idle — show mic button
  if (state === "idle") {
    return (
      <TouchableOpacity
        onPress={startRecording}
        accessibilityLabel={`Practice pronouncing ${clip.word}`}
        className="h-7 w-7 items-center justify-center rounded-full border border-[#d4c9bd]"
      >
        <Mic color="#8a7f73" size={14} />
      </TouchableOpacity>
    );
  }

  // Recording — show stop button
  if (state === "recording") {
    return (
      <TouchableOpacity
        onPress={stopRecording}
        accessibilityLabel="Stop recording"
        className="h-7 w-7 items-center justify-center rounded-full bg-red-500"
      >
        <MicOff color="white" size={14} />
      </TouchableOpacity>
    );
  }

  // Uploading — show spinner
  if (state === "uploading") {
    return (
      <View className="h-7 w-7 items-center justify-center">
        <ActivityIndicator color="#8a7f73" size="small" />
      </View>
    );
  }

  // Error — show retry
  if (state === "error") {
    return (
      <TouchableOpacity
        onPress={reset}
        accessibilityLabel="Retry pronunciation practice"
        className="h-7 w-7 items-center justify-center rounded-full border border-red-200"
      >
        <AlertCircle color="#ef4444" size={14} />
      </TouchableOpacity>
    );
  }

  // Done — show score
  const passed = (result?.score ?? 0) >= 7;
  return (
    <View className="relative">
      <TouchableOpacity
        onPress={reset}
        accessibilityLabel={`Score: ${result?.score}/10. ${result?.feedback}. Click to try again.`}
        className={`flex-row h-7 items-center gap-1 rounded-full px-2 ${
          passed ? "bg-emerald-100" : "bg-amber-100"
        }`}
      >
        {passed ? (
          <CheckCircle2 color="#059669" size={11} />
        ) : (
          <AlertCircle color="#d97706" size={11} />
        )}
        <Text className={`text-xs font-bold ${passed ? "text-emerald-700" : "text-amber-700"}`}>
          {result?.score}/10
        </Text>
      </TouchableOpacity>
      {result && (
        <View className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-[#efe9e2] bg-white p-2 shadow-lg">
          <Text className="text-xs leading-tight text-[#8a7f73]">
            {result.feedback}
          </Text>
        </View>
      )}
    </View>
  );
}
