import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execFileAsync = promisify(execFile);

/**
 * Map BCP-47 language tags to Microsoft Edge TTS voice names.
 * Falls back to a reasonable default for common languages.
 */
function languageToEdgeVoice(language: string): string {
  const lang = language.split("-")[0].toLowerCase();
  const region = language.split("-")[1]?.toUpperCase() || lang.toUpperCase();

  // Microsoft Edge voice name format: {lang}-{region}-{Name}Neural
  // Build a table for common languages
  const voiceMap: Record<string, string> = {
    "it": `it-IT-ElsaNeural`,
    "it-it": `it-IT-ElsaNeural`,
    "fr": `fr-FR-DeniseNeural`,
    "fr-fr": `fr-FR-DeniseNeural`,
    "es": `es-ES-AlvaroNeural`,
    "es-es": `es-ES-AlvaroNeural`,
    "de": `de-DE-KatjaNeural`,
    "de-de": `de-DE-KatjaNeural`,
    "pt": `pt-BR-FranciscaNeural`,
    "pt-br": `pt-BR-FranciscaNeural`,
    "ja": `ja-JP-NanamiNeural`,
    "ja-jp": `ja-JP-NanamiNeural`,
    "ko": `ko-KR-SunHiNeural`,
    "ko-kr": `ko-KR-SunHiNeural`,
    "zh": `zh-CN-XiaoxiaoNeural`,
    "zh-cn": `zh-CN-XiaoxiaoNeural`,
    "ru": `ru-RU-SvetlanaNeural`,
    "ru-ru": `ru-RU-SvetlanaNeural`,
    "en": `en-US-AriaNeural`,
    "en-us": `en-US-AriaNeural`,
    "en-gb": `en-GB-SoniaNeural`,
    "nl": `nl-NL-FennaNeural`,
    "nl-nl": `nl-NL-FennaNeural`,
    "ar": `ar-SA-ZariyahNeural`,
    "ar-sa": `ar-SA-ZariyahNeural`,
    "hi": `hi-IN-SwaraNeural`,
    "hi-in": `hi-IN-SwaraNeural`,
    "sv": `sv-SE-SofieNeural`,
    "sv-se": `sv-SE-SofieNeural`,
  };

  return voiceMap[language.toLowerCase()] || voiceMap[lang] || `en-US-AriaNeural`;
}

export type TtsResult = {
  audioDataUrl: string;
  durationMs: number;
};

/**
 * Generate TTS audio using the edge-tts CLI.
 *
 * Swappable: replace the body of this function with any TTS provider
 * (OpenAI TTS, ElevenLabs, local model, etc.) without changing callers.
 *
 * Returns null on failure (TTS unavailable, network error, etc.)
 * so callers can gracefully degrade.
 */
export async function generateTtsAudio(
  text: string,
  language: string,
): Promise<TtsResult | null> {
  const tmpDir = await mkdtemp(join(tmpdir(), "bitebase-tts-"));
  const mediaPath = join(tmpDir, "audio.mp3");

  try {
    const voice = languageToEdgeVoice(language);

    await execFileAsync("edge-tts", [
      "--voice", voice,
      "--text", text,
      "--write-media", mediaPath,
    ], { timeout: 15_000 });

    // Read generated audio file
    const buffer = await readFile(mediaPath);

    // Get duration via ffprobe
    let durationMs = Math.max(500, Math.round(text.length * 80)); // fallback: ~80ms/char
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "quiet",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        mediaPath,
      ], { timeout: 5_000 });
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) {
        durationMs = Math.round(parsed * 1000);
      }
    } catch {
      // Use fallback duration
    }

    const base64 = buffer.toString("base64");
    const mimeType = "audio/mpeg";

    return {
      audioDataUrl: `data:${mimeType};base64,${base64}`,
      durationMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[tts] edge-tts failed for "${text}" (${language}): ${msg}`);
    return null;
  } finally {
    // Cleanup temp files
    try { await unlink(mediaPath); } catch { /* ignore */ }
    try { await unlink(tmpDir); } catch { /* ignore */ }
  }
}
