import { normalizeText } from "@/lib/postlint/campaign/text-normalization";
import type { CampaignRequirement } from "@/lib/postlint/types";

const SUPPORTED_ACTIONS = ["show", "display", "visible", "feature", "include", "hold"];
const SUPPORTED_OBJECTS = [
  "product",
  "logo",
  "packaging",
  "package",
  "interface",
  "app",
  "screen",
  "brand",
  "text",
  "item",
];
const SUBJECTIVE_TERMS = [
  "energetic",
  "excited",
  "premium lighting",
  "youthful",
  "cinematic",
  "beautiful",
  "aesthetic",
  "mood",
  "vibe",
  "feel",
];

export function isSupportedVisualRequirement(
  requirement: CampaignRequirement,
): boolean {
  if (requirement.type !== "visual_requirement") return false;
  const text = normalizeText(
    [requirement.description, requirement.expectedText].filter(Boolean).join(" "),
  );
  if (SUBJECTIVE_TERMS.some((term) => text.includes(normalizeText(term)))) {
    return false;
  }
  return (
    SUPPORTED_ACTIONS.some((term) => text.includes(term)) &&
    SUPPORTED_OBJECTS.some((term) => text.includes(term))
  );
}

export function partitionVisualRequirements(requirements: CampaignRequirement[]): {
  supported: CampaignRequirement[];
  unsupported: CampaignRequirement[];
} {
  const visual = requirements.filter(
    (requirement) => requirement.type === "visual_requirement",
  );
  return {
    supported: visual.filter(isSupportedVisualRequirement),
    unsupported: visual.filter((requirement) => !isSupportedVisualRequirement(requirement)),
  };
}
