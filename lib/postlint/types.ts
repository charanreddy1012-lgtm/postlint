export type LintCategory =
  | "media"
  | "visual"
  | "claim"
  | "campaign"
  | "accessibility";

export type LintSeverity = "pass" | "warning" | "fail";

export type LintResult = {
  id: string;
  category: LintCategory;
  severity: LintSeverity;
  title: string;
  message: string;
  timestampStart?: number;
  timestampEnd?: number;
  evidence?: string;
  suggestion?: string;
};

export type TargetPlatform = "tiktok" | "instagram" | "youtube";

export type MediaMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
  fps?: number;
  videoCodec: string;
  audioPresent: boolean;
  audioCodec?: string;
  aspectRatio: number;
  aspectRatioLabel: string;
  fileSizeBytes?: number;
};

export type LintSummary = {
  passes: number;
  warnings: number;
  failures: number;
};

export type PreflightReport = {
  filename: string;
  target: TargetPlatform;
  metadata: MediaMetadata;
  lintResults: LintResult[];
  summary: LintSummary;
};

export type ApiError = {
  error: string;
};
