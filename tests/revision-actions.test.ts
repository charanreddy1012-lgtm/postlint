import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySafeCaptionFixes,
  buildRevisionActions,
  buildRevisionPackage,
  resetRevisionCaption,
} from "../lib/postlint/revisions/revision-actions";
import type { PreflightReport } from "../lib/postlint/types";

function report(): PreflightReport {
  return {
    filename: "focusflow.mp4",
    target: "tiktok",
    metadata: {
      width: 1080,
      height: 1920,
      durationSeconds: 13,
      videoCodec: "h264",
      audioPresent: true,
      aspectRatio: 9 / 16,
      aspectRatioLabel: "9:16",
    },
    transcript: null,
    campaign: {
      rawBrief: "FocusFlow campaign",
      evaluatedCount: 5,
      unevaluatedCount: 0,
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
        },
        {
          id: "prohibited",
          type: "prohibited_phrase",
          description: "Do not say scientifically proven",
          expectedText: "scientifically proven",
        },
        {
          id: "promo",
          type: "promo_code",
          description: "Include FLOW20",
          expectedText: "FLOW20",
        },
        {
          id: "cta",
          type: "call_to_action",
          description: "Include a CTA",
        },
      ],
    },
    visualAnalysis: {
      sampledFrameCount: 3,
      supportedRequirementCount: 1,
      checks: [
        {
          id: "visual-product",
          requirementId: "visual-product",
          status: "not_verified",
          title: "Show the FocusFlow interface",
          message: "No clear evidence was found.",
          suggestion: "Add a clear interface shot.",
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
      },
      {
        id: "discount",
        category: "campaign",
        severity: "fail",
        title: "Discount mismatch",
        message: "The discount does not match.",
        timestampStart: 8,
        detected: "15%",
        expected: "20%",
        evidence: "Get 15 percent off.",
      },
      {
        id: "prohibited",
        category: "campaign",
        severity: "fail",
        title: "Prohibited phrase detected",
        message: "The phrase was detected.",
        timestampStart: 4,
        timestampEnd: 7,
        detected: "scientifically proven",
      },
      {
        id: "promo",
        category: "campaign",
        severity: "fail",
        title: "Promo code missing",
        message: "FLOW20 was not found.",
        expected: "FLOW20",
      },
      {
        id: "cta",
        category: "campaign",
        severity: "fail",
        title: "Call to action missing",
        message: "No CTA was found.",
      },
      {
        id: "platform-tiktok-001",
        category: "platform",
        severity: "warning",
        title: "CTA may be obscured",
        message: "The CTA overlaps the interaction rail.",
        timestampStart: 10,
        suggestion: "Move the CTA toward the center-left safe area.",
        platformZoneId: "interaction-rail",
      },
    ],
    unevaluatedRequirements: [],
    analysisStatus: {
      transcription: "complete",
      campaign: "complete",
      visual: "complete",
    },
    summary: { passes: 0, warnings: 1, failures: 5 },
  };
}

describe("revision classification", () => {
  it("classifies missing disclosure as a conservative safe auto-fix", () => {
    const action = buildRevisionActions(report()).find(
      (candidate) => candidate.sourceLintId === "disclosure",
    );
    assert.equal(action?.type, "safe_auto_fix");
    assert.equal(action?.target, "caption");
    assert.equal(action?.replacementText, "#ad");
  });

  it("keeps a spoken discount mismatch manual", () => {
    const action = buildRevisionActions(report()).find(
      (candidate) => candidate.sourceLintId === "discount",
    );
    assert.equal(action?.type, "manual_edit");
    assert.equal(action?.target, "audio");
    assert.equal(action?.replacementText, undefined);
    assert.match(action?.explanation ?? "", /caption change cannot repair/iu);
  });

  it("keeps a prohibited spoken phrase manual", () => {
    const action = buildRevisionActions(report()).find(
      (candidate) => candidate.sourceLintId === "prohibited",
    );
    assert.equal(action?.type, "manual_edit");
    assert.equal(action?.target, "audio");
    assert.equal(action?.replacementText, undefined);
  });

  it("classifies a visual not-verified result as a manual video edit", () => {
    const action = buildRevisionActions(report()).find(
      (candidate) => candidate.sourceLintId === "visual-product",
    );
    assert.equal(action?.type, "manual_edit");
    assert.equal(action?.target, "video");
  });

  it("classifies a platform warning as a manual video edit", () => {
    const action = buildRevisionActions(report()).find(
      (candidate) => candidate.sourceLintId === "platform-tiktok-001",
    );
    assert.equal(action?.type, "manual_edit");
    assert.equal(action?.platformZoneId, "interaction-rail");
  });

  it("classifies uncertain visual evidence as review and never auto-fixes it", () => {
    const input = report();
    input.visualAnalysis!.checks[0] = {
      ...input.visualAnalysis!.checks[0],
      status: "needs_review",
      confidence: "medium",
    };
    const action = buildRevisionActions(input).find(
      (candidate) => candidate.sourceLintId === "visual-product",
    );
    assert.equal(action?.type, "review");
    assert.equal(action?.replacementText, undefined);
  });
});

describe("revision caption safety", () => {
  it("applies disclosure and exact caption-safe fixes without changing the original", () => {
    const original = "FocusFlow changed how I study.";
    const revised = applySafeCaptionFixes(
      original,
      buildRevisionActions(report()),
    );
    assert.equal(original, "FocusFlow changed how I study.");
    assert.match(revised, /^#ad\n\nFocusFlow/);
    assert.match(revised, /Use code FLOW20\./);
    assert.match(revised, /Check it out\./);
  });

  it("never applies manual discount or prohibited-phrase actions", () => {
    const revised = applySafeCaptionFixes(
      "Original caption",
      buildRevisionActions(report()),
    );
    assert.doesNotMatch(revised, /20%/);
    assert.doesNotMatch(revised, /scientifically proven/iu);
  });

  it("is idempotent when safe fixes are applied repeatedly", () => {
    const actions = buildRevisionActions(report());
    const first = applySafeCaptionFixes("Original caption", actions);
    const second = applySafeCaptionFixes(first, actions);
    assert.equal(second, first);
  });

  it("reset restores the exact original revision draft", () => {
    const original = "  Original caption with intentional spacing  ";
    assert.equal(resetRevisionCaption(original), original);
  });

  it("does not auto-fix a requirement that explicitly requires spoken delivery", () => {
    const input = report();
    input.campaign!.requirements.push({
      id: "spoken-mention",
      type: "required_phrase",
      description: "Say this exact phrase in the voiceover",
      expectedText: "Built for focus",
    });
    input.lintResults.push({
      id: "spoken-mention",
      category: "campaign",
      severity: "fail",
      title: "Required phrase missing",
      message: "Not found.",
    });
    const action = buildRevisionActions(input).find(
      (candidate) => candidate.sourceLintId === "spoken-mention",
    );
    assert.equal(action?.type, "manual_edit");
    assert.equal(action?.replacementText, undefined);
  });

  it("does not auto-fix text that conflicts with a prohibited phrase", () => {
    const input = report();
    input.campaign!.requirements.push({
      id: "conflicting-text",
      type: "required_phrase",
      description: "Include the required phrase",
      expectedText: "Scientifically proven",
    });
    input.lintResults.push({
      id: "conflicting-text",
      category: "campaign",
      severity: "fail",
      title: "Required phrase missing",
      message: "Not found.",
    });
    const action = buildRevisionActions(input).find(
      (candidate) => candidate.sourceLintId === "conflicting-text",
    );
    assert.equal(action?.type, "manual_edit");
  });
});

describe("Revision Package", () => {
  it("separates applied safe fixes, manual edits, reviews, and platform edits", () => {
    const input = report();
    input.visualAnalysis!.checks[0] = {
      ...input.visualAnalysis!.checks[0],
      status: "needs_review",
      confidence: "medium",
    };
    const actions = buildRevisionActions(input);
    const disclosure = actions.find(
      (action) => action.sourceLintId === "disclosure",
    )!;
    const revisionPackage = buildRevisionPackage(
      actions,
      new Set([disclosure.id]),
    );
    assert.equal(revisionPackage.safeApplied.length, 1);
    assert.ok(revisionPackage.manualEdits.some((item) => item.sourceLintId === "discount"));
    assert.ok(revisionPackage.visualReview.some((item) => item.sourceLintId === "visual-product"));
    assert.equal(revisionPackage.platformEdits.length, 1);
    assert.match(revisionPackage.copyText, /SAFE FIXES APPLIED/);
    assert.match(revisionPackage.copyText, /MANUAL EDITS/);
    assert.match(revisionPackage.copyText, /VISUAL REVIEW/);
    assert.match(revisionPackage.copyText, /CONTENT REVIEW/);
    assert.match(revisionPackage.copyText, /PLATFORM PLACEMENT/);
  });
});
