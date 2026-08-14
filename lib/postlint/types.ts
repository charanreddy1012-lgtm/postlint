export type LintCategory =
  | "media"
  | "visual"
  | "platform"
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
  platformZoneId?: string;
  contentBox?: NormalizedRect;
  overlapRatio?: number;
};

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
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

export type VideoFrame = {
  path: string;
  timestampSeconds: number;
};

export type VisualConfidence = "high" | "medium" | "low";

export type DetectedVisualElementKind =
  | "cta"
  | "promo_code"
  | "discount"
  | "headline"
  | "caption"
  | "brand_text"
  | "other_important_text";

export type DetectedVisualElement = {
  frameTimestampSeconds: number;
  kind: DetectedVisualElementKind;
  text?: string;
  /** Gemini box_2d order: [ymin, xmin, ymax, xmax], normalized 0–1000. */
  box2d: [number, number, number, number];
  confidence: VisualConfidence;
};

export type VisualRequirementEvaluation = {
  requirementId: string;
  status: "verified" | "not_verified" | "uncertain";
  evidence?: string;
  startSeconds?: number;
  endSeconds?: number;
  confidence: VisualConfidence;
};

export type VisualCheckResult = {
  id: string;
  requirementId: string;
  status: "pass" | "needs_review" | "not_verified";
  title: string;
  message: string;
  evidence?: string;
  timestampStart?: number;
  timestampEnd?: number;
  confidence?: VisualConfidence;
  suggestion?: string;
};

export type VisualAnalysis = {
  sampledFrameCount: number;
  supportedRequirementCount: number;
  checks: VisualCheckResult[];
  detectedElementCount?: number;
};

export type BatchedVisualAnalysis = {
  evaluations: VisualRequirementEvaluation[];
  detectedElements: DetectedVisualElement[];
};

export type AnalysisStatus = {
  transcription: "complete" | "unavailable" | "no_audio";
  campaign: "complete" | "unavailable" | "not_requested";
  visual:
    | "complete"
    | "unavailable"
    | "not_requested"
    | "no_supported_requirements";
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
  visualAnalysis: VisualAnalysis | null;
  lintResults: LintResult[];
  unevaluatedRequirements: UnevaluatedRequirement[];
  analysisStatus: AnalysisStatus;
  summary: LintSummary;
};

export type ApiError = {
  error: string;
};
