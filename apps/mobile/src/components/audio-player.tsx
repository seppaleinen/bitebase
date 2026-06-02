import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Play, Pause } from "lucide-react-native";
import { PracticeButton } from "./pronunciation-practice";

type AudioClip = {
  word: string;
  language: string;
  pronunciation: string;
  definition: string;
  audioDataUrl: string;
  durationMs: number;
};

/**
 * Converts a base64 data URL to a local file URI for playback.
 * expo-av cannot load data: URIs directly on iOS/Android.
 */
async function dataUrlToFile(dataUrl: string): Promise<string | null> {
  try {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;
    const base64 = matches[2];
    const filename = `bitebase-audio-${Date.now()}.mp3`;
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  } catch {
    return null;
  }
}

export function AudioPlayer({ clip }: { clip: AudioClip }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = useCallback(async () => {
    if (isLoading) return;

    // If already loaded and paused, resume
    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if ("isLoaded" in status && status.isLoaded) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }
    }

    // First load: convert data URL to file, then create sound
    setIsLoading(true);
    try {
      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const fileUri = await dataUrlToFile(clip.audioDataUrl);
      if (!fileUri) {
        console.warn("[audio-player] failed to decode audio data url");
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { shouldPlay: true },
        (status) => {
          // Callback for status updates
          if ("isLoaded" in status && status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
            soundRef.current?.setPositionAsync(0);
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch (err) {
      console.warn("[audio-player] playback failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [clip.audioDataUrl, isPlaying, isLoading]);

  return (
    <View className="flex-row items-center justify-between rounded-xl border border-[#efe9e2] bg-[#fcfaf8] px-4 py-3">
      <View className="flex-1 mr-2">
        <Text className="font-medium text-[#2d2419] text-sm" numberOfLines={1}>
          {clip.word}
        </Text>
        <Text className="text-xs text-[#8a7f73]" numberOfLines={1}>
          /{clip.pronunciation}/ · {clip.definition}
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5 shrink-0">
        <PracticeButton clip={clip} />
        <Text className="text-[10px] text-[#8a7f73]">{clip.language}</Text>
        <TouchableOpacity
          onPress={handlePlay}
          disabled={isLoading}
          accessibilityLabel={isPlaying ? `Pause ${clip.word}` : `Play ${clip.word}`}
          className="h-9 w-9 items-center justify-center rounded-full bg-[#c75146]"
        >
          {isLoading ? (
            <Text className="text-white text-xs">...</Text>
          ) : isPlaying ? (
            <Pause color="white" size={16} />
          ) : (
            <Play color="white" size={16} style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function VocabularySection({ clips }: { clips: AudioClip[] }) {
  if (!clips || clips.length === 0) return null;

  return (
    <View className="mt-6 rounded-2xl border border-[#efe9e2] bg-white p-5">
      <Text
        accessibilityRole="header"
        className="mb-3 font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[#2d2419]"
      >
        Vocabulary & Pronunciation
      </Text>
      <View className="gap-2">
        {clips.map((clip, i) => (
          <AudioPlayer key={`${clip.word}-${i}`} clip={clip} />
        ))}
      </View>
    </View>
  );
}
