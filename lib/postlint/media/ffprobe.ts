import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { MediaMetadata } from "@/lib/postlint/types";

const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

export class MediaProbeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MediaProbeError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseFrameRate(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const [numerator, denominator = "1"] = value.split("/");
  const top = Number(numerator);
  const bottom = Number(denominator);
  if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
    return undefined;
  }
  const fps = top / bottom;
  return fps > 0 ? fps : undefined;
}

function readRotation(stream: JsonRecord): number {
  const tags = isRecord(stream.tags) ? stream.tags : undefined;
  const tagRotation = numberFrom(tags?.rotate);
  if (tagRotation !== undefined) return tagRotation;

  if (Array.isArray(stream.side_data_list)) {
    for (const entry of stream.side_data_list) {
      if (isRecord(entry)) {
        const rotation = numberFrom(entry.rotation);
        if (rotation !== undefined) return rotation;
      }
    }
  }
  return 0;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(Math.round(a));
  let right = Math.abs(Math.round(b));
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return left || 1;
}

function aspectRatioLabel(width: number, height: number): string {
  const divisor = greatestCommonDivisor(width, height);
  const exactWidth = width / divisor;
  const exactHeight = height / divisor;
  if (exactWidth <= 32 && exactHeight <= 32) {
    return `${exactWidth}:${exactHeight}`;
  }

  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) <= 0.025) return "9:16";
  if (Math.abs(ratio - 3 / 4) <= 0.025) return "3:4";
  if (Math.abs(ratio - 1) <= 0.025) return "1:1";
  if (Math.abs(ratio - 16 / 9) <= 0.025) return "16:9";
  return `${ratio.toFixed(2)}:1`;
}

export async function probeMedia(filePath: string): Promise<MediaMetadata> {
  let stdout: string;

  try {
    const result = await execFileAsync(
      "ffprobe",
      [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        filePath,
      ],
      { maxBuffer: 10 * 1024 * 1024, timeout: 30_000 },
    );
    stdout = result.stdout;
  } catch (error) {
    throw new MediaProbeError(
      "We could not read this video. Confirm it is a valid MP4 or MOV file and try again.",
      { cause: error },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new MediaProbeError("ffprobe returned malformed media metadata.", {
      cause: error,
    });
  }

  if (!isRecord(payload) || !Array.isArray(payload.streams)) {
    throw new MediaProbeError("No usable media streams were found in this file.");
  }

  const streams = payload.streams.filter(isRecord);
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");

  if (!videoStream) {
    throw new MediaProbeError("This file does not contain a usable video stream.");
  }

  const codedWidth = numberFrom(videoStream.width);
  const codedHeight = numberFrom(videoStream.height);
  const videoCodec =
    typeof videoStream.codec_name === "string" ? videoStream.codec_name : undefined;

  if (!codedWidth || !codedHeight || !videoCodec) {
    throw new MediaProbeError("The video stream is missing required format metadata.");
  }

  const rotation = Math.abs(readRotation(videoStream)) % 180;
  const isQuarterTurn = Math.abs(rotation - 90) < 1;
  const width = isQuarterTurn ? codedHeight : codedWidth;
  const height = isQuarterTurn ? codedWidth : codedHeight;
  const format = isRecord(payload.format) ? payload.format : undefined;
  const durationSeconds =
    numberFrom(format?.duration) ?? numberFrom(videoStream.duration);

  if (!durationSeconds || durationSeconds <= 0) {
    throw new MediaProbeError("The video duration could not be determined.");
  }

  const fps =
    parseFrameRate(videoStream.avg_frame_rate) ??
    parseFrameRate(videoStream.r_frame_rate);

  return {
    width,
    height,
    durationSeconds,
    fps,
    videoCodec,
    audioPresent: Boolean(audioStream),
    audioCodec:
      audioStream && typeof audioStream.codec_name === "string"
        ? audioStream.codec_name
        : undefined,
    aspectRatio: width / height,
    aspectRatioLabel: aspectRatioLabel(width, height),
    fileSizeBytes: numberFrom(format?.size),
  };
}
