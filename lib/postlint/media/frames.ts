import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { mediaBinaryPath } from "@/lib/postlint/media/binaries";
import type { VideoFrame } from "@/lib/postlint/types";

const execFileAsync = promisify(execFile);

export const MAX_SAMPLE_FRAMES = 16;
const TARGET_INTERVAL_SECONDS = 3;

export class FrameExtractionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FrameExtractionError";
  }
}

export function sampleFrameTimestamps(
  durationSeconds: number,
  maxFrames = MAX_SAMPLE_FRAMES,
): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || maxFrames < 1) {
    return [];
  }

  if (durationSeconds <= TARGET_INTERVAL_SECONDS) {
    return [Number((durationSeconds / 2).toFixed(3))];
  }

  const count = Math.min(
    Math.floor(maxFrames),
    Math.max(2, Math.ceil(durationSeconds / TARGET_INTERVAL_SECONDS) + 1),
  );
  const edgeInset = Math.min(0.25, durationSeconds / (count * 2));
  const first = edgeInset;
  const last = Math.max(first, durationSeconds - edgeInset);
  const interval = count === 1 ? 0 : (last - first) / (count - 1);

  return Array.from({ length: count }, (_, index) =>
    Number((first + index * interval).toFixed(3)),
  );
}

export async function extractVideoFrames(
  videoPath: string,
  framesDirectory: string,
  durationSeconds: number,
): Promise<VideoFrame[]> {
  const timestamps = sampleFrameTimestamps(durationSeconds);
  await mkdir(framesDirectory, { recursive: true });
  const frames: VideoFrame[] = [];

  try {
    for (const [index, timestampSeconds] of timestamps.entries()) {
      const framePath = join(
        framesDirectory,
        `frame-${String(index + 1).padStart(2, "0")}.jpg`,
      );
      await execFileAsync(
        mediaBinaryPath("ffmpeg"),
        [
          "-v",
          "error",
          "-ss",
          timestampSeconds.toFixed(3),
          "-i",
          videoPath,
          "-frames:v",
          "1",
          "-vf",
          "scale='min(720,iw)':-2",
          "-q:v",
          "3",
          "-y",
          framePath,
        ],
        { maxBuffer: 5 * 1024 * 1024, timeout: 20_000 },
      );
      frames.push({ path: framePath, timestampSeconds });
    }
    return frames;
  } catch (error) {
    throw new FrameExtractionError("Visual frame extraction is unavailable.", {
      cause: error,
    });
  }
}
