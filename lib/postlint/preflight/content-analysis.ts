import { runCampaignLints } from "@/lib/postlint/campaign/campaign-lints";
import type {
  AnalysisStatus,
  CampaignAnalysis,
  CampaignRequirement,
  LintResult,
  Transcript,
  UnevaluatedRequirement,
} from "@/lib/postlint/types";

export type ContentAnalysisDependencies = {
  extractAudio: (videoPath: string, audioPath: string) => Promise<void>;
  transcribe: (audioPath: string) => Promise<Transcript>;
  parseBrief: (rawBrief: string) => Promise<CampaignRequirement[]>;
};

type ContentAnalysisInput = {
  videoPath: string;
  audioPath: string;
  audioPresent: boolean;
  caption: string;
  rawBrief: string;
};

export type ContentAnalysisOutput = {
  transcript: Transcript | null;
  campaign: CampaignAnalysis | null;
  campaignLintResults: LintResult[];
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
      campaignLintResults: [],
      unevaluatedRequirements: [],
      analysisStatus: {
        transcription: transcriptionStatus,
        campaign:
          campaignResult.status === "not_requested" ? "not_requested" : "unavailable",
      },
    };
  }

  const campaignChecks = runCampaignLints(
    campaignResult.value,
    transcript,
    input.caption,
    { transcriptUnavailable: transcriptionStatus === "unavailable" },
  );

  return {
    transcript,
    campaign: {
      rawBrief: input.rawBrief,
      requirements: campaignResult.value,
      evaluatedCount: campaignChecks.lintResults.length,
      unevaluatedCount: campaignChecks.unevaluatedRequirements.length,
    },
    campaignLintResults: campaignChecks.lintResults,
    unevaluatedRequirements: campaignChecks.unevaluatedRequirements,
    analysisStatus: {
      transcription: transcriptionStatus,
      campaign: "complete",
    },
  };
}
