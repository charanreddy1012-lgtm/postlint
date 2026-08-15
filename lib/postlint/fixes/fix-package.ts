import type {
  CampaignRequirement,
  LintResult,
  PreflightReport,
  VisualCheckResult,
} from "@/lib/postlint/types";

export type FixProvenance = "deterministic" | "ai_observed";

export type FixItem = {
  id: string;
  issue: string;
  timestampStart?: number;
  timestampEnd?: number;
  detected?: string;
  expected?: string;
  recommendedFix: string;
  replacementText?: string;
  provenance: FixProvenance;
  platformZoneId?: string;
};

export type FixPackage = {
  items: FixItem[];
  copyAllText: string;
};

function requirementFor(
  report: PreflightReport,
  resultId: string,
): CampaignRequirement | undefined {
  return report.campaign?.requirements.find(
    (requirement) => requirement.id === resultId,
  );
}

function replacementFor(
  result: LintResult,
  report: PreflightReport,
): string | undefined {
  const requirement = requirementFor(report, result.id);

  switch (requirement?.type) {
    case "sponsorship_disclosure":
      return "#ad";
    case "promo_code":
      return requirement.expectedText
        ? `Use code ${requirement.expectedText}.`
        : undefined;
    case "required_mention":
    case "required_phrase":
      return requirement.expectedText;
    case "discount":
      // A caption replacement cannot repair contradictory spoken-video content.
      return undefined;
    case "call_to_action":
      return requirement.expectedText?.trim() || "Check it out.";
    default:
      return undefined;
  }
}

function fixFromLint(
  result: LintResult,
  report: PreflightReport,
): FixItem {
  return {
    id: `fix-${result.id}`,
    issue: result.title,
    timestampStart: result.timestampStart,
    timestampEnd: result.timestampEnd,
    detected: result.detected ?? result.evidence,
    expected: result.expected,
    recommendedFix:
      result.suggestion ?? "Review this finding and correct it before publishing.",
    replacementText: replacementFor(result, report),
    provenance: "deterministic",
    platformZoneId: result.platformZoneId,
  };
}

function fixFromVisual(check: VisualCheckResult): FixItem {
  return {
    id: `fix-${check.id}`,
    issue: check.title,
    timestampStart: check.timestampStart,
    timestampEnd: check.timestampEnd,
    detected: check.evidence,
    expected: check.title,
    recommendedFix:
      check.suggestion ??
      "Add a clear, prominent product or logo shot before publishing.",
    provenance: "ai_observed",
  };
}

function formatTimestamp(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function copyableFixChecklist(items: FixItem[]): string {
  return items
    .map((item, index) => {
      const timestamp =
        item.timestampStart === undefined
          ? ""
          : ` @ ${formatTimestamp(item.timestampStart)}`;
      const comparison = [
        item.detected ? `detected ${item.detected}` : undefined,
        item.expected ? `expected ${item.expected}` : undefined,
      ]
        .filter(Boolean)
        .join("; ");
      return `${index + 1}. ${item.issue}${timestamp} — ${item.recommendedFix}${comparison ? ` (${comparison})` : ""}`;
    })
    .join("\n");
}

export function buildFixPackage(report: PreflightReport): FixPackage {
  const lintFixes = report.lintResults
    .filter((result) => result.severity !== "pass")
    .map((result) => fixFromLint(result, report));
  const visualFixes = (report.visualAnalysis?.checks ?? [])
    .filter((check) => check.status !== "pass")
    .map(fixFromVisual);
  const items = [...lintFixes, ...visualFixes];

  return { items, copyAllText: copyableFixChecklist(items) };
}
