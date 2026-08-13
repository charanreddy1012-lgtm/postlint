import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSupportedVisualRequirement,
  partitionVisualRequirements,
} from "../lib/postlint/visual/visual-requirements";
import { mapVisualEvaluations } from "../lib/postlint/visual/visual-lints";
import type {
  CampaignRequirement,
  VisualRequirementEvaluation,
} from "../lib/postlint/types";

const productRequirement: CampaignRequirement = {
  id: "campaign-007",
  type: "visual_requirement",
  description: "Show the FocusFlow product",
};
const timestamps = [0.25, 3, 6, 9.75];

function mapped(evaluation: VisualRequirementEvaluation) {
  return mapVisualEvaluations([productRequirement], [evaluation], timestamps)[0];
}

describe("supported visual requirements", () => {
  it("supports concrete product, logo, packaging, interface, and holding checks", () => {
    for (const description of [
      "Show the product",
      "Display the logo",
      "Make the packaging visible",
      "Show the app interface",
      "Creator should hold the item",
    ]) {
      assert.equal(
        isSupportedVisualRequirement({ ...productRequirement, description }),
        true,
      );
    }
  });

  it("does not support subjective visual direction", () => {
    const requirement = {
      ...productRequirement,
      description: "Show the product with premium lighting and an energetic vibe",
    };
    assert.equal(isSupportedVisualRequirement(requirement), false);
    const partition = partitionVisualRequirements([requirement]);
    assert.equal(partition.supported.length, 0);
    assert.equal(partition.unsupported.length, 1);
  });
});

describe("visual evaluation mapping", () => {
  it("maps high-confidence verified evidence with a sampled timestamp to PASS", () => {
    const result = mapped({
      requirementId: productRequirement.id,
      status: "verified",
      confidence: "high",
      evidence: "FocusFlow interface is clearly visible.",
      startSeconds: 3,
      endSeconds: 6,
    });
    assert.equal(result.status, "pass");
    assert.equal(result.timestampStart, 3);
    assert.equal(result.timestampEnd, 6);
  });

  it("never maps medium- or low-confidence verified evidence to PASS", () => {
    for (const confidence of ["medium", "low"] as const) {
      const result = mapped({
        requirementId: productRequirement.id,
        status: "verified",
        confidence,
        evidence: "Possible product UI.",
        startSeconds: 3,
      });
      assert.equal(result.status, "needs_review");
    }
  });

  it("requires visible evidence and a real sampled timestamp for PASS", () => {
    assert.equal(
      mapped({
        requirementId: productRequirement.id,
        status: "verified",
        confidence: "high",
        startSeconds: 3,
      }).status,
      "needs_review",
    );
    assert.equal(
      mapped({
        requirementId: productRequirement.id,
        status: "verified",
        confidence: "high",
        evidence: "Product visible.",
      }).status,
      "needs_review",
    );
  });

  it("treats uncertain evidence as a non-scoring review state", () => {
    const result = mapped({
      requirementId: productRequirement.id,
      status: "uncertain",
      confidence: "low",
      evidence: "Possible logo, too small to identify.",
      startSeconds: 6,
    });
    assert.equal(result.status, "needs_review");
  });

  it("treats clear non-verification as non-failing", () => {
    const result = mapped({
      requirementId: productRequirement.id,
      status: "not_verified",
      confidence: "high",
      evidence: "No identifiable product in sampled frames.",
    });
    assert.equal(result.status, "not_verified");
  });

  it("rejects invented timestamps and never fabricates a PASS", () => {
    const result = mapped({
      requirementId: productRequirement.id,
      status: "verified",
      confidence: "high",
      evidence: "Product visible.",
      startSeconds: 4.137,
    });
    assert.equal(result.status, "needs_review");
    assert.equal(result.timestampStart, undefined);
  });

  it("ignores unknown provider requirement ids", () => {
    const result = mapVisualEvaluations(
      [productRequirement],
      [
        {
          requirementId: "invented-id",
          status: "verified",
          confidence: "high",
          evidence: "Invented evidence.",
          startSeconds: 3,
        },
      ],
      timestamps,
    )[0];
    assert.equal(result.status, "needs_review");
  });
});
