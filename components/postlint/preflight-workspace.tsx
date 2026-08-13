"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { buildFixPackage } from "@/lib/postlint/fixes/fix-package";
import type { FixItem } from "@/lib/postlint/fixes/fix-package";
import type { UploadConfig } from "@/lib/postlint/config/upload";
import type {
  ApiError,
  LintResult,
  LintSeverity,
  PreflightReport,
  TargetPlatform,
  Transcript,
  UnevaluatedRequirement,
  VisualCheckResult,
} from "@/lib/postlint/types";
import {
  AlertIcon,
  ArrowIcon,
  CheckIcon,
  ClockIcon,
  FilmIcon,
  SoundIcon,
  UploadIcon,
  XIcon,
} from "@/components/postlint/icons";

const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];
const PROCESSING_STAGES = [
  "Inspecting media",
  "Transcribing audio",
  "Parsing campaign",
  "Checking requirements",
  "Inspecting visual evidence",
  "Building report",
] as const;

const FOCUSFLOW_DEMO_CAPTION =
  "FocusFlow helps me stay on track. Get 15% off with code FLOW15.";
const FOCUSFLOW_DEMO_BRIEF = `Sponsored FocusFlow campaign.
Mention FocusFlow and include the promo code FLOW20.
State that viewers receive 20% off.
Include a clear sponsorship disclosure and a simple call to action.
Show the FocusFlow product or logo clearly.
Do not use the phrase “guaranteed results.”`;

const targets: Array<{
  id: TargetPlatform;
  name: string;
  shortName: string;
}> = [
  { id: "tiktok", name: "TikTok", shortName: "TT" },
  { id: "instagram", name: "Instagram Reels", shortName: "IG" },
  { id: "youtube", name: "YouTube Shorts", shortName: "YT" },
];

function getFileError(file: File, uploadConfig: UploadConfig): string | null {
  const lowerName = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return "Choose an MP4 or MOV video file.";
  }
  if (file.size > uploadConfig.maxUploadBytes) {
    return `That video is over the allowed limit. ${uploadConfig.label}.`;
  }
  if (file.size === 0) return "That video file is empty.";
  return null;
}

async function copyText(text: string): Promise<void> {
  if (!navigator.clipboard) {
    throw new Error("Clipboard access is unavailable in this browser.");
  }
  await navigator.clipboard.writeText(text);
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds - minutes * 60;
  return minutes > 0
    ? `${minutes}:${remaining.toFixed(1).padStart(4, "0")}`
    : `${remaining.toFixed(1)}s`;
}

function formatTimestamp(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function severityDetails(severity: LintSeverity) {
  if (severity === "pass") {
    return { label: "Pass", icon: CheckIcon, color: "emerald" };
  }
  if (severity === "warning") {
    return { label: "Warning", icon: AlertIcon, color: "amber" };
  }
  return { label: "Fail", icon: XIcon, color: "red" };
}

function LintCard({
  result,
  index,
  onSeek,
}: {
  result: LintResult;
  index: number;
  onSeek: (seconds: number) => void;
}) {
  const details = severityDetails(result.severity);
  const Icon = details.icon;

  return (
    <article className={`lint-card lint-card--${details.color}`}>
      <div className={`lint-icon lint-icon--${details.color}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className={`severity severity--${details.color}`}>
            {details.label}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
            PL-{String(index + 1).padStart(3, "0")}
          </span>
        </div>
        <h3 className="text-[15px] font-semibold text-slate-900">{result.title}</h3>
        {result.timestampStart !== undefined && (
          <button
            className="timestamp-pill timestamp-button"
            type="button"
            onClick={() => onSeek(result.timestampStart!)}
            aria-label={`Seek video to ${formatTimestamp(result.timestampStart)}`}
          >
            {formatTimestamp(result.timestampStart)}
            {result.timestampEnd !== undefined &&
              `–${formatTimestamp(result.timestampEnd)}`}
            <span>approx.</span>
          </button>
        )}
        <p className="mt-1 text-sm leading-6 text-slate-600">{result.message}</p>
        {(result.expected || result.detected) && (
          <div className="evidence-grid">
            {result.expected && (
              <div>
                <span>Expected</span>
                <strong>{result.expected}</strong>
              </div>
            )}
            {result.detected && (
              <div>
                <span>Detected</span>
                <strong>{result.detected}</strong>
              </div>
            )}
          </div>
        )}
        {result.evidence && (
          <blockquote className="evidence-quote">“{result.evidence}”</blockquote>
        )}
        {result.suggestion && (
          <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm leading-5 text-slate-500">
            <span className="font-semibold text-slate-700">Suggested fix:</span>{" "}
            {result.suggestion}
          </p>
        )}
      </div>
    </article>
  );
}

function VisualCheckCard({
  check,
  index,
  onSeek,
}: {
  check: VisualCheckResult;
  index: number;
  onSeek: (seconds: number) => void;
}) {
  const state =
    check.status === "pass"
      ? { color: "emerald", label: "Pass · Visual", icon: CheckIcon }
      : check.status === "needs_review"
        ? { color: "violet", label: "Needs review · Visual", icon: AlertIcon }
        : { color: "slate", label: "Not verified · Visual", icon: XIcon };
  const Icon = state.icon;

  return (
    <article className={`lint-card lint-card--${state.color}`}>
      <div className={`lint-icon lint-icon--${state.color}`}>
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className={`severity severity--${state.color}`}>{state.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
            PL-{String(index + 1).padStart(3, "0")}
          </span>
          {check.confidence && (
            <span className="confidence-label">{check.confidence} confidence</span>
          )}
        </div>
        <h3 className="text-[15px] font-semibold text-slate-900">{check.title}</h3>
        {check.timestampStart !== undefined && (
          <button
            className="timestamp-pill timestamp-button"
            type="button"
            onClick={() => onSeek(check.timestampStart!)}
            aria-label={`Seek video to ${formatTimestamp(check.timestampStart)}`}
          >
            {formatTimestamp(check.timestampStart)}
            {check.timestampEnd !== undefined &&
              `–${formatTimestamp(check.timestampEnd)}`}
            <span>sampled frame</span>
          </button>
        )}
        <p className="mt-1 text-sm leading-6 text-slate-600">{check.message}</p>
        {check.evidence && (
          <blockquote className="evidence-quote">“{check.evidence}”</blockquote>
        )}
        {check.suggestion && (
          <p className="mt-3 border-l-2 border-slate-200 pl-3 text-sm leading-5 text-slate-500">
            <span className="font-semibold text-slate-700">Suggested fix:</span>{" "}
            {check.suggestion}
          </p>
        )}
      </div>
    </article>
  );
}

function UnevaluatedCard({
  requirement,
}: {
  requirement: UnevaluatedRequirement;
}) {
  return (
    <article className="lint-card lint-card--slate">
      <div className="lint-icon lint-icon--slate">
        <span className="font-mono text-xs font-bold">—</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="severity severity--slate">Not evaluated</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
            {requirement.requirementId}
          </span>
        </div>
        <h3 className="text-[15px] font-semibold text-slate-900">
          {requirement.description}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{requirement.reason}</p>
      </div>
    </article>
  );
}

function TranscriptSection({
  transcript,
  status,
  onSeek,
}: {
  transcript: Transcript | null;
  status: PreflightReport["analysisStatus"]["transcription"];
  onSeek: (seconds: number) => void;
}) {
  return (
    <section className="report-subsection">
      <div className="subsection-heading">
        <div>
          <p className="eyebrow">Transcript</p>
          <h2>Timestamped speech</h2>
        </div>
        {status === "complete" && (
          <span className="analysis-badge analysis-badge--ai">AI-interpreted</span>
        )}
      </div>

      {status === "unavailable" && (
        <div className="availability-note availability-note--warning">
          <AlertIcon className="size-4 shrink-0" />
          <div>
            <strong>Transcript analysis unavailable</strong>
            <p>The local media report was preserved. Campaign checks do not penalize missing provider output.</p>
          </div>
        </div>
      )}

      {status === "no_audio" && (
        <div className="availability-note">
          <SoundIcon className="size-4 shrink-0" />
          <div>
            <strong>No audio to transcribe</strong>
            <p>Gemini was not called because ffprobe found no audio stream.</p>
          </div>
        </div>
      )}

      {status === "complete" && transcript && transcript.segments.length === 0 && (
        <div className="availability-note">
          <SoundIcon className="size-4 shrink-0" />
          <div>
            <strong>No intelligible speech detected</strong>
            <p>The audio was analyzed, but no spoken transcript was returned.</p>
          </div>
        </div>
      )}

      {status === "complete" && transcript && transcript.segments.length > 0 && (
        <div className="transcript-list">
          {transcript.segments.map((segment, index) => (
            <div className="transcript-segment" key={`${segment.startSeconds}-${index}`}>
              <button
                type="button"
                onClick={() => onSeek(segment.startSeconds)}
                aria-label={`Seek video to transcript at ${formatTimestamp(segment.startSeconds)}`}
              >
                {formatTimestamp(segment.startSeconds)}–{formatTimestamp(segment.endSeconds)}
              </button>
              <p>{segment.text}</p>
            </div>
          ))}
          <p className="mt-4 text-[10px] leading-5 text-slate-400">
            Timestamps are Gemini estimates, rounded to the nearest second—not forced alignment.
          </p>
        </div>
      )}
    </section>
  );
}

function CampaignSection({
  report,
  onSeek,
}: {
  report: PreflightReport;
  onSeek: (seconds: number) => void;
}) {
  if (report.analysisStatus.campaign === "not_requested") return null;

  const campaignResults = report.lintResults.filter(
    (result) => result.category === "campaign",
  );
  const passes = campaignResults.filter((result) => result.severity === "pass").length;
  const failures = campaignResults.filter((result) => result.severity === "fail").length;
  const campaignUnevaluated = report.unevaluatedRequirements.filter(
    (requirement) => requirement.type !== "visual_requirement",
  );

  return (
    <section className="report-subsection report-subsection--campaign">
      <div className="subsection-heading campaign-heading">
        <div>
          <p className="eyebrow">Campaign preflight</p>
          <h2>Brief requirements</h2>
          <div className="provenance-row">
            <span className="analysis-badge analysis-badge--ai">
              AI-interpreted brief
            </span>
            <span className="analysis-badge analysis-badge--code">
              Deterministic checks
            </span>
          </div>
        </div>
        {report.campaign && (
          <div className="flex flex-wrap gap-2">
            <span className="mini-count mini-count--pass">{passes} pass</span>
            <span className="mini-count mini-count--fail">{failures} fail</span>
            <span className="mini-count mini-count--neutral">
              {campaignUnevaluated.length} not evaluated
            </span>
          </div>
        )}
      </div>

      {report.analysisStatus.campaign === "unavailable" && (
        <div className="availability-note availability-note--warning">
          <AlertIcon className="size-4 shrink-0" />
          <div>
            <strong>Campaign analysis unavailable</strong>
            <p>The media report and transcript remain available. No campaign result was fabricated.</p>
          </div>
        </div>
      )}

      {report.campaign && (
        <>
          <div className="brief-preview">
            <span>Interpreted brief</span>
            <p>{report.campaign.rawBrief}</p>
          </div>
          <div className="mt-5 space-y-3">
            {campaignResults.map((result, index) => (
              <LintCard
                key={result.id}
                result={result}
                index={index + 4}
                onSeek={onSeek}
              />
            ))}
            {campaignUnevaluated.map((requirement) => (
              <UnevaluatedCard
                key={requirement.requirementId}
                requirement={requirement}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function VisualSection({
  report,
  onSeek,
}: {
  report: PreflightReport;
  onSeek: (seconds: number) => void;
}) {
  const visualUnevaluated = report.unevaluatedRequirements.filter(
    (requirement) => requirement.type === "visual_requirement",
  );
  const checks = report.visualAnalysis?.checks ?? [];
  const wasRequested =
    checks.length > 0 ||
    visualUnevaluated.length > 0 ||
    report.analysisStatus.visual === "unavailable";
  if (!wasRequested) return null;

  const passes = checks.filter((check) => check.status === "pass").length;
  const reviews = checks.filter((check) => check.status !== "pass").length;

  return (
    <section className="report-subsection report-subsection--visual">
      <div className="subsection-heading campaign-heading">
        <div>
          <p className="eyebrow">Visual checks</p>
          <h2>Observed frame evidence</h2>
          <div className="provenance-row">
            <span className="analysis-badge analysis-badge--observed">
              AI-observed
            </span>
          </div>
        </div>
        {report.visualAnalysis && (
          <div className="flex flex-wrap gap-2">
            <span className="mini-count mini-count--pass">{passes} pass</span>
            <span className="mini-count mini-count--neutral">{reviews} review</span>
            <span className="mini-count mini-count--visual">
              {report.visualAnalysis.sampledFrameCount} frames
            </span>
          </div>
        )}
      </div>

      <p className="visual-method-note">
        AI-observed from representative frames. Only high-confidence visible evidence can pass automatically.
      </p>

      {report.analysisStatus.visual === "unavailable" && (
        <div className="availability-note availability-note--warning mt-4">
          <AlertIcon className="size-4 shrink-0" />
          <div>
            <strong>Visual analysis unavailable</strong>
            <p>Media, transcript, and deterministic campaign results were preserved.</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {checks.map((check, index) => (
          <VisualCheckCard
            key={check.id}
            check={check}
            index={report.lintResults.filter((result) => result.category !== "visual").length + index}
            onSeek={onSeek}
          />
        ))}
        {visualUnevaluated.map((requirement) => (
          <UnevaluatedCard
            key={requirement.requirementId}
            requirement={requirement}
          />
        ))}
      </div>
    </section>
  );
}

function VideoPreview({
  previewUrl,
  videoRef,
}: {
  previewUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  return (
    <section className="video-preview-section" id="video-preview">
      <div>
        <p className="eyebrow text-slate-300">Video preview</p>
        <h2>Inspect every finding in context</h2>
        <p>Click any timestamp in the report to jump to that moment.</p>
      </div>
      <div className="video-stage">
        <video
          ref={videoRef}
          src={previewUrl}
          controls
          playsInline
          preload="metadata"
          tabIndex={-1}
        >
          Your browser cannot preview this video format.
        </video>
      </div>
    </section>
  );
}

function FixCard({
  item,
  copyStatus,
  onCopy,
  onSeek,
}: {
  item: FixItem;
  copyStatus: string | null;
  onCopy: (text: string, id: string) => void;
  onSeek: (seconds: number) => void;
}) {
  return (
    <article className="fix-card">
        <div className="fix-card__heading">
          <div>
            <span className="fix-source">
              {item.provenance === "deterministic"
                ? "Deterministic finding"
                : "AI-observed evidence"}
            </span>
            <h3>{item.issue}</h3>
          </div>
          {item.timestampStart !== undefined && (
            <button
              className="timestamp-pill timestamp-button"
              type="button"
              onClick={() => onSeek(item.timestampStart!)}
            >
              {formatTimestamp(item.timestampStart)}
              {item.timestampEnd !== undefined &&
                `–${formatTimestamp(item.timestampEnd)}`}
            </button>
          )}
        </div>

        {(item.detected || item.expected) && (
          <div className="evidence-grid">
            {item.detected && (
              <div>
                <span>Detected</span>
                <strong>{item.detected}</strong>
              </div>
            )}
            {item.expected && (
              <div>
                <span>Expected</span>
                <strong>{item.expected}</strong>
              </div>
            )}
          </div>
        )}

        <p className="fix-recommendation">
          <span>Recommended fix</span>
          {item.recommendedFix}
        </p>

        {item.replacementText && (
          <div className="replacement-row">
            <code>{item.replacementText}</code>
            <button
              type="button"
              onClick={() => onCopy(item.replacementText!, item.id)}
            >
              {copyStatus === item.id ? "Copied" : "Copy fix"}
            </button>
          </div>
        )}
    </article>
  );
}

function FixPackageSection({
  report,
  onSeek,
}: {
  report: PreflightReport;
  onSeek: (seconds: number) => void;
}) {
  const fixPackage = buildFixPackage(report);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function handleCopy(text: string, id: string) {
    try {
      await copyText(text);
      setCopyStatus(id);
      window.setTimeout(() => setCopyStatus(null), 1_800);
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section className="report-subsection fix-package">
      <div className="subsection-heading campaign-heading">
        <div>
          <p className="eyebrow">Fix Package</p>
          <h2>Actionable handoff</h2>
          <p className="provenance-line">
            Generated from this report only. No additional AI analysis.
          </p>
        </div>
        {fixPackage.items.length > 0 && (
          <button
            type="button"
            className="copy-all-button"
            onClick={() => handleCopy(fixPackage.copyAllText, "all")}
          >
            {copyStatus === "all" ? "Copied all fixes" : "Copy all fixes"}
          </button>
        )}
      </div>

      {copyStatus === "error" && (
        <p className="copy-error" role="status">
          Clipboard access was blocked. Copy the replacement text manually.
        </p>
      )}

      {fixPackage.items.length === 0 ? (
        <div className="availability-note">
          <CheckIcon className="size-4 shrink-0" />
          <div>
            <strong>No actionable fixes</strong>
            <p>Evaluated checks passed without warnings or failures.</p>
          </div>
        </div>
      ) : (
        <div className="fix-list">
          {fixPackage.items.map((item) => (
            <FixCard
              item={item}
              copyStatus={copyStatus}
              key={item.id}
              onCopy={handleCopy}
              onSeek={onSeek}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Report({
  report,
  previewUrl,
  videoRef,
  onSeek,
}: {
  report: PreflightReport;
  previewUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSeek: (seconds: number) => void;
}) {
  const targetName = targets.find((target) => target.id === report.target)?.name;
  const hasFailures = report.summary.failures > 0;
  const hasWarnings = report.summary.warnings > 0;
  const verdict = hasFailures
    ? "Changes needed"
    : hasWarnings
      ? "Review recommended"
      : "Preflight passed";
  const mediaResults = report.lintResults.filter(
    (result) => result.category === "media",
  );
  const visualReviewCount =
    report.visualAnalysis?.checks.filter((check) => check.status !== "pass").length ?? 0;
  const nonScoringCount = report.unevaluatedRequirements.length + visualReviewCount;
  const completedCheckCount = report.lintResults.length + nonScoringCount;

  const metadata = [
    {
      label: "Resolution",
      value: `${report.metadata.width} × ${report.metadata.height}`,
      sub: report.metadata.aspectRatioLabel,
      icon: FilmIcon,
    },
    {
      label: "Duration",
      value: formatDuration(report.metadata.durationSeconds),
      sub: report.metadata.fps ? `${report.metadata.fps.toFixed(2)} fps` : "Frame rate N/A",
      icon: ClockIcon,
    },
    {
      label: "Video codec",
      value: report.metadata.videoCodec.toUpperCase(),
      sub: formatBytes(report.metadata.fileSizeBytes),
      icon: FilmIcon,
    },
    {
      label: "Audio",
      value: report.metadata.audioPresent ? "Detected" : "No stream",
      sub: report.metadata.audioCodec?.toUpperCase() ?? "Silent export",
      icon: SoundIcon,
    },
  ];

  return (
    <section className="report-enter scroll-mt-6" id="report" aria-live="polite">
      <div className="report-header">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
            <FilmIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">{report.filename}</p>
              <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:inline">
                {targetName}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">Media and content preflight complete</p>
          </div>
        </div>
        <span
          className={`verdict ${hasFailures ? "verdict--fail" : hasWarnings ? "verdict--warning" : "verdict--pass"}`}
        >
          {verdict}
        </span>
      </div>

      <div className="metadata-grid">
        {metadata.map((item) => {
          const Icon = item.icon;
          return (
            <div className="metadata-item" key={item.label}>
              <div className="mb-4 flex items-center gap-2 text-slate-400">
                <Icon className="size-3.5" />
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em]">
                  {item.label}
                </span>
              </div>
              <p className="text-base font-semibold tracking-tight text-slate-900">{item.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.sub}</p>
            </div>
          );
        })}
      </div>

      <VideoPreview previewUrl={previewUrl} videoRef={videoRef} />

      <div className="report-body">
        <div className="summary-strip">
          <div>
            <p className="eyebrow">Lint summary</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {completedCheckCount} requirements checked
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="summary-chip summary-chip--pass">
              <CheckIcon className="size-3.5" />
              <strong>{report.summary.passes}</strong> pass
            </div>
            <div className="summary-chip summary-chip--warning">
              <AlertIcon className="size-3.5" />
              <strong>{report.summary.warnings}</strong> warning
            </div>
            <div className="summary-chip summary-chip--fail">
              <XIcon className="size-3.5" />
              <strong>{report.summary.failures}</strong> fail
            </div>
            {nonScoringCount > 0 && (
              <div className="summary-chip summary-chip--neutral">
                <strong>{nonScoringCount}</strong> review / not evaluated
              </div>
            )}
          </div>
        </div>

        <div className="mt-7 flex items-start justify-between gap-4 border-t border-slate-100 pt-6">
          <div>
            <p className="eyebrow">Media checks</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
              File validation
            </h2>
          </div>
          <span className="analysis-badge analysis-badge--code">
            Deterministic
          </span>
        </div>
        <div className="mt-6 space-y-3">
          {mediaResults.map((result, index) => (
            <LintCard
              key={result.id}
              result={result}
              index={index}
              onSeek={onSeek}
            />
          ))}
        </div>
      </div>
      <FixPackageSection report={report} onSeek={onSeek} />
      <CampaignSection report={report} onSeek={onSeek} />
      <VisualSection report={report} onSeek={onSeek} />
      <TranscriptSection
        transcript={report.transcript}
        status={report.analysisStatus.transcription}
        onSeek={onSeek}
      />
      <p className="border-t border-slate-100 px-6 py-5 text-center text-[11px] leading-5 text-slate-400">
        Results use PostLint MVP target checks—not universal platform or legal requirements.
      </p>
    </section>
  );
}

export function PreflightWorkspace({
  uploadConfig,
}: {
  uploadConfig: UploadConfig;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<TargetPlatform>("tiktok");
  const [caption, setCaption] = useState("");
  const [brief, setBrief] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingStageIndex, setProcessingStageIndex] = useState(0);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const submissionInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      requestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isAnalyzing) return;
    const interval = window.setInterval(() => {
      setProcessingStageIndex((current) =>
        Math.min(current + 1, PROCESSING_STAGES.length - 1),
      );
    }, 1_600);
    return () => window.clearInterval(interval);
  }, [isAnalyzing]);

  function chooseFile(nextFile: File) {
    if (isAnalyzing) return;
    const validationError = getFileError(nextFile, uploadConfig);
    setError(validationError);
    if (validationError) return;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    previewUrlRef.current = nextPreviewUrl;
    setPreviewUrl(nextPreviewUrl);
    setFile(nextFile);
    setReport(null);
  }

  function seekVideo(timestampSeconds: number) {
    const video = videoRef.current;
    if (!video) return;

    const seek = () => {
      const maximum = Number.isFinite(video.duration)
        ? Math.max(0, video.duration - 0.05)
        : timestampSeconds;
      video.currentTime = Math.min(Math.max(0, timestampSeconds), maximum);
      void video.play().catch(() => undefined);
    };

    if (video.readyState === 0) video.addEventListener("loadedmetadata", seek, { once: true });
    else seek();
    video.scrollIntoView({ behavior: "smooth", block: "center" });
    video.focus({ preventScroll: true });
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) chooseFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) chooseFile(nextFile);
  }

  async function runPreflight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current || isAnalyzing) return;
    if (!file) {
      setError("Select an MP4 or MOV video before running preflight.");
      inputRef.current?.focus();
      return;
    }

    const controller = new AbortController();
    submissionInFlightRef.current = true;
    requestRef.current = controller;
    setIsAnalyzing(true);
    setProcessingStageIndex(0);
    setError(null);
    setReport(null);

    const formData = new FormData();
    formData.append("video", file);
    formData.append("target", target);
    formData.append("caption", caption);
    formData.append("brief", brief);

    try {
      const response = await fetch("/api/preflight", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload = (await response.json()) as PreflightReport | ApiError;
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Preflight failed.");
      }
      setReport(payload);
      window.setTimeout(() => {
        document.getElementById("report")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Preflight failed unexpectedly. Please try again.",
      );
    } finally {
      if (requestRef.current === controller) {
        submissionInFlightRef.current = false;
        setIsAnalyzing(false);
        requestRef.current = null;
      }
    }
  }

  function loadFocusFlowDemo() {
    if (isAnalyzing) return;
    setCaption(FOCUSFLOW_DEMO_CAPTION);
    setBrief(FOCUSFLOW_DEMO_BRIEF);
    setTarget("tiktok");
    setDemoLoaded(true);
    setReport(null);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f9] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="logo-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span className="text-[17px] font-bold tracking-[-0.03em]">PostLint</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-slate-400">
              MVP
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Portable media runtime
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow mb-3">Pre-publication QA for social video</p>
          <h1 className="text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:text-[52px]">
            Preflight your content
            <br />
            <span className="text-slate-400">before you publish.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-500">
            Upload a draft and connect real media metadata, timestamped speech,
            campaign rules, and sampled visual evidence in one inspectable report.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_310px]">
          <form className="workspace-card" onSubmit={runPreflight}>
            <div className="workspace-section">
              <div className="section-heading">
                <span className="step-number">01</span>
                <div>
                  <h2>Upload draft</h2>
                  <p>Choose the exact export you plan to publish.</p>
                </div>
              </div>

              <div
                className={`dropzone ${isDragging ? "dropzone--active" : ""} ${file ? "dropzone--selected" : ""}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setIsDragging(false);
                  }
                }}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="sr-only"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  onChange={handleFileInput}
                  disabled={isAnalyzing}
                />
                {file ? (
                  <>
                    <div className="file-icon">
                      <FilmIcon className="size-6" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatBytes(file.size)} · Ready to analyze
                      </p>
                    </div>
                    <button
                      type="button"
                      className="change-file"
                      onClick={(event) => {
                        event.stopPropagation();
                        inputRef.current?.click();
                      }}
                      disabled={isAnalyzing}
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <>
                    <div className="upload-icon">
                      <UploadIcon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Drop your video here or <span className="text-indigo-600">browse</span>
                      </p>
                      <p className="mt-1.5 text-xs text-slate-400">
                        MP4 or MOV · {uploadConfig.label}
                      </p>
                    </div>
                  </>
                )}
              </div>
              <p className="upload-policy">{uploadConfig.label}</p>
            </div>

            <div className="workspace-section border-t border-slate-100">
              <div className="section-heading">
                <span className="step-number">02</span>
                <div>
                  <h2>Choose target</h2>
                  <p>Set the publishing context for this preflight.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {targets.map((option) => (
                  <label
                    className={`target-option ${target === option.id ? "target-option--selected" : ""}`}
                    key={option.id}
                  >
                    <input
                      type="radio"
                      name="target"
                      value={option.id}
                      checked={target === option.id}
                      onChange={() => setTarget(option.id)}
                      disabled={isAnalyzing}
                      className="sr-only"
                    />
                    <span className="platform-mark">{option.shortName}</span>
                    <span className="text-xs font-semibold">{option.name}</span>
                    <span className="target-check">
                      <CheckIcon className="size-3" />
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="workspace-section border-t border-slate-100">
              <div className="section-heading">
                <span className="step-number">03</span>
                <div>
                  <h2>Add context <span className="font-normal text-slate-400">(optional)</span></h2>
                    <p>Used for deterministic transcript and campaign checks.</p>
                </div>
              </div>
              <div className="demo-loader">
                <div>
                  <span>Built-in judging workflow</span>
                  <p>Populate the synthetic FocusFlow brief and caption.</p>
                </div>
                <button
                  type="button"
                  onClick={loadFocusFlowDemo}
                  disabled={isAnalyzing}
                >
                  {demoLoaded ? "FocusFlow demo loaded" : "Load FocusFlow demo"}
                </button>
              </div>
              {demoLoaded && (
                <p className="demo-note" role="status">
                  Demo context loaded. Select the synthetic FocusFlow video manually;
                  its output will run through the real pipeline.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  <span>Caption</span>
                  <textarea
                    value={caption}
                    onChange={(event) => {
                      setCaption(event.target.value);
                      setDemoLoaded(false);
                    }}
                    placeholder="Paste your post caption…"
                    rows={4}
                    disabled={isAnalyzing}
                  />
                </label>
                <label className="field-label">
                  <span>Campaign brief</span>
                  <textarea
                    value={brief}
                    onChange={(event) => {
                      setBrief(event.target.value);
                      setDemoLoaded(false);
                    }}
                    placeholder="Key message, constraints, audience…"
                    rows={4}
                    disabled={isAnalyzing}
                  />
                </label>
              </div>
            </div>

            {isAnalyzing && (
              <div className="processing-panel" aria-live="polite">
                <div className="processing-panel__heading">
                  <span className="spinner spinner--dark" />
                  <div>
                    <strong>{PROCESSING_STAGES[processingStageIndex]}</strong>
                    <p>Provider timing varies; exact percentages are not estimated.</p>
                  </div>
                </div>
                <ol>
                  {PROCESSING_STAGES.map((stage, index) => (
                    <li
                      className={index === processingStageIndex ? "is-active" : ""}
                      key={stage}
                    >
                      {stage}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Temporary processing · no permanent storage
              </p>
              <button className="run-button" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <span className="spinner" />
                    {PROCESSING_STAGES[processingStageIndex]}…
                  </>
                ) : (
                  <>
                    Run preflight
                    <ArrowIcon className="size-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <aside className="side-panel">
            <p className="eyebrow">Phase 1 + 2 + 3 + 4</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
              Evidence pipeline
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              PostLint inspects real media, transcribes speech, interprets the brief, then verifies objective requirements in code.
            </p>
            <ol className="checklist">
              {[
                ["Format", "Vertical / 9:16 target"],
                ["Resolution", "Quality baseline"],
                ["Duration", "90-second MVP limit"],
                ["Audio", "Stream presence"],
                ["Transcript", "Timestamped speech"],
                ["Campaign", "Deterministic compliance"],
                ["Visual", "Conservative frame evidence"],
              ].map(([title, description], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-500">
                Built for proof
              </p>
              <p className="mt-2 text-xs leading-5 text-indigo-950/70">
                AI interprets and observes. Deterministic gates decide what is safe to pass.
              </p>
            </div>
          </aside>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <AlertIcon className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Preflight couldn’t run</p>
              <p className="mt-0.5 text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {report && previewUrl && (
          <Report
            report={report}
            previewUrl={previewUrl}
            videoRef={videoRef}
            onSeek={seekVideo}
          />
        )}
      </div>
    </main>
  );
}
