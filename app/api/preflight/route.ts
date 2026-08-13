import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import {
  analyzeVisualFrames,
  parseCampaignBrief,
  transcribeAudio,
} from "@/lib/postlint/ai/gemini";
import { MediaProbeError, probeMedia } from "@/lib/postlint/media/ffprobe";
import { extractSpeechAudio } from "@/lib/postlint/media/audio";
import { extractVideoFrames } from "@/lib/postlint/media/frames";
import {
  runMediaLints,
  summarizeLints,
} from "@/lib/postlint/media/media-lints";
import { analyzeContent } from "@/lib/postlint/preflight/content-analysis";
import type {
  ApiError,
  PreflightReport,
  TargetPlatform,
} from "@/lib/postlint/types";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov"]);
const ALLOWED_MIME_TYPES = new Set(["video/mp4", "video/quicktime"]);
const TARGETS = new Set<TargetPlatform>(["tiktok", "instagram", "youtube"]);
const MAX_CAPTION_LENGTH = 10_000;
const MAX_BRIEF_LENGTH = 25_000;

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message } satisfies ApiError, { status });
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return errorResponse("Expected a multipart video upload.", 415);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES + 1_000_000) {
    return errorResponse("Video is too large. The local upload limit is 250 MB.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("The upload could not be read. Please try the file again.", 400);
  }

  const upload = formData.get("video");
  const targetValue = formData.get("target");
  const captionValue = formData.get("caption");
  const briefValue = formData.get("brief");

  if (!(upload instanceof File)) {
    return errorResponse("Select an MP4 or MOV video before running preflight.", 400);
  }

  if (typeof targetValue !== "string" || !TARGETS.has(targetValue as TargetPlatform)) {
    return errorResponse("Select a valid publishing target.", 400);
  }

  const caption = typeof captionValue === "string" ? captionValue.trim() : "";
  const rawBrief = typeof briefValue === "string" ? briefValue.trim() : "";
  if (caption.length > MAX_CAPTION_LENGTH) {
    return errorResponse("Caption is too long for this preflight.", 400);
  }
  if (rawBrief.length > MAX_BRIEF_LENGTH) {
    return errorResponse("Campaign brief is too long for this preflight.", 400);
  }

  const extension = extname(upload.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension) || !ALLOWED_MIME_TYPES.has(upload.type)) {
    return errorResponse("Unsupported file. PostLint currently accepts MP4 and MOV videos.", 415);
  }

  if (upload.size === 0) {
    return errorResponse("The selected video is empty.", 400);
  }

  if (upload.size > MAX_UPLOAD_BYTES) {
    return errorResponse("Video is too large. The local upload limit is 250 MB.", 413);
  }

  let temporaryDirectory: string | undefined;

  try {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "postlint-"));
    const temporaryPath = join(temporaryDirectory, `upload${extension}`);
    await writeFile(temporaryPath, Buffer.from(await upload.arrayBuffer()));

    const metadata = await probeMedia(temporaryPath);
    const target = targetValue as TargetPlatform;
    const mediaLintResults = runMediaLints(metadata, target);
    const contentAnalysis = await analyzeContent(
      {
        videoPath: temporaryPath,
        audioPath: join(temporaryDirectory, "speech.mp3"),
        audioPresent: metadata.audioPresent,
        caption,
        rawBrief,
        framesDirectory: join(temporaryDirectory, "frames"),
        durationSeconds: metadata.durationSeconds,
      },
      {
        extractAudio: extractSpeechAudio,
        transcribe: transcribeAudio,
        parseBrief: parseCampaignBrief,
        extractFrames: extractVideoFrames,
        analyzeVisual: analyzeVisualFrames,
      },
    );
    const lintResults = [
      ...mediaLintResults,
      ...contentAnalysis.campaignLintResults,
      ...contentAnalysis.visualLintResults,
    ];
    const report: PreflightReport = {
      filename: upload.name,
      target,
      metadata,
      transcript: contentAnalysis.transcript,
      campaign: contentAnalysis.campaign,
      visualAnalysis: contentAnalysis.visualAnalysis,
      lintResults,
      unevaluatedRequirements: contentAnalysis.unevaluatedRequirements,
      analysisStatus: contentAnalysis.analysisStatus,
      summary: summarizeLints(lintResults),
    };

    return Response.json(report);
  } catch (error) {
    if (error instanceof MediaProbeError) {
      return errorResponse(error.message, 422);
    }
    console.error("PostLint preflight failed", error);
    return errorResponse("Preflight failed unexpectedly. Please try again.", 500);
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true }).catch((error) => {
        console.error("PostLint temporary-file cleanup failed", error);
      });
    }
  }
}
