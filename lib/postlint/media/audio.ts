import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class AudioExtractionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AudioExtractionError";
  }
}

export async function extractSpeechAudio(
  videoPath: string,
  audioPath: string,
): Promise<void> {
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        videoPath,
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "48k",
        "-codec:a",
        "libmp3lame",
        "-y",
        audioPath,
      ],
      { maxBuffer: 5 * 1024 * 1024, timeout: 45_000 },
    );
  } catch (error) {
    throw new AudioExtractionError("Audio extraction is unavailable.", {
      cause: error,
    });
  }
}
