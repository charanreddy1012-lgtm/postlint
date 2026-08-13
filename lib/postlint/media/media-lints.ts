import type {
  LintResult,
  LintSummary,
  MediaMetadata,
  TargetPlatform,
} from "@/lib/postlint/types";

export const POSTLINT_MAX_DURATION_SECONDS = 90;

const TARGET_NAMES: Record<TargetPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube Shorts",
};

function lintVerticalFormat(metadata: MediaMetadata): LintResult {
  const deltaFromNineSixteen = Math.abs(metadata.aspectRatio - 9 / 16);

  if (deltaFromNineSixteen <= 0.04) {
    return {
      id: "media.vertical-format",
      category: "media",
      severity: "pass",
      title: "Vertical format",
      message: `${metadata.width} × ${metadata.height} is approximately 9:16 vertical.`,
      evidence: `Detected aspect ratio: ${metadata.aspectRatioLabel}`,
    };
  }

  if (metadata.width < metadata.height) {
    return {
      id: "media.vertical-format",
      category: "media",
      severity: "warning",
      title: "Non-standard vertical ratio",
      message: `${metadata.aspectRatioLabel} is vertical, but it falls outside PostLint’s 9:16 target range.`,
      evidence: `${metadata.width} × ${metadata.height}`,
      suggestion: "Reframe or export the video on a 9:16 canvas before publishing.",
    };
  }

  return {
    id: "media.vertical-format",
    category: "media",
    severity: "fail",
    title: "Not a vertical video",
    message: `${metadata.aspectRatioLabel} falls outside PostLint’s vertical format target.`,
    evidence: `${metadata.width} × ${metadata.height}`,
    suggestion: "Reframe the edit to a 9:16 vertical canvas.",
  };
}

function lintResolution(metadata: MediaMetadata): LintResult {
  if (metadata.width >= 1080 && metadata.height >= 1920) {
    return {
      id: "media.resolution",
      category: "media",
      severity: "pass",
      title: "Strong resolution",
      message: `${metadata.width} × ${metadata.height} meets PostLint’s high-quality vertical target.`,
      evidence: `${metadata.width} × ${metadata.height}`,
    };
  }

  if (metadata.width >= 720 && metadata.height >= 1280) {
    return {
      id: "media.resolution",
      category: "media",
      severity: "pass",
      title: "Usable resolution",
      message: `${metadata.width} × ${metadata.height} meets PostLint’s baseline vertical resolution target.`,
      evidence: `${metadata.width} × ${metadata.height}`,
    };
  }

  return {
    id: "media.resolution",
    category: "media",
    severity: "warning",
    title: "Low resolution",
    message: `${metadata.width} × ${metadata.height} is below PostLint’s 720 × 1280 baseline target.`,
    evidence: `${metadata.width} × ${metadata.height}`,
    suggestion: "Export from the highest-quality source available, ideally at 1080 × 1920.",
  };
}

function lintDuration(
  metadata: MediaMetadata,
  target: TargetPlatform,
): LintResult {
  const duration = metadata.durationSeconds.toFixed(1);
  if (metadata.durationSeconds <= POSTLINT_MAX_DURATION_SECONDS) {
    return {
      id: "media.duration",
      category: "media",
      severity: "pass",
      title: "Duration within target",
      message: `${duration}s is within PostLint’s 90-second MVP limit for ${TARGET_NAMES[target]}.`,
      evidence: `${duration} seconds`,
    };
  }

  return {
    id: "media.duration",
    category: "media",
    severity: "fail",
    title: "Duration exceeds target",
    message: `${duration}s exceeds PostLint’s 90-second MVP limit.`,
    evidence: `${duration} seconds`,
    suggestion: `Trim at least ${(metadata.durationSeconds - POSTLINT_MAX_DURATION_SECONDS).toFixed(1)} seconds from the edit.`,
  };
}

function lintAudio(metadata: MediaMetadata): LintResult {
  if (metadata.audioPresent) {
    return {
      id: "media.audio",
      category: "media",
      severity: "pass",
      title: "Audio stream detected",
      message: `This file contains an ${metadata.audioCodec?.toUpperCase() ?? "audio"} audio stream.`,
      evidence: metadata.audioCodec?.toUpperCase(),
    };
  }

  return {
    id: "media.audio",
    category: "media",
    severity: "warning",
    title: "No audio detected",
    message: "This file does not contain an audio stream.",
    suggestion: "Confirm the silent export is intentional before publishing.",
  };
}

export function runMediaLints(
  metadata: MediaMetadata,
  target: TargetPlatform,
): LintResult[] {
  return [
    lintVerticalFormat(metadata),
    lintResolution(metadata),
    lintDuration(metadata, target),
    lintAudio(metadata),
  ];
}

export function summarizeLints(results: LintResult[]): LintSummary {
  return results.reduce<LintSummary>(
    (summary, result) => {
      if (result.severity === "pass") summary.passes += 1;
      if (result.severity === "warning") summary.warnings += 1;
      if (result.severity === "fail") summary.failures += 1;
      return summary;
    },
    { passes: 0, warnings: 0, failures: 0 },
  );
}
