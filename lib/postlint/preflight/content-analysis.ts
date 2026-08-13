import { runCampaignLints } from "@/lib/postlint/campaign/campaign-lints";
import { partitionVisualRequirements } from "@/lib/postlint/visual/visual-requirements";
import {
  mapVisualEvaluations,
  unsupportedVisualRequirement,
} from "@/lib/postlint/visual/visual-lints";
import type {
  AnalysisStatus,
  CampaignAnalysis,
  CampaignRequirement,
  LintResult,
  Transcript,
  UnevaluatedRequirement,
  VideoFrame,
  VisualAnalysis,
  VisualRequirementEvaluation,
} from "@/lib/postlint/types";

export type ContentAnalysisDependencies = {
  extractAudio: (videoPath: string, audioPath: string) => Promise<void>;
  transcribe: (audioPath: string) => Promise<Transcript>;
  parseBrief: (rawBrief: string) => Promise<CampaignRequirement[]>;
  extractFrames: (
    videoPath: string,
    framesDirectory: string,
    durationSeconds: number,
  ) => Promise<VideoFrame[]>;
  analyzeVisual: (
    requirements: CampaignRequirement[],
    frames: VideoFrame[],
  ) => Promise<VisualRequirementEvaluation[]>;
};

type ContentAnalysisInput = {
  videoPath: string;
  audioPath: string;
  audioPresent: boolean;
  caption: string;
  rawBrief: string;
  framesDirectory: string;
  durationSeconds: number;
};

export type ContentAnalysisOutput = {
  transcript: Transcript | null;
  campaign: CampaignAnalysis | null;
  visualAnalysis: VisualAnalysis | null;
  campaignLintResults: LintResult[];
  visualLintResults: LintResult[];
  unevaluatedRequirements: UnevaluatedRequirement[];
  analysisStatus: AnalysisStatus;
};

export async function analyzeContent(
  input: ContentAnalysisInput,
  dependencies: ContentAnalysisDependencies,
): Promise<ContentAnalysisOutput> {
  const transcriptionTask = input.audioPresent
    ? (async () => {
        await dependencies.extractAudio(input.videoPath, input.audioPath);
        return dependencies.transcribe(input.audioPath);
      })()
    : null;

  const campaignTask = input.rawBrief
    ? dependencies.parseBrief(input.rawBrief)
    : null;

  const [transcriptionResult, campaignResult] = await Promise.all([
    transcriptionTask
      ? transcriptionTask.then(
          (value) => ({ status: "fulfilled" as const, value }),
          () => ({ status: "rejected" as const }),
        )
      : Promise.resolve({ status: "no_audio" as const }),
    campaignTask
      ? campaignTask.then(
          (value) => ({ status: "fulfilled" as const, value }),
          () => ({ status: "rejected" as const }),
        )
      : Promise.resolve({ status: "not_requested" as const }),
  ]);

  const transcript =
    transcriptionResult.status === "fulfilled" ? transcriptionResult.value : null;
  const transcriptionStatus: AnalysisStatus["transcription"] =
    transcriptionResult.status === "fulfilled"
      ? "complete"
      : transcriptionResult.status === "no_audio"
        ? "no_audio"
        : "unavailable";

  if (campaignResult.status !== "fulfilled") {
    return {
      transcript,
      campaign: null,
      visualAnalysis: null,
      campaignLintResults: [],
      visualLintResults: [],
      unevaluatedRequirements: [],
      analysisStatus: {
        transcription: transcriptionStatus,
        campaign:
          campaignResult.status === "not_requested" ? "not_requested" : "unavailable",
        visual:
          campaignResult.status === "not_requested" ? "not_requested" : "unavailable",
      },
    };
  }

  const visualRequirements = partitionVisualRequirements(campaignResult.value);
  const campaignChecks = runCampaignLints(
    campaignResult.value.filter(
      (requirement) => requirement.type !== "visual_requirement",
    ),
    transcript,
    input.caption,
    { transcriptUnavailable: transcriptionStatus === "unavailable" },
  );

  const unsupportedVisual = visualRequirements.unsupported.map(
    unsupportedVisualRequirement,
  );
  let visualAnalysis: VisualAnalysis | null = null;
  let visualLintResults: LintResult[] = [];
  let visualUnavailable: UnevaluatedRequirement[] = [];
  let visualStatus: AnalysisStatus["visual"] = "no_supported_requirements";

  if (visualRequirements.supported.length > 0) {
    try {
      const frames = await dependencies.extractFrames(
        input.videoPath,
        input.framesDirectory,
        input.durationSeconds,
      );
      const evaluations = await dependencies.analyzeVisual(
        visualRequirements.supported,
        frames,
      );
      const checks = mapVisualEvaluations(
        visualRequirements.supported,
        evaluations,
        frames.map((frame) => frame.timestampSeconds),
      );
      visualAnalysis = {
        sampledFrameCount: frames.length,
        supportedRequirementCount: visualRequirements.supported.length,
        checks,
      };
      visualLintResults = checks
        .filter((check) => check.status === "pass")
        .map((check) => ({
          id: check.id,
          category: "visual" as const,
          severity: "pass" as const,
          title: check.title,
          message: check.message,
          evidence: check.evidence,
          timestampStart: check.timestampStart,
          timestampEnd: check.timestampEnd,
        }));
      visualStatus = "complete";
    } catch {
      visualStatus = "unavailable";
      visualUnavailable = visualRequirements.supported.map((requirement) => ({
        requirementId: requirement.id,
        type: requirement.type,
        description: requirement.description,
        reason:
          "Visual analysis was unavailable. PostLint did not infer or fabricate a result.",
      }));
    }
  }

  const unevaluatedRequirements = [
    ...campaignChecks.unevaluatedRequirements,
    ...unsupportedVisual,
    ...visualUnavailable,
  ];
  const visualNonPassCount =
    visualAnalysis?.checks.filter((check) => check.status !== "pass").length ?? 0;

  return {
    transcript,
    campaign: {
      rawBrief: input.rawBrief,
      requirements: campaignResult.value,
      evaluatedCount: campaignChecks.lintResults.length + visualLintResults.length,
      unevaluatedCount: unevaluatedRequirements.length + visualNonPassCount,
    },
    visualAnalysis,
    campaignLintResults: campaignChecks.lintResults,
    visualLintResults,
    unevaluatedRequirements,
    analysisStatus: {
      transcription: transcriptionStatus,
      campaign: "complete",
      visual: visualStatus,
    },
  };
}
