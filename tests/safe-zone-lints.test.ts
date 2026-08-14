import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  runSafeZoneLints,
  SAFE_ZONE_WARNING_OVERLAP_RATIO,
} from "../lib/postlint/platform/safe-zone-lints";
import { summarizeLints } from "../lib/postlint/media/media-lints";
import type { DetectedVisualElement } from "../lib/postlint/types";

const sampledTimestamps = [0.25, 3, 6, 9];

function element(
  overrides: Partial<DetectedVisualElement> = {},
): DetectedVisualElement {
  return {
    frameTimestampSeconds: 6,
    kind: "cta",
    text: "Use code FLOW20",
    box2d: [300, 800, 420, 950],
    confidence: "high",
    ...overrides,
  };
}

describe("safe-zone collision lints", () => {
  it("emits a timestamped warning for meaningful overlap", () => {
    const [result] = runSafeZoneLints("tiktok", [element()], sampledTimestamps);
    assert.equal(result.severity, "warning");
    assert.equal(result.category, "platform");
    assert.equal(result.timestampStart, 6);
    assert.equal(result.platformZoneId, "interaction-rail");
    assert.ok((result.overlapRatio ?? 0) >= SAFE_ZONE_WARNING_OVERLAP_RATIO);
    assert.match(result.suggestion ?? "", /center-left safe area/);
  });

  it("ignores a tiny overlap below the threshold", () => {
    const results = runSafeZoneLints(
      "tiktok",
      [element({ box2d: [300, 600, 420, 790] })],
      sampledTimestamps,
    );
    assert.equal(results.length, 0);
  });

  it("changes results when the platform profile changes", () => {
    const lowerText = element({ box2d: [720, 200, 760, 700] });
    assert.equal(runSafeZoneLints("instagram", [lowerText], sampledTimestamps).length, 1);
    assert.equal(runSafeZoneLints("youtube", [lowerText], sampledTimestamps).length, 0);
  });

  it("ignores medium- and low-confidence detections", () => {
    for (const confidence of ["medium", "low"] as const) {
      assert.equal(
        runSafeZoneLints("tiktok", [element({ confidence })], sampledTimestamps)
          .length,
        0,
      );
    }
  });

  it("ignores malformed provider boxes defensively", () => {
    const malformed = element({ box2d: [300, 800, 200, 950] });
    assert.equal(runSafeZoneLints("tiktok", [malformed], sampledTimestamps).length, 0);
  });

  it("ignores timestamps not corresponding to a sampled frame", () => {
    assert.equal(
      runSafeZoneLints(
        "tiktok",
        [element({ frameTimestampSeconds: 6.5 })],
        sampledTimestamps,
      ).length,
      0,
    );
  });

  it("does not warn for safe placement", () => {
    assert.equal(
      runSafeZoneLints(
        "tiktok",
        [element({ box2d: [300, 200, 420, 600] })],
        sampledTimestamps,
      ).length,
      0,
    );
  });

  it("contributes a warning without becoming a blocking failure", () => {
    const results = runSafeZoneLints("tiktok", [element()], sampledTimestamps);
    assert.deepEqual(summarizeLints(results), {
      passes: 0,
      warnings: 1,
      failures: 0,
    });
  });

  it("merges the same persistent text across adjacent sampled frames", () => {
    const results = runSafeZoneLints(
      "tiktok",
      [
        element({ frameTimestampSeconds: 3 }),
        element({ frameTimestampSeconds: 6 }),
      ],
      sampledTimestamps,
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].timestampStart, 3);
    assert.equal(results[0].timestampEnd, 6);
  });
});
