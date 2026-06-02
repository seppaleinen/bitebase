"use client";

import { useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";
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
 * Renders a row for a single vocabulary word with a play/pause button.
 * Uses the native <audio> element under the hood.
 */
export function AudioPlayer({ clip }: { clip: AudioClip }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function handleToggle() {
    if (!audioRef.current) {
      const audio = new Audio(clip.audioDataUrl);
      audio.preload = "none";
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      audioRef.current = audio;
    }

    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
    } else {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#efe9e2] bg-[#fcfaf8] px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[var(--color-text-primary)] text-sm">
          {clip.word}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          <span className="italic font-[family-name:var(--font-literata)]">/{clip.pronunciation}/</span>
          <span className="mx-1.5">·</span>
          {clip.definition}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <PracticeButton clip={clip} />
        <span className="text-[10px] text-[var(--color-text-muted)] mr-1">
          {clip.language}
        </span>
        <button
          onClick={handleToggle}
          aria-label={playing ? `Pause ${clip.word}` : `Play ${clip.word}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Full vocabulary card rendered when a lesson has audio clips.
 * Shows all vocabulary words with play buttons.
 */
export function VocabularySection({ clips }: { clips: AudioClip[] }) {
  if (!clips || clips.length === 0) return null;

  return (
    <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-5 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[var(--color-text-primary)]">
        <Volume2 className="h-3.5 w-3.5 text-[var(--color-accent)]" />
        Vocabulary & Pronunciation
      </h3>
      <div className="space-y-2">
        {clips.map((clip, i) => (
          <AudioPlayer key={`${clip.word}-${i}`} clip={clip} />
        ))}
      </div>
    </div>
  );
}
