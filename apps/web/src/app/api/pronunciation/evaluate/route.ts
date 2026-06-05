import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

/**
 * Find the mlx_whisper binary by checking common locations.
 * pipx installs to ~/.local/bin which may not be in Node's PATH.
 */
async function findWhisperBinary(): Promise<string> {
  const candidates = [
    "mlx_whisper",                              // in PATH
    join(homedir(), ".local", "bin", "mlx_whisper"),  // pipx default
    "/usr/local/bin/mlx_whisper",
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // not found at this path
    }
  }
  // Fall back to bare name — will fail with ENOENT but give a clear error
  return "mlx_whisper";
}

// Lazily resolved whisper binary path
let whisperBinary: string | null = null;
async function getWhisperBinary(): Promise<string> {
  if (!whisperBinary) whisperBinary = await findWhisperBinary();
  return whisperBinary;
}

/**
 * Convert audio to WAV using ffmpeg (mlx-whisper only supports common audio formats).
 * Returns the path to the converted WAV file.
 */
async function convertToWav(inputPath: string): Promise<string> {
  const wavPath = inputPath.replace(/\.[^.]+$/, ".wav");
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-ar", "16000",
    "-ac", "1",
    "-sample_fmt", "s16",
    wavPath,
  ], { timeout: 15_000 });
  return wavPath;
}

/**
 * Transcribe an audio file using mlx-whisper (MLX Whisper on Apple Silicon).
 * Returns the raw transcription text.
 */
async function transcribeWithWhisper(
  audioPath: string,
  language: string,
): Promise<string> {
  const langCode = language.split("-")[0].toLowerCase(); // "it-IT" → "it"

  try {
    // mlx-whisper works best with WAV — convert webm/mp3 first
    const wavPath = await convertToWav(audioPath);

    const whisperPath = await getWhisperBinary();
    await execFileAsync(
      whisperPath,
      [
        wavPath,
        "--model", "mlx-community/whisper-small-mlx",
        "--language", langCode,
        "--output-format", "txt",
      ],
      { timeout: 30_000 },
    );

    // mlx_whisper writes a .txt file alongside the audio file
    const txtPath = wavPath.replace(/\.[^.]+$/, ".txt");
    const text = await readFile(txtPath, "utf-8");
    const cleaned = text.replace(/^\[\d+:\d+\.\d+ --> \d+:\d+\.\d+\]\s*/gm, "").trim();

    // Cleanup temp files
    await unlink(txtPath).catch(() => {});
    await unlink(wavPath).catch(() => {});

    return cleaned || "";
  } catch (err) {
    console.warn("[whisper] transcription failed, falling back to empty string:", err instanceof Error ? err.message : String(err));
    return "";
  }
}

/**
 * Score a pronunciation attempt using the Llama model via OMLX.
 * Sends both expected and transcribed text for comparison.
 */
async function scoreWithLlama(
  expected: string,
  transcribed: string,
): Promise<{ score: number; feedback: string }> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:8000/v1";
  const modelName = process.env.OLLAMA_MODEL || "llama3.2";
  const apiKey = process.env.OLLAMA_API_KEY || "";

  // Normalize both strings for comparison (case-insensitive, trim whitespace)
  const normalizedExpected = expected.toLowerCase().trim();
  const normalizedTranscribed = transcribed.toLowerCase().trim();

  const prompt = `You are a language pronunciation coach. Rate this pronunciation attempt on a scale of 0-10.

Expected phrase (correct pronunciation): "${expected}"
User's attempt (transcribed by ASR): "${transcribed}"

IMPORTANT: ASR (automatic speech recognition) is imperfect. Be lenient with minor differences:
- Case differences (e.g., "Buon Giorno" vs "buongiorno") should NOT penalize heavily
- Extra spaces or minor phonetic variations are acceptable
- If the transcription is close enough to be understandable, give a score of 7 or above

Respond with ONLY a JSON object. No extra text, no markdown, no explanation outside the JSON:
{
  "score": <integer 0-10>,
  "feedback": "<one brief sentence explaining what went wrong or a tip for improvement>"
}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${ollamaUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!res.ok) {
    throw new Error(`LLM scoring request failed: ${res.status}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || "";

  // Extract JSON from the response
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in LLM response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.max(0, Math.min(10, Math.round(parsed.score ?? 5))),
      feedback: parsed.feedback || "Keep practicing!",
    };
  } catch {
    // Fallback for parsing failure
    return { score: 5, feedback: "Could not evaluate pronunciation this time." };
  }
}

/**
 * POST /api/pronunciation/evaluate
 *
 * Accepts multipart/form-data:
 *   - audio: audio file (WAV, WebM, MP3)
 *   - expectedWord: the word/phrase the user was supposed to say
 *   - language: BCP-47 language tag (e.g. "it-IT")
 *
 * Returns JSON:
 *   { score: number, feedback: string, userTranscription: string }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const expectedWord = formData.get("expectedWord") as string | null;
    const language = formData.get("language") as string | null;

    if (!audioFile || !expectedWord || !language) {
      return NextResponse.json(
        { error: "Missing required fields: audio, expectedWord, language" },
        { status: 400 },
      );
    }

    // Write audio to temp file for Whisper
    const tmpDir = await mkdtemp(join(tmpdir(), "bitebase-pronunciation-"));
    const audioBytes = Buffer.from(await audioFile.arrayBuffer());
    const ext = audioFile.name?.split(".").pop() || "webm";
    const audioPath = join(tmpDir, `recording.${ext}`);
    await writeFile(audioPath, audioBytes);

    // Transcribe with MLX Whisper
    const userTranscription = await transcribeWithWhisper(audioPath, language);

    // Score with Llama
    const { score, feedback } = await scoreWithLlama(expectedWord, userTranscription);

    // Cleanup
    try { await unlink(audioPath); } catch { /* ignore */ }
    try { await unlink(tmpDir); } catch { /* ignore */ }

    return NextResponse.json({
      score,
      feedback,
      userTranscription,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[pronunciation/evaluate] error:", msg);
    return NextResponse.json(
      { error: "Pronunciation evaluation failed", detail: msg },
      { status: 500 },
    );
  }
}
