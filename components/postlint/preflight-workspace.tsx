"use client";

import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useRef,
  useState,
} from "react";

import type {
  ApiError,
  LintResult,
  LintSeverity,
  PreflightReport,
  TargetPlatform,
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

const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".mp4", ".mov"];

const targets: Array<{
  id: TargetPlatform;
  name: string;
  shortName: string;
}> = [
  { id: "tiktok", name: "TikTok", shortName: "TT" },
  { id: "instagram", name: "Instagram Reels", shortName: "IG" },
  { id: "youtube", name: "YouTube Shorts", shortName: "YT" },
];

function getFileError(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return "Choose an MP4 or MOV video file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That video is over the 250 MB local upload limit.";
  }
  if (file.size === 0) return "That video file is empty.";
  return null;
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

function severityDetails(severity: LintSeverity) {
  if (severity === "pass") {
    return { label: "Pass", icon: CheckIcon, color: "emerald" };
  }
  if (severity === "warning") {
    return { label: "Warning", icon: AlertIcon, color: "amber" };
  }
  return { label: "Fail", icon: XIcon, color: "red" };
}

function LintCard({ result, index }: { result: LintResult; index: number }) {
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
        <p className="mt-1 text-sm leading-6 text-slate-600">{result.message}</p>
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

function Report({ report }: { report: PreflightReport }) {
  const targetName = targets.find((target) => target.id === report.target)?.name;
  const hasFailures = report.summary.failures > 0;
  const hasWarnings = report.summary.warnings > 0;
  const verdict = hasFailures
    ? "Changes needed"
    : hasWarnings
      ? "Review recommended"
      : "Preflight passed";

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
            <p className="mt-0.5 text-xs text-slate-500">Local media analysis complete</p>
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

      <div className="report-body">
        <div className="summary-strip">
          <div>
            <p className="eyebrow">Lint summary</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              {report.lintResults.length} checks completed
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
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {report.lintResults.map((result, index) => (
            <LintCard key={result.id} result={result} index={index} />
          ))}
        </div>
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          Results use PostLint MVP target checks—not universal platform requirements.
        </p>
      </div>
    </section>
  );
}

export function PreflightWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState<TargetPlatform>("tiktok");
  const [caption, setCaption] = useState("");
  const [brief, setBrief] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  function chooseFile(nextFile: File) {
    const validationError = getFileError(nextFile);
    setError(validationError);
    if (validationError) return;
    setFile(nextFile);
    setReport(null);
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
    if (!file) {
      setError("Select an MP4 or MOV video before running preflight.");
      inputRef.current?.focus();
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsAnalyzing(true);
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
        setIsAnalyzing(false);
        requestRef.current = null;
      }
    }
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
            ffprobe ready
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
            Upload a draft and run deterministic media checks against PostLint’s
            short-form targets. Real metadata, clear findings, no guesswork.
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
                      <p className="mt-1.5 text-xs text-slate-400">MP4 or MOV · Up to 250 MB</p>
                    </div>
                  </>
                )}
              </div>
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
                  <p>Saved for future content checks; not analyzed in Phase 1.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field-label">
                  <span>Caption</span>
                  <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Paste your post caption…"
                    rows={4}
                    disabled={isAnalyzing}
                  />
                </label>
                <label className="field-label">
                  <span>Campaign brief</span>
                  <textarea
                    value={brief}
                    onChange={(event) => setBrief(event.target.value)}
                    placeholder="Key message, constraints, audience…"
                    rows={4}
                    disabled={isAnalyzing}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Processed locally · uploads are temporary
              </p>
              <button className="run-button" type="submit" disabled={isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <span className="spinner" />
                    Inspecting media…
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
            <p className="eyebrow">Phase 1 checks</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
              Media fundamentals
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              PostLint reads the uploaded file with ffprobe and evaluates four deterministic rules.
            </p>
            <ol className="checklist">
              {[
                ["Format", "Vertical / 9:16 target"],
                ["Resolution", "Quality baseline"],
                ["Duration", "90-second MVP limit"],
                ["Audio", "Stream presence"],
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
                Every result below is generated from real video stream metadata—never mocked output.
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

        {report && <Report report={report} />}
      </div>
    </main>
  );
}
