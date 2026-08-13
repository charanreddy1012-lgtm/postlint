import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  analyzeContent,
  type ContentAnalysisDependencies,
} from "../lib/postlint/preflight/content-analysis";
import type { CampaignRequirement, Transcript } from "../lib/postlint/types";

const parsedRequirements: CampaignRequirement[] = [
  {
    id: "campaign-001",
    type: "required_mention",
    description: "Mention FocusFlow",
    expectedText: "FocusFlow",
  },
];

const transcript: Transcript = {
  text: "FocusFlow helps me study.",
  segments: [
    { startSeconds: 1, endSeconds: 3, text: "FocusFlow helps me study." },
  ],
};

function dependencies(
  overrides: Partial<ContentAnalysisDependencies> = {},
): ContentAnalysisDependencies {
  return {
    extractAudio: async () => undefined,
    transcribe: async () => transcript,
    parseBrief: async () => parsedRequirements,
    extractFrames: async () => [],
    analyzeVisual: async () => [],
    ...overrides,
  };
}

const input = {
  videoPath: "/tmp/video.mp4",
  audioPath: "/tmp/audio.mp3",
  audioPresent: true,
  caption: "",
  rawBrief: "Mention FocusFlow",
  framesDirectory: "/tmp/frames",
  durationSeconds: 10,
};

describe("partial provider failure", () => {
  it("preserves campaign parsing when transcription fails", async () => {
    const output = await analyzeContent(
      input,
      dependencies({ transcribe: async () => Promise.reject(new Error("provider")) }),
    );
    assert.equal(output.analysisStatus.transcription, "unavailable");
    assert.equal(output.analysisStatus.campaign, "complete");
    assert.equal(output.transcript, null);
    assert.equal(output.campaign?.requirements.length, 1);
    assert.equal(output.unevaluatedRequirements.length, 1);
    assert.equal(output.campaignLintResults.length, 0);
  });

  it("preserves transcript when brief parsing fails", async () => {
    const output = await analyzeContent(
      input,
      dependencies({ parseBrief: async () => Promise.reject(new Error("provider")) }),
    );
    assert.equal(output.analysisStatus.transcription, "complete");
    assert.equal(output.analysisStatus.campaign, "unavailable");
    assert.equal(output.transcript?.text, transcript.text);
    assert.equal(output.campaign, null);
  });

  it("skips transcription entirely when no audio exists", async () => {
    let extractionCalled = false;
    let transcriptionCalled = false;
    const output = await analyzeContent(
      { ...input, audioPresent: false },
      dependencies({
        extractAudio: async () => {
          extractionCalled = true;
        },
        transcribe: async () => {
          transcriptionCalled = true;
          return transcript;
        },
      }),
    );
    assert.equal(output.analysisStatus.transcription, "no_audio");
    assert.equal(extractionCalled, false);
    assert.equal(transcriptionCalled, false);
  });

  it("skips campaign parsing when no brief was provided", async () => {
    let parserCalled = false;
    const output = await analyzeContent(
      { ...input, rawBrief: "" },
      dependencies({
        parseBrief: async () => {
          parserCalled = true;
          return parsedRequirements;
        },
      }),
    );
    assert.equal(output.analysisStatus.campaign, "not_requested");
    assert.equal(parserCalled, false);
    assert.equal(output.transcript?.segments.length, 1);
  });

  it("preserves Phase 2 results when visual analysis fails", async () => {
    const visualRequirement: CampaignRequirement = {
      id: "campaign-002",
      type: "visual_requirement",
      description: "Show the FocusFlow product",
    };
    const output = await analyzeContent(
      input,
      dependencies({
        parseBrief: async () => [...parsedRequirements, visualRequirement],
        extractFrames: async () => [
          { path: "/tmp/frame.jpg", timestampSeconds: 3 },
        ],
        analyzeVisual: async () => Promise.reject(new Error("provider")),
      }),
    );
    assert.equal(output.analysisStatus.transcription, "complete");
    assert.equal(output.analysisStatus.campaign, "complete");
    assert.equal(output.analysisStatus.visual, "unavailable");
    assert.equal(output.campaignLintResults[0].severity, "pass");
    assert.equal(output.unevaluatedRequirements[0].requirementId, "campaign-002");
  });
});
