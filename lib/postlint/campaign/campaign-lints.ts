import { findTextMatch, normalizeText } from "@/lib/postlint/campaign/text-normalization";
import type {
  CampaignRequirement,
  LintResult,
  Transcript,
  UnevaluatedRequirement,
} from "@/lib/postlint/types";

const DISCLOSURE_PATTERNS = [
  "#ad",
  "#sponsored",
  "sponsored",
  "sponsored by",
  "paid partnership",
  "paid promotion",
];

const CTA_PATTERNS = [
  "check it out",
  "learn more",
  "shop now",
  "click the link",
  "link in bio",
  "download",
  "try it",
  "sign up",
  "visit",
  "get started",
];

type CampaignLintOptions = {
  transcriptUnavailable?: boolean;
};

type CampaignLintOutput = {
  lintResults: LintResult[];
  unevaluatedRequirements: UnevaluatedRequirement[];
};

type PercentageMatch = {
  value: number;
  evidence: string;
  relevant: boolean;
  timestampStart?: number;
  timestampEnd?: number;
};

function withTimestamp(
  result: LintResult,
  match: ReturnType<typeof findTextMatch>,
): LintResult {
  if (!match) return result;
  return {
    ...result,
    evidence: match.evidence,
    timestampStart: match.timestampStart,
    timestampEnd: match.timestampEnd,
  };
}

function searchTerms(requirement: CampaignRequirement): string[] {
  return [requirement.expectedText, ...(requirement.aliases ?? [])].filter(
    (term): term is string => Boolean(term?.trim()),
  );
}

function unavailable(
  requirement: CampaignRequirement,
  reason = "Transcript analysis was unavailable, so PostLint cannot verify this requirement completely.",
): UnevaluatedRequirement {
  return {
    requirementId: requirement.id,
    type: requirement.type,
    description: requirement.description,
    reason,
  };
}

function requiredTextLint(
  requirement: CampaignRequirement,
  transcript: Transcript | null,
  caption: string,
  options: CampaignLintOptions,
): LintResult | UnevaluatedRequirement {
  const terms = searchTerms(requirement);
  if (terms.length === 0) {
    return unavailable(requirement, "No concrete text target was parsed from this requirement.");
  }

  const match = findTextMatch(transcript, caption, terms);
  const isPromoCode = requirement.type === "promo_code";
  const title = isPromoCode
    ? "Promo code"
    : requirement.type === "required_mention"
      ? "Required mention"
      : "Required phrase";

  if (match) {
    return withTimestamp(
      {
        id: requirement.id,
        category: "campaign",
        severity: "pass",
        title,
        message: `${requirement.expectedText ?? match.matchedText} was detected in the ${match.source}.`,
        detected: match.matchedText,
      },
      match,
    );
  }

  if (options.transcriptUnavailable) return unavailable(requirement);

  return {
    id: requirement.id,
    category: "campaign",
    severity: "fail",
    title: `${title} missing`,
    message: `${requirement.expectedText ?? "The required text"} was not detected in the transcript or caption.`,
    expected: requirement.expectedText,
    suggestion: `Add ${requirement.expectedText ?? "the required wording"} to the spoken content or caption.`,
  };
}

function disclosureLint(
  requirement: CampaignRequirement,
  transcript: Transcript | null,
  caption: string,
  options: CampaignLintOptions,
): LintResult | UnevaluatedRequirement {
  const match = findTextMatch(transcript, caption, DISCLOSURE_PATTERNS);
  if (match) {
    return withTimestamp(
      {
        id: requirement.id,
        category: "campaign",
        severity: "pass",
        title: "Sponsorship disclosure",
        message: `A disclosure token was detected in the ${match.source}. This is a PostLint disclosure check, not a guarantee of legal compliance.`,
        detected: match.matchedText,
      },
      match,
    );
  }

  if (options.transcriptUnavailable) return unavailable(requirement);

  return {
    id: requirement.id,
    category: "campaign",
    severity: "fail",
    title: "Sponsorship disclosure missing",
    message: "No explicit sponsorship disclosure was found in the transcript or caption.",
    suggestion: "Add a clear sponsorship disclosure to the content or caption.",
  };
}

function prohibitedPhraseLint(
  requirement: CampaignRequirement,
  transcript: Transcript | null,
  caption: string,
  options: CampaignLintOptions,
): LintResult | UnevaluatedRequirement {
  const terms = searchTerms(requirement);
  if (terms.length === 0) {
    return unavailable(requirement, "No concrete prohibited phrase was parsed.");
  }

  const match = findTextMatch(transcript, caption, terms);
  if (match) {
    return withTimestamp(
      {
        id: requirement.id,
        category: "campaign",
        severity: "fail",
        title: "Prohibited phrase detected",
        message: `“${match.matchedText}” was detected in the ${match.source}.`,
        detected: match.matchedText,
        suggestion: `Remove or revise the prohibited phrase “${requirement.expectedText ?? match.matchedText}.”`,
      },
      match,
    );
  }

  if (options.transcriptUnavailable) return unavailable(requirement);

  return {
    id: requirement.id,
    category: "campaign",
    severity: "pass",
    title: "Prohibited phrase absent",
    message: `“${requirement.expectedText}” was not detected in the transcript or caption.`,
    expected: requirement.expectedText,
  };
}

function callToActionLint(
  requirement: CampaignRequirement,
  transcript: Transcript | null,
  caption: string,
  options: CampaignLintOptions,
): LintResult | UnevaluatedRequirement {
  const terms = [...CTA_PATTERNS, ...searchTerms(requirement)];
  const match = findTextMatch(transcript, caption, terms);
  if (match) {
    return withTimestamp(
      {
        id: requirement.id,
        category: "campaign",
        severity: "pass",
        title: "Call to action",
        message: `“${match.matchedText}” was detected in the ${match.source}.`,
        detected: match.matchedText,
      },
      match,
    );
  }

  if (options.transcriptUnavailable) return unavailable(requirement);

  return {
    id: requirement.id,
    category: "campaign",
    severity: "fail",
    title: "Call to action missing",
    message: "No explicit PostLint CTA pattern was found in the transcript or caption.",
    suggestion: "Add an explicit call to action such as “Check it out” or “Link in bio.”",
  };
}

function percentageMatches(text: string): Array<{ value: number; relevant: boolean }> {
  const normalized = normalizeText(text);
  const matches: Array<{ value: number; relevant: boolean }> = [];
  const pattern = /(\d+(?:[.,]\d+)?)\s*(?:%|percent\b)/giu;

  for (const match of normalized.matchAll(pattern)) {
    const value = Number(match[1].replace(",", "."));
    if (!Number.isFinite(value)) continue;
    const index = match.index ?? 0;
    const context = normalized.slice(Math.max(0, index - 45), index + match[0].length + 45);
    matches.push({
      value,
      relevant: /\b(?:off|discount|save|saving|savings|deal|promo)\b/u.test(context),
    });
  }
  return matches;
}

function collectPercentages(
  transcript: Transcript | null,
  caption: string,
): PercentageMatch[] {
  const matches: PercentageMatch[] = [];
  if (transcript) {
    for (const segment of transcript.segments) {
      for (const match of percentageMatches(segment.text)) {
        matches.push({
          ...match,
          evidence: segment.text,
          timestampStart: segment.startSeconds,
          timestampEnd: segment.endSeconds,
        });
      }
    }
  }
  for (const match of percentageMatches(caption)) {
    matches.push({ ...match, evidence: caption });
  }
  return matches;
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function discountLint(
  requirement: CampaignRequirement,
  transcript: Transcript | null,
  caption: string,
  options: CampaignLintOptions,
): LintResult | UnevaluatedRequirement {
  const expected = requirement.expectedValue;
  if (expected === undefined) {
    return unavailable(requirement, "No numeric discount value was parsed from this requirement.");
  }

  const allMatches = collectPercentages(transcript, caption);
  const relevantMatches = allMatches.filter((match) => match.relevant);
  const candidates = relevantMatches.length > 0 ? relevantMatches : allMatches;
  const exactMatch = candidates.find((match) => Math.abs(match.value - expected) < 0.001);
  if (exactMatch) {
    return {
      id: requirement.id,
      category: "campaign",
      severity: "pass",
      title: "Discount matches",
      message: `${formatPercent(expected)} was detected in discount-related content.`,
      expected: formatPercent(expected),
      detected: formatPercent(exactMatch.value),
      evidence: exactMatch.evidence,
      timestampStart: exactMatch.timestampStart,
      timestampEnd: exactMatch.timestampEnd,
    };
  }

  const mismatch = candidates[0];
  if (mismatch) {
    return {
      id: requirement.id,
      category: "campaign",
      severity: "fail",
      title: "Discount mismatch",
      message: `The detected discount does not match the campaign requirement.`,
      expected: formatPercent(expected),
      detected: formatPercent(mismatch.value),
      evidence: mismatch.evidence,
      timestampStart: mismatch.timestampStart,
      timestampEnd: mismatch.timestampEnd,
      suggestion: `Change the discount to ${formatPercent(expected)}.`,
    };
  }

  if (options.transcriptUnavailable) return unavailable(requirement);

  return {
    id: requirement.id,
    category: "campaign",
    severity: "fail",
    title: "Discount missing",
    message: `No percentage-shaped discount was detected in the transcript or caption.`,
    expected: formatPercent(expected),
    suggestion: `State the ${formatPercent(expected)} discount explicitly.`,
  };
}

function isUnevaluated(
  result: LintResult | UnevaluatedRequirement,
): result is UnevaluatedRequirement {
  return "requirementId" in result;
}

export function runCampaignLints(
  requirements: CampaignRequirement[],
  transcript: Transcript | null,
  caption: string,
  options: CampaignLintOptions = {},
): CampaignLintOutput {
  const lintResults: LintResult[] = [];
  const unevaluatedRequirements: UnevaluatedRequirement[] = [];

  for (const requirement of requirements) {
    let result: LintResult | UnevaluatedRequirement;

    switch (requirement.type) {
      case "required_mention":
      case "required_phrase":
      case "promo_code":
        result = requiredTextLint(requirement, transcript, caption, options);
        break;
      case "discount":
        result = discountLint(requirement, transcript, caption, options);
        break;
      case "sponsorship_disclosure":
        result = disclosureLint(requirement, transcript, caption, options);
        break;
      case "prohibited_phrase":
        result = prohibitedPhraseLint(requirement, transcript, caption, options);
        break;
      case "call_to_action":
        result = callToActionLint(requirement, transcript, caption, options);
        break;
      case "visual_requirement":
        result = unavailable(
          requirement,
          "This requires visual analysis, which is not evaluated in Phase 2.",
        );
        break;
      case "other":
        result = unavailable(
          requirement,
          "PostLint recognized this requirement but does not have a deterministic Phase 2 check for it.",
        );
        break;
    }

    if (isUnevaluated(result)) unevaluatedRequirements.push(result);
    else lintResults.push(result);
  }

  return { lintResults, unevaluatedRequirements };
}
