import type {
  CampaignRequirement,
  UnevaluatedRequirement,
  VisualCheckResult,
  VisualRequirementEvaluation,
} from "@/lib/postlint/types";

const TIMESTAMP_TOLERANCE_SECONDS = 0.02;

function allowedTimestamp(value: number | undefined, timestamps: number[]): boolean {
  if (value === undefined) return true;
  return timestamps.some(
    (timestamp) => Math.abs(timestamp - value) <= TIMESTAMP_TOLERANCE_SECONDS,
  );
}

function reviewResult(
  requirement: CampaignRequirement,
  evaluation?: VisualRequirementEvaluation,
): VisualCheckResult {
  return {
    id: `visual-${requirement.id}`,
    requirementId: requirement.id,
    status: evaluation?.status === "not_verified" ? "not_verified" : "needs_review",
    title: requirement.description,
    message:
      evaluation?.status === "not_verified"
        ? "No clear evidence of this requirement was found in the sampled frames."
        : "Possible visual evidence was found, but it is not clear enough for PostLint to verify automatically.",
    evidence: evaluation?.evidence,
    timestampStart: evaluation?.startSeconds,
    timestampEnd: evaluation?.endSeconds,
    confidence: evaluation?.confidence,
    suggestion: "Add a clear, prominent product or brand shot before publishing.",
  };
}

export function mapVisualEvaluations(
  requirements: CampaignRequirement[],
  evaluations: VisualRequirementEvaluation[],
  sampledTimestamps: number[],
): VisualCheckResult[] {
  const requirementsById = new Map(
    requirements.map((requirement) => [requirement.id, requirement]),
  );
  const validEvaluations = new Map<string, VisualRequirementEvaluation>();

  for (const evaluation of evaluations) {
    if (!requirementsById.has(evaluation.requirementId)) continue;
    if (!allowedTimestamp(evaluation.startSeconds, sampledTimestamps)) continue;
    if (!allowedTimestamp(evaluation.endSeconds, sampledTimestamps)) continue;
    if (
      evaluation.startSeconds !== undefined &&
      evaluation.endSeconds !== undefined &&
      evaluation.endSeconds < evaluation.startSeconds
    ) {
      continue;
    }
    validEvaluations.set(evaluation.requirementId, evaluation);
  }

  return requirements.map((requirement) => {
    const evaluation = validEvaluations.get(requirement.id);
    if (!evaluation) return reviewResult(requirement);

    if (
      evaluation.status === "verified" &&
      evaluation.confidence === "high" &&
      evaluation.evidence?.trim() &&
      evaluation.startSeconds !== undefined
    ) {
      return {
        id: `visual-${requirement.id}`,
        requirementId: requirement.id,
        status: "pass",
        title: requirement.description,
        message: "Clear visual evidence corresponding to this requirement was found in the sampled frames.",
        evidence: evaluation.evidence,
        timestampStart: evaluation.startSeconds,
        timestampEnd: evaluation.endSeconds,
        confidence: evaluation.confidence,
      };
    }

    return reviewResult(requirement, evaluation);
  });
}

export function unsupportedVisualRequirement(
  requirement: CampaignRequirement,
): UnevaluatedRequirement {
  return {
    requirementId: requirement.id,
    type: requirement.type,
    description: requirement.description,
    reason:
      "This visual requirement is subjective or outside PostLint’s conservative Phase 3 recognition scope.",
  };
}
