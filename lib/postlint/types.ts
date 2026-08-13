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
  expected?: string;
  detected?: string;
};

export type TranscriptSegment = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type Transcript = {
  text: string;
  segments: TranscriptSegment[];
};

export type CampaignRequirementType =
  | "sponsorship_disclosure"
  | "required_mention"
  | "required_phrase"
  | "promo_code"
  | "discount"
  | "call_to_action"
  | "prohibited_phrase"
  | "visual_requirement"
  | "other";

export type CampaignRequirement = {
  id: string;
  type: CampaignRequirementType;
  description: string;
  expectedText?: string;
  expectedValue?: number;
  expectedUnit?: string;
  aliases?: string[];
};

export type UnevaluatedRequirement = {
  requirementId: string;
  type: CampaignRequirementType;
  description: string;
  reason: string;
};

export type CampaignAnalysis = {
  rawBrief: string;
  requirements: CampaignRequirement[];
  evaluatedCount: number;
  unevaluatedCount: number;
};

export type AnalysisStatus = {
  transcription: "complete" | "unavailable" | "no_audio";
  campaign: "complete" | "unavailable" | "not_requested";
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
  transcript: Transcript | null;
  campaign: CampaignAnalysis | null;
  lintResults: LintResult[];
  unevaluatedRequirements: UnevaluatedRequirement[];
  analysisStatus: AnalysisStatus;
  summary: LintSummary;
};

export type ApiError = {
  error: string;
};
