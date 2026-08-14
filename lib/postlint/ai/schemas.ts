import { z } from "zod";

import type {
  BatchedVisualAnalysis,
  CampaignRequirement,
  DetectedVisualElement,
  Transcript,
} from "@/lib/postlint/types";

const transcriptSegmentSchema = z
  .object({
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().nonnegative(),
    text: z.string().trim().min(1).max(2_000),
  })
  .strict()
  .refine((segment) => segment.endSeconds >= segment.startSeconds, {
    message: "Segment end must not precede its start.",
  });

export const transcriptResponseSchema = z
  .object({
    text: z.string().max(50_000),
    segments: z.array(transcriptSegmentSchema).max(250),
  })
  .strict()
  .superRefine((transcript, context) => {
    for (let index = 1; index < transcript.segments.length; index += 1) {
      if (
        transcript.segments[index].startSeconds <
        transcript.segments[index - 1].startSeconds
      ) {
        context.addIssue({
          code: "custom",
          message: "Transcript segments must be chronological.",
          path: ["segments", index, "startSeconds"],
        });
      }
    }
  });

const requirementTypeSchema = z.enum([
  "sponsorship_disclosure",
  "required_mention",
  "required_phrase",
  "promo_code",
  "discount",
  "call_to_action",
  "prohibited_phrase",
  "visual_requirement",
  "other",
]);

const parsedRequirementSchema = z
  .object({
    type: requirementTypeSchema,
    description: z.string().trim().min(1).max(1_000),
    expectedText: z.string().trim().min(1).max(500).optional(),
    expectedValue: z.number().finite().nonnegative().optional(),
    expectedUnit: z.string().trim().min(1).max(100).optional(),
    aliases: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  })
  .strict();

export const campaignResponseSchema = z
  .object({
    requirements: z.array(parsedRequirementSchema).max(100),
  })
  .strict();

const visualEvaluationSchema = z
  .object({
    requirementId: z.string().trim().min(1).max(200),
    status: z.enum(["verified", "not_verified", "uncertain"]),
    evidence: z.string().trim().min(1).max(1_000).optional(),
    startSeconds: z.number().finite().nonnegative().optional(),
    endSeconds: z.number().finite().nonnegative().optional(),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict()
  .refine(
    (evaluation) =>
      evaluation.startSeconds === undefined ||
      evaluation.endSeconds === undefined ||
      evaluation.endSeconds >= evaluation.startSeconds,
    { message: "Visual evidence end must not precede its start." },
  );

const visualElementKindSchema = z.enum([
  "cta",
  "promo_code",
  "discount",
  "headline",
  "caption",
  "brand_text",
  "other_important_text",
]);

export const detectedVisualElementSchema = z
  .object({
    frameTimestampSeconds: z.number().finite().nonnegative(),
    kind: visualElementKindSchema,
    text: z.string().trim().min(1).max(1_000).optional(),
    box2d: z.tuple([
      z.number().finite().min(0).max(1000),
      z.number().finite().min(0).max(1000),
      z.number().finite().min(0).max(1000),
      z.number().finite().min(0).max(1000),
    ]),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict()
  .refine(
    (element) =>
      element.box2d[0] < element.box2d[2] &&
      element.box2d[1] < element.box2d[3],
    { message: "Visual element box must have positive width and height." },
  );

export const visualResponseSchema = z
  .object({
    evaluations: z.array(visualEvaluationSchema).max(100),
    visualElements: z.array(z.unknown()).max(200).optional().default([]),
  })
  .strict();

export const TRANSCRIPT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "segments"],
  properties: {
    text: {
      type: "string",
      description: "The full spoken transcript, preserving the wording in the audio.",
    },
    segments: {
      type: "array",
      description: "Chronological transcript segments with approximate timestamps.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["startSeconds", "endSeconds", "text"],
        properties: {
          startSeconds: { type: "number", minimum: 0 },
          endSeconds: { type: "number", minimum: 0 },
          text: { type: "string" },
        },
      },
    },
  },
} as const;

export const CAMPAIGN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["requirements"],
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "description"],
        properties: {
          type: {
            type: "string",
            enum: requirementTypeSchema.options,
          },
          description: { type: "string" },
          expectedText: { type: "string" },
          expectedValue: { type: "number", minimum: 0 },
          expectedUnit: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const VISUAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["evaluations", "visualElements"],
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["requirementId", "status", "confidence"],
        properties: {
          requirementId: { type: "string" },
          status: {
            type: "string",
            enum: ["verified", "not_verified", "uncertain"],
          },
          evidence: { type: "string" },
          startSeconds: { type: "number", minimum: 0 },
          endSeconds: { type: "number", minimum: 0 },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
        },
      },
    },
    visualElements: {
      type: "array",
      description:
        "Prominent creator-authored communication regions in sampled frames. box2d order is [ymin, xmin, ymax, xmax] on a 0–1000 grid.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "frameTimestampSeconds",
          "kind",
          "box2d",
          "confidence",
        ],
        properties: {
          frameTimestampSeconds: { type: "number", minimum: 0 },
          kind: { type: "string", enum: visualElementKindSchema.options },
          text: { type: "string" },
          box2d: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "number", minimum: 0, maximum: 1000 },
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
        },
      },
    },
  },
} as const;

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("The model response was not valid JSON.");
  }
}

export function validateTranscriptResponse(raw: string): Transcript {
  return transcriptResponseSchema.parse(parseJson(raw));
}

export function validateCampaignResponse(raw: string): CampaignRequirement[] {
  const parsed = campaignResponseSchema.parse(parseJson(raw));
  return parsed.requirements.map((requirement, index) => ({
    ...requirement,
    id: `campaign-${String(index + 1).padStart(3, "0")}`,
  }));
}

export function validateVisualResponse(
  raw: string,
): BatchedVisualAnalysis {
  const parsed = visualResponseSchema.parse(parseJson(raw));
  const detectedElements: DetectedVisualElement[] = [];
  for (const candidate of parsed.visualElements) {
    const result = detectedVisualElementSchema.safeParse(candidate);
    if (result.success) detectedElements.push(result.data);
  }
  return { evaluations: parsed.evaluations, detectedElements };
}
