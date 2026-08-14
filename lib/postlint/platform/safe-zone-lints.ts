import {
  overlapRatio,
  providerBoxToNormalizedRect,
} from "@/lib/postlint/platform/geometry";
import { platformProfile } from "@/lib/postlint/platform/profiles";
import type {
  DetectedVisualElement,
  LintResult,
  TargetPlatform,
} from "@/lib/postlint/types";

export const SAFE_ZONE_WARNING_OVERLAP_RATIO = 0.2;
export const SAFE_ZONE_SEVERE_OVERLAP_RATIO = 0.5;
const TIMESTAMP_TOLERANCE_SECONDS = 0.02;
const PERSISTENT_COLLISION_MAX_GAP_SECONDS = 7;

const KIND_LABELS: Record<DetectedVisualElement["kind"], string> = {
  cta: "CTA",
  promo_code: "Promo code",
  discount: "Discount text",
  headline: "Headline",
  caption: "Caption",
  brand_text: "Brand text",
  other_important_text: "Important text",
};

function allowedTimestamp(timestamp: number, sampledTimestamps: number[]): boolean {
  return sampledTimestamps.some(
    (sampled) => Math.abs(timestamp - sampled) <= TIMESTAMP_TOLERANCE_SECONDS,
  );
}

function recommendation(
  label: string,
  zoneId: string,
  zoneLabel: string,
  text?: string,
): string {
  const subject = text?.trim() ? `“${text.trim()}”` : `the ${label.toLowerCase()}`;
  if (zoneId === "interaction-rail") {
    return `Move ${subject} away from the ${zoneLabel} and farther toward the center-left safe area.`;
  }
  if (zoneId === "lower-interface") {
    return `Move ${subject} higher and away from the ${zoneLabel}.`;
  }
  return `Move ${subject} lower and away from the ${zoneLabel}.`;
}

export function runSafeZoneLints(
  platform: TargetPlatform,
  elements: DetectedVisualElement[],
  sampledTimestamps: number[],
): LintResult[] {
  const profile = platformProfile(platform);
  const results: LintResult[] = [];

  for (const [index, element] of elements.entries()) {
    if (element.confidence !== "high") continue;
    if (!allowedTimestamp(element.frameTimestampSeconds, sampledTimestamps)) continue;
    const contentBox = providerBoxToNormalizedRect(element.box2d);
    if (!contentBox) continue;

    const overlaps = profile.zones
      .map((zone) => ({ zone, ratio: overlapRatio(contentBox, zone.rect) }))
      .sort((left, right) => right.ratio - left.ratio);
    const collision = overlaps[0];
    if (!collision || collision.ratio < SAFE_ZONE_WARNING_OVERLAP_RATIO) continue;

    const label = KIND_LABELS[element.kind];
    const overlapPercent = Math.round(collision.ratio * 100);
    const severe = collision.ratio >= SAFE_ZONE_SEVERE_OVERLAP_RATIO;
    const evidence = element.text?.trim();
    results.push({
      id: `platform-${platform}-${String(index + 1).padStart(3, "0")}`,
      category: "platform",
      severity: "warning",
      title: `${label} ${severe ? "is likely to be obscured" : "may be obscured"}`,
      message: `${evidence ? `“${evidence}”` : `A high-confidence ${label.toLowerCase()} region`} overlaps the estimated ${profile.label} ${collision.zone.label} by ${overlapPercent}%.`,
      timestampStart: element.frameTimestampSeconds,
      evidence,
      detected: `${overlapPercent}% overlap`,
      expected: `Outside the estimated ${collision.zone.label}`,
      suggestion: recommendation(
        label,
        collision.zone.id,
        collision.zone.label,
        evidence,
      ),
      platformZoneId: collision.zone.id,
      contentBox,
      overlapRatio: collision.ratio,
    });
  }

  const merged: LintResult[] = [];
  for (const result of results.sort(
    (left, right) => (left.timestampStart ?? 0) - (right.timestampStart ?? 0),
  )) {
    const previous = [...merged]
      .reverse()
      .find(
        (candidate) =>
          Boolean(result.evidence) &&
          candidate.evidence?.toLowerCase() === result.evidence?.toLowerCase() &&
          candidate.platformZoneId === result.platformZoneId &&
          result.timestampStart !== undefined &&
          (candidate.timestampEnd ?? candidate.timestampStart) !== undefined &&
          result.timestampStart -
            (candidate.timestampEnd ?? candidate.timestampStart ?? 0) <=
            PERSISTENT_COLLISION_MAX_GAP_SECONDS,
      );

    if (!previous) {
      merged.push({ ...result });
      continue;
    }

    previous.timestampEnd = result.timestampStart;
    if ((result.overlapRatio ?? 0) > (previous.overlapRatio ?? 0)) {
      const timestampStart = previous.timestampStart;
      const timestampEnd = previous.timestampEnd;
      Object.assign(previous, result, { timestampStart, timestampEnd });
    }
  }

  return merged;
}
