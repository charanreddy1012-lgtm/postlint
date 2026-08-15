import { normalizeText } from "@/lib/postlint/campaign/text-normalization";
import type {
  CampaignRequirement,
  LintCategory,
  LintSeverity,
  PreflightReport,
  VisualCheckResult,
} from "@/lib/postlint/types";

export type RevisionActionType = "safe_auto_fix" | "manual_edit" | "review";
export type RevisionTarget = "caption" | "video" | "audio" | "general";
export type RevisionSource = "lint" | "visual" | "unevaluated";

export type RevisionAction = {
  id: string;
  sourceLintId: string;
  source: RevisionSource;
  sourceCategory?: LintCategory;
  sourceSeverity?: LintSeverity | "review";
  type: RevisionActionType;
  title: string;
  explanation: string;
  timestampStart?: number;
  timestampEnd?: number;
  originalText?: string;
  replacementText?: string;
  detected?: string;
  expected?: string;
  target: RevisionTarget;
  platformZoneId?: string;
};

export type RevisionPackage = {
  safeApplied: RevisionAction[];
  safeAvailable: RevisionAction[];
  manualEdits: RevisionAction[];
  reviewItems: RevisionAction[];
  visualReview: RevisionAction[];
  platformEdits: RevisionAction[];
  copyText: string;
};

const SPOKEN_DELIVERY_PATTERN = /\b(?:say|said|spoken|voice|voiceover|audio|narrat|read aloud)\b/iu;

function requirementFor(
  report: PreflightReport,
  lintId: string,
): CampaignRequirement | undefined {
  return report.campaign?.requirements.find(
    (requirement) => requirement.id === lintId,
  );
}

function timestampLabel(action: RevisionAction): string {
  if (action.timestampStart === undefined) return "";
  const format = (seconds: number) => {
    const rounded = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  };
  const start = format(action.timestampStart);
  return action.timestampEnd === undefined
    ? `${start} `
    : `${start}–${format(action.timestampEnd)} `;
}

function safeReplacement(requirement: CampaignRequirement): string | undefined {
  switch (requirement.type) {
    case "sponsorship_disclosure":
      return "#ad";
    case "promo_code":
      return requirement.expectedText?.trim()
        ? `Use code ${requirement.expectedText.trim()}.`
        : undefined;
    case "required_mention":
    case "required_phrase":
      return requirement.expectedText?.trim();
    case "call_to_action":
      return requirement.expectedText?.trim() || "Check it out.";
    default:
      return undefined;
  }
}

function requiresSpokenDelivery(requirement: CampaignRequirement): boolean {
  return SPOKEN_DELIVERY_PATTERN.test(
    `${requirement.description} ${requirement.expectedText ?? ""}`,
  );
}

function conflictsWithProhibitedText(
  replacementText: string,
  report: PreflightReport,
): boolean {
  const replacement = normalizeText(replacementText);
  return Boolean(
    report.campaign?.requirements.some((requirement) => {
      if (requirement.type !== "prohibited_phrase") return false;
      const prohibited = normalizeText(requirement.expectedText ?? "");
      return Boolean(
        prohibited &&
          (replacement.includes(prohibited) || prohibited.includes(replacement)),
      );
    }),
  );
}

function safeCampaignAction(
  report: PreflightReport,
  lintId: string,
): Pick<RevisionAction, "type" | "target" | "replacementText" | "explanation"> | null {
  const requirement = requirementFor(report, lintId);
  if (!requirement) return null;
  const replacementText = safeReplacement(requirement);
  if (!replacementText) return null;
  if (requiresSpokenDelivery(requirement)) return null;
  if (conflictsWithProhibitedText(replacementText, report)) return null;

  const explanation =
    requirement.type === "sponsorship_disclosure"
      ? "Add the conservative disclosure token #ad to the revision caption."
      : `Append the exact caption-safe text “${replacementText}” without changing the uploaded video.`;

  return {
    type: "safe_auto_fix",
    target: "caption",
    replacementText,
    explanation,
  };
}

function manualExplanation(
  category: LintCategory,
  title: string,
  suggestion: string | undefined,
  hasTimestamp: boolean,
): string {
  if (category === "platform") {
    return suggestion ?? "Move the important on-screen content outside the estimated platform interface zone.";
  }
  if (category === "media") {
    return suggestion ?? "Adjust the export settings, then export the video again.";
  }
  if (/discount mismatch/iu.test(title)) {
    return hasTimestamp
      ? "Re-record or edit the spoken discount. A caption change cannot repair contradictory audio."
      : "Correct the conflicting discount in the source content before publishing.";
  }
  if (/prohibited phrase/iu.test(title)) {
    return hasTimestamp
      ? "Remove or re-record the prohibited spoken phrase at this timestamp."
      : "Remove the prohibited phrase from the source content before publishing.";
  }
  return suggestion ?? "Edit the source content and run PostLint again.";
}

function visualAction(check: VisualCheckResult): RevisionAction {
  const isUncertain =
    check.status === "needs_review" ||
    check.confidence === "medium" ||
    check.confidence === "low";
  return {
    id: `revision-${check.id}`,
    sourceLintId: check.id,
    source: "visual",
    sourceCategory: "visual",
    sourceSeverity: "review",
    type: isUncertain ? "review" : "manual_edit",
    title: check.title,
    explanation: isUncertain
      ? "Review the sampled visual evidence manually; PostLint will not alter content from an uncertain observation."
      : check.suggestion ?? "Add or replace a shot so the visual requirement is clearly visible.",
    timestampStart: check.timestampStart,
    timestampEnd: check.timestampEnd,
    originalText: check.evidence,
    detected: check.evidence,
    expected: check.title,
    target: "video",
  };
}

export function buildRevisionActions(report: PreflightReport): RevisionAction[] {
  const actions: RevisionAction[] = [];

  for (const result of report.lintResults) {
    if (result.severity === "pass") continue;
    const safe =
      result.category === "campaign" && result.severity === "fail"
        ? safeCampaignAction(report, result.id)
        : null;
    const isReview = result.severity === "warning" && result.category === "visual";
    const target: RevisionTarget =
      result.category === "media"
        ? "video"
        : result.category === "platform"
          ? "video"
          : result.timestampStart !== undefined
            ? "audio"
            : "general";

    actions.push({
      id: `revision-${result.id}`,
      sourceLintId: result.id,
      source: "lint",
      sourceCategory: result.category,
      sourceSeverity: result.severity,
      type: safe?.type ?? (isReview ? "review" : "manual_edit"),
      title: result.title,
      explanation:
        safe?.explanation ??
        manualExplanation(
          result.category,
          result.title,
          result.suggestion,
          result.timestampStart !== undefined,
        ),
      timestampStart: result.timestampStart,
      timestampEnd: result.timestampEnd,
      originalText: result.evidence,
      replacementText: safe?.replacementText,
      detected: result.detected ?? result.evidence,
      expected: result.expected,
      target: safe?.target ?? target,
      platformZoneId: result.platformZoneId,
    });
  }

  for (const check of report.visualAnalysis?.checks ?? []) {
    if (check.status !== "pass") actions.push(visualAction(check));
  }

  for (const requirement of report.unevaluatedRequirements) {
    actions.push({
      id: `revision-review-${requirement.requirementId}`,
      sourceLintId: requirement.requirementId,
      source: "unevaluated",
      sourceCategory:
        requirement.type === "visual_requirement" ? "visual" : "campaign",
      sourceSeverity: "review",
      type: "review",
      title: requirement.description,
      explanation: requirement.reason,
      expected: requirement.description,
      target:
        requirement.type === "visual_requirement" ? "video" : "general",
    });
  }

  return actions;
}

function includesReplacement(caption: string, replacement: string): boolean {
  const normalizedCaption = normalizeText(caption);
  const normalizedReplacement = normalizeText(replacement);
  return Boolean(
    normalizedReplacement && normalizedCaption.includes(normalizedReplacement),
  );
}

export function applySafeCaptionFixes(
  caption: string,
  actions: RevisionAction[],
): string {
  let draft = caption.trim();
  const safeActions = actions.filter(
    (action) =>
      action.type === "safe_auto_fix" &&
      action.target === "caption" &&
      action.replacementText,
  );

  for (const action of safeActions) {
    const replacement = action.replacementText!.trim();
    if (!replacement || includesReplacement(draft, replacement)) continue;
    const isDisclosure = replacement.toLowerCase() === "#ad";
    draft = isDisclosure
      ? [replacement, draft].filter(Boolean).join("\n\n")
      : [draft, replacement].filter(Boolean).join("\n\n");
  }

  return draft;
}

export function resetRevisionCaption(originalCaption: string): string {
  return originalCaption;
}

function actionLine(action: RevisionAction): string {
  const comparison = [
    action.detected ? `detected ${action.detected}` : undefined,
    action.expected ? `expected ${action.expected}` : undefined,
  ]
    .filter(Boolean)
    .join("; ");
  return `- ${timestampLabel(action)}${action.title}: ${action.explanation}${comparison ? ` (${comparison})` : ""}`;
}

function section(title: string, actions: RevisionAction[]): string {
  return `${title}\n${actions.length > 0 ? actions.map(actionLine).join("\n") : "- None"}`;
}

export function buildRevisionPackage(
  actions: RevisionAction[],
  appliedActionIds: ReadonlySet<string> = new Set(),
): RevisionPackage {
  const safe = actions.filter((action) => action.type === "safe_auto_fix");
  const safeApplied = safe.filter((action) => appliedActionIds.has(action.id));
  const safeAvailable = safe.filter((action) => !appliedActionIds.has(action.id));
  const platformEdits = actions.filter(
    (action) =>
      action.type === "manual_edit" && action.sourceCategory === "platform",
  );
  const manualEdits = actions.filter(
    (action) =>
      action.type === "manual_edit" &&
      action.sourceCategory !== "platform" &&
      action.sourceCategory !== "visual",
  );
  const visualReview = actions.filter(
    (action) => action.sourceCategory === "visual",
  );
  const reviewItems = actions.filter(
    (action) => action.type === "review" && action.sourceCategory !== "visual",
  );
  const copyText = [
    section("SAFE FIXES APPLIED", safeApplied),
    section("SAFE FIXES AVAILABLE", safeAvailable),
    section("MANUAL EDITS", manualEdits),
    section("VISUAL REVIEW", visualReview),
    section("CONTENT REVIEW", reviewItems),
    section("PLATFORM PLACEMENT", platformEdits),
  ].join("\n\n");

  return {
    safeApplied,
    safeAvailable,
    manualEdits,
    reviewItems,
    visualReview,
    platformEdits,
    copyText,
  };
}
