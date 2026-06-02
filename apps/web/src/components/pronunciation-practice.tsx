"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

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
 * Record & evaluate button for a single vocabulary word.
 * Handles the full flow: record → upload → display score.
 */
export function PracticeButton({ clip }: { clip: AudioClip }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading" | "done" | "error">("idle");
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        setState("uploading");

        try {
          const formData = new FormData();
          formData.append("audio", blob, `recording.${recorder.mimeType.includes("webm") ? "webm" : "mp3"}`);
          formData.append("expectedWord", clip.word);
          formData.append("language", clip.language);

          const res = await fetch("/api/pronunciation/evaluate", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
          }

          const data: EvaluationResult = await res.json();
          setResult(data);
          setState("done");
        } catch {
          setState("error");
        }
      };

      recorder.onerror = () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("error");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState("recording");

      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, 5000);
    } catch {
      setState("error");
    }
  }, [clip.word, clip.language]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
  }, []);

  // Button states
  if (state === "idle") {
    return (
      <button
        onClick={startRecording}
        aria-label={`Practice pronouncing ${clip.word}`}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d4c9bd] text-[var(--color-text-muted)] hover:bg-[#f2ede8] transition-colors"
      >
        <Mic className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <button
        onMouseUp={stopRecording}
        onTouchEnd={stopRecording}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            stopRecording();
          }
        }}
        aria-label="Stop recording"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white animate-pulse"
      >
        <MicOff className="h-3.5 w-3.5" />
      </button>
    );
  }

  if (state === "uploading") {
    return (
      <div className="flex h-7 w-7 items-center justify-center">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-text-muted)]" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <button
        onClick={reset}
        aria-label="Retry pronunciation practice"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 text-red-400 hover:bg-red-50 transition-colors"
      >
        <AlertCircle className="h-3.5 w-3.5" />
      </button>
    );
  }

  // Done state — show score badge
  const passed = (result?.score ?? 0) >= 7;
  return (
    <div className="relative">
      <button
        onClick={reset}
        aria-label={`Score: ${result?.score}/10. ${result?.feedback}. Click to try again.`}
        className={`flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-semibold transition-colors ${
          passed
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
        }`}
      >
        {passed ? (
          <CheckCircle2 className="h-3 w-3" />
        ) : (
          <AlertCircle className="h-3 w-3" />
        )}
        {result?.score}/10
      </button>
      {/* Tooltip with feedback */}
      {result && (
        <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-[#efe9e2] bg-white p-2 shadow-lg">
          <p className="text-[11px] leading-tight text-[var(--color-text-muted)]">
            {result.feedback}
          </p>
        </div>
      )}
    </div>
  );
}
