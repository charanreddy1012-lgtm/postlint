import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

import { MediaProbeError, probeMedia } from "@/lib/postlint/media/ffprobe";
import {
  runMediaLints,
  summarizeLints,
} from "@/lib/postlint/media/media-lints";
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

  if (!(upload instanceof File)) {
    return errorResponse("Select an MP4 or MOV video before running preflight.", 400);
  }

  if (typeof targetValue !== "string" || !TARGETS.has(targetValue as TargetPlatform)) {
    return errorResponse("Select a valid publishing target.", 400);
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
    const lintResults = runMediaLints(metadata, target);
    const report: PreflightReport = {
      filename: upload.name,
      target,
      metadata,
      lintResults,
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
