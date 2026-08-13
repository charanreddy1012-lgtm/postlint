import ffprobeStaticPath from "@derhuerst/ffprobe-static";
import ffmpegStaticPath from "ffmpeg-static";

export type MediaBinary = "ffmpeg" | "ffprobe";
export type BinarySource = "configured" | "packaged" | "system";

export type ResolvedBinary = {
  path: string;
  source: BinarySource;
};

type BinaryEnvironment = Record<string, string | undefined>;
type PackagedBinaryPaths = Partial<Record<MediaBinary, string | null>>;

const ENVIRONMENT_KEYS: Record<MediaBinary, string> = {
  ffmpeg: "FFMPEG_PATH",
  ffprobe: "FFPROBE_PATH",
};

const DEFAULT_PACKAGED_PATHS: PackagedBinaryPaths = {
  ffmpeg: ffmpegStaticPath,
  ffprobe: ffprobeStaticPath,
};

export function resolveMediaBinary(
  binary: MediaBinary,
  options: {
    environment?: BinaryEnvironment;
    packagedPaths?: PackagedBinaryPaths;
  } = {},
): ResolvedBinary {
  const environment = options.environment ?? process.env;
  const configuredPath = environment[ENVIRONMENT_KEYS[binary]]?.trim();
  if (configuredPath) return { path: configuredPath, source: "configured" };

  const packagedPath = (options.packagedPaths ?? DEFAULT_PACKAGED_PATHS)[
    binary
  ]?.trim();
  if (packagedPath) return { path: packagedPath, source: "packaged" };

  return { path: binary, source: "system" };
}

export function mediaBinaryPath(binary: MediaBinary): string {
  return resolveMediaBinary(binary).path;
}

