import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runCampaignLints } from "../lib/postlint/campaign/campaign-lints";
import { findTextMatch, normalizeText } from "../lib/postlint/campaign/text-normalization";
import type {
  CampaignRequirement,
  CampaignRequirementType,
  Transcript,
} from "../lib/postlint/types";

const transcript: Transcript = {
  text: "I've been using FocusFlow. Get 15% off with code SUMMER20. Check it out.",
  segments: [
    { startSeconds: 1, endSeconds: 4, text: "I've been using FocusFlow." },
    {
      startSeconds: 9,
      endSeconds: 14,
      text: "Get 15% off with code SUMMER20.",
    },
    { startSeconds: 17, endSeconds: 19, text: "Check it out." },
  ],
};

function requirement(
  type: CampaignRequirementType,
  overrides: Partial<CampaignRequirement> = {},
): CampaignRequirement {
  return {
    id: `test-${type}`,
    type,
    description: `Test ${type}`,
    ...overrides,
  };
}

function singleResult(
  item: CampaignRequirement,
  contentTranscript: Transcript | null = transcript,
  caption = "",
) {
  const output = runCampaignLints([item], contentTranscript, caption);
  assert.equal(output.lintResults.length, 1);
  return output.lintResults[0];
}

describe("text normalization", () => {
  it("normalizes casing, punctuation, and whitespace", () => {
    assert.equal(
      normalizeText("  FOCUS Flow!!!\n\tSummer  "),
      "focus flow summer",
    );
  });

  it("preserves useful hashtags and normalizes smart apostrophes", () => {
    assert.equal(normalizeText("Creator’s #Sponsored post"), "creator's #sponsored post");
  });

  it("selects the matching transcript segment and propagates timestamps", () => {
    const match = findTextMatch(transcript, "", ["SUMMER20"]);
    assert.equal(match?.source, "transcript");
    assert.equal(match?.timestampStart, 9);
    assert.equal(match?.timestampEnd, 14);
  });
});

describe("required mentions and phrases", () => {
  const mention = requirement("required_mention", { expectedText: "FocusFlow" });

  it("passes a transcript match with its segment timestamp", () => {
    const result = singleResult(mention);
    assert.equal(result.severity, "pass");
    assert.equal(result.timestampStart, 1);
  });

  it("passes a caption match", () => {
    const result = singleResult(mention, null, "FocusFlow changed how I study.");
    assert.equal(result.severity, "pass");
    assert.equal(result.timestampStart, undefined);
  });

  it("fails when absent", () => {
    const result = singleResult(mention, null, "No brand here.");
    assert.equal(result.severity, "fail");
  });
});

describe("promo codes", () => {
  const promo = requirement("promo_code", { expectedText: "SUMMER20" });

  it("passes the correct code", () => {
    assert.equal(singleResult(promo).severity, "pass");
  });

  it("matches case-insensitively", () => {
    assert.equal(singleResult(promo, null, "Use summer20 today.").severity, "pass");
  });

  it("fails when absent", () => {
    assert.equal(singleResult(promo, null, "No promo code.").severity, "fail");
  });

  it("does not match a longer code", () => {
    assert.equal(singleResult(promo, null, "Use SUMMER200 today.").severity, "fail");
  });
});

describe("discount checking", () => {
  const discount = requirement("discount", {
    expectedValue: 20,
    expectedUnit: "percent",
  });

  it("passes an exact percentage-shaped value", () => {
    assert.equal(singleResult(discount, null, "Save 20 percent today.").severity, "pass");
  });

  it("fails a mismatch and reports expected and detected values", () => {
    const result = singleResult(discount);
    assert.equal(result.severity, "fail");
    assert.equal(result.title, "Discount mismatch");
    assert.equal(result.expected, "20%");
    assert.equal(result.detected, "15%");
  });

  it("propagates the transcript timestamp for a mismatch", () => {
    const result = singleResult(discount);
    assert.equal(result.timestampStart, 9);
    assert.equal(result.timestampEnd, 14);
  });

  it("fails when no percentage is detected", () => {
    const result = singleResult(discount, null, "Save more today.");
    assert.equal(result.severity, "fail");
    assert.equal(result.title, "Discount missing");
  });

  it("does not treat a bare number as a percentage", () => {
    assert.equal(singleResult(discount, null, "We have 20 new features.").severity, "fail");
  });
});

describe("sponsorship disclosure", () => {
  const disclosure = requirement("sponsorship_disclosure");

  for (const token of ["#ad", "#sponsored", "Sponsored by FocusFlow", "Paid partnership"]) {
    it(`passes ${token}`, () => {
      assert.equal(singleResult(disclosure, null, token).severity, "pass");
    });
  }

  it("fails when absent", () => {
    assert.equal(singleResult(disclosure, null, "FocusFlow is great.").severity, "fail");
  });
});

describe("prohibited phrases", () => {
  const prohibited = requirement("prohibited_phrase", {
    expectedText: "scientifically proven",
  });
  const claimTranscript: Transcript = {
    text: "It is scientifically proven to work.",
    segments: [
      { startSeconds: 4, endSeconds: 8, text: "It is scientifically proven to work." },
    ],
  };

  it("fails when present and includes the matching timestamp", () => {
    const result = singleResult(prohibited, claimTranscript);
    assert.equal(result.severity, "fail");
    assert.equal(result.timestampStart, 4);
  });

  it("passes when absent", () => {
    assert.equal(singleResult(prohibited, null, "A productivity tool.").severity, "pass");
  });
});

describe("calls to action", () => {
  const cta = requirement("call_to_action");

  it("passes check it out", () => {
    assert.equal(singleResult(cta).severity, "pass");
  });

  it("passes link in bio", () => {
    assert.equal(singleResult(cta, null, "Link in bio!").severity, "pass");
  });

  it("fails when absent", () => {
    assert.equal(singleResult(cta, null, "FocusFlow is useful.").severity, "fail");
  });
});

describe("unsupported requirements", () => {
  it("never passes a visual requirement", () => {
    const output = runCampaignLints(
      [requirement("visual_requirement", { description: "Show the product" })],
      transcript,
      "",
    );
    assert.equal(output.lintResults.length, 0);
    assert.equal(output.unevaluatedRequirements.length, 1);
  });

  it("marks other requirements as not evaluated", () => {
    const output = runCampaignLints([requirement("other")], transcript, "");
    assert.equal(output.lintResults.length, 0);
    assert.equal(output.unevaluatedRequirements[0].type, "other");
  });

  it("does not fail an absent requirement when transcription is unavailable", () => {
    const output = runCampaignLints(
      [requirement("required_mention", { expectedText: "FocusFlow" })],
      null,
      "",
      { transcriptUnavailable: true },
    );
    assert.equal(output.lintResults.length, 0);
    assert.equal(output.unevaluatedRequirements.length, 1);
  });
});
