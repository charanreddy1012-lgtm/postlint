import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  validateCampaignResponse,
  validateTranscriptResponse,
  validateVisualResponse,
} from "../lib/postlint/ai/schemas";

describe("Gemini transcript response validation", () => {
  it("accepts a valid structured transcript", () => {
    const transcript = validateTranscriptResponse(
      JSON.stringify({
        text: "Hello world.",
        segments: [{ startSeconds: 0, endSeconds: 2, text: "Hello world." }],
      }),
    );
    assert.equal(transcript.segments[0].endSeconds, 2);
  });

  it("accepts an empty transcript for unintelligible audio", () => {
    const transcript = validateTranscriptResponse('{"text":"","segments":[]}');
    assert.equal(transcript.segments.length, 0);
  });

  it("rejects malformed JSON", () => {
    assert.throws(() => validateTranscriptResponse("not-json"));
  });

  it("rejects invalid or reversed timestamps", () => {
    assert.throws(() =>
      validateTranscriptResponse(
        '{"text":"Hello","segments":[{"startSeconds":3,"endSeconds":1,"text":"Hello"}]}',
      ),
    );
  });

  it("rejects non-chronological segments", () => {
    assert.throws(() =>
      validateTranscriptResponse(
        '{"text":"Two one","segments":[{"startSeconds":4,"endSeconds":5,"text":"Two"},{"startSeconds":1,"endSeconds":2,"text":"One"}]}',
      ),
    );
  });
});

describe("Gemini visual response validation", () => {
  it("accepts a valid structured visual evaluation", () => {
    const evaluations = validateVisualResponse(
      JSON.stringify({
        evaluations: [
          {
            requirementId: "campaign-007",
            status: "verified",
            evidence: "FocusFlow interface visible.",
            startSeconds: 3,
            endSeconds: 6,
            confidence: "high",
          },
        ],
      }),
    );
    assert.equal(evaluations[0].status, "verified");
  });

  it("rejects malformed visual output", () => {
    assert.throws(() =>
      validateVisualResponse(
        '{"evaluations":[{"requirementId":"campaign-007","status":"yes"}]}',
      ),
    );
  });

  it("rejects reversed visual timestamps", () => {
    assert.throws(() =>
      validateVisualResponse(
        '{"evaluations":[{"requirementId":"campaign-007","status":"verified","confidence":"high","startSeconds":6,"endSeconds":3}]}',
      ),
    );
  });
});

describe("Gemini campaign response validation", () => {
  it("accepts valid requirements and assigns deterministic ids", () => {
    const requirements = validateCampaignResponse(
      JSON.stringify({
        requirements: [
          {
            type: "promo_code",
            description: "Mention code SUMMER20",
            expectedText: "SUMMER20",
          },
          {
            type: "discount",
            description: "State a 20% discount",
            expectedValue: 20,
            expectedUnit: "percent",
          },
        ],
      }),
    );
    assert.equal(requirements[0].id, "campaign-001");
    assert.equal(requirements[1].expectedValue, 20);
  });

  it("preserves visual requirements", () => {
    const requirements = validateCampaignResponse(
      '{"requirements":[{"type":"visual_requirement","description":"Show the product"}]}',
    );
    assert.equal(requirements[0].type, "visual_requirement");
  });

  it("rejects malformed campaign structure", () => {
    assert.throws(() =>
      validateCampaignResponse('{"requirements":[{"type":"promo_code"}]}'),
    );
  });

  it("rejects unknown requirement types", () => {
    assert.throws(() =>
      validateCampaignResponse(
        '{"requirements":[{"type":"make_it_good","description":"Be good"}]}',
      ),
    );
  });
});
