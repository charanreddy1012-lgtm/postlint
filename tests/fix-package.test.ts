import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFixPackage,
  copyableFixChecklist,
} from "../lib/postlint/fixes/fix-package";
import { summarizeLints } from "../lib/postlint/media/media-lints";
import type { PreflightReport } from "../lib/postlint/types";

function report(): PreflightReport {
  return {
    filename: "focusflow.mp4",
    target: "tiktok",
    metadata: {
      width: 1080,
      height: 1920,
      durationSeconds: 24,
      videoCodec: "h264",
      audioPresent: true,
      aspectRatio: 9 / 16,
      aspectRatioLabel: "9:16",
    },
    transcript: null,
    campaign: {
      rawBrief: "FocusFlow demo",
      evaluatedCount: 5,
      unevaluatedCount: 1,
      requirements: [
        {
          id: "disclosure",
          type: "sponsorship_disclosure",
          description: "Include a sponsorship disclosure",
        },
        {
          id: "discount",
          type: "discount",
          description: "State 20% off",
          expectedValue: 20,
          expectedUnit: "percent",
        },
        {
          id: "promo",
          type: "promo_code",
          description: "Include FLOW20",
          expectedText: "FLOW20",
        },
        {
          id: "prohibited",
          type: "prohibited_phrase",
          description: "Do not say guaranteed results",
          expectedText: "guaranteed results",
        },
        {
          id: "cta",
          type: "call_to_action",
          description: "Include a CTA",
        },
        {
          id: "unsupported",
          type: "other",
          description: "Feel premium",
        },
      ],
    },
    visualAnalysis: {
      sampledFrameCount: 8,
      supportedRequirementCount: 1,
      checks: [
        {
          id: "visual-product",
          requirementId: "visual-product",
          status: "not_verified",
          title: "Show the FocusFlow product",
          message: "No clear evidence was found.",
          suggestion: "Add a clear product or logo shot before publishing.",
        },
      ],
    },
    lintResults: [
      {
        id: "disclosure",
        category: "campaign",
        severity: "fail",
        title: "Sponsorship disclosure missing",
        message: "No disclosure was found.",
        suggestion: "Add a clear sponsorship disclosure.",
      },
      {
        id: "discount",
        category: "campaign",
        severity: "fail",
        title: "Discount mismatch",
        message: "The discount does not match.",
        timestampStart: 9,
        timestampEnd: 14,
        detected: "15%",
        expected: "20%",
        suggestion: "Change the discount to 20%.",
      },
      {
        id: "promo",
        category: "campaign",
        severity: "fail",
        title: "Promo code missing",
        message: "FLOW20 was not detected.",
        expected: "FLOW20",
        suggestion: "Add FLOW20 to the spoken content or caption.",
      },
      {
        id: "prohibited",
        category: "campaign",
        severity: "fail",
        title: "Prohibited phrase detected",
        message: "The phrase was detected.",
        detected: "guaranteed results",
        suggestion: "Remove the prohibited phrase.",
      },
      {
        id: "cta",
        category: "campaign",
        severity: "fail",
        title: "Call to action missing",
        message: "No CTA was found.",
        suggestion: "Add a simple call to action.",
      },
      {
        id: "media.vertical-format",
        category: "media",
        severity: "pass",
        title: "Vertical format",
        message: "The format passes.",
      },
    ],
    unevaluatedRequirements: [
      {
        requirementId: "unsupported",
        type: "other",
        description: "Feel premium",
        reason: "Subjective requirement.",
      },
    ],
    analysisStatus: {
      transcription: "unavailable",
      campaign: "complete",
      visual: "complete",
    },
    summary: { passes: 1, warnings: 0, failures: 5 },
  };
}

describe("Fix Package", () => {
  it("generates fixes entirely from actionable report results", () => {
    const fixes = buildFixPackage(report());
    assert.equal(fixes.items.length, 6);

    const disclosure = fixes.items.find((item) => item.id === "fix-disclosure");
    assert.equal(disclosure?.replacementText, "#ad");

    const discount = fixes.items.find((item) => item.id === "fix-discount");
    assert.equal(discount?.detected, "15%");
    assert.equal(discount?.expected, "20%");
    assert.equal(discount?.timestampStart, 9);
    assert.equal(discount?.replacementText, undefined);

    assert.equal(
      fixes.items.find((item) => item.id === "fix-promo")?.replacementText,
      "Use code FLOW20.",
    );
    assert.equal(
      fixes.items.find((item) => item.id === "fix-cta")?.replacementText,
      "Check it out.",
    );
  });

  it("does not invent copyable replacement text for prohibited or visual findings", () => {
    const fixes = buildFixPackage(report());
    assert.equal(
      fixes.items.find((item) => item.id === "fix-prohibited")
        ?.replacementText,
      undefined,
    );
    assert.equal(
      fixes.items.find((item) => item.id === "fix-visual-product")
        ?.replacementText,
      undefined,
    );
  });

  it("does not create fake fixes for unevaluated requirements", () => {
    const fixes = buildFixPackage(report());
    assert.equal(
      fixes.items.some((item) => item.id.includes("unsupported")),
      false,
    );
  });

  it("builds a concise copy-all checklist with timestamps and comparisons", () => {
    const fixes = buildFixPackage(report());
    const text = copyableFixChecklist(fixes.items);
    assert.match(text, /Discount mismatch @ 00:09/);
    assert.match(text, /detected 15%; expected 20%/);
    assert.match(text, /Add a clear product or logo shot/);
  });

  it("preserves scoring semantics for pass, warning, and failure results", () => {
    assert.deepEqual(
      summarizeLints([
        ...report().lintResults,
        {
          id: "media.audio",
          category: "media",
          severity: "warning",
          title: "No audio detected",
          message: "No stream.",
        },
      ]),
      { passes: 1, warnings: 1, failures: 5 },
    );
  });

  it("turns a safe-zone warning into a deterministic placement recommendation", () => {
    const input = report();
    input.lintResults.push({
      id: "platform-tiktok-001",
      category: "platform",
      severity: "warning",
      title: "CTA may be obscured",
      message: "CTA overlaps the estimated TikTok interaction rail.",
      timestampStart: 8,
      detected: "34% overlap",
      expected: "Outside the estimated right-side interaction rail",
      suggestion:
        "Move “Use code FLOW20” farther toward the center-left safe area.",
      platformZoneId: "interaction-rail",
    });

    const item = buildFixPackage(input).items.find(
      (candidate) => candidate.id === "fix-platform-tiktok-001",
    );
    assert.equal(item?.timestampStart, 8);
    assert.equal(item?.platformZoneId, "interaction-rail");
    assert.match(item?.recommendedFix ?? "", /center-left/);
    assert.equal(item?.replacementText, undefined);
  });
});
